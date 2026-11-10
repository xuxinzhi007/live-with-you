# 骨骼系统评估调研报告

> 基于当前代码（`skeleton-system.ts` 677 行 / `paper-doll-rig.ts` 434 行）的真实实现分析。
> 目标：评估当前方案是否够用，以及如果要升级，真实可实现的路径是什么。

---

## 一、当前实现的真实状况

### 1.1 数据

```
关节数:     14 个（含 4 个插槽 socket）
骨骼数:     7 根（脊柱/头/左臂/右臂/左腿/右腿）
动画剪辑:   5 个（idle / tilt / wave / walk / cheer）
每帧驱动:   setState(animTime) 30fps 节流
渲染方式:   CSS transform: rotate() + translate()
身体切片:   已废弃（computeHumanoidPartSlices 返回 []）
配饰渲染:   SVG overlay 挂骨骼坐标
```

### 1.2 骨骼层级

```
pelvis（根）
  └── torso（胸腔）
        ├── neck → head → crown/hairSide（插槽）
        ├── shoulderL → handL（插槽）
        ├── shoulderR → handR（插槽）
        └── （脊柱本身）
  └── hipL → footL
  └── hipR → footR
```

### 1.3 动画原理

```typescript
// 每个动画剪辑返回 7 个数值（硬编码正弦波）
evaluateAnimClip("walk", t) → {
  torsoRot: sin(t*5.5) * 3.5,
  headRot:  sin(t*5.5-0.4) * 4,
  armLRot:  sin(t*5.5) * 18,
  armRRot: -sin(t*5.5) * 18,
  legLRot: -sin(t*5.5) * 20,
  legRRot:  sin(t*5.5) * 20,
  pelvisDy: |cos(t*5.5)| * -2.2,
}

// FK 求解：父关节角度累加到子关节
solveWorldSkeleton(skel, anim) → 每个关节的 worldAngle
```

---

## 二、当前方案的真实问题

### 问题 1：身体没有真正的骨骼蒙皮

当前的身体渲染**不是骨骼驱动的**。看这段代码：

```typescript
// WorldApp.tsx — 身体就是 4 张静态 PNG 叠在一起
<img className="nk-layer m-body" src={layeredUrls.body} />
<img className="nk-layer m-dress" src={layeredUrls.dress} />
<img className="nk-layer m-head" src={layeredUrls.head} />
<img className="nk-layer m-arms" src={layeredUrls.armsFront} />
```

这 4 张图**没有任何骨骼变形**。骨骼系统只用来：
- 计算配饰的挂点坐标（头发/手持/香氛）
- 在 rig 屏幕上画骨骼线给用户看

**真实评价：这不是骨骼动画，是"骨骼标注 + 静态贴图"。** 身体本身不会弯、不会扭、不会变形。

### 问题 2：动画是硬编码正弦波

```typescript
// 不是关键帧动画，是数学函数
torsoRot: Math.sin(t * 5.5) * 3.5
```

这意味着：
- 不能调 easing（缓动曲线）
- 不能加关键帧
- 不能做过渡混合（blend）
- 每个动作都是单一频率的正弦波，看起来机械

### 问题 3：性能瓶颈

```
setState(animTime) 30fps
  → React 重渲染整个 1700 行组件树
    → useMemo 重算 currentAnimOffsets
      → useMemo 重算 worldJoints
        → useMemo 重算 partSlices
          → 重新渲染所有 <img> 的 style
```

即使节流到 30fps，**React reconciliation 的开销仍然远大于直接操作 DOM**。低端手机会卡。

### 问题 4：没有 IK（逆运动学）

当前只有 FK（正向运动学）：父关节旋转 → 子关节跟着转。

没有 IK 意味着：
- 不能"把手放到某个位置"
- 不能"让脚跟着地面"
- 不能做物理碰撞（比如手不能穿过身体）

---

## 三、可选方案评估

### 方案 A：保持现状，只优化性能

**做什么**：把 `setState` 改成 `ref` + 直接 DOM 操作。

**改动范围**：
- `WorldApp.tsx` 动画循环（~30 行）
- 配饰渲染从 JSX style 改成 ref + `element.style.transform`（~50 行）

**优点**：
- 零依赖新增
- 1-2 天工作量
- 性能立即提升 3-5 倍

**缺点**：
- 动画质量不变（还是硬编码正弦波）
- 身体还是没有骨骼变形
- 后续想升级还是要重写

**真实评价**：**该做，但只是止痛药，不是治病。**

---

### 方案 B：引入 Spine（2D 骨骼动画行业标准）

**做什么**：用 Spine 编辑器制作骨骼动画，运行时渲染。

**技术栈**：
```
Spine Editor（付费 $69/月 或 $329 一次性）
  ↓ 导出 .json + .atlas + .png
spine-ts（运行时，npm: @esotericsoftware/spine-ts）
  ↓ WebGL 或 Canvas 渲染
React 组件包装
```

