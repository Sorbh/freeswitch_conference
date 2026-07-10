import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './i18n';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Auto-reload on new build: poll build-id.json on tab refocus + every 60s
(function () {
  let knownId = null;
  async function check() {
    try {
      const r = await fetch('/build-id.json?_=' + Date.now());
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

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
