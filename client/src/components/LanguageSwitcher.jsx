import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../i18n";

export default function LanguageSwitcher({ light = false }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ||
    LANGUAGES.find((l) => i18n.language?.startsWith(l.code)) ||
    LANGUAGES[0];

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  function change(code) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  return (
    <div className="lang-sw" ref={ref}>
      <style>{CSS}</style>
      <button
        type="button"
        className={`lang-sw-btn ${light ? "light" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Change language"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="lang-sw-code">{current.code.toUpperCase()}</span>
      </button>

      {open && (
        <div className="lang-sw-dropdown">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`lang-sw-option ${l.code === current.code ? "active" : ""}`}
              onClick={() => change(l.code)}
            >
              <span className="lang-sw-option-label">{l.label}</span>
              <span className="lang-sw-option-code">{l.code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CSS = `
.lang-sw { position: relative; display: inline-flex; z-index: 100; }
.lang-sw-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 8px;
  border: 1px solid var(--line, #e7e4dd);
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(6px);
  cursor: pointer; font-family: var(--mono, monospace);
  font-size: 12px; font-weight: 600; letter-spacing: 0.06em;
  color: var(--muted, #5d6370);
  transition: border-color .2s, background .2s;
}
.lang-sw-btn:hover { border-color: var(--red, #d92d20); color: var(--ink, #16181d); }
.lang-sw-btn.light { border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #b9bcc4; }
.lang-sw-btn.light:hover { border-color: rgba(255,255,255,0.5); color: #fff; }
.lang-sw-code { min-width: 20px; text-align: center; }
.lang-sw-dropdown {
  position: absolute; top: calc(100% + 6px); right: 0;
  min-width: 180px; padding: 6px;
  background: #fff; border: 1px solid var(--line, #e7e4dd);
  border-radius: 12px;
  box-shadow: 0 8px 32px -8px rgba(22,24,29,0.22);
  display: flex; flex-direction: column;
}
.lang-sw-option {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 14px; border: 0; border-radius: 8px;
  background: transparent; cursor: pointer;
  font-family: var(--body, sans-serif); font-size: 14px;
  color: var(--ink, #16181d);
  transition: background .15s;
}
.lang-sw-option:hover { background: var(--band, #f4f2ee); }
.lang-sw-option.active { background: var(--red-soft, #fef3f2); color: var(--red, #d92d20); font-weight: 600; }
.lang-sw-option-code {
  font-family: var(--mono, monospace); font-size: 11px;
  letter-spacing: 0.08em; color: var(--muted, #5d6370);
}
.lang-sw-option.active .lang-sw-option-code { color: var(--red, #d92d20); }

[dir="rtl"] .lang-sw-dropdown { right: auto; left: 0; }
`;
