# 和你住在一起 · 雯宝的小屋

一个竖屏、单手的移动端小世界生活游戏。**玩家就是雯宝**：点地面走过去，点家具、花圃和门做事，种花、收花、踢球，把每天几分钟的游玩留在房间里。React + TypeScript + Vite + PixiJS。

手机上默认进入 V2 小世界；`?legacy` 打开旧的观察向界面，`?desktop` 打开桌面版。

## 怎么运行

本地开发：

```bash
npm install
npm run dev
```

手机与电脑连接同一 Wi-Fi 时，可用局域网模式测试：

```bash
npm run dev:lan
```

然后在手机浏览器打开电脑局域网地址，例如 `http://192.168.124.36:5173`。首次访问若被 Windows 防火墙拦截，请允许 Node.js/Vite 通过“专用网络”。

生产构建：

```bash
npm run build
```

Netlify 使用 `npm run build` 构建，并发布 `dist` 目录。图片资源位于 `public/assets`，在页面中统一以 `assets/...` 引用。

手机浏览器可通过“添加到主屏幕”把雯宝作为独立应用打开；清单与图标位于 `public/manifest.webmanifest` 和 `public/icon.svg`。当前不注册离线缓存，保证 Netlify 发布后始终使用最新版本。

## 可选：Ollama 陪伴内容

页面只请求同源 `/.netlify/functions/companion-scene`，不直连 Ollama。

本地开发（和 N100 同一局域网）：

```bash
copy .env.example .env
```

`.env` 里填：

```env
OLLAMA_BASE_URL=http://192.168.124.77:11434
OLLAMA_MODEL=qwen2.5:3b-instruct
```

然后 `npm run dev`。Vite 会代理这个函数。浏览器打开后，点「模型状态」，并可在侧栏「和雯宝说两句」里聊天。

## 存档策略

当前游戏把主要进度保存在浏览器本地，并会生成版本化世界快照。配置上传地址后，客户端可以尝试上传；但持久化重试队列、云端读档、账号跨设备同步和冲突处理尚未完整实现。当前也没有 Service Worker 缓存，因此断网后能否重新打开页面取决于浏览器是否仍保留已加载资源。

推荐的离线优先存档、N100/MySQL 安全边界和分阶段实施路线见 [离线优先存档与云同步设计](docs/offline-first-save-design.md)。现有匿名接口草案见 [存档接口原型契约](docs/backend-save-contract.md)。

## 在其他地方用网页聊天

浏览器不能直连家里的 `11434`。外网打开 Netlify 网页时，链路是：

```text
网页（HTTPS）→ Netlify Function → 云主机 :8787（带密钥）→ 已有隧道 → N100 Ollama
```

1. 阿里云安全组放行 TCP **8787**（不要放行 11434）。
2. 把 `server/ollama-gateway.py` 拷到云主机 `/root/wenbebi-ollama-gateway.py`，把 `server/wenbebi-ollama-gateway.service` 拷到 `/etc/systemd/system/`。
3. 生成密钥并写入 service 里的 `OLLAMA_API_TOKEN`，然后：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wenbebi-ollama-gateway
```

4. Netlify 环境变量填 `OLLAMA_BASE_URL=http://47.106.175.49:8787`、同一串 `OLLAMA_API_TOKEN`、`OLLAMA_MODEL=qwen2.5:3b-instruct`，再 Redeploy。

## 玩法（V2）

- 点地面：雯宝走过去（自动寻路到可行走带）。
- 点物件：走到它前面，底部出现一个情境按钮；再点按钮执行。
- 门：走到门口即切换房间。
- 小屋：床（休息）、书桌（阅读）、收藏架。
- 庭院：三块花圃（种 / 浇 / 收）、小皮球（踢 / 点球接住）。
- 街区：喷泉（许愿）、花摊（6 零钱买 2 颗种子）、长椅。
- 底栏：背包 / 手账 / 更多；聊天与多人不在主线。
- 角色外观：默认「白色」（原来的她），可在「更多 → 角色外观」切换成「小鲸鱼」（蓝白女仆）；选择写入存档。
- 角色动作：站立呼吸（4 帧）、走路（4 帧）、点她 / 短交互、坐下（书桌 / 长椅）、躺下（床）、花圃蹲下；`prefers-reduced-motion` 下只保留静帧。

## 代码入口

- `src/mobile/WorldApp.tsx`：页面、HUD、抽屉与提示。
- `src/mobile/world/runtime.ts`：移动、碰撞、走近、接球、镜头（纯 TS）。
- `src/mobile/world/rooms.ts`：房间与物件数据。
- `src/mobile/world/state.ts` / `actions.ts`：花圃、冷却、收集与动作结算。
- `src/mobile/world/WorldView.tsx`：Pixi 渲染与指针输入。
- `src/mobile/world/useWorldGame.ts`：存档读写与状态钩子。
- `src/mobile/world/skins.ts`：角色皮肤表（original / maid），统一的帧规格、姿势帧与头像路径。
- `src/mobile/world/poses.ts`：动作 → 姿态映射（床=躺下、椅子/书桌=坐下、其余=短交互）。
- `tools/build-character-assets.py`、`tools/build-scene-assets.py`：角色抠图/走路帧与房间、物件素材生成。
- `?legacy`：旧观察向移动端；`?desktop`：桌面版。

## 验证

```bash
npx tsc --noEmit
npm run build
node --experimental-strip-types --test tests/mobile-engine.test.mjs
```

`npm run test:mobile` 需要 Node ≥ 22.6（已在 `package.json` 的 `engines` 声明）；当前 23 个用例。

- 390×844 全流程验收（12 项检查 + 360/390/430 跨尺寸）：
  [spark-output/audit/v2-390x844](spark-output/audit/v2-390x844/README.md)
- 角色皮肤验收（14 项检查：默认白色、切换、刷新保留）：
  [spark-output/audit/v2-character-skins](spark-output/audit/v2-character-skins/README.md)
- 角色动作验收（11 项检查：呼吸、点她、坐下、躺下、蹲下、换皮回落、减少动态）：
  [spark-output/audit/v2-character-poses](spark-output/audit/v2-character-poses/README.md)

## 部署

```bash
npm run build
npx netlify-cli login
npx netlify-cli deploy --prod --dir=dist --functions=netlify/functions
```