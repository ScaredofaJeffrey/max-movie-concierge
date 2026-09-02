(() => {
  "use strict";

  const API_BASE = "https://api.themoviedb.org/3";
  const IMAGE_BASE = "https://image.tmdb.org/t/p/w780";
  const output = document.getElementById("out");
  let item = null;

  const getToken = () => localStorage.getItem("maxTmdbToken") || "";
  const voiceOn = () => localStorage.getItem("maxVoiceReplies") !== "off";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function speak(text) {
    if (!voiceOn() || !("speechSynthesis" in window)) return false;

    try {
      const synthesis = window.speechSynthesis;
      synthesis.cancel();
      synthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voice = synthesis.getVoices().find((candidate) =>
        /^en(-|_)?US$/i.test(candidate.lang)
      ) || synthesis.getVoices().find((candidate) => /^en/i.test(candidate.lang));

      if (voice) utterance.voice = voice;
      synthesis.speak(utterance);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function api(path) {
    const response = await fetch(API_BASE + path, {
      headers: {
        Authorization: "Bearer " + getToken()
      }
    });

    if (!response.ok) {
      throw new Error("TMDB returned " + response.status);
    }

    return response.json();
  }

  function saveForLater() {
    const saved = JSON.parse(localStorage.getItem("maxLater") || "[]")
      .filter((savedItem) => Number(savedItem.id) !== Number(item.id));

    saved.push({
      id: Number(item.id),
      type: item.type,
      title: item.title,
      poster_path: item.poster_path || "",
      overview: item.overview || "",
      added: Date.now(),
      reason: "maybe"
    });

    localStorage.setItem("maxLater", JSON.stringify(saved));
    next("maybe");
  }

  function adjustGenreTaste(delta) {
    const taste = JSON.parse(localStorage.getItem("maxGenreTaste") || "{}");

    (item.genres || []).forEach((genre) => {
      taste[genre.id] = Math.max(
        -5,
        Math.min(5, Number(taste[genre.id] || 0) + delta)
      );
    });

    localStorage.setItem("maxGenreTaste", JSON.stringify(taste));
  }

  function next(reason) {
    const history = JSON.parse(
      localStorage.getItem("maxReactionHistory") || "[]"
    );

    history.unshift({
      id: item.id,
      reason,
      genres: (item.genres || []).map((genre) => genre.id),
      at: Date.now()
    });

    localStorage.setItem(
      "maxReactionHistory",
      JSON.stringify(history.slice(0, 30))
    );

    const streak = Number(localStorage.getItem("maxNoWatchStreak") || 0) + 1;
    localStorage.setItem("maxNoWatchStreak", String(streak));
    location.href = "./repeat.html?v=" + Date.now();
  }

  function comment() {
    const preferences = JSON.parse(
      localStorage.getItem("maxLastPreferences") || "{}"
    );

    const vibe = {
      laugh: "funny",
      hooked: "tense",
      think: "thought-provoking",
      feeling: "emotional",
      freak: "creepy",
      surprise: "a wildcard"
    }[preferences.vibe] || "your kind of";

    const novelty = {
      new: "newer",
      comfort: "familiar",
      surprise: "a change of pace"
    }[preferences.novelty] || "something different";

    return `Okay, I found you something ${vibe} and ${novelty}. I think this one is worth a shot.`;
  }

  function renderItem() {
    const message = comment();
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : "—";

    output.innerHTML = `
      <div class="card">
        ${item.poster_path ? `
          <img
            class="poster"
            src="${IMAGE_BASE}${item.poster_path}"
            alt="Poster for ${escapeHtml(item.title)}"
          >
        ` : ""}
        <div class="title">${escapeHtml(item.title)}</div>
        <p class="muted">${escapeHtml(year)} · TMDB ${rating}/10</p>
        <p class="small">${escapeHtml(item.overview || "MAX found this for you.")}</p>
      </div>

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

    if (voiceOn()) {
      setTimeout(() => speak(message), 350);
    }

    document.getElementById("find").onclick = () => {
      adjustGenreTaste(-0.5);
      if (voiceOn()) speak("Sure. I’ll find you another one.");
      next("find-another");
    };

    document.getElementById("later").onclick = () => {
      if (voiceOn()) {
        speak("No problem. I’ll save this one for later and find you another.");
      }
      saveForLater();
    };

    document.getElementById("today").onclick = () => {
      adjustGenreTaste(-1);
      if (voiceOn()) speak("Got it. Not tonight. I’ll try something else.");
      next("not-today");
    };

    document.getElementById("nope").onclick = () => {
      adjustGenreTaste(-4);

      const rejected = new Set(
        JSON.parse(localStorage.getItem("maxRejected") || "[]").map(Number)
      );

      rejected.add(Number(item.id));
      localStorage.setItem("maxRejected", JSON.stringify([...rejected]));

      if (voiceOn()) speak("Understood. I won’t recommend that one again.");
      next("no-never");
    };
  }

  async function run() {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const type = params.get("type") || "movie";

    if (!id) {
      output.innerHTML = `
        <div class="status">No title selected.</div>
        <a class="link primary" href="./index.html">Back to MAX</a>
      `;
      return;
    }

    if (!getToken()) {
      output.innerHTML = `
        <div class="status">TMDB is not connected.</div>
        <a class="link primary" href="./settings.html">Open Settings</a>
      `;
      return;
    }

    try {
      const data = await api(`/${type}/${id}?language=en-US`);
      item = {
        ...data,
        id: Number(id),
        type,
        title: data.title || data.name
      };
      renderItem();
    } catch (error) {
      output.innerHTML = `
        <div class="status">${escapeHtml(error.message)}</div>
        <a class="link primary" href="./search.html">Back to Search</a>
        <a class="link" href="./index.html">Back to MAX</a>
      `;
    }
  }

  run();
})();
