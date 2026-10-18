
const PASSWORD_ITERATIONS = 250000;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function randomHex(byteCount = 16) {
  const bytes = crypto.getRandomValues(
    new Uint8Array(byteCount)
  );

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password, saltHex) {
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
      iterations: PASSWORD_ITERATIONS
    },
    key,
    256
  );

  return toHex(result);
}

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

  if (
    displayName.length < 2 ||
    displayName.length > 60
  ) {
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

  let passwordHash;

  try {
    passwordHash = await hashPassword(password, salt);
  } catch {
    return jsonResponse(
      { error: "Could not securely process the password." },
      500
    );
  }

  try {
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
      201
    );
  } catch (error) {
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
      { error: "Account creation failed. Please try again." },
      500
    );
  }
    }
  
