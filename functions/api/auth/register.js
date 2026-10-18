"use strict";

import {
  jsonResponse,
  randomHex,
  hashPassword,
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
      { error: "Send the registration form as JSON." },
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse(
      { error: "Invalid registration details." },
      400
    );
  }

  const displayName =
    typeof body.displayName === "string"
      ? body.displayName.trim()
      : "";

  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const password =
    typeof body.password === "string"
      ? body.password
      : "";

  if (displayName.length < 2 || displayName.length > 60) {
    return jsonResponse(
      { error: "Name must be between 2 and 60 characters." },
      400
    );
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return jsonResponse(
      { error: "Enter a valid email address." },
      400
    );
  }

  if (password.length < 12 || password.length > 128) {
    return jsonResponse(
      { error: "Password must be 12–128 characters long." },
      400
    );
  }

  const id = crypto.randomUUID();
  const salt = randomHex(16);

  try {
    const passwordHash = await hashPassword(password, salt);

    await env.DB.prepare(`
      INSERT INTO developers (
        id,
        display_name,
        email,
        password_salt,
        password_hash
      )
      VALUES (?, ?, ?, ?, ?)
    `)
      .bind(id, displayName, email, salt, passwordHash)
      .run();

    const session = await createSession(env, id);

    return jsonResponse(
      {
        success: true,
        message: "Developer account created successfully.",
        developer: {
          id,
          displayName,
          email
        }
      },
      201,
      {
        "Set-Cookie": session.cookie
      }
    );
  } catch (error) {
    // Log technical details privately for debugging.
    console.error("Developer registration failed:", error);

    const message = String(error?.message || "");

    if (
      message.includes("UNIQUE constraint failed") ||
      message.includes("developers.email")
    ) {
      return jsonResponse(
        { error: "An account with this email already exists." },
        409
      );
    }

    return jsonResponse(
      {
        error: "Account creation failed. Please try again."
      },
      500
    );
  }
  }
