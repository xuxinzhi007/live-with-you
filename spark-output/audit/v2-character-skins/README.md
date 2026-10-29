# V2 角色皮肤验收（390 × 844）

> 生成方式：headless Chrome 156 + CDP，设备模拟 390×844、DPR 2。
> 默认皮肤为「白色」（原来的她）；「小鲸鱼」为可切换的第二套外观。
> 图片为缩到 390px 宽的副本，原始截图在 `/tmp/wenbebi-skin-audit/`。

## 14 项检查

| 检查 | 结果 |
| --- | --- |
| 默认皮肤是 original（白色） | **PASS** |
| 顶栏头像使用白色皮肤 | **PASS** |
| 默认只加载 original 帧 | **PASS** |
| 外观选择器有两套皮肤 | **PASS** |
| 默认选中白色 | **PASS** |
| 切到小鲸鱼后写入存档 | **PASS** |
| 顶栏头像切成小鲸鱼 | **PASS** |
| 小鲸鱼帧已加载 | **PASS** |
| 刷新后仍是小鲸鱼 | **PASS** |
| 换皮后点角色有 toast + react 姿态 | **PASS** |
| 切回白色并写入存档 | **PASS** |
| 「更多」抽屉高度在预算内 | **PASS** |
| 控制台 0 错误/警告 | **PASS** |
| 页面 0 异常 | **PASS** |

## 截图索引

- `01-default-original-390x844.png`：默认进入：原来的白色雯宝
- `02-more-skins-390x844.png`：更多 → 角色外观：两套皮肤，默认选中白色
- `03-maid-selected-390x844.png`：点「小鲸鱼」后：头像与选中态切换
- `04-maid-scene-390x844.png`：关掉抽屉：场景中的小鲸鱼
- `05-maid-tap-390x844.png`：换皮后点角色仍有反应
- `06-maid-after-reload-390x844.png`：刷新后仍是小鲸鱼
- `07-original-again-390x844.png`：切回白色
- `08-original-after-reload-390x844.png`：刷新后仍是白色

原始数据：`report.json`。