**改动范围**：
- 删除 `skeleton-system.ts`（677 行）
- 删除 `paper-doll-rig.ts`（434 行）
- 删除 `layered-stage.ts`（92 行）
- 新增 Spine 运行时 + React 绑定（~200 行）
- 所有换装/骨骼校准逻辑重写（~500 行）

**优点**：
- 行业标准，工具成熟
- 真正的骨骼蒙皮（身体可以弯、扭、变形）
- IK、蒙皮权重、关键帧动画、过渡混合全都有
- 性能极好（WebGL 渲染）

**缺点**：
- **Spine Editor 是付费软件**（$69/月 或 $329）
- 需要学习 Spine 编辑器（1-2 周上手）
- 需要重新制作所有骨骼数据（每套衣服一套骨骼）
- 当前 17 件 SVG 配饰全部要重新导入 Spine
- 换装逻辑要重写（Spine 的 skin/slot/attachment 机制）
- **工作量：3-4 周**

**真实评价**：**如果愿意付 Spine Editor 的钱 + 投入学习时间，这是最好的方案。但如果不想付费，不可行。**

---

### 方案 C：引入 PixiJS + pixi-spine（免费 Spine 运行时）

**做什么**：用 PixiJS 做渲染引擎，pixi-spine 做 Spine 运行时。

**技术栈**：
```
Spine Editor（还是需要付费编辑器来制作动画）
  ↓ 导出 .json + .atlas
pixi.js（渲染引擎，免费）
pixi-spine（Spine 运行时，免费）
  ↓ WebGL 渲染
React 组件包装
```

**优点**：
- 运行时免费
- 渲染性能极好
- 但**还是需要 Spine Editor 来制作动画**

**缺点**：
- 和方案 B 一样需要 Spine Editor
- 额外引入 PixiJS（~500KB）
- **工作量：3-4 周 + PixiJS 学习成本**

**真实评价**：**和方案 B 一样，省不了 Spine Editor 的钱。**

---

### 方案 D：DragonBones（免费 Spine 替代品）

**做什么**：用 DragonBones 替代 Spine，完全免费。

**技术栈**：
```
DragonBones Editor（免费开源）
  ↓ 导出 .ske.json + .tex.json
dragonbones.js（运行时，免费）
  ↓ Canvas 或 WebGL 渲染
```

**优点**：
- **完全免费**
- 功能接近 Spine（骨骼蒙皮、IK、关键帧动画）
- 编辑器是中文的，上手快

**缺点**：
- **项目已停止维护**（最后更新 2020 年）
- 运行时 dragonbones.js 有 bug 无人修
- 社区生态几乎为零
- 和 React 集成需要自己写绑定
- **风险：用了没人维护的技术，后续出问题自己扛**

**真实评价**：**免费但高风险。不建议用于生产项目。**

---

### 方案 E：自研 Canvas/WebGL 骨骼系统

**做什么**：用 Canvas 2D 或 WebGL 自己写骨骼蒙皮渲染。

**技术栈**：
```
自定义骨骼数据结构（JSON）
自定义蒙皮算法（线性混合蒙皮 LBS）
Canvas 2D 或 WebGL 渲染
React 组件包装
```

**改动范围**：
- 重写 `skeleton-system.ts`（从 677 行 → ~1500 行）
- 新增蒙皮渲染引擎（~800 行）
- 重写换装/骨骼校准逻辑（~500 行）

**优点**：
- 完全可控，无外部依赖
- 可以精确匹配项目需求
- 性能可以做到极好（WebGL）

**缺点**：
- **工作量巨大：4-6 周**
- 需要图形学知识（矩阵变换、蒙皮权重、UV 映射）
- 需要自己做编辑器（或者写 JSON 配置文件）
- 测试成本高（每种姿势都要验证蒙皮是否正确）
- **风险：自研系统 bug 多，边界情况难处理**

**真实评价**：**除非有图形学专家，否则不建议。投入产出比极低。**

---

### 方案 F：Live2D Cubism（二次元行业标准）

**做什么**：用 Live2D 做角色动画。

**技术栈**：
```
Live2D Cubism Editor（免费版可用，专业版付费）
  ↓ 导出 .moc3 + .model3.json
pixi-live2d-display（运行时，npm 免费）
  ↓ WebGL 渲染
React 组件包装
```

**优点**：
- **二次元行业标准**（碧蓝档案、少女前线都在用）
- 效果极好（自然的面部动画、物理模拟）
- 编辑器免费版够用
- pixi-live2d-display 是成熟的开源运行时

**缺点**：
- **和换装系统不兼容**：Live2D 是"一个角色一套模型"，换装 = 换整个模型
- 当前 17 件自由搭配的配饰系统**无法保留**
- 每套衣服需要单独制作 Live2D 模型（1-2 周/套）
- 换装闯关的核心玩法（自由搭配 5 槽位）**会死掉**

