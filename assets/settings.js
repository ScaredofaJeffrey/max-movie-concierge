(() => {
  "use strict";

  const API_BASE = "https://api.themoviedb.org/3";
  const STORAGE_KEY = "maxTmdbToken";
  const input = document.getElementById("token");
  const message = document.getElementById("msg");
  const save = document.getElementById("save");

  input.value = localStorage.getItem(STORAGE_KEY) || "";

  save.addEventListener("click", async () => {
    const token = input.value.trim();

    if (!token) {
      message.textContent = "Paste your TMDB token first.";
      return;
    }

    message.textContent = "Testing TMDB…";

    try {
      const response = await fetch(`${API_BASE}/configuration`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`TMDB returned ${response.status}`);
      }

      localStorage.setItem(STORAGE_KEY, token);
      message.textContent = "TMDB connected.";
    } catch (error) {
      message.textContent = error.message;
    }
  });
})();
