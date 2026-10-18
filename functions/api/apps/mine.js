"use strict";

import {
  jsonResponse,
  getSession
} from "../_utils.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return jsonResponse(
      { error: "Database is not configured." },
      500
    );
  }

  const developer = await getSession(request, env).catch(() => null);

  if (!developer) {
    return jsonResponse(
      { error: "Please log in to view your apps." },
      401
    );
  }

  try {
    const result = await env.DB.prepare(`
      SELECT
        id,
        name,
        description,
        category,
        version,
        file_size,
        sha256,
        published,
        downloads,
        created_at
      FROM apps
      WHERE developer_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `)
      .bind(developer.id)
      .all();

    const apps = (result.results || []).map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      category: app.category,
      version: app.version,
      fileSize: app.file_size,
      sha256: app.sha256,
      published: app.published === 1,
      downloads: app.downloads,
      createdAt: app.created_at,
      downloadUrl: app.published
        ? `/api/apps/${encodeURIComponent(app.id)}/download`
        : null
    }));

    return jsonResponse({
      success: true,
      apps
    });
  } catch {
    return jsonResponse(
      { error: "Could not load your apps." },
      500
    );
  }
}
