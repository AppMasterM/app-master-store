
"use strict";

import {
  jsonResponse,
  getSession
} from "../_utils.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const APK_MIME_TYPE = "application/vnd.android.package-archive";
const BUCKET = "app-apks";

function validText(value, min, max) {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max
  );
}

function safeStoragePath(path) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function deleteStorageObject(env, objectKey) {
  const baseUrl = env.SUPABASE_URL.replace(/\/+$/, "");
  const url =
    `${baseUrl}/storage/v1/object/${BUCKET}/${safeStoragePath(objectKey)}`;

  await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`
    }
  });
}

export async function onRequestPost({ request, env }) {
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

  const origin = request.headers.get("Origin");

  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return jsonResponse(
          { error: "Cross-origin requests are not allowed." },
          403
        );
      }
    } catch {
      return jsonResponse(
        { error: "Invalid request origin." },
        403
      );
    }
  }

  const developer = await getSession(request, env).catch(() => null);

  if (!developer) {
    return jsonResponse(
      { error: "Please log in before uploading an app." },
      401
    );
  }

  const contentType = request.headers.get("Content-Type") || "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonResponse(
      { error: "Upload the app using a multipart form." },
      415
    );
  }

  const contentLength = Number(
    request.headers.get("Content-Length") || 0
  );

  if (contentLength > MAX_FILE_SIZE + 1024 * 1024) {
    return jsonResponse(
      { error: "The upload exceeds the 50 MB limit." },
      413
    );
  }

  let form;
  let file;

  try {
    form = await request.formData();
    file = form.get("file");
  } catch {
    return jsonResponse(
      { error: "Could not read the uploaded form." },
      400
    );
  }

  const name = form.get("name");
  const description = form.get("description");
  const category = form.get("category");
  const version = form.get("version");

  if (
    !validText(name, 2, 80) ||
    !validText(description, 10, 3000) ||
    !validText(category, 2, 40) ||
    !validText(version, 1, 40)
  ) {
    return jsonResponse(
      {
        error:
          "Enter a name (2–80 characters), description (10–3000), category (2–40), and version (1–40)."
      },
      400
    );
  }

  if (
    typeof File === "undefined" ||
    !(file instanceof File) ||
    file.size < 8 ||
    file.size > MAX_FILE_SIZE ||
    !file.name.toLowerCase().endsWith(".apk")
  ) {
    return jsonResponse(
      { error: "Choose a valid APK file no larger than 50 MB." },
      400
    );
  }

  if (
    file.type &&
    file.type !== APK_MIME_TYPE &&
    file.type !== "application/octet-stream"
  ) {
    return jsonResponse(
      { error: "The uploaded file has an unsupported file type." },
      400
    );
  }

  let bytes;

  try {
    bytes = await file.arrayBuffer();
  } catch {
    return jsonResponse(
      { error: "Could not read the APK file." },
      400
    );
  }

  const signature = new Uint8Array(bytes);

  // APKs are ZIP archives. This checks the basic ZIP signature only;
  // it does not prove the APK is safe or installable.
  if (
    signature[0] !== 0x50 ||
    signature[1] !== 0x4b ||
    !(
      (signature[2] === 0x03 && signature[3] === 0x04) ||
      (signature[2] === 0x05 && signature[3] === 0x06) ||
      (signature[2] === 0x07 && signature[3] === 0x08)
    )
  ) {
    return jsonResponse(
      { error: "The file does not have a valid ZIP/APK signature." },
      400
    );
  }

  let sha256;

  try {
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    sha256 = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return jsonResponse(
      { error: "Could not verify the uploaded file." },
      500
    );
  }

  const appId = crypto.randomUUID();
  const objectKey = `${developer.id}/${appId}.apk`;
  const baseUrl = env.SUPABASE_URL.replace(/\/+$/, "");
  const storageUrl =
    `${baseUrl}/storage/v1/object/${BUCKET}/${safeStoragePath(objectKey)}`;

  let uploaded = false;

  try {
    const storageResponse = await fetch(storageUrl, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        "Content-Type": APK_MIME_TYPE,
        "x-upsert": "false"
      },
      body: bytes
    });

    if (!storageResponse.ok) {
      return jsonResponse(
        { error: "Storage rejected the APK upload. Please try again." },
        502
      );
    }

    uploaded = true;

    await env.DB.prepare(`
      INSERT INTO apps (
        id,
        developer_id,
        name,
        description,
        category,
        version,
        r2_key,
        file_size,
        sha256,
        published
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `)
      .bind(
        appId,
        developer.id,
        name.trim(),
        description.trim(),
        category.trim(),
        version.trim(),
        objectKey,
        file.size,
        sha256
      )
      .run();

    return jsonResponse(
      {
        success: true,
        message: "App uploaded and published successfully.",
        app: {
          id: appId,
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          version: version.trim(),
          fileSize: file.size,
          sha256
        }
      },
      201
    );
  } catch {
    if (uploaded) {
      try {
        await deleteStorageObject(env, objectKey);
      } catch {
        // Do not expose storage credentials or internal errors.
      }
    }

    return jsonResponse(
      { error: "Upload failed. Please try again." },
      500
    );
  }
}
