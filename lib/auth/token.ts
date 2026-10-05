export const sessionCookieName = "tradezilla_session";
export const sessionMaxAge = 60 * 60 * 24 * 30;

type SessionPayload = { userId: string; expiresAt: number };

function encode(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function secret() {
  const value = process.env.AUTH_SECRET ?? process.env.DATABASE_URL;
  if (!value) throw new Error("AUTH_SECRET is not configured");
  return new TextEncoder().encode(value);
}

async function signature(payload: string) {
  const key = await crypto.subtle.importKey("raw", secret(), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return encode(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

async function signatureIsValid(payload: string, supplied: string) {
  try {
    const key = await crypto.subtle.importKey("raw", secret(), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return crypto.subtle.verify("HMAC", key, decode(supplied), new TextEncoder().encode(payload));
  } catch { return false; }
}

export async function createSessionToken(userId: string) {
  const payload = encode(JSON.stringify({ userId, expiresAt: Date.now() + sessionMaxAge * 1000 } satisfies SessionPayload));
  return `${payload}.${await signature(payload)}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra || !await signatureIsValid(payload, supplied)) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decode(payload))) as SessionPayload;
    return typeof parsed.userId === "string" && parsed.expiresAt > Date.now() ? parsed : null;
  } catch { return null; }
}
