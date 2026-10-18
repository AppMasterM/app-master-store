
"use strict";

/* =========================================================
   APP MASTER STORE — DEVELOPER CONSOLE
   Registration, login, session, APK upload and app management
   ========================================================= */

const API = {
  register: "/api/auth/register",
  login: "/api/auth/login",
  me: "/api/auth/me",
  logout: "/api/auth/logout",
  upload: "/api/apps/upload",
  mine: "/api/apps/mine"
};

const MAX_APK_SIZE = 50 * 1024 * 1024;

const $ = (id) => document.getElementById(id);

const notice = $("notice");
const authSection = $("auth-section");
const dashboardSection = $("dashboard-section");
const loginForm = $("login-form");
const registerForm = $("register-form");
const uploadForm = $("upload-form");
const uploadButton = $("upload-button");
const logoutButton = $("logout-button");
const refreshAppsButton = $("refresh-apps");
const myAppsContainer = $("my-apps");

let currentDeveloper = null;
let noticeTimer = null;

function showNotice(message, type = "info") {
  if (!notice) return;

  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }

  notice.textContent = message;
  notice.className = "dev-notice";

  if (type === "success") {
    notice.classList.add("success");
  } else if (type === "error") {
    notice.classList.add("error");
  }

  notice.hidden = false;
}

function clearNotice() {
  if (!notice) return;
  notice.textContent = "";
  notice.className = "dev-notice";
}

async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : `Request failed (${response.status}).`;

    throw new Error(message);
  }

  return data;
}

function setBusy(button, busy, busyText = "Please wait...") {
  if (!button) return;

  if (busy) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

function showAuth() {
  if (authSection) authSection.hidden = false;
  if (dashboardSection) dashboardSection.hidden = true;
  currentDeveloper = null;
}

function showDashboard(developer) {
  if (!developer || typeof developer !== "object") {
    showAuth();
    return;
  }

  currentDeveloper = developer;

  if (authSection) authSection.hidden = true;
  if (dashboardSection) dashboardSection.hidden = false;

  const nameElement = $("developer-name");
  const emailElement = $("developer-email");

  if (nameElement) {
    nameElement.textContent = developer.displayName || "Developer";
  }

  if (emailElement) {
    emailElement.textContent = developer.email || "";
  }

  loadMyApps();
}

function switchAuthTab(tabName) {
  const loginTab = $("login-tab");
  const registerTab = $("register-tab");

  if (loginTab) {
    const active = tabName === "login";
    loginTab.classList.toggle("active", active);
    loginTab.setAttribute("aria-selected", String(active));
  }

  if (registerTab) {
    const active = tabName === "register";
    registerTab.classList.toggle("active", active);
    registerTab.setAttribute("aria-selected", String(active));
  }

  const loginPanel = $("login-panel");
  const registerPanel = $("register-panel");

  if (loginPanel) loginPanel.hidden = tabName !== "login";
  if (registerPanel) registerPanel.hidden = tabName !== "register";
}

function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return "Unknown size";
  }

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function createChip(text) {
  const chip = document.createElement("span");
  chip.className = "dev-chip";
  chip.textContent = text;
  return chip;
}

function renderMyApps(apps) {
  if (!myAppsContainer) return;

  myAppsContainer.replaceChildren();

  if (!Array.isArray(apps) || apps.length === 0) {
    const empty = document.createElement("p");
    empty.className = "dev-empty";
    empty.textContent =
      "You haven't uploaded any apps yet. Upload your first APK above.";
    myAppsContainer.appendChild(empty);
    return;
  }

  for (const app of apps) {
    if (!app || typeof app !== "object") continue;

    const card = document.createElement("article");
    card.className = "dev-app-card";

    const title = document.createElement("h3");
    title.textContent = app.name || "Untitled app";
    card.appendChild(title);

    const description = document.createElement("p");
    description.textContent = app.description || "No description provided.";
    card.appendChild(description);

    const metadata = document.createElement("div");
    metadata.className = "dev-app-meta";

    metadata.appendChild(
      createChip(`Category: ${app.category || "Other"}`)
    );

    metadata.appendChild(
      createChip(`Version: ${app.version || "Unknown"}`)
    );

    metadata.appendChild(
      createChip(`Size: ${formatBytes(app.fileSize)}`)
    );

    metadata.appendChild(
      createChip(`Downloads: ${Number(app.downloads) || 0}`)
    );

    const isPublished = app.published === true || app.published === 1;

    metadata.appendChild(
      createChip(isPublished ? "Published" : "Unpublished")
    );

    card.appendChild(metadata);

    if (isPublished && typeof app.downloadUrl === "string") {
      const downloadUrl = app.downloadUrl;

      if (
        downloadUrl.startsWith("/") &&
        !downloadUrl.startsWith("//") &&
        !downloadUrl.includes("\\")
      ) {
        const link = document.createElement("a");
        link.className = "dev-button dev-button-small";
        link.href = downloadUrl;
        link.textContent = "Download APK";
        link.style.display = "inline-flex";
        link.style.marginTop = "8px";
        card.appendChild(link);
      }
    }

    myAppsContainer.appendChild(card);
  }
}

