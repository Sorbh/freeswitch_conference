import { useState, useEffect } from "react";

const DISMISS_KEY = "hq_pwa_dismiss";
const DISMISS_DAYS = 14;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

function wasDismissed() {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  return Date.now() - Number(ts) < DISMISS_DAYS * 86400000;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    if (isIos) {
      const timer = setTimeout(() => setShowIosBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    if (!isMobile) return;

    function onPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (deferredPrompt || showIosBanner) {
      requestAnimationFrame(() => setVisible(true));
    }
  }, [deferredPrompt, showIosBanner]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setTimeout(() => { setDeferredPrompt(null); setShowIosBanner(false); }, 300);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferredPrompt(null);
  }

  if (!deferredPrompt && !showIosBanner) return null;

  return (
    <>
      <style>{`
        .pwa-banner {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
          padding: 16px; display: flex; justify-content: center;
          pointer-events: none;
          transform: translateY(100%); opacity: 0;
          transition: transform .3s cubic-bezier(.4,0,.2,1), opacity .3s ease;
        }
        .pwa-banner.pwa-visible { transform: translateY(0); opacity: 1; }
        .pwa-card {
          pointer-events: auto;
          display: flex; align-items: center; gap: 12px;
          max-width: 420px; width: 100%;
          padding: 14px 16px; border-radius: 14px;
          background: #16181d; color: #fff;
          box-shadow: 0 8px 32px -8px rgba(0,0,0,.4);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .pwa-icon {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
          background: #d92d20; display: flex; align-items: center; justify-content: center;
        }
        .pwa-text { flex: 1; min-width: 0; }
        .pwa-title { font-size: 14px; font-weight: 700; margin: 0 0 2px; }
        .pwa-desc { font-size: 12px; color: rgba(255,255,255,.6); margin: 0; line-height: 1.4; }
        .pwa-btn {
          flex-shrink: 0; padding: 8px 16px; border-radius: 8px;
          background: #d92d20; color: #fff; border: none;
          font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background .15s;
        }
        .pwa-btn:hover { background: #b42318; }
        .pwa-close {
          flex-shrink: 0; width: 28px; height: 28px; border-radius: 6px;
          background: rgba(255,255,255,.08); border: none; color: rgba(255,255,255,.4);
          font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background .15s;
        }
        .pwa-close:hover { background: rgba(255,255,255,.15); color: #fff; }
      `}</style>
      <div className={`pwa-banner ${visible ? "pwa-visible" : ""}`}>
        <div className="pwa-card">
          <div className="pwa-icon">
            <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
              <path d="M33.8 30.7v2.6a2.3 2.3 0 0 1-2.5 2.3 23 23 0 0 1-10-3.6 22.7 22.7 0 0 1-7-7 23 23 0 0 1-3.5-10.1 2.3 2.3 0 0 1 2.3-2.5h2.6a2.3 2.3 0 0 1 2.3 2c.1 1 .4 2.1.7 3.1a2.3 2.3 0 0 1-.5 2.4l-1.1 1.1a18.4 18.4 0 0 0 6.7 6.7l1.1-1.1a2.3 2.3 0 0 1 2.4-.5c1 .3 2 .6 3.1.7a2.3 2.3 0 0 1 2 2.3z" fill="#fff"/>
            </svg>
          </div>
          <div className="pwa-text">
            <p className="pwa-title">Hotline HQ</p>
            {showIosBanner ? (
              <p className="pwa-desc">Tap <strong>Share</strong> then <strong>Add to Home Screen</strong></p>
            ) : (
              <p className="pwa-desc">Install the app for quick access</p>
            )}
          </div>
          {deferredPrompt && <button className="pwa-btn" onClick={handleInstall}>Install</button>}
          <button className="pwa-close" onClick={dismiss} aria-label="Dismiss">&times;</button>
        </div>
      </div>
    </>
  );
}
