"use strict";

import { jsonResponse } from "../../_utils.js";

const BUCKET = "app-apks";

function safeStoragePath(path) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export async function onRequestGet({ params, env }) {
  if (!env.DB) {
    return jsonResponse(
      { error: "Database is not configured." },
      500
    );
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return jsonResponse(
      { error: "File storage is not configured." },
      500
    );
  }

  const id = params.id;

  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return jsonResponse({ error: "App not found." }, 404);
  }

  let app;

  try {
    app = await env.DB.prepare(`
      SELECT id, name, r2_key, file_size
      FROM apps
      WHERE id = ? AND published = 1
      LIMIT 1
    `)
      .bind(id)
      .first();
  } catch {
    return jsonResponse(
      { error: "Could not find the app." },
      500
    );
  }

  if (!app) {
    return jsonResponse({ error: "App not found." }, 404);
  }

  const baseUrl = env.SUPABASE_URL.replace(/\/+$/, "");
  const objectUrl =
    `${baseUrl}/storage/v1/object/${BUCKET}/${safeStoragePath(app.r2_key)}`;

  let storageResponse;

  try {
    storageResponse = await fetch(objectUrl, {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`
      }
    });
  } catch {
    return jsonResponse(
      { error: "Could not retrieve the APK. Please try again." },
      502
    );
  }

  if (!storageResponse.ok || !storageResponse.body) {
    return jsonResponse(
      { error: "The APK file is currently unavailable." },
      502
    );
  }

  try {
    await env.DB.prepare(`
      UPDATE apps
      SET downloads = downloads + 1,
          updated_at = datetime('now')
      WHERE id = ? AND published = 1
    `)
      .bind(id)
      .run();
  } catch {
    await storageResponse.body.cancel().catch(() => {});
    return jsonResponse(
      { error: "Could not record the download." },
      500
    );
  }

  const safeName = String(app.name)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "android-app";

  const headers = new Headers({
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": `attachment; filename="${safeName}.apk"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  });

  if (app.file_size) {
    headers.set("Content-Length", String(app.file_size));
  }

  return new Response(storageResponse.body, {
    status: 200,
    headers
  });
}