async function loadMyApps() {
  if (!myAppsContainer) return;

  myAppsContainer.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "dev-empty";
  loading.textContent = "Loading your apps...";
  myAppsContainer.appendChild(loading);

  try {
    const data = await requestJSON(API.mine);

    renderMyApps(data.apps);
  } catch (error) {
    myAppsContainer.replaceChildren();

    const errorMessage = document.createElement("p");
    errorMessage.className = "dev-empty";
    errorMessage.textContent = error.message || "Could not load your apps.";
    myAppsContainer.appendChild(errorMessage);

    if (error.message.toLowerCase().includes("unauthorized")) {
      showAuth();
      showNotice("Your session may have expired. Please log in again.", "error");
    }
  }
}

async function checkSession() {
  try {
    const data = await requestJSON(API.me);

    if (data.authenticated && data.developer) {
      showDashboard(data.developer);
    } else {
      showAuth();
    }
  } catch {
    showAuth();
  }
}

/* Login */

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice();

    const email = $("login-email")?.value.trim();
    const password = $("login-password")?.value;

    if (!email || !password) {
      showNotice("Enter your email and password.", "error");
      return;
    }

    const button = loginForm.querySelector('button[type="submit"]');
    setBusy(button, true, "Logging in...");

    try {
      await requestJSON(API.login, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const session = await requestJSON(API.me);

      if (!session.authenticated || !session.developer) {
        throw new Error("Login succeeded, but your session could not be verified.");
      }

      showNotice("You are logged in successfully.", "success");
      showDashboard(session.developer);
      loginForm.reset();
    } catch (error) {
      showNotice(error.message || "Login failed. Please try again.", "error");
    } finally {
      setBusy(button, false);
    }
  });
}

/* Registration */

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice();

    const displayName = $("register-name")?.value.trim();
    const email = $("register-email")?.value.trim();
    const password = $("register-password")?.value;

    if (!displayName || !email || !password) {
      showNotice("Complete all registration fields.", "error");
      return;
    }

    if (password.length < 12) {
      showNotice("Your password must be at least 12 characters long.", "error");
      return;
    }

    const button = registerForm.querySelector('button[type="submit"]');
    setBusy(button, true, "Creating account...");

    try {
      await requestJSON(API.register, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ displayName, email, password })
      });

      const session = await requestJSON(API.me);

      if (!session.authenticated || !session.developer) {
        throw new Error(
          "Your account may have been created, but automatic login failed. Please log in."
        );
      }

      registerForm.reset();
      showNotice("Your developer account is ready!", "success");
      showDashboard(session.developer);
    } catch (error) {
      showNotice(
        error.message || "Registration failed. Please try again.",
        "error"
      );
    } finally {
      setBusy(button, false);
    }
  });
}

/* Login/register tabs */

if ($("login-tab")) {
  $("login-tab").addEventListener("click", () => {
    switchAuthTab("login");
    clearNotice();
  });
}

if ($("register-tab")) {
  $("register-tab").addEventListener("click", () => {
    switchAuthTab("register");
    clearNotice();
  });
}

/* Logout */

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    clearNotice();
    setBusy(logoutButton, true, "Logging out...");

    try {
      await requestJSON(API.logout, {
        method: "POST"
      });

      showAuth();
      switchAuthTab("login");
      showNotice("You have been logged out.", "success");
    } catch (error) {
      showNotice(error.message || "Logout failed. Try again.", "error");
    } finally {
      setBusy(logoutButton, false);
    }
  });
}

/* Refresh app list */

if (refreshAppsButton) {
  refreshAppsButton.addEventListener("click", loadMyApps);
}

/* APK upload */

if (uploadForm) {
  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearNotice();

    const fileInput = uploadForm.querySelector('input[name="file"]');
    const file = fileInput?.files?.[0];

    if (!file) {
      showNotice("Choose an APK file first.", "error");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".apk")) {
      showNotice("Please select a file ending in .apk.", "error");
      return;
    }

    if (file.size === 0) {
      showNotice("The selected APK file is empty.", "error");
      return;
    }

    if (file.size > MAX_APK_SIZE) {
      showNotice("Your APK is larger than the 50 MB upload limit.", "error");
      return;
    }

    const formData = new FormData(uploadForm);

    setBusy(uploadButton, true, "Uploading APK...");

    try {
      const result = await requestJSON(API.upload, {
        method: "POST",
        body: formData
      });

      uploadForm.reset();

      showNotice(
        result.message || "APK uploaded successfully.",
        "success"
      );

      await loadMyApps();
    } catch (error) {
      showNotice(
        error.message ||
          "Upload failed. Check your connection and server configuration.",
        "error"
      );
    } finally {
      setBusy(uploadButton, false);
    }
  });
}

/* Set the footer year */

const yearElement = $("developer-year");

if (yearElement) {
  yearElement.textContent = String(new Date().getFullYear());
}

/* Start */

switchAuthTab("login");
checkSession();
