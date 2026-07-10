import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Auto-reload on new build: poll build-id.json on tab refocus + every 60s
(function () {
  let knownId = null;
  async function check() {
    try {
      const r = await fetch('/admin/build-id.json?_=' + Date.now());
      if (!r.ok) return;
      const { id } = await r.json();
      if (knownId === null) { knownId = id; return; }
      if (id !== knownId) window.location.reload();
    } catch {}
  }
  check();
  setInterval(check, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
})();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
