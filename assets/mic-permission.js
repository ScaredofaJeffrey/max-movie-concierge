(() => {
  "use strict";

  const mic = document.getElementById("mic");
  const status = document.getElementById("status");

  if (!mic || !status) return;

  const originalClick = mic.onclick;

  mic.onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = "MAX cannot access microphone input in this browser. Try Opera's microphone settings or use Search instead.";
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach((track) => track.stop());

      if (typeof originalClick === "function") {
        originalClick.call(mic);
      }
    } catch (error) {
      const reason = error?.name || "Microphone access error";
      status.textContent = `MAX could not access the microphone (${reason}). Check Opera's site microphone permission and try again.`;
    }
  };
})();
