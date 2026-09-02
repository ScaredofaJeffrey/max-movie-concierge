(() => {
  "use strict";

  const list = document.getElementById("list");

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem("maxLater") || "[]");
    } catch {
      return [];
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

  function render() {
    const items = readSaved().slice().reverse();

    if (!items.length) {
      list.innerHTML = `
        <div class="empty">
          Nothing saved yet.<br><br>
          MAX will keep the good maybes here.
        </div>
      `;
      return;
    }

    items.forEach((item) => {
      const link = document.createElement("a");
      link.className = "card";
      link.href = `./detail.html?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(item.type || "movie")}`;

      link.innerHTML = `
        ${item.poster_path ? `
          <img
            class="poster"
            src="https://image.tmdb.org/t/p/w185${item.poster_path}"
            alt="Poster for ${escapeHtml(item.title || "Untitled")}"
            loading="lazy"
          >
        ` : ""}
        <span>
          <span class="title">${escapeHtml(item.title || "Untitled")}</span>
          <span class="reason">
            ${item.reason === "not-today" ? "🌙 Not today" : "🕐 Maybe another time"}
          </span>
        </span>
      `;

      list.appendChild(link);
    });
  }

  if (list) render();
})();
