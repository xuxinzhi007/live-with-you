# V2 角色动作验收（390 × 844）

> 生成方式：headless Chrome 156 + CDP，设备模拟 390×844、DPR 2。
> 默认角色为「白色」；本目录同时验证小鲸鱼皮肤在缺少 sit/sleep 帧时的回落。
> 图片为缩到 390px 宽的副本，原始截图在 `/tmp/wenbebi-pose-audit/`。

## 动作清单

| 皮肤 | 帧 | 数量 |
| --- | --- | --- |
| original（白色，默认） | idle / breathe×4 / walk×4 / react / sit / sleep / avatar | 13 |
| maid（小鲸鱼） | idle / breathe×4 / walk×4 / react / avatar | 11 |

## 11 项检查

| 检查 | 结果 |
| --- | --- |
| 待机呼吸帧有实际差异 | **PASS** |
| 点角色播 react 且有文案 | **PASS** |
| 床 → sleep | **PASS** |
| pose 结束回 idle | **PASS** |
| 书桌 → sit | **PASS** |
| 长椅 → sit | **PASS** |
| 花圃 → sit | **PASS** |
| 小鲸鱼缺 sleep 帧时回落且可交互 | **PASS** |
| 小鲸鱼动作结束回 idle | **PASS** |
| 控制台 0 错误/警告 | **PASS** |
| 页面 0 异常 | **PASS** |

## 像素级证据

| 对比 | 变化像素 | 说明 |
| --- | --- | --- |
| 待机 A vs 0.5s 后 B | 2.16% | 呼吸确实在动 |
| 待机 vs 躺下 | 60.66% | sleep 是明显不同的姿势 |
| 待机 vs 坐下 | 54.06% | sit 是明显不同的姿势 |
| 躺下 vs 坐下 | 55.04% | 两种姿势互不混淆 |
| reduced-motion A vs B | 0% | 关闭动态时完全静止 |

## 截图索引

- `01-idle-a.png`：待机呼吸：第 1 帧
- `02-idle-b.png`：待机呼吸：约 0.5 秒后
- `03-react.png`：点角色：短交互姿态
- `04-sleep.png`：床：躺下
- `05-sit-desk.png`：书桌：坐下
- `06-sit-bench.png`：街区长椅：坐下
- `07-garden-plot.png`：庭院花圃：蹲下照料
- `08-maid-bed.png`：小鲸鱼皮肤：无 sleep 帧时回落到 react 仍可交互
- `09-reduced-motion-a.png`：减少动态效果：待机不换帧（A）
- `09-reduced-motion-b.png`：减少动态效果：0.48 秒后完全一致（B）

原始数据：`report.json`。