**真实评价**：**Live2D 适合"固定角色展示"，不适合"自由换装游戏"。和当前玩法冲突，不可行。**

---

### 方案 G：CSS 3D Transform 升级（当前方案的增强版）

**做什么**：保持 CSS transform，但把"硬编码正弦波"改成"关键帧动画系统"。

**技术栈**：
```
自定义关键帧数据结构
自定义插值引擎（lerp / bezier easing）
CSS transform 渲染（不变）
```

**改动范围**：
- 重写 `evaluateAnimClip`（从硬编码 switch → 关键帧插值，~200 行）
- 新增动画编辑器 UI（可视化调关键帧，~300 行）
- 动画循环改 ref + 直接 DOM（~50 行）

**优点**：
- 零依赖新增
- 保持现有渲染架构
- 可以做关键帧动画 + easing + 过渡混合
- 1-2 周工作量

**缺点**：
- 身体还是没有真正的骨骼蒙皮（还是静态 PNG）
- 性能不如 WebGL
- 复杂动画（比如弯腰+挥手同时）很难调

**真实评价**：**性价比最高的方案。能解决 80% 的问题，工作量只有 Spine 的 1/3。**

---

## 四、方案对比矩阵

| 方案 | 成本 | 效果 | 换装兼容 | 性能 | 风险 | 推荐度 |
|---|---|---|---|---|---|---|
| A: 只优化性能 | 1-2 天 | ⭐⭐ | ✅ | ⭐⭐⭐ | 低 | ⭐⭐⭐ |
| B: Spine | 3-4 周 + $329 | ⭐⭐⭐⭐⭐ | ✅ | ⭐⭐⭐⭐⭐ | 中 | ⭐⭐⭐⭐ |
| C: Pixi+Spine | 3-4 周 + $329 | ⭐⭐⭐⭐⭐ | ✅ | ⭐⭐⭐⭐⭐ | 中 | ⭐⭐⭐ |
| D: DragonBones | 3-4 周 | ⭐⭐⭐⭐ | ✅ | ⭐⭐⭐⭐ | **高** | ⭐⭐ |
| E: 自研 WebGL | 4-6 周 | ⭐⭐⭐⭐⭐ | ✅ | ⭐⭐⭐⭐⭐ | **高** | ⭐⭐ |
| F: Live2D | 2-3 周/套 | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐⭐⭐⭐ | 中 | ⭐ |
| **G: CSS 关键帧** | **1-2 周** | **⭐⭐⭐⭐** | **✅** | **⭐⭐⭐** | **低** | **⭐⭐⭐⭐⭐** |

---

## 五、真实建议

### 短期（本周）：方案 A + G 的第一步

**先做方案 A**（性能优化）：
```typescript
// 把 setState 改成 ref + 直接 DOM
const animClock = useRef({ t: 0 });
const dollRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  let raf = 0;
  const loop = (now: number) => {
    animClock.current.t = now / 1000;
    const offsets = evaluateAnimClip(animClip, animClock.current.t);
    const joints = solveWorldSkeleton(activeSkeletonRef.current, offsets);
    // 直接写 DOM，不经过 React
    applyJointsToDOM(dollRef.current, joints);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}, []);
```

**再做方案 G 的关键帧系统**：
```typescript
// 把硬编码 switch 改成关键帧插值
interface Keyframe {
  time: number;    // 秒
  value: number;   // 角度
  easing: "linear" | "easeIn" | "easeOut" | "easeInOut";
}

interface AnimClip {
  id: string;
  duration: number;
  loop: boolean;
  tracks: {
    torsoRot?: Keyframe[];
    headRot?: Keyframe[];
    armLRot?: Keyframe[];
    // ...
  };
}

// 插值引擎
function evaluateKeyframeTrack(track: Keyframe[], t: number): number {
  // 二分查找 + bezier easing 插值
}
```

### 中期（下月）：评估是否上 Spine

如果关键帧系统不够用了（比如需要身体弯曲、裙子飘动），再评估 Spine：

**上 Spine 的前提条件**：
1. 愿意付 $329 买 Spine Editor
2. 愿意花 1-2 周学习 Spine
3. 愿意花 2-3 周重新制作所有骨骼数据
4. 接受换装逻辑重写

**如果以上任何一条不满足，不要上 Spine。**

### 长期（下季度）：如果项目需要 3D 或更复杂动画

到时候再评估：
- **Three.js + Mixamo**：如果需要 3D 角色
- **Unity WebGL**：如果需要完整游戏引擎
- **自研 WebGL**：如果有图形学专家加入

---

## 六、一句话总结

> **当前骨骼系统不是"不够细"，是"根本不是真正的骨骼动画"——身体没有蒙皮，动画是硬编码正弦波。短期最优解是 CSS 关键帧系统（方案 G），长期如果需要身体变形再考虑 Spine（方案 B）。不要上 Live2D（杀死换装玩法），不要上 DragonBones（停止维护），不要自研 WebGL（投入产出比极低）。**
