# 和你住在一起 · 雯宝的小屋

一个和雯宝一起慢慢生活下去的移动端陪伴游戏。使用 React、TypeScript 和 Vite；状态图会自动切到对应动作。

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

网页始终以本地存档为准，游戏不会等待网络。运行时会把角色状态、房间布置、花园、资源、天气、今日片段和生活小记整理成一个版本化世界快照，写入 `wenbebi-world-v1`。

后端准备好匿名存档接口后，可在构建环境配置 `VITE_WENBEBI_SAVE_URL`。页面会在切后台、退出和定时保存时静默上传快照；上传失败不会影响离线游玩。照片数据暂不上传，避免把大体积图片塞进游戏存档。

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


更新项目
npm run build
第一次使用需要登录
npx netlify-cli login
部署远程
npx netlify-cli deploy --prod --dir=dist --functions=netlify/functions
