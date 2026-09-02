(() => {
  "use strict";

  const API_BASE = "https://api.themoviedb.org/3";
  const root = document.getElementById("root");

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function token() {
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

  function show(title, message, actions) {
    root.innerHTML = `
      <section class="screen hero">
        <h1>${escapeHtml(title)}</h1>
        <div class="status">${escapeHtml(message)}</div>
        ${actions || ""}
      </section>
    `;
  }

  async function api(path) {
    if (!token()) throw new Error("TMDB is not connected.");

    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token()}`
      }
    });

    if (!response.ok) {
      throw new Error(`TMDB returned ${response.status}`);
    }

    return response.json();
  }

  const prefs = readJson("maxLastPreferences", null);

  function genreIds() {
    return {
      laugh: [35],
      hooked: [53, 80, 9648],
      think: [878, 9648, 18],
      feeling: [18, 10749, 35],
      freak: [27, 53]
    }[prefs?.vibe] || [];
  }

  function query(page) {
    const params = [
      "language=en-US",
      "region=US",
      "include_adult=false",
      "include_video=false",
      "sort_by=popularity.desc",
      "vote_count.gte=100",
      `page=${page}`
    ];

    const genres = genreIds();
    if (genres.length) params.push(`with_genres=${genres.join("|")}`);
    if (prefs?.time === "short") params.push("with_runtime.lte=90");
    if (prefs?.time === "mid") params.push("with_runtime.gte=90", "with_runtime.lte=120");
    if (prefs?.time === "long") params.push("with_runtime.gte=120");

    const services = (prefs?.services || []).filter(
      (service) => service && service !== "EVERYWHERE"
    );

    if (services.length) {
      params.push("watch_region=US", `with_watch_providers=${services.join("|")}`);
    }

    return params.join("&");
  }

  function state() {
    const rejected = new Set(readJson("maxRejected", []).map(Number));
    const recent = new Set(readJson("maxRecent", []).map(Number));
    const later = readJson("maxLater", []);
    const notToday = new Set(
      later
        .filter((item) => item.reason === "not-today" && Date.now() - item.added < 3 * 86400000)
        .map((item) => Number(item.id))
    );

    return { rejected, recent, notToday };
  }

  function score(item) {
    const genres = item.genre_ids || [];
    const wanted = new Set(genreIds());
    const recentGenres = readJson("maxRecentGenres", {});
    const taste = readJson("maxGenreTaste", {});

    let score =
      (item.vote_average || 0) * 9 +
      Math.log10((item.vote_count || 1) + 1) * 3 +
      (item.popularity || 0) / 25;

    score += genres.reduce((total, id) => total + (wanted.has(id) ? 18 : 0), 0);
    score += genres.reduce((total, id) => total + Number(taste[id] || 0) * 8, 0);
    score -= genres.reduce((total, id) => total + Number(recentGenres[id] || 0) * 8, 0);
    score += Math.random() * 18;

    return score;
  }

  function serviceNames(ids) {
    const names = {
      "8": "Netflix",
      "9": "Prime Video",
      "15": "Hulu",
      "337": "Disney+",
      "1899": "Max",
      "531": "Paramount+",
      "386": "Peacock",
      "350": "Apple TV+"
    };

    return ids.map((id) => names[id] || "your service");
  }

  function offerServiceExpansion() {
    const existing = (prefs?.services || []).filter(
      (service) => service && service !== "EVERYWHERE"
    );
    const all = ["8", "9", "15", "337", "1899", "531", "386", "350"];

    if (all.every((service) => existing.includes(service))) return false;

    const currentService = serviceNames(existing)[0] || "your current services";

    show(
      "MAX is running low",
      `We’ve tried several matches on ${currentService}. Want to open up the search?`,
      `
        <a class="link primary" href="./services.html">＋ Add another streaming service</a>
        <a class="link" href="./repeat.html?keepServices=1">Keep searching here</a>
      `
    );

    return true;
  }

  async function run() {
    if (!prefs) {
      show(
        "Let’s start fresh",
        "MAX doesn’t have your previous preferences yet.",
        `
          <a class="link primary" href="./pick.html">Start MAX Pick</a>
          <a class="link" href="./index.html">Back to MAX</a>
        `
      );
      return;
    }

    const params = new URLSearchParams(location.search);
    const streak = Number(localStorage.getItem("maxNoWatchStreak") || 0);
    const serviceAdded = params.has("serviceAdded");
    const keepServices = params.has("keepServices");

    if (keepServices) localStorage.setItem("maxNoWatchStreak", "0");
    if (streak >= 7 && !serviceAdded && !keepServices && offerServiceExpansion()) return;

    show("MAX is thinking…", "Looking beyond the usual shortlist.");

    try {
      const type = prefs.type === "tv" ? "tv" : "movie";
      const currentState = state();
      const results = [];

      for (let page = 1; page <= 6; page += 1) {
        const data = await api(`/discover/${type}?${query(page)}`);
        results.push(...(data.results || []));

        if (!data.total_pages || page >= Math.min(data.total_pages, 6)) break;
      }

      let candidates = results.filter(
        (item) =>
          !currentState.rejected.has(Number(item.id)) &&
          !currentState.notToday.has(Number(item.id)) &&
          !currentState.recent.has(Number(item.id))
      );

      if (!candidates.length) {
        candidates = results.filter(
          (item) =>
            !currentState.rejected.has(Number(item.id)) &&
            !currentState.notToday.has(Number(item.id))
        );
      }

      if (!candidates.length) {
        throw new Error("MAX could not find another match for those preferences.");
      }

      candidates.sort((a, b) => score(b) - score(a));
      const top = candidates.slice(0, 20);
      const pick = top[Math.floor(Math.random() * top.length)];
      const history = [
        Number(pick.id),
        ...Array.from(currentState.recent).filter((id) => Number(id) !== Number(pick.id))
      ].slice(0, 20);
      const recentGenres = readJson("maxRecentGenres", {});

      (pick.genre_ids || []).forEach((id) => {
        recentGenres[id] = Math.min(5, Number(recentGenres[id] || 0) + 1);
      });

      localStorage.setItem("maxRecent", JSON.stringify(history));
      localStorage.setItem("maxRecentGenres", JSON.stringify(recentGenres));
      location.href = `./detail.html?id=${pick.id}&type=${type}`;
    } catch (error) {
      show(
        "MAX hit a snag",
        `${error.message}.`,
        `
          <a class="link primary" href="./pick.html">Run preferences again</a>
          <a class="link" href="./index.html">Back to MAX</a>
        `
      );
    }
  }

  run();
})();
