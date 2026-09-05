const DEFAULT_MODEL = "qwen2.5:3b-instruct";

function json(status, body) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

function envValue(env, key) {
  return String(env?.[key] || process.env[key] || "").trim();
}

function ollamaHeaders(env, extra = {}) {
  const token = envValue(env, "OLLAMA_API_TOKEN");
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function stripThink(content) {
  return String(content || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function parseModelJson(content) {
  const source = stripThink(content).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model did not return JSON");
  const parsed = JSON.parse(source.slice(start, end + 1));
  if (typeof parsed.line !== "string" || typeof parsed.storyTitle !== "string" || typeof parsed.journalCopy !== "string") {
    throw new Error("model response is incomplete");
  }
  return {
    line: parsed.line.slice(0, 120),
    storyTitle: parsed.storyTitle.slice(0, 40),
    journalCopy: parsed.journalCopy.slice(0, 180),
  };
}

export async function handleCompanion({ httpMethod, body, env = process.env }) {
  if (httpMethod !== "GET" && httpMethod !== "POST") return json(405, { ok: false, error: "只支持 GET 或 POST" });
  const baseUrl = envValue(env, "OLLAMA_BASE_URL").replace(/\/$/, "");
  if (!baseUrl) return json(503, { ok: false, error: "未配置 OLLAMA_BASE_URL" });
  const model = envValue(env, "OLLAMA_MODEL") || DEFAULT_MODEL;

  if (httpMethod === "GET") {
    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        headers: ollamaHeaders(env),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return json(502, { ok: false, error: `Ollama 返回 HTTP ${response.status}` });
      const payload = await response.json();
      const models = Array.isArray(payload?.models)
        ? payload.models.map((item) => ({
          name: typeof item?.name === "string" ? item.name : "未知模型",
          size: Number.isFinite(item?.size) ? item.size : 0,
          parameterSize: typeof item?.details?.parameter_size === "string" ? item.details.parameter_size : "",
        }))
        : [];
      return json(200, { ok: true, data: { model, models } });
    } catch (error) {
      return json(502, { ok: false, error: error instanceof Error ? error.message : "无法连接 Ollama" });
    }
  }

  let context;
  try {
    context = JSON.parse(body || "{}");
  } catch {
    return json(400, { ok: false, error: "请求上下文不是有效 JSON" });
  }

  const chatText = typeof context.text === "string" ? context.text.trim().slice(0, 400) : "";
  const isChat = context.mode === "chat" || chatText.length > 0;
  const history = Array.isArray(context.history)
    ? context.history
      .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .slice(-8)
      .map((item) => ({ role: item.role, content: item.content.trim().slice(0, 400) }))
    : [];

  const messages = isChat
    ? [
      { role: "system", content: "你是雯宝，住在小屋里的桌面宠物，不是人工智能、语言模型或聊天机器人。即使用户追问身份，也只用雯宝的口吻回答一两句中文：温柔、具体、不催促，不提问任务，不做心理诊断。不要自称模型、AI 或助手。" },
      ...history,
      { role: "user", content: chatText || "你好" },
    ]
    : [
      { role: "system", content: "你是雯宝小屋的克制型生活编剧。语气温柔、简短、留白，不做心理诊断，不制造依赖。" },
      {
        role: "user",
        content: `根据下面这份雯宝小屋的结构化状态，写一段安静、具体、不催促人的陪伴内容。不要提出任务，不要使用数字奖励，不要假装知道未提供的事实。只返回 JSON，不要 Markdown：{"line":"雯宝会说的一句话","storyTitle":"今天的小片段标题","journalCopy":"一条第三人称生活小记"}\n状态：${JSON.stringify(context).slice(0, 4000)}`,
      },
    ];

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: ollamaHeaders(env),
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages,
        options: { temperature: 0.72, num_predict: isChat ? 80 : 180 },
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) return json(502, { ok: false, error: `Ollama 返回 HTTP ${response.status}` });
    const payload = await response.json();
    const content = stripThink(payload?.message?.content);
    if (isChat) {
      if (!content) return json(502, { ok: false, error: "模型没有返回内容" });
      return json(200, { ok: true, data: { reply: content.slice(0, 240) } });
    }
    return json(200, { ok: true, data: parseModelJson(content) });
  } catch (error) {
    return json(502, { ok: false, error: error instanceof Error ? error.message : "模型调用失败" });
  }
}

export default async function handler(request) {
  const body = request.method === "POST" || request.method === "PUT"
    ? await request.text()
    : "";
  const result = await handleCompanion({
    httpMethod: request.method,
    body,
    env: process.env,
  });
  return new Response(result.body, {
    status: result.statusCode,
    headers: result.headers,
  });
}
