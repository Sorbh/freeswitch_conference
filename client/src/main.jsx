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

// Recover from stale hashed chunks after a deploy: Vite fires this when a
// dynamic import 404s (old tab, new build). One reload fetches the fresh
// chunk graph; the sessionStorage guard prevents reload loops.
window.addEventListener('vite:preloadError', (event) => {
  const last = Number(sessionStorage.getItem('chunk_reload_at') || 0);
  if (Date.now() - last > 30000) {
    event.preventDefault();
    sessionStorage.setItem('chunk_reload_at', String(Date.now()));
    window.location.reload();
  }
});

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

const _ssrRoot = document.getElementById('root');
if (_ssrRoot.querySelector('#ssr-shell') && document.getElementById('__BLOG_DATA__')) {
  const _overlay = _ssrRoot.cloneNode(true);
  _overlay.id = 'ssr-overlay';
  _ssrRoot.parentNode.insertBefore(_overlay, _ssrRoot);
  _ssrRoot.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
  window.__removeSSROverlay = () => {
    const o = document.getElementById('ssr-overlay');
    if (!o) return;
    o.remove();
    _ssrRoot.style.cssText = '';
    delete window.__removeSSROverlay;
  };
  setTimeout(() => window.__removeSSROverlay?.(), 8000);
}

createRoot(_ssrRoot).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
