
"use strict";

import {
  jsonResponse,
  deleteSession,
  clearSessionCookie
} from "../_utils.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return jsonResponse(
      { error: "Database is not configured." },
      500
    );
  }

  try {
    await deleteSession(request, env);

    return jsonResponse(
      {
        success: true,
        message: "Logged out successfully."
      },
      200,
      {
        "Set-Cookie": clearSessionCookie()
      }
    );
  } catch {
    return jsonResponse(
      { error: "Logout failed. Please try again." },
      500
    );
  }
}
