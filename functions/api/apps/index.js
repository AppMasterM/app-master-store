
"use strict";

import { jsonResponse } from "../_utils.js";

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return jsonResponse(
      { error: "Database is not configured." },
      500
    );
  }

  try {
    const result = await env.DB.prepare(`
      SELECT
        apps.id,
        apps.name,
        apps.description,
        apps.category,
        apps.version,
        apps.file_size,
        apps.downloads,
        apps.sha256,
        apps.created_at,
        developers.display_name AS developer
      FROM apps
      JOIN developers
        ON developers.id = apps.developer_id
      WHERE apps.published = 1
      ORDER BY apps.created_at DESC
      LIMIT 200
    `).all();

    const apps = (result.results || []).map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      category: app.category,
      version: app.version,
      fileSize: app.file_size,
      downloads: app.downloads,
      sha256: app.sha256,
      createdAt: app.created_at,
      developer: app.developer,
      downloadUrl: `/api/apps/${encodeURIComponent(app.id)}/download`
    }));

    return jsonResponse({
      success: true,
      apps
    });
  } catch {
    return jsonResponse(
      { error: "Could not load published apps." },
      500
    );
  }
}
