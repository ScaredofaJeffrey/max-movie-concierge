(() => {
  "use strict";

  const STORAGE_KEYS = {
    saved: "maxLater"
  };

  function readJson(key, fallback = []) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function renderSavedPreview(container) {
    const items = readJson(STORAGE_KEYS.saved, [])
      .slice()
      .reverse();

    if (!items.length) return;

    container.innerHTML = `
      <section class="saved-box" aria-labelledby="saved-title">
        <h2 id="saved-title" class="saved-title">
          🕐 Maybe Later
          <span class="saved-reason">· ${items.length} saved</span>
        </h2>

        ${items.slice(0, 3).map((item) => `
          <a
            class="saved-row"
            href="./detail.html?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(item.type || "movie")}"
          >
            ${item.poster_path ? `
              <img
                src="https://image.tmdb.org/t/p/w92${item.poster_path}"
                alt=""
                loading="lazy"
              >
            ` : ""}
            <span>
              <span class="saved-title">${escapeHtml(item.title || "Untitled")}</span>
              <span class="saved-reason">
                ${item.reason === "not-today" ? "🌙 Not today" : "🕐 Maybe another time"}
              </span>
            </span>
          </a>
        `).join("")}

        <a class="saved-row" href="./saved.html">
          <span class="saved-title">View all saved →</span>
        </a>
      </section>
    `;
  }

  const saved = document.getElementById("saved");
  if (saved) renderSavedPreview(saved);
})();
