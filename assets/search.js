(() => {
  "use strict";

  const API_BASE = "https://api.themoviedb.org/3";
  const form = document.getElementById("search-form");
  const input = document.getElementById("q");
  const results = document.getElementById("results");

  function getToken() {
    return localStorage.getItem("maxTmdbToken") || "";
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

  async function api(path) {
    const response = await fetch(API_BASE + path, {
      headers: {
        Authorization: `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`TMDB returned ${response.status}`);
    }

    return response.json();
  }

  async function search() {
    const query = input.value.trim();

    if (!query) return;

    if (!getToken()) {
      results.innerHTML = '<div class="status">Connect TMDB in MAX Settings first.</div>';
      return;
    }

    results.innerHTML = '<div class="status">MAX is searching…</div>';

    try {
      const data = await api(
        `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
      );

      const items = (data.results || [])
        .filter((item) => item.media_type === "movie" || item.media_type === "tv")
        .slice(0, 10);

      if (!items.length) {
        results.innerHTML = '<div class="status">MAX couldn’t find that.</div>';
        return;
      }

      results.innerHTML = items.map((item) => `
        <a
          class="button"
          href="./detail.html?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(item.media_type)}"
        >
          ${escapeHtml(item.title || item.name)}
          <span class="muted">· ${item.media_type === "tv" ? "TV" : "Movie"}</span>
        </a>
      `).join("");
    } catch (error) {
      results.innerHTML = `<div class="status">${escapeHtml(error.message)}</div>`;
    }
  }

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      search();
    });
  }

  const query = new URLSearchParams(location.search).get("q");

  if (query) {
    input.value = query;
    search();
  }
})();
