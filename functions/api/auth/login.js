"use strict";

import {
  jsonResponse,
  verifyPassword,
  createSession
} from "../_utils.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return jsonResponse(
      { error: "Database is not configured." },
      500
    );
  }

  const contentType = request.headers.get("Content-Type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse(
      { error: "Send login details as JSON." },
      415
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { error: "Invalid JSON request." },
      400
    );
  }

  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const password =
    typeof body.password === "string"
      ? body.password
      : "";

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 1 ||
    password.length > 128
  ) {
    return jsonResponse(
      { error: "Invalid email or password." },
      400
    );
  }

  try {
    const developer = await env.DB.prepare(`
      SELECT
        id,
        display_name,
        email,
        password_salt,
        password_hash
      FROM developers
      WHERE email = ?
      LIMIT 1
    `)
      .bind(email)
      .first();

    if (!developer) {
      return jsonResponse(
        { error: "Invalid email or password." },
        401
      );
    }

    const valid = await verifyPassword(
      password,
      developer.password_salt,
      developer.password_hash
    );

    if (!valid) {
      return jsonResponse(
        { error: "Invalid email or password." },
        401
      );
    }

    const session = await createSession(
      env,
      developer.id
    );

    return jsonResponse(
      {
        success: true,
        message: "Login successful.",
        developer: {
          id: developer.id,
          displayName: developer.display_name,
          email: developer.email
        }
      },
      200,
      {
        "Set-Cookie": session.cookie
      }
    );
  } catch {
    return jsonResponse(
      { error: "Login failed. Please try again." },
      500
    );
  }
}
