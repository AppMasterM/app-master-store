"use strict";

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8"
  );
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

export function randomHex(byteCount = 32) {
  const bytes = crypto.getRandomValues(
    new Uint8Array(byteCount)
  );

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return toHex(digest);
}

export async function hashPassword(password, saltHex) {
  const salt = new Uint8Array(
    saltHex.match(/.{2}/g).map((part) => parseInt(part, 16))
  );

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const result = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 100000
    },
    key,
    256
  );

  return toHex(result);
}

export async function verifyPassword(password, saltHex, expectedHash) {
  const actualHash = await hashPassword(password, saltHex);

  if (
    typeof expectedHash !== "string" ||
    actualHash.length !== expectedHash.length
  ) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < actualHash.length; i++) {
    difference |= actualHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }

  return difference === 0;
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");

    if (separator < 0) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === name) return value;
  }

  return "";
}

const SESSION_COOKIE = "__Host-app_master_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

export async function createSession(env, developerId) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;

  await env.DB.prepare(`
    INSERT INTO sessions (
      token_hash,
      developer_id,
      expires_at
    )
    VALUES (?, ?, ?)
  `)
    .bind(tokenHash, developerId, expiresAt)
    .run();

  return {
    cookie:
      `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`
  };
}

export async function getSession(request, env) {
  if (!env.DB) return null;

  const token = getCookie(request, SESSION_COOKIE);

  if (!/^[a-f0-9]{64}$/.test(token)) return null;

  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);

  return await env.DB.prepare(`
    SELECT
      d.id,
      d.display_name,
      d.email,
      s.expires_at
    FROM sessions AS s
    JOIN developers AS d
      ON d.id = s.developer_id
    WHERE s.token_hash = ?
      AND s.expires_at > ?
    LIMIT 1
  `)
    .bind(tokenHash, now)
    .first();
}

export async function deleteSession(request, env) {
  if (!env.DB) return;

  const token = getCookie(request, SESSION_COOKIE);

  if (!/^[a-f0-9]{64}$/.test(token)) return;

  const tokenHash = await sha256Hex(token);

  await env.DB.prepare(`
    DELETE FROM sessions
    WHERE token_hash = ?
  `)
    .bind(tokenHash)
    .run();
}

export function clearSessionCookie() {
  return (
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  );
}
