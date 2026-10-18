
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

  try {
    const developer = await getSession(request, env);

    if (!developer) {
      return jsonResponse(
        {
          authenticated: false,
          developer: null
        },
        200
      );
    }

    return jsonResponse({
      authenticated: true,
      developer: {
        id: developer.id,
        displayName: developer.display_name,
        email: developer.email
      }
    });
  } catch {
    return jsonResponse(
      { error: "Could not check the login session." },
      500
    );
  }
}
