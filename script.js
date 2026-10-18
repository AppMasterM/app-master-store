
"use strict";

/* =========================================================
   APP MASTER STORE — COMPLETE CORRECTED SCRIPT
   Matches index.html and styles.css
   ========================================================= */

const apps = [
  {
    id: "study-tool",
    name: "Study Tool",
    category: "Education",
    version: "1.0.0",
    icon: "📚",
    theme: "purple",
    description:
      "A study companion to help you learn, revise, and organize your studies.",
    apkUrl:
      "https://github.com/AppMasterM/app-master-store/releases/download/1.0.0/app-release.apk",
    webUrl: "",
  },
  {
    id: "pixelkit",
    name: "PixelKit",
    category: "Developer Tools",
    version: "1.0.0",
    icon: "🧩",
    theme: "purple",
    description:
      "PixelKit for Android. Explore the app and download the latest release.",
    apkUrl:
      "https://github.com/AppMasterM/app-master-store/releases/download/1.0.1/pixalkit.v1.apk",
    webUrl: "",
  },
  {
    id: "myai",
    name: "MyAI",
    category: "AI Tools",
    version: "1.0.0",
    icon: "✦",
    theme: "blue",
    description:
      "An AI assistant for questions, ideas, learning, and everyday tasks.",
    apkUrl: "",
    webUrl: "",
  },
  {
    id: "pixalith",
    name: "Pixalith",
    category: "Developer Tools",
    version: "1.0.0",
    icon: "⚡",
    theme: "orange",
    description:
      "A developer-focused project for creating and working with Android apps.",
    apkUrl: "",
    webUrl: "",
  },
];

const state = {
  search: "",
  category: "All",
};

const elements = {
  grid: document.getElementById("app-grid"),
  search: document.getElementById("search-input"),
  filters: document.getElementById("category-filters"),
  count: document.getElementById("app-count"),
  empty: document.getElementById("empty-state"),
  clear: document.getElementById("clear-search"),
  dialog: document.getElementById("app-dialog"),
  dialogContent: document.getElementById("dialog-content"),
  dialogClose: document.getElementById("dialog-close"),
  year: document.getElementById("current-year"),
  toast: document.getElementById("toast"),
};

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return replacements[character];
  });
}

function safeURL(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function getFilteredApps() {
  const query = state.search.trim().toLowerCase();

  return apps.filter((app) => {
    const matchesCategory =
      state.category === "All" ||
      app.category === state.category;

    const searchable = [
      app.name,
      app.category,
      app.description,
      app.version,
    ]
      .join(" ")
      .toLowerCase();

    return matchesCategory && searchable.includes(query);
  });
}

function renderApps() {
  if (!elements.grid) {
    console.error('App Master Store: missing "#app-grid" element.');
    return;
  }

  const filteredApps = getFilteredApps();

  elements.grid.innerHTML = filteredApps
    .map((app) => {
      const apk = safeURL(app.apkUrl);
      const web = safeURL(app.webUrl);

      const downloadButton = apk
        ? `
          <a
            class="app-action primary"
            href="${escapeHTML(apk)}"
            target="_blank"
            rel="noopener noreferrer"
          >Download APK</a>
        `
        : `
          <button class="app-action" type="button" disabled>
            APK Coming Soon
          </button>
        `;

      const webButton = web
        ? `
          <a
            class="app-action"
            href="${escapeHTML(web)}"
            target="_blank"
            rel="noopener noreferrer"
          >Open Web App</a>
        `
        : "";

      return `
        <article class="app-card">
          <div class="app-card-top">
            <div
              class="app-icon ${escapeHTML(app.theme)}"
              aria-hidden="true"
            >${escapeHTML(app.icon)}</div>

            <span class="category-tag">
              ${escapeHTML(app.category)}
            </span>
          </div>

          <h3>${escapeHTML(app.name)}</h3>

          <span class="app-version">
            Version ${escapeHTML(app.version)}
          </span>

          <p class="app-description">
            ${escapeHTML(app.description)}
          </p>

          <div class="app-actions">
            <button
              class="app-action"
              type="button"
              data-details="${escapeHTML(app.id)}"
            >Details</button>

            ${downloadButton}
            ${webButton}
          </div>
        </article>
      `;
    })
    .join("");

  if (elements.count) {
    elements.count.textContent =
      `${filteredApps.length} ${
        filteredApps.length === 1 ? "app" : "apps"
      }`;
  }

  if (elements.empty) {
    elements.empty.hidden = filteredApps.length > 0;
  }

  elements.grid.hidden = filteredApps.length === 0;
}

function updateFilters(selectedButton) {
  if (!elements.filters) {
    return;
  }

  elements.filters
    .querySelectorAll("[data-category]")
    .forEach((button) => {
      const active = button === selectedButton;

      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
}

function openDetails(appId) {
  const app = apps.find((item) => item.id === appId);

  if (!app || !elements.dialog || !elements.dialogContent) {
    return;
  }

  const apk = safeURL(app.apkUrl);
  const web = safeURL(app.webUrl);

  const apkAction = apk
    ? `
      <a
        class="primary-button"
        href="${escapeHTML(apk)}"
        target="_blank"
        rel="noopener noreferrer"
      >Download APK</a>
    `
    : `
      <button class="secondary-button" type="button" disabled>
        APK Coming Soon
      </button>
    `;

  const webAction = web
    ? `
      <a
        class="secondary-button"
        href="${escapeHTML(web)}"
        target="_blank"
        rel="noopener noreferrer"
      >Open Web App</a>
    `
    : `
      <button class="secondary-button" type="button" disabled>
        Web App Coming Soon
      </button>
    `;

  elements.dialogContent.innerHTML = `
    <div class="dialog-body">
      <div class="app-icon ${escapeHTML(app.theme)}" aria-hidden="true">
        ${escapeHTML(app.icon)}
      </div>

      <h2 id="dialog-title">${escapeHTML(app.name)}</h2>

      <p>
        ${escapeHTML(app.category)}
        · Version ${escapeHTML(app.version)}
      </p>

      <p>${escapeHTML(app.description)}</p>

      <div class="dialog-actions">
        ${apkAction}
        ${webAction}
      </div>
    </div>
  `;

  if (!elements.dialog.open) {
    elements.dialog.showModal();
  }
}

function closeDetails() {
  if (elements.dialog?.open) {
    elements.dialog.close();
  }
}

function clearFilters() {
  state.search = "";
  state.category = "All";

  if (elements.search) {
    elements.search.value = "";
  }

  const allButton =
    elements.filters?.querySelector('[data-category="All"]');

  if (allButton) {
    updateFilters(allButton);
  }

  renderApps();
}

function bindEvents() {
  elements.search?.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderApps();
  });

  elements.filters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");

    if (!button || !elements.filters.contains(button)) {
      return;
    }

    state.category = button.dataset.category || "All";
    updateFilters(button);
    renderApps();
  });

  elements.grid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-details]");

    if (button) {
      openDetails(button.dataset.details);
    }
  });

  elements.clear?.addEventListener("click", clearFilters);
  elements.dialogClose?.addEventListener("click", closeDetails);

  elements.dialog?.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closeDetails();
    }
  });
}

function initializeStore() {
  if (elements.year) {
    elements.year.textContent = String(new Date().getFullYear());
  }

  const allButton =
    elements.filters?.querySelector('[data-category="All"]');

  if (allButton) {
    updateFilters(allButton);
  }

  bindEvents();
  renderApps();

  console.log(
    "App Master Store initialized:",
    apps.length,
    "apps"
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeStore,
    { once: true }
  );
} else {
  initializeStore();
                                   }
     
