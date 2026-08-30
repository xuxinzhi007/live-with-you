# 桌面宠物 · 雯宝

网页版桌面宠物。使用 React、TypeScript 和 Vite；状态图会自动切到对应动作。

## 怎么运行

本地开发：

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

Netlify 使用 `npm run build` 构建，并发布 `dist` 目录。图片资源位于 `public/assets`，在页面中统一以 `assets/...` 引用。

手机浏览器可通过“添加到主屏幕”把雯宝作为独立应用打开；清单与图标位于 `public/manifest.webmanifest` 和 `public/icon.svg`。当前不注册离线缓存，保证 Netlify 发布后始终使用最新版本。

## 扩展入口

游戏的体验方向、横竖屏策略与上线验收标准见 [docs/game-direction.md](docs/game-direction.md)。

- `src/game/data/pet.js`：角色名称、精灵映射与台词。
- `src/game/data/room.js`：房间内可交互物件及其动作。
- `src/game/data/controls.js`：控制面板中的动作按钮。

新增内容应优先更新这些配置；只有出现新的运行机制时，才修改 `src/game` 中的核心模块。

## 状态图

| 动作 | 使用图片 |
|---|---|
| 待机 / 散步 / 挥手 | `assets/idle.webp` |
| 坐下（休息） | `assets/rest.webp` |
| 睡觉 | `assets/sleep.webp` |
| 跳跃 / 开心 | `assets/jump.webp` |

中文原图会留在本地，部署只用上面这些英文小图，手机上更稳。

## 操作

- 点地板：雯宝走过去
- 点头：摸摸，出爱心
- 点身体：挥手
- 连点三下：开心跳
- 拖起来再放下：落地；从很高处摔下会晕一下
- 丢玩具：她会跑去捡
- 方向键走动，空格跳，F 丢球
