// Supportgram chat widget loader — injects the script async so it never blocks rendering.
// Identity (when known) must be set on window.SupportgramSettings BEFORE the script loads;
// the widget reads it once at init and skips the pre-chat form.

const WIDGET_SRC = 'https://supportgram.vercel.app/widget.js';
const WIDGET_KEY = 'pk_7ddc4b6bdd4ed3331af1cdf7';
const SCRIPT_ID = 'supportgram-widget';
const BRAND_COLOR = '#d92d20'; // Hotline HQ --red

export function loadSupportgram(identity, options = {}) {
  if (typeof document === 'undefined') return;

  if (identity?.name && identity?.email) {
    window.SupportgramSettings = { name: identity.name, email: identity.email, hmac: identity.hmac };
  }

  // Already loaded (SPA navigation): switch identity at runtime instead of re-injecting.
  if (window.Supportgram) {
    if (identity?.email) window.Supportgram.identify(identity);
    return;
  }

  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = WIDGET_SRC;
  script.async = true;
  script.setAttribute('data-key', WIDGET_KEY);
  script.setAttribute('data-color', BRAND_COLOR);
  script.setAttribute('data-title', 'Hotline HQ');
  script.setAttribute('data-greeting', 'Let me know if you have any questions!');
  if (options.offset) script.setAttribute('data-offset', String(options.offset));
  document.body.appendChild(script);
}

// Call on logout: drops the user identity so the widget returns to the anonymous slot.
export function resetSupportgram() {
  try { delete window.SupportgramSettings; } catch { /* ignore */ }
  if (window.Supportgram) window.Supportgram.reset();
}
