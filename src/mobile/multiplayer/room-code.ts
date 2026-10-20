const STORAGE_KEY = "wenbebi-couple-room-id";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 规范化用户输入的短码（4 位） */
export function normalizeRoomCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

/** 生成易读短码（避开 0/O/1/I） */
export function createRoomCode(): string {
  let code = "";
  const rand = typeof crypto !== "undefined" && "getRandomValues" in crypto
    ? () => {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return buf[0]! / 2 ** 32;
      }
    : Math.random;
  for (let i = 0; i < 4; i += 1) {
    code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]!;
  }
  return code;
}

export function roomIdFromCode(code: string): string {
  const normalized = normalizeRoomCode(code);
  return `wb-${normalized}`;
}

export function displayCodeFromRoomId(roomId: string): string {
  return roomId.replace(/^wb-/i, "").toUpperCase();
}

export function isValidRoomCode(raw: string): boolean {
  return normalizeRoomCode(raw).length === 4;
}

function writeUrlRoom(roomId: string | null) {
  try {
    const url = new URL(window.location.href);
    if (roomId) url.searchParams.set("room", roomId);
    else url.searchParams.delete("room");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // ignore
  }
}

/** 启动时：URL ?room= > sessionStorage；无则 null（单人，不进房） */
export function readStoredRoomId(): string | null {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("room");
    if (fromQuery?.trim()) {
      const raw = fromQuery.trim();
      // 兼容旧默认房名与短码
      if (/^wb-/i.test(raw) || raw === "wenbebi-couple") return raw;
      if (isValidRoomCode(raw)) return roomIdFromCode(raw);
      return raw.slice(0, 64);
    }
  } catch {
    // ignore
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored?.trim()) return stored.trim().slice(0, 64);
  } catch {
    // ignore
  }
  return null;
}

export function persistRoomId(roomId: string | null) {
  try {
    if (roomId) sessionStorage.setItem(STORAGE_KEY, roomId);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  writeUrlRoom(roomId);
}
