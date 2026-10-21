
"use strict";

import { jsonResponse, getSession } from "../_utils.js";

function validText(value, min, max) {
  return typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max;
}

export async function onRequestPatch({ request, env, params }) {
  if (!env.DB) {
    return jsonResponse({ error: "Database is not configured." }, 500);
  }

  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return jsonResponse(
          { error: "Cross-origin requests are not allowed." }, 403
        );
      }
    } catch {
      return jsonResponse({ error: "Invalid request origin." }, 403);
    }
  }

  const developer = await getSession(request, env).catch(() => null);
  if (!developer) {
    return jsonResponse({ error: "Please log in to edit your apps." }, 401);
  }

  const appId = params?.id;
  if (
    typeof appId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(appId)
  ) {
    return jsonResponse({ error: "Invalid app ID." }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Send the app details as JSON." }, 400);
  }

  const { name, description, category, version } = body || {};

  if (
    !validText(name, 2, 80) ||
    !validText(description, 10, 3000) ||
    !validText(category, 2, 40) ||
    !validText(version, 1, 40)
  ) {
    return jsonResponse({
      error: "Enter a name (2–80 characters), description (10–3000), category (2–40), and version (1–40)."
    }, 400);
  }

  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM apps WHERE id = ? AND developer_id = ? LIMIT 1"
    ).bind(appId, developer.id).first();

    if (!existing) {
      return jsonResponse({
        error: "App not found or you do not own it."
      }, 404);
    }

    await env.DB.prepare(`
      UPDATE apps
      SET name = ?, description = ?, category = ?, version = ?,
          updated_at = datetime('now')
      WHERE id = ? AND developer_id = ?
    `).bind(
      name.trim(),
      description.trim(),
      category.trim(),
      version.trim(),
      appId,
      developer.id
    ).run();

    return jsonResponse({
      success: true,
      message: "App details updated successfully.",
      app: {
        id: appId,
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        version: version.trim()
      }
    });
  } catch (error) {
    if (/unique constraint/i.test(String(error?.message || ""))) {
      return jsonResponse({
        error: "You already have an app with that name and version. Change the name or version."
      }, 409);
    }

    return jsonResponse({
      error: "Could not update the app. Please try again."
    }, 500);
  }
}
