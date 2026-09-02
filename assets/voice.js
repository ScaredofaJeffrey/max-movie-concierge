(() => {
  "use strict";

  const API_BASE = "https://api.themoviedb.org/3";
  const IMAGE_BASE = "https://image.tmdb.org/t/p/w780";
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const status = document.getElementById("status");
  const mic = document.getElementById("mic");
  const auto = document.getElementById("auto");
  const switchControl = document.getElementById("switch");
  const autoText = document.getElementById("autoText");
  const autoLabel = document.getElementById("autoLabel");
  const heard = document.getElementById("heard");
  const actions = document.getElementById("actions");
  const result = document.getElementById("result");

  let recognition = null;
  let voiceOn = localStorage.getItem("maxVoiceReplies") !== "off";
  let lastReply = "I’m ready. Tell me what you want to watch.";
  let audioPrimed = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function refreshToggle() {
    voiceOn = localStorage.getItem("maxVoiceReplies") !== "off";
    switchControl.className = `switch ${voiceOn ? "on" : "off"}`;
    auto.className = `toggle ${voiceOn ? "" : "off"}`;
    autoLabel.textContent = voiceOn ? "🔊 MAX voice replies" : "🔇 MAX voice replies";
    autoText.textContent = voiceOn
      ? "On — MAX will speak replies automatically."
      : "Off — MAX replies stay in text.";
  }

  function getVoice() {
    try {
      const voices = speechSynthesis.getVoices() || [];
      return voices.find((voice) => /^en(-|_)?US$/i.test(voice.lang))
        || voices.find((voice) => /^en/i.test(voice.lang))
        || voices[0]
        || null;
    } catch {
      return null;
    }
  }

  function speak(text) {
    lastReply = text;

    if (!voiceOn || !("speechSynthesis" in window)) {
      return false;
    }

    try {
      const synthesis = speechSynthesis;
      synthesis.cancel();
      synthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voice = getVoice();
      if (voice) utterance.voice = voice;

      utterance.onstart = () => mic.classList.add("speaking");
      utterance.onend = utterance.onerror = () => mic.classList.remove("speaking");
      synthesis.speak(utterance);
      return true;
    } catch {
      mic.classList.remove("speaking");
      return false;
    }
  }

  function primeAudio() {
    if (!voiceOn || !("speechSynthesis" in window) || audioPrimed) return;

    audioPrimed = true;

    try {
      const synthesis = speechSynthesis;
      synthesis.cancel();
      synthesis.resume();

      const utterance = new SpeechSynthesisUtterance("Listening.");
      utterance.lang = "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voice = getVoice();
      if (voice) utterance.voice = voice;
      synthesis.speak(utterance);
    } catch {
      // Voice priming is best-effort on browsers with restricted speech APIs.
    }
  }

  function stop() {
    const activeRecognition = recognition;
    recognition = null;

    if (activeRecognition) {
      try {
        activeRecognition.onresult = null;
        activeRecognition.onerror = null;
        activeRecognition.onend = null;
        activeRecognition.stop();
      } catch {
        try {
          activeRecognition.abort();
        } catch {
          // Recognition is already stopped.
        }
      }
    }

    mic.classList.remove("listening");
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || fallback);
    } catch {
      return JSON.parse(fallback);
    }
  }

  function genres(vibe) {
    switch (vibe) {
      case "laugh": return [35];
      case "hooked": return [53, 80, 9648];
      case "think": return [878, 9648, 18];
      case "feeling": return [18, 10749, 35];
      case "freak": return [27, 53];
      default: return [];
    }
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

  function score(item, preferences) {
    const genreIds = item.genre_ids || [];
    const requested = new Set(genres(preferences.vibe));
    const taste = readJson("maxGenreTaste", "{}");
    const recentGenres = readJson("maxRecentGenres", "{}");

    let value =
      (item.vote_average || 0) * 9
      + Math.log10((item.vote_count || 1) + 1) * 3
      + (item.popularity || 0) / 25;

    value += genreIds.reduce(
      (sum, id) => sum + (requested.has(id) ? 18 : 0),
      0
    );
    value += genreIds.reduce(
      (sum, id) => sum + Number(taste[id] || 0) * 8,
      0
    );
    value -= genreIds.reduce(
      (sum, id) => sum + Number(recentGenres[id] || 0) * 8,
      0
    );

    return value + Math.random() * 18;
  }

  async function api(path) {
    const token = localStorage.getItem("maxTmdbToken") || "";

    if (!token) {
      throw new Error("TMDB is not connected.");
    }

    const response = await fetch(API_BASE + path, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`TMDB returned ${response.status}`);
    }

    return response.json();
  }

  async function recommend(preferences) {
    status.textContent = "MAX is thinking…";
    result.innerHTML = "";

    const excludedItems = excluded();
    const allResults = [];
    const type = preferences.type === "tv" ? "tv" : "movie";
    const query = [
      "language=en-US",
      "region=US",
      "include_adult=false",
      "include_video=false",
      "sort_by=popularity.desc",
      "vote_count.gte=100"
    ];
    const requestedGenres = genres(preferences.vibe);

    if (requestedGenres.length) {
      query.push(`with_genres=${requestedGenres.join("|")}`);
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
        `with_watch_providers=${preferences.services.join("|")}`
      );
    }

    for (let page = 1; page <= 6; page += 1) {
      const data = await api(
        `/discover/${type}?${query.join("&")}&page=${page}`
      );

      allResults.push(...(data.results || []));

      if (!data.total_pages || page >= Math.min(6, data.total_pages)) {
        break;
      }
    }

    let items = allResults.filter(
      (item) =>
        !excludedItems.rejected.has(Number(item.id))
        && !excludedItems.notToday.has(Number(item.id))
        && !excludedItems.recent.has(Number(item.id))
    );

    if (items.length < 3) {
      items = allResults.filter(
        (item) =>
          !excludedItems.rejected.has(Number(item.id))
          && !excludedItems.notToday.has(Number(item.id))
      );
    }

    if (!items.length) {
      throw new Error("MAX could not find another match for those preferences.");
    }

    items.sort(
      (left, right) => score(right, preferences) - score(left, preferences)
    );

    const pick = items[Math.floor(Math.random() * Math.min(10, items.length))];

    localStorage.setItem("maxLastPreferences", JSON.stringify(preferences));
    localStorage.setItem(
      "maxRecent",
      JSON.stringify([Number(pick.id), ...excludedItems.recent].slice(0, 20))
    );

    render(pick, preferences);
  }

  function render(item, preferences) {
    const mood = {
      laugh: "funny",
      hooked: "tense",
      think: "thought-provoking",
      feeling: "emotional",
      freak: "creepy",
      surprise: "unexpected"
    }[preferences.vibe] || "interesting";

    const message = `Okay, I found you something ${mood}. I think this one is worth a shot.`;
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "—";

    result.innerHTML = `
      <article class="resultCard">
        ${item.poster_path ? `
          <img
            class="poster"
            src="${IMAGE_BASE}${item.poster_path}"
            alt="Poster for ${escapeHtml(title)}"
          >
        ` : ""}
        <div class="title">${escapeHtml(title)}</div>
        <p class="small">${escapeHtml(year)} · TMDB ${rating}/10</p>
        <p class="small">${escapeHtml(item.overview || "MAX found this for you.")}</p>
      </article>

      <div class="maxSays">
        <strong>MAX says:</strong> ${escapeHtml(message)}
      </div>

      <div class="actions">
        <button class="reaction" id="find" type="button">🎲 Find another</button>
        <button class="reaction" id="later" type="button">🕐 Maybe another time</button>
        <button class="reaction" id="today" type="button">🌙 Not today</button>
        <button class="reaction" id="nope" type="button">👎 No, never</button>
      </div>
    `;

    if (voiceOn) speak(message);

    document.getElementById("find").onclick = () => {
      if (voiceOn) speak("Sure. I’ll find you another one.");
      recommend(preferences).catch(showError);
    };

    document.getElementById("later").onclick = () => {
      const saved = readJson("maxLater", "[]")
        .filter((savedItem) => Number(savedItem.id) !== Number(item.id));

      saved.push({
        id: Number(item.id),
        type: preferences.type,
        title,
        poster_path: item.poster_path || "",
        overview: item.overview || "",
        added: Date.now(),
        reason: "maybe"
      });

      localStorage.setItem("maxLater", JSON.stringify(saved));

      if (voiceOn) {
        speak("No problem. I’ll save this one for later and find you another.");
      }

      recommend(preferences).catch(showError);
    };

    document.getElementById("today").onclick = () => {
      if (voiceOn) speak("Got it. Not tonight. I’ll try something else.");
      recommend(preferences).catch(showError);
    };

    document.getElementById("nope").onclick = () => {
      const rejected = new Set(readJson("maxRejected", "[]").map(Number));
      rejected.add(Number(item.id));
      localStorage.setItem("maxRejected", JSON.stringify([...rejected]));

      if (voiceOn) speak("Understood. I won’t recommend that one again.");
      recommend(preferences).catch(showError);
    };
  }

  function showError(error) {
    status.textContent = "MAX hit a snag.";
    result.innerHTML = `<div class="status">${escapeHtml(error.message)}</div>`;
  }

  function parse(text) {
    const input = text.toLowerCase();
    const preferences = {
      type: /\b(tv|show|series|television)\b/.test(input) ? "tv" : "movie",
      vibe: /funny|comedy|laugh/.test(input)
        ? "laugh"
        : /thriller|suspense|mystery|hooked|edge of my seat/.test(input)
          ? "hooked"
          : /smart|thought|think|sci-fi|science fiction/.test(input)
            ? "think"
            : /romantic|romance|feel good|emotional/.test(input)
              ? "feeling"
              : /scary|horror|creepy|freak me out/.test(input)
                ? "freak"
                : "surprise",
      time: /under 90|less than 90|90 minutes or less|short/.test(input)
        ? "short"
        : /90\s*(to|-|–)\s*120|between 90 and 120|under two hours|two hours/.test(input)
          ? "mid"
          : /over two hours|more than two hours|2\+ hours|long/.test(input)
            ? "long"
            : "any",
      novelty: /new|recent|newer/.test(input)
        ? "new"
        : /old|classic|comfort|familiar/.test(input)
          ? "comfort"
          : "surprise",
      services: []
    };

    [
      ["Netflix", "8"],
      ["Prime Video", "9"],
      ["Hulu", "15"],
      ["Disney+", "337"],
      ["Max", "1899"],
      ["Paramount+", "531"],
      ["Peacock", "386"],
      ["Apple TV+", "350"]
    ].forEach(([name, id]) => {
      if (input.includes(name.toLowerCase())) {
        preferences.services.push(id);
      }
    });

    return preferences;
  }

  function summary(preferences) {
    const type = preferences.type === "tv" ? "TV" : "movie";
    const vibe = {
      laugh: "funny",
      hooked: "thrilling",
      think: "thought-provoking",
      feeling: "emotional",
      freak: "scary",
      surprise: "unexpected"
    };
    const time = {
      short: "under 90 minutes",
      mid: "about 90 to 120 minutes",
      long: "over two hours",
      any: "any length"
    };
    const novelty = {
      new: "something newer",
      comfort: "something familiar",
      surprise: "something different"
    };

    return `Got it — ${type}, ${vibe[preferences.vibe]}, ${time[preferences.time]}, and ${novelty[preferences.novelty]}.`;
  }

  function startRecognition() {
    if (!SpeechRecognition) {
      status.textContent = "Voice input is not available in this browser. Use Search or MAX Pick instead.";
      return;
    }

    stop();

    const currentRecognition = new SpeechRecognition();
    recognition = currentRecognition;
    currentRecognition.lang = "en-US";
    currentRecognition.interimResults = false;
    currentRecognition.continuous = false;
    mic.classList.add("listening");
    status.textContent = "I’m listening…";

    currentRecognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      stop();

      const preferences = parse(text);
      const message = summary(preferences);
      lastReply = message;
      heard.hidden = false;
      heard.innerHTML = `
        <div class="phrase">“${escapeHtml(text)}”</div>
        <div class="small heard-summary">${escapeHtml(message)}</div>
      `;
      status.textContent = "Got it. I’m finding a match.";

      if (voiceOn) speak(message);
      recommend(preferences).catch(showError);
    };

    currentRecognition.onerror = () => {
      stop();
      status.textContent = "MAX couldn’t hear that. Tap the microphone and try again.";
    };

    currentRecognition.onend = () => {
      if (recognition === currentRecognition) {
        recognition = null;
        mic.classList.remove("listening");
      }
    };

    try {
      currentRecognition.start();
    } catch {
      stop();
      status.textContent = "MAX could not start voice input. Please tap the microphone again.";
    }
  }

  function start() {
    if (!voiceOn) {
      startRecognition();
      return;
    }

    primeAudio();
    setTimeout(startRecognition, 120);
  }

  auto.onclick = () => {
    voiceOn = !voiceOn;
    localStorage.setItem("maxVoiceReplies", voiceOn ? "on" : "off");

    if (!voiceOn && "speechSynthesis" in window) {
      speechSynthesis.cancel();
    }

    refreshToggle();
  };

  mic.onclick = start;
  refreshToggle();

  window.addEventListener("pagehide", stop);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });

  if ("speechSynthesis" in window && typeof speechSynthesis.onvoiceschanged !== "undefined") {
    speechSynthesis.onvoiceschanged = () => getVoice();
  }
})();
