import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './i18n';
import './index.css';

const basename = window.location.pathname === '/hotlinehq' || window.location.pathname.startsWith('/hotlinehq/')
  ? '/hotlinehq'
  : undefined;

// PWA service worker (push notifications) — root mount only
if ('serviceWorker' in navigator && !basename) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
