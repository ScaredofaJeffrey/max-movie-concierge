(() => {
  "use strict";

  const nativeRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isOpera = /OPR\//i.test(navigator.userAgent);

  // Keep native recognition everywhere it is actually supported.
  if (nativeRecognition && !isOpera) return;

  class MaxVoiceRecorder {
    constructor() {
      this.lang = "en-US";
      this.interimResults = false;
      this.continuous = false;
      this.maxAlternatives = 1;
      this.onstart = null;
      this.onaudiostart = null;
      this.onsoundstart = null;
      this.onspeechstart = null;
      this.onspeechend = null;
      this.onaudioend = null;
      this.onsoundend = null;
      this.onresult = null;
      this.onnomatch = null;
      this.onerror = null;
      this.onend = null;
      this.stream = null;
      this.recorder = null;
      this.chunks = [];
      this.running = false;
      this.silenceTimer = null;
      this.maxTimer = null;
      this.audioContext = null;
      this.analyser = null;
      this.raf = null;
      this.speechDetected = false;
      this.startedAt = 0;
    }

    async start() {
      if (this.running) {
        throw new DOMException("Recognition has already started.", "InvalidStateError");
      }

      const endpoint = localStorage.getItem("maxTranscribeUrl") || "";

      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        this.fail("not-supported", "MAX voice recording is not available in this browser.");
        return;
      }

      if (!endpoint) {
        this.fail("service-not-configured", "MAX voice transcription is not connected yet. Add the transcription endpoint in MAX Settings.");
        return;
      }

      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.running = true;
        this.startedAt = Date.now();
        this.chunks = [];
        this.speechDetected = false;
        this.recorder = new MediaRecorder(this.stream);

        this.recorder.ondataavailable = (event) => {
          if (event.data?.size) this.chunks.push(event.data);
        };

        this.recorder.onstop = () => this.finish(endpoint);
        this.recorder.onerror = () => {
          this.fail("audio-capture", "MAX could not read the microphone.");
        };

        this.setupMeter();
        this.recorder.start();
        this.onstart?.();
        this.onaudiostart?.();
        this.maxTimer = setTimeout(() => this.stopRecording(), 10000);
      } catch (error) {
        this.cleanup();
        const code = error?.name === "NotAllowedError" ? "not-allowed" : "audio-capture";
        this.fail(code, error?.message || "MAX could not access the microphone.");
      }
    }

    stop() {
      if (this.running) this.stopRecording();
    }

    abort() {
      if (!this.running) return;
      this.cleanup();
      this.running = false;
      this.onend?.();
    }

    stopRecording() {
      if (!this.running) return;
      this.clearTimers();
      if (this.recorder && this.recorder.state !== "inactive") {
        this.recorder.stop();
      } else {
        this.finish(localStorage.getItem("maxTranscribeUrl") || "");
      }
    }

    setupMeter() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.audioContext = new AudioContext();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        source.connect(this.analyser);

        const data = new Uint8Array(this.analyser.fftSize);
        let silentSince = 0;

        const tick = () => {
          if (!this.running || !this.analyser) return;

          this.analyser.getByteTimeDomainData(data);
          let sum = 0;

          for (const value of data) {
            const sample = (value - 128) / 128;
            sum += sample * sample;
          }

          const rms = Math.sqrt(sum / data.length);
          const speaking = rms > 0.018;
          const warmedUp = Date.now() - this.startedAt >= 600;

          if (speaking && warmedUp) {
            silentSince = 0;
            if (!this.speechDetected) {
              this.speechDetected = true;
              this.onsoundstart?.();
              this.onspeechstart?.();
            }
          } else if (this.speechDetected) {
            if (!silentSince) silentSince = Date.now();
            if (Date.now() - silentSince >= 1200) {
              this.onspeechend?.();
              this.stopRecording();
              return;
            }
          }

          this.raf = requestAnimationFrame(tick);
        };

        this.raf = requestAnimationFrame(tick);
      } catch {
        // Recording still works without the meter; the ten-second limit remains active.
      }
    }

    clearTimers() {
      clearTimeout(this.maxTimer);
      clearTimeout(this.silenceTimer);
      this.maxTimer = null;
      this.silenceTimer = null;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    async finish(endpoint) {
      if (!this.running) return;

      this.running = false;
      const blob = new Blob(this.chunks, {
        type: this.recorder?.mimeType || "audio/webm"
      });

      this.onaudioend?.();
      this.onsoundend?.();
      this.cleanup();
      this.onend?.();

      if (!blob.size) {
        this.onnomatch?.();
        return;
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: blob,
          headers: {
            "Content-Type": blob.type || "audio/webm"
          }
        });

        if (!response.ok) {
          throw new Error(`Transcription service returned ${response.status}`);
        }

        const data = await response.json();
        const text = String(data.text || "").trim();

        if (!text) {
          this.onnomatch?.();
          return;
        }

        this.onresult?.({
          results: [[{ transcript: text }]]
        });
      } catch (error) {
        this.onerror?.({
          error: "network",
          message: error?.message || "MAX could not transcribe that request."
        });
      }
    }

    fail(error, message) {
      this.running = false;
      this.cleanup();
      this.onerror?.({ error, message });
      this.onend?.();
    }

    cleanup() {
      this.clearTimers();

      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
      }

      this.stream = null;

      if (this.audioContext) {
        this.audioContext.close().catch(() => {});
      }

      this.audioContext = null;
      this.analyser = null;
      this.recorder = null;
      this.chunks = [];
      this.speechDetected = false;
      this.startedAt = 0;
    }
  }

  window.SpeechRecognition = MaxVoiceRecorder;
  window.webkitSpeechRecognition = MaxVoiceRecorder;
})();
