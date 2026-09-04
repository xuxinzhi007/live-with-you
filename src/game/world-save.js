const WORLD_SNAPSHOT_KEY = "wenbebi-world-v1";
const DEVICE_ID_KEY = "wenbebi-device-id-v1";
const SYNC_URL = String(import.meta.env?.VITE_WENBEBI_SAVE_URL || "").trim().replace(/\/$/, "");

const CORE_KEYS = [
  "wenbebi-v1",
  "wenbebi-room-layout-v1",
  "wenbebi-room-state-v1",
  "wenbebi-toy-position-v1",
  "wenbebi-life-bag-v1",
  "wenbebi-balcony-garden-v1",
  "wenbebi-street-log-v1",
  "wenbebi-weather-v1",
  "wenbebi-life-journal-v1",
  "wenbebi-play-streak-v1",
  "wenbebi-today-story-v1",
];

let syncTimer = 0;
let syncInFlight = false;
let syncQueued = false;

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function deviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "ephemeral-device";
  }
}

export function collectWorldSnapshot() {
  const state = {};
  for (const key of CORE_KEYS) {
    const value = readJSON(key);
    if (value !== null) state[key] = value;
  }
  return { schemaVersion: 1, updatedAt: Date.now(), deviceId: deviceId(), state };
}

function persistSnapshot(snapshot) {
  try {
    localStorage.setItem(WORLD_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Legacy keys remain the source of truth when storage is full.
  }
}

async function sendSnapshot(snapshot) {
  if (!SYNC_URL || syncInFlight) return;
  syncInFlight = true;
  try {
    const response = await fetch(SYNC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: snapshot.deviceId, snapshot, clientUpdatedAt: snapshot.updatedAt }),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`save sync failed: ${response.status}`);
  } catch {
    // Sync is best effort; local play must never be blocked.
  } finally {
    syncInFlight = false;
    if (syncQueued) {
      syncQueued = false;
      queueWorldSnapshotSync();
    }
  }
}

export function queueWorldSnapshotSync() {
  const snapshot = collectWorldSnapshot();
  persistSnapshot(snapshot);
  if (!SYNC_URL) return;
  if (syncInFlight) {
    syncQueued = true;
    return;
  }
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => sendSnapshot(snapshot), 1200);
}

export function getWorldSnapshot() {
  return readJSON(WORLD_SNAPSHOT_KEY) || collectWorldSnapshot();
}
