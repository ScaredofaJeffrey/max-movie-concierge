(() => {
  "use strict";

  const services = [
    ["Netflix", "8"],
    ["Prime Video", "9"],
    ["Hulu", "15"],
    ["Disney+", "337"],
    ["Max", "1899"],
    ["Paramount+", "531"],
    ["Peacock", "386"],
    ["Apple TV+", "350"]
  ];

  const choices = document.getElementById("choices");

  function readPreferences() {
    try {
      return JSON.parse(localStorage.getItem("maxLastPreferences") || "null");
    } catch {
      return null;
    }
  }

  const preferences = readPreferences();

  if (!preferences) {
    choices.innerHTML = '<a class="link primary" href="./pick.html">Start MAX Pick</a>';
  } else {
    const current = new Set(preferences.services || []);

    services
      .filter(([, id]) => !current.has(id))
      .forEach(([name, id]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `Add ${name}`;
        button.addEventListener("click", () => {
          const next = [...(preferences.services || []), id];
          preferences.services = next;
          localStorage.setItem("maxLastPreferences", JSON.stringify(preferences));
          localStorage.setItem("maxNoWatchStreak", "0");
          location.href = "./repeat.html?serviceAdded=1";
        });
        choices.appendChild(button);
      });

    const keep = document.createElement("a");
    keep.className = "link";
    keep.href = "./repeat.html?keepServices=1";
    keep.textContent = "Keep current services";
    choices.appendChild(keep);
  }
})();
