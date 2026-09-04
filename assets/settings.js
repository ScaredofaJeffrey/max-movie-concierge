(() => {
  "use strict";

  const API_BASE = "https://api.themoviedb.org/3";
  const TOKEN_KEY = "maxTmdbToken";
  const TRANSCRIBE_KEY = "maxTranscribeUrl";
  const DEFAULT_TRANSCRIBE_URL = "https://max-voice-transcription-inb26uz6u-m5vdfmywmv-4350.vercel.app/api/transcribe";
  const form = document.getElementById("settings-form");
  const input = document.getElementById("token");
  const transcribeInput = document.getElementById("transcribe-url");
  const message = document.getElementById("msg");

  input.value = localStorage.getItem(TOKEN_KEY) || "";
  transcribeInput.value = localStorage.getItem(TRANSCRIBE_KEY) || DEFAULT_TRANSCRIBE_URL;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = input.value.trim();
    const transcribeUrl = transcribeInput.value.trim();

    if (!token) {
      message.textContent = "Paste your TMDB token first.";
      return;
    }

    if (transcribeUrl) {
      try {
        const parsed = new URL(transcribeUrl);
        if (parsed.protocol !== "https:") {
          throw new Error("Voice transcription endpoint must use HTTPS.");
        }
      } catch (error) {
        message.textContent = error.message || "Enter a valid HTTPS transcription endpoint.";
        return;
      }
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

      localStorage.setItem(TOKEN_KEY, token);

      if (transcribeUrl) {
        localStorage.setItem(TRANSCRIBE_KEY, transcribeUrl);
      } else {
        localStorage.removeItem(TRANSCRIBE_KEY);
      }

      message.textContent = transcribeUrl
        ? "TMDB connected. Voice transcription endpoint saved."
        : "TMDB connected. Voice transcription is not configured.";
    } catch (error) {
      message.textContent = error.message;
    }
  });
})();
