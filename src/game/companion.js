export async function requestCompanionScene(context, signal) {
  const response = await fetch("/.netlify/functions/companion-scene", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(context),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) throw new Error(payload.error || "陪伴内容暂时不可用");
  return payload.data;
}

export async function requestCompanionStatus(signal) {
  const response = await fetch("/.netlify/functions/companion-scene", { signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) throw new Error(payload.error || "陪伴模型暂时不可用");
  return payload.data;
}

export async function requestCompanionChat(text, history = [], signal) {
  const response = await fetch("/.netlify/functions/companion-scene", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "chat", text, history }),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) throw new Error(payload.error || "雯宝暂时说不了话");
  return payload.data;
}
