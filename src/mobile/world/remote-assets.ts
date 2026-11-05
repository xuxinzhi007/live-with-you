/** 远端资源解析：优先小主机资源库，不可用时回退到仓库 public 路径。 */
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

/** 把仓库里的 public 相对路径映射到远端分类文件名。 */
export function mapLocalAsset(localPath: string): RemoteAssetRef | null {
  const path = localPath.replace(/^\//, "");
  let match = path.match(/^assets\/characters\/(original|maid)\/(.+)$/);
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

export function resolveAsset(localPath: string): string {
  const base = getAssetBaseUrl();
  const mapped = mapLocalAsset(localPath);
  if (base && mapped) return `${base}/files/${mapped.cat}/${mapped.name}`;
  return localPath;
}