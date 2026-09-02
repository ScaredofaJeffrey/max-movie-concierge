(() => {
  "use strict";

  const API_BASE = "https://api.themoviedb.org/3";
  const root = document.getElementById("root");

  const QUESTIONS = [
    ["Movie or TV?", [
      ["🎬 Movie", "movie"],
      ["📺 TV", "tv"]
    ]],
    ["What’s the vibe?", [
      ["😂 Make me laugh", "laugh"],
      ["😮 Keep me hooked", "hooked"],
      ["🧠 Make me think", "think"],
      ["❤️ Something with feeling", "feeling"],
      ["😱 Freak me out", "freak"],
      ["🎲 Surprise me", "surprise"]
    ]],
    ["How much time do we have?", [
      ["Under 90 min", "short"],
      ["90–120 min", "mid"],
      ["2+ hours", "long"],
      ["Don’t care", "any"]
    ]],
    ["Something new or familiar?", [
      ["Comfort pick", "comfort"],
      ["Something new", "new"],
      ["Surprise me", "surprise"]
    ]],
    ["Where can you watch it?", [
      ["Netflix", "8"],
      ["Prime Video", "9"],
      ["Hulu", "15"],
      ["Disney+", "337"],
      ["Max", "1899"],
      ["Paramount+", "531"],
      ["Peacock", "386"],
      ["Apple TV+", "350"]
    ]]
  ];

  const preferences = {
    type: null,
    vibe: null,
    time: null,
    novelty: null,
    services: []
  };

  let step = 0;

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

  function buildHref(nextStep, extra = {}) {
    const params = new URLSearchParams();
    const state = { ...preferences, ...extra };

    Object.entries(state).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length) {
        params.set(key, value.join(","));
      } else if (value) {
        params.set(key, value);
      }
    });

    params.set("step", nextStep);
    return `./pick.html?${params.toString()}`;
  }

  function loadPreferences() {
    const params = new URLSearchParams(location.search);

    preferences.type = params.get("type") || null;
    preferences.vibe = params.get("vibe") || null;
    preferences.time = params.get("time") || null;
    preferences.novelty = params.get("novelty") || null;
    preferences.services = (params.get("services") || "")
      .split(",")
      .filter(Boolean);
    step = Number(params.get("step") || 1);
  }

  function render() {
    const question = QUESTIONS[step - 1];
    const gridClass = step === 2 || step === 5 ? "grid" : "";

    root.innerHTML = `
      <section aria-labelledby="question-title">
        <div class="top">
          <a class="link" href="./index.html" style="width:auto;padding:8px 12px;font-size:13px">
            ‹ Home
          </a>
          <span class="small">${step} / 5</span>
        </div>

        <div class="progress" aria-label="Question ${step} of 5">
          <i style="width:${step / 5 * 100}%"></i>
        </div>

        <h1 id="question-title" class="q">${question[0]}</h1>
        <div id="choices" class="${gridClass}"></div>

        <p class="footer">
          MAX learns from your reactions and deliberately varies what it shows you.
        </p>
      </section>
    `;

    const choices = document.getElementById("choices");

    question[1].forEach(([label, value]) => {
      const choice = document.createElement("a");
      choice.className = "link";
      choice.textContent = label;

      if (step === 5) {
        const selected = preferences.services.includes(value);
        choice.href = buildHref(5, {
          services: selected
            ? preferences.services.filter((service) => service !== value)
            : preferences.services.concat(value)
        });

        if (selected) {
          choice.className += " selected";
        }
      } else {
        const key = step === 1
          ? "type"
          : step === 2
            ? "vibe"
            : step === 3
              ? "time"
              : "novelty";

        choice.href = buildHref(step + 1, { [key]: value });
      }

      choices.appendChild(choice);
    });

    if (step === 5) {
      const everywhere = document.createElement("a");
      everywhere.className = "link";
      everywhere.textContent = "🌎 Everywhere";
      everywhere.href = buildHref("go", { services: [] });
      choices.appendChild(everywhere);

      const find = document.createElement("a");
      find.className = "link primary";
      find.textContent = "Find my pick →";
      find.href = buildHref("go", { services: preferences.services });
      choices.appendChild(find);
    }
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || fallback);
    } catch {
      return JSON.parse(fallback);
    }
  }

  function genreTaste() {
    return readJson("maxGenreTaste", "{}");
  }

  function recentGenres() {
    return readJson("maxRecentGenres", "{}");
  }

  function excluded() {
    const rejected = new Set(readJson("maxRejected", "[]").map(Number));
    const recent = new Set(readJson("maxRecent", "[]").map(Number));
    const later = readJson("maxLater", "[]");
    const notToday = new Set(
      later
        .filter((item) => item.reason === "not-today" && Date.now() - item.added < 3 * 86400000)
        .map((item) => Number(item.id))
    );

    return { rejected, recent, notToday };
  }

  function requestedGenreIds() {
    switch (preferences.vibe) {
      case "laugh":
        return [35];
      case "hooked":
        return [53, 80, 9648];
      case "think":
        return [878, 9648, 18];
      case "feeling":
        return [18, 10749, 35];
      case "freak":
        return [27, 53];
      default:
        return [];
    }
  }

  function score(item) {
    const taste = genreTaste();
    const recent = recentGenres();
    const requested = new Set(requestedGenreIds());
    const genreIds = item.genre_ids || [];

    const recentPenalty = genreIds.reduce(
      (sum, id) => sum - Number(recent[id] || 0) * 9,
      0
    );
    const learnedBoost = genreIds.reduce(
      (sum, id) => sum + Number(taste[id] || 0) * 7,
      0
    );
    const requestedBoost = genreIds.reduce(
      (sum, id) => sum + (requested.has(id) ? 20 : 0),
      0
    );

    let value =
      (item.vote_average || 0) * 9 +
      Math.log10((item.vote_count || 1) + 1) * 3 +
      (item.popularity || 0) / 25 +
      recentPenalty +
      learnedBoost +
      requestedBoost;

    const year = Number(
      (item.release_date || item.first_air_date || "").slice(0, 4)
    );

    if (preferences.novelty === "new") {
      value += year >= 2020 ? 9 : -2;
    }

    if (preferences.novelty === "comfort") {
      value += year && year < 2020 ? 8 : 0;
    }

    if (preferences.novelty === "surprise" || preferences.vibe === "surprise") {
      value += Math.random() * 18;
    }

    return value;
  }

  async function api(path) {
    if (!token()) {
      throw new Error("TMDB is not connected.");
    }

    const response = await fetch(API_BASE + path, {
      headers: {
        Authorization: `Bearer ${token()}`
      }
    });

    if (!response.ok) {
      throw new Error(`TMDB returned ${response.status}`);
    }

    return response.json();
  }

  async function finish() {
    if (!token()) {
      location.href = "./settings.html";
      return;
    }

    root.innerHTML = `
      <section class="hero" aria-live="polite">
        <h1>MAX is thinking…</h1>
        <p>Balancing your preferences with some variety.</p>
        <div class="status">Learning your taste…</div>
      </section>
    `;

    try {
      const type = preferences.type === "tv" ? "tv" : "movie";
      const query = [
        "language=en-US",
        "region=US",
        "include_adult=false",
        "include_video=false",
        "sort_by=popularity.desc",
        "vote_count.gte=100"
      ];
      const genres = requestedGenreIds();

      if (genres.length) {
        query.push(`with_genres=${genres.join("|")}`);
      }

      if (preferences.time === "short") {
        query.push("with_runtime.lte=90");
      }

      if (preferences.time === "mid") {
        query.push("with_runtime.gte=90", "with_runtime.lte=120");
      }

      if (preferences.time === "long") {
        query.push("with_runtime.gte=120");
      }

      if (preferences.services.length) {
        query.push(
          "watch_region=US",
          `with_watch_providers=${preferences.services
            .filter((service) => service !== "EVERYWHERE")
            .join("|")}`
        );
      }

      const data = await api(`/discover/${type}?${query.join("&")}&page=1`);
      const { rejected, recent, notToday } = excluded();
      let items = (data.results || []).filter(
        (item) =>
          !rejected.has(Number(item.id)) &&
          !notToday.has(Number(item.id))
      );
      const fresh = items.filter((item) => !recent.has(Number(item.id)));

      if (fresh.length >= 3) {
        items = fresh;
      }

      if (!items.length) {
        throw new Error("No matches found after your filters.");
      }

      items.sort((left, right) => score(right) - score(left));

      const top = items.slice(0, 10);
      const tasteTop = top.slice(0, 5);
      const pick = tasteTop[Math.floor(Math.random() * tasteTop.length)];
      const history = [
        Number(pick.id),
        ...Array.from(recent).filter(
          (id) => Number(id) !== Number(pick.id)
        )
      ].slice(0, 12);
      const recentGenreCounts = recentGenres();

      (pick.genre_ids || []).forEach((id) => {
        recentGenreCounts[id] = Number(recentGenreCounts[id] || 0) + 1;
      });

      Object.keys(recentGenreCounts).forEach((id) => {
        recentGenreCounts[id] = Math.max(
          0,
          Math.min(4, Number(recentGenreCounts[id]))
        );
      });

      localStorage.setItem("maxRecent", JSON.stringify(history));
      localStorage.setItem("maxRecentGenres", JSON.stringify(recentGenreCounts));
      localStorage.setItem("maxLastPreferences", JSON.stringify(preferences));

      location.href = `./detail.html?id=${pick.id}&type=${type}`;
    } catch (error) {
      root.innerHTML = `
        <section class="hero" aria-live="assertive">
          <h1>MAX hit a snag.</h1>
          <div class="status">${escapeHtml(error.message)}</div>
          <a class="link primary" href="./settings.html">Check TMDB</a>
          <a class="link" href="./index.html">Back to MAX</a>
        </section>
      `;
    }
  }

  loadPreferences();

  if (location.search.includes("step=go")) {
    finish();
  } else if (step >= 1 && step <= 5) {
    render();
  } else {
    render();
  }
})();
