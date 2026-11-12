/** 远端资源解析：优先小主机资源库；库未探活或不可用时回退到仓库 public 路径。 */
export const DEFAULT_ASSET_BASE_URL = "http://192.168.124.77:8788";

export function getAssetBaseUrl(): string {
  // Vite always provides import.meta.env; Node tests do not — keep local public/ paths there.
  const env = (import.meta as ImportMeta & { env?: { VITE_ASSET_BASE_URL?: string } }).env;
  if (!env) return "";
  const raw = env.VITE_ASSET_BASE_URL?.trim();
  if (raw === "") return "";
  return (raw ?? DEFAULT_ASSET_BASE_URL).replace(/\/$/, "");
}

export interface RemoteAssetRef {
  cat: "dress" | "part" | "card" | "icon" | "base" | "ui" | "world";
  name: string;
}

export type RemoteAssetState = "unknown" | "up" | "down";

let remoteState: RemoteAssetState = "unknown";
let probePromise: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

export function getRemoteAssetState(): RemoteAssetState {
  return remoteState;
}

export function subscribeRemoteAssets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setRemoteState(next: RemoteAssetState): void {
  if (remoteState === next) return;
  remoteState = next;
  for (const listener of listeners) listener();
}

/** 测试用：把探活状态拨回去。 */
export function resetRemoteAssetStateForTests(state: RemoteAssetState = "unknown"): void {
  remoteState = state;
  probePromise = null;
}

/** 把仓库里的 public 相对路径映射到远端分类文件名。 */
export function mapLocalAsset(localPath: string): RemoteAssetRef | null {
  const path = localPath.replace(/^\//, "");
  // Transparent dress layers for paper-doll stack (not the opaque whole-body Comfy nikki/dress-*.png).
  let match = path.match(/^assets\/characters\/parts\/dress\/(.+)$/);
  if (match) return { cat: "dress", name: match[1] };
  match = path.match(/^assets\/characters\/(original|maid)\/(.+)$/);
  if (match) return { cat: "base", name: `${match[1]}-${match[2]}` };
  match = path.match(/^assets\/nikki\/(dress-.+)$/);
  if (match) return { cat: "dress", name: match[1] };
  match = path.match(/^assets\/nikki\/(card-.+)$/);
  if (match) return { cat: "card", name: match[1] };
  match = path.match(/^assets\/nikki\/(item-.+)$/);
  if (match) return { cat: "part", name: match[1] };
  match = path.match(/^assets\/scenes\/(home|garden|street)\.webp$/);
  if (match) return { cat: "ui", name: `stage-${match[1]}.webp` };
  match = path.match(/^assets\/scenes\/(.+)$/);
  if (match) return { cat: "world", name: match[1] };
  if (path === "icon.svg" || path === "public/icon.svg") return { cat: "ui", name: "icon.svg" };
  return null;
}

export function isComfyDressSource(image: string): boolean {
  return image.startsWith("assets/nikki/dress-") || image.includes("/files/dress/");
}

/**
 * 库还没探活或探活失败时返回本地路径，保证首屏能马上显示角色。
 * 探活成功后才指向 8788；调用方应在 subscribe / generation 变化后重新 resolve。
 */
export function resolveAsset(localPath: string): string {
  const base = getAssetBaseUrl();
  const mapped = mapLocalAsset(localPath);
  if (base && mapped && remoteState === "up") {
    return `${base}/files/${mapped.cat}/${mapped.name}`;
  }
  return localPath;
}

/** 把远端 /files/{cat}/{name} URL 还原成本地 public 相对路径；还原不了则返回 null。 */
export function unmapRemoteAsset(src: string): string | null {
  if (!src) return null;
  if (!/^https?:\/\//i.test(src) && !src.startsWith("/files/")) {
    return src.startsWith("assets/") || src.startsWith("/assets/") ? src.replace(/^\//, "") : null;
  }
  try {
    const path = /^https?:\/\//i.test(src)
      ? new URL(src).pathname
      : src;
    const match = path.match(/\/files\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const cat = match[1];
    const name = decodeURIComponent(match[2]);
    if (cat === "base") {
      const baseMatch = name.match(/^(original|maid)-(.+)$/);
      if (baseMatch) return `assets/characters/${baseMatch[1]}/${baseMatch[2]}`;
    }
    if (cat === "dress") {
      if (name.startsWith("dress-")) return `assets/nikki/${name}`;
      return `assets/characters/parts/dress/${name}`;
    }
    if (cat === "card") return `assets/nikki/${name}`;
    if (cat === "part") return `assets/nikki/${name}`;
    if (cat === "ui") {
      const stage = name.match(/^stage-(home|garden|street)\.webp$/);
      if (stage) return `assets/scenes/${stage[1]}.webp`;
      if (name === "icon.svg") return "icon.svg";
    }
    if (cat === "world") return `assets/scenes/${name}`;
    return null;
  } catch {
    return null;
  }
}

/** 单张 <img> 远端失败时换成本地路径，不把整库打成 down（单文件缺失不应连坐）。 */
export function applyLocalAssetFallback(img: HTMLImageElement, localPath: string): void {
  if (!localPath || img.dataset.assetFallback === "1") return;
  const current = img.getAttribute("src") || "";
  const normalizedLocal = localPath.replace(/^\//, "");
  if (current === localPath || current.endsWith(normalizedLocal) || current.endsWith("/" + normalizedLocal)) {
    img.dataset.assetFallback = "1";
    return;
  }
  img.dataset.assetFallback = "1";
  img.src = localPath;
}

const PROBE_PATH = "/files/base/original-idle.webp";
const PROBE_TIMEOUT_MS = 2000;

/** 对 8788 做短超时探活。失败则本场会话走本地；成功则后续 resolveAsset 优先远端。 */
export function probeRemoteAssets(timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  if (remoteState === "up") return Promise.resolve(true);
  if (remoteState === "down") return Promise.resolve(false);
  if (probePromise) return probePromise;

  const base = getAssetBaseUrl();
  if (!base) {
    setRemoteState("down");
    return Promise.resolve(false);
  }
  if (typeof Image === "undefined") {
    setRemoteState("down");
    return Promise.resolve(false);
  }

  probePromise = new Promise<boolean>((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      img.onload = null;
      img.onerror = null;
      setRemoteState(ok ? "up" : "down");
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      finish(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };
    img.src = `${base}${PROBE_PATH}?_probe=${Date.now()}`;
  }).finally(() => {
    if (remoteState === "unknown") probePromise = null;
  });

  return probePromise;
}
