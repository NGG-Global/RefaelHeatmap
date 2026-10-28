/** Anonymous per-browser ID: a random UUID in localStorage, in memory when storage is unavailable. */

const STORAGE_KEY = "ngg.deviceId";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memoryId: string | null = null;

export function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID needs a secure context and Safari 15.4+; getRandomValues does not.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getDeviceId(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && UUID_RE.test(stored)) return stored;
    const id = randomUuid();
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    memoryId ??= randomUuid();
    return memoryId;
  }
}
