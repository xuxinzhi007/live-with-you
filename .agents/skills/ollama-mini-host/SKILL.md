---
name: ollama-mini-host
description: 调用、诊断和接入局域网小主机上的 Ollama 模型，适用于雯宝 Companion 台词生成和连通性排查。
---

# 小主机 Ollama 调用 Skill（雯宝）

## 目标与边界

```text
浏览器  →  Vite 代理或 Netlify Function `/.netlify/functions/companion-scene`
                →  Ollama（N100 :11434）
```

- 浏览器不直连 Ollama，也不走 OpenClaw / Moe Social 的聊天协议。
- Ollama 只在局域网开放，不暴露公网。
- 陪伴生成默认 `qwen2.5:3b-instruct`（JSON 更稳、比 `qwen3:4b` 快）。不要假定模型一定存在，先查 `/api/tags`。
- 模型不可用时回退本地文案，不阻塞游戏。

## 当前仓库的配置

SSOT 是根目录 `.env`（gitignored），模板是 `.env.example`：

```env
OLLAMA_BASE_URL=http://192.168.124.77:11434
OLLAMA_MODEL=qwen2.5:3b-instruct
```

关键实现：

- `netlify/functions/companion-scene.mjs`：GET `/api/tags`，POST `/api/chat`。
- `vite.config.ts`：`npm run dev` 时把 `/.netlify/functions/companion-scene` 接到同一套 handler。
- `src/game/companion.js`：页面只请求上述同源函数。

## 标准调用流程

1. 小主机：`curl -fsS http://127.0.0.1:11434/api/tags` 且 `ollama list` 含配置中的模型名。
2. 开发机：`curl -fsS http://192.168.124.77:11434/api/tags`。
3. `npm run dev` 后：`curl -fsS http://127.0.0.1:5173/.netlify/functions/companion-scene`。
4. 页面点「模型状态」，并可用「和雯宝说两句」。

外网（Netlify）不要写局域网 IP。应让 Function 访问云主机网关：

```env
OLLAMA_BASE_URL=http://47.106.175.49:8787
OLLAMA_API_TOKEN=<与网关相同>
```

网关脚本：`server/ollama-gateway.py`。只转发 `/api/tags` 和 `/api/chat`，必须带 Bearer token。阿里云只放行 8787，不要放行 11434。

不要在应用启动时自动 `ollama pull`。

## 故障排查

1. 函数 503：未配置 `OLLAMA_BASE_URL`，检查 `.env` 后重启 Vite。
2. 函数 502：开发机访问不到 N100 `11434`，检查 Ollama 监听地址和防火墙。
3. 模型名对不上：用 `/api/tags` 返回的 `name` 原样写入 `OLLAMA_MODEL`。
4. `qwen3:4b` 很慢或 JSON 被思考内容弄坏：改回 `qwen2.5:3b-instruct`。
5. Netlify 线上 502：云函数访问不到家庭局域网，这是预期；不要为了雯宝把 `11434` 对公网放开。

## 完成判定

- 开发机可访问 N100 `/api/tags`。
- `npm run dev` 下 GET 函数返回模型列表。
- 页面「模型状态」显示已连接。
- Ollama 停止时页面提示未连接，游戏仍可玩。
