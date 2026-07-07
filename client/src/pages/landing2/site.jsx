import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../../components/LanguageSwitcher";

/* ------------------------------------------------------------------ */
/*  Hotline HQ — shared site chrome: SVG logo, nav, footer, doc shell  */
/*  Used by the landing page and the about/legal pages.                */
/* ------------------------------------------------------------------ */

export function HQMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#d92d20" />
      {/* handset */}
      <path
        d="M33.8 30.7v2.6a2.3 2.3 0 0 1-2.5 2.3 23 23 0 0 1-10-3.6 22.7 22.7 0 0 1-7-7 23 23 0 0 1-3.5-10.1 2.3 2.3 0 0 1 2.3-2.5h2.6a2.3 2.3 0 0 1 2.3 2c.1 1 .4 2.1.7 3.1a2.3 2.3 0 0 1-.5 2.4l-1.1 1.1a18.4 18.4 0 0 0 6.7 6.7l1.1-1.1a2.3 2.3 0 0 1 2.4-.5c1 .3 2 .6 3.1.7a2.3 2.3 0 0 1 2 2.3z"
        fill="#ffffff"
      />
      {/* broadcast waves */}
      <path d="M30.5 13.6a8.6 8.6 0 0 1 5 5" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M32.8 8.4a14.3 14.3 0 0 1 8 8" stroke="#ffb4ad" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function HQLogo({ light = false, size = 32 }) {
  return (
    <span className={`l2-logowrap ${light ? "light" : ""}`}>
      <HQMark size={size} />
      <span className="l2-logo-text">
        Hotline&nbsp;<em>HQ</em>
      </span>
    </span>
  );
}

export const CONTACT_EMAIL = "hotlinehq@redlineusedautoparts.com";
const HOTLINE_LOGIN_URL = "https://hotline.redlineusedautoparts.com/client/login";
const HOTLINE_SIGNUP_URL = "https://hotline.redlineusedautoparts.com/client/signup";
const HOTLINE_ADMIN_URL = "https://hotline.redlineusedautoparts.com/admin/login";
const SITE_BASE_PATH = "/hotlinehq";

function getSiteBasePath() {
  if (typeof window === "undefined") return "";
  return window.location.pathname === SITE_BASE_PATH ||
    window.location.pathname.startsWith(`${SITE_BASE_PATH}/`)
    ? SITE_BASE_PATH
    : "";
}

export function buildSiteUrl(path = "/") {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const basePath = getSiteBasePath();
  const normalizedPath = path === "/" ? "/" : path.replace(/\/+$/, "");
  return `${origin}${basePath}${normalizedPath}`;
}

/* ------------------------------------------------------------------ */
/*  SEO — sets title, meta, Open Graph, canonical, and JSON-LD         */
/* ------------------------------------------------------------------ */

export function Seo({
  title,
  description,
  keywords,
  path = "/",
  canonicalUrl = null,
  jsonLd = null,
  robots = "index, follow",
}) {
  useEffect(() => {
    document.title = title;

    const ensure = (selector, create) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      return el;
    };
    const setNamed = (name, content) => {
      const el = ensure(`meta[name="${name}"]`, () => {
        const m = document.createElement("meta");
        m.name = name;
        return m;
      });
      el.content = content;
    };
    const setProp = (prop, content) => {
      const el = ensure(`meta[property="${prop}"]`, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", prop);
        return m;
      });
      el.content = content;
    };

    const url = canonicalUrl || buildSiteUrl(path);

    setNamed("description", description);
    if (keywords) setNamed("keywords", keywords);
    setNamed("robots", robots);
    setProp("og:title", title);
    setProp("og:description", description);
    setProp("og:type", "website");
    setProp("og:url", url);
    setProp("og:site_name", "Hotline HQ");
    setNamed("twitter:card", "summary");
    setNamed("twitter:title", title);
    setNamed("twitter:description", description);

    const canon = ensure('link[rel="canonical"]', () => {
      const l = document.createElement("link");
      l.rel = "canonical";
      return l;
    });
    canon.href = url;

    let script = document.getElementById("seo-jsonld");
    if (jsonLd) {
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "seo-jsonld";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) {
      script.remove();
    }
  }, [title, description, keywords, path, jsonLd, robots, canonicalUrl]);
  return null;
}

/* JSON-LD for the main landing page. */
export function landingJsonLd() {
  const websiteUrl = buildSiteUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${websiteUrl}#org`,
        name: "Hotline HQ",
        url: websiteUrl,
        logo: buildSiteUrl("/favicon.svg"),
        email: CONTACT_EMAIL,
        description:
          "Hotline HQ builds and operates always-on voice hotline networks that connect businesses in the same industry — proven with a 500+ yard used auto parts network.",
      },
      {
        "@type": "WebSite",
        name: "Hotline HQ",
        url: websiteUrl,
        publisher: { "@id": `${websiteUrl}#org` },
      },
      {
        "@type": "Service",
        name: "Hotline HQ voice hotline network",
        serviceType: "Always-on business voice hotline network",
        provider: { "@id": `${websiteUrl}#org` },
        areaServed: "US",
        description:
          "An always-on voice hotline that connects member businesses by region. Members broadcast requests live and get answers in seconds; the network owner earns flat monthly membership revenue.",
        offers: {
          "@type": "Offer",
          priceCurrency: "USD",
          description: "Flat monthly membership per member business.",
        },
      },
    ],
  };
}

/* Slim nav for the about/legal pages. */
export function SiteNav() {
  const { t } = useTranslation("common");
  return (
    <header className="l2-nav">
      <Link className="l2-logo" to="/">
        <HQLogo />
      </Link>
      <nav className="l2-nav-links">
        <Link to="/">{t("nav.home")}</Link>
        <Link to="/#how">{t("nav.howItWorks")}</Link>
        <Link to="/marketplace">Marketplace</Link>
        <a href={HOTLINE_LOGIN_URL} className="l2-nav-login">{t("nav.login")}</a>
        <a href={HOTLINE_SIGNUP_URL} className="l2-nav-cta">
          {t("nav.signUpFree")}
        </a>
        <LanguageSwitcher />
      </nav>
    </header>
  );
}

const PRODUCT_LINK_KEYS = [
  ["footer.hearItLive", "/#listen-live"],
  ["footer.howItWorks", "/#how"],
  ["footer.coverageLink", "/#rooms"],
  ["footer.theSystem", "/#system"],
  ["footer.getALine", "/#join"],
  ["footer.ownAutoPartsHotline", "/own-a-hotline"],
  ["footer.marketplace", "/marketplace"],
];

const ROOM_LINKS = [
  "California", "Texas", "Florida", "Arizona", "Michigan", "Georgia",
  "Ohio", "New York", "Indiana", "Carolinas",
];

export function SiteFooter() {
  const { t } = useTranslation("common");
  return (
    <footer className="l2f">
      <div className="l2f-inner">
        <div className="l2f-brand">
          <Link to="/" className="l2f-logolink">
            <HQLogo light />
          </Link>
          <p>{t("footer.brandDescription")}</p>
          <a
            className="l2f-mail"
            href={`mailto:${CONTACT_EMAIL}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="l2f-col">
          <p className="l2f-head">{t("footer.product")}</p>
          {PRODUCT_LINK_KEYS.map(([key, href]) => (
            <Link key={key} to={href}>
              {t(key)}
            </Link>
          ))}
        </div>

        <div className="l2f-col">
          <p className="l2f-head">{t("footer.rooms")}</p>
          {ROOM_LINKS.map((r) => (
            <Link key={r} to="/#rooms">
              {r}
            </Link>
          ))}
          <Link to="/#rooms" className="l2f-more">
            {t("footer.allRooms")}
          </Link>
        </div>

        <div className="l2f-col">
          <p className="l2f-head">{t("footer.company")}</p>
          <Link to="/about">{t("footer.aboutUs")}</Link>
          <Link to="/privacy-policy">{t("footer.privacyPolicy")}</Link>
          <Link to="/terms-and-conditions">{t("footer.termsConditions")}</Link>
          <Link to="/disclaimer">{t("footer.disclaimer")}</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} target="_blank" rel="noopener noreferrer">
            {t("footer.contact")}
          </a>
          <a href={HOTLINE_ADMIN_URL}>{t("footer.admin")}</a>
        </div>
      </div>

      <div className="l2f-note">
        {t("footer.notice")}
      </div>

      <div className="l2f-bottom">
        <span>{t("footer.copyright")}</span>
        <span className="l2f-bottom-links">
          <Link to="/privacy-policy">{t("footer.privacy")}</Link>
          <Link to="/terms-and-conditions">{t("footer.terms")}</Link>
          <Link to="/disclaimer">{t("footer.disclaimer")}</Link>
          <Link to="/about">{t("footer.aboutUs")}</Link>
        </span>
      </div>
    </footer>
  );
}

/* Shell for the about/legal pages. */
export function PageShell({ kicker, title, updated, children, seo }) {
  const { t } = useTranslation("common");
  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      {seo && <Seo {...seo} />}
      <SiteNav />
      <main className="l2-doc">
        <p className="l2-doc-kicker">{kicker}</p>
        <h1>{title}</h1>
        {updated && <p className="l2-doc-updated">{t("lastUpdated", { date: updated })}</p>}
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared styles: base vars, nav, logo, footer, document pages        */
/* ------------------------------------------------------------------ */

export const SITE_CSS = `
.l2 {
  --bg: #fbfaf8;
  --surface: #ffffff;
  --band: #f4f2ee;
  --ink: #16181d;
  --muted: #5d6370;
  --line: #e7e4dd;
  --red: #d92d20;
  --red-deep: #b42318;
  --red-soft: #fef3f2;
  --green: #12b76a;
  --display: "Bricolage Grotesque", "Georgia", sans-serif;
  --body: "Instrument Sans", sans-serif;
  --mono: "IBM Plex Mono", monospace;

  background: var(--bg);
  color: var(--ink);
  font-family: var(--body);
  min-height: 100vh;
}
.l2 *, .l2 *::before, .l2 *::after { box-sizing: border-box; }
.l2 a { text-decoration: none; color: inherit; }

/* logo */
.l2-logowrap { display: inline-flex; align-items: center; gap: 10px; }
.l2-logo-text {
  font-family: var(--display); font-weight: 700; font-size: 21px;
  letter-spacing: -0.01em; color: var(--ink); white-space: nowrap;
}
.l2-logo-text em { font-style: normal; color: var(--red); }
.l2-logowrap.light .l2-logo-text { color: #ffffff; }

/* nav (shared) */
.l2-nav {
  position: fixed; inset: 0 0 auto 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 32px;
  background: rgba(251,250,248,0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.l2-nav-links { display: flex; gap: 26px; align-items: center; font-size: 14.5px; font-weight: 500; }
.l2-nav-links a { color: var(--muted); transition: color .2s; }
.l2-nav-links a:hover { color: var(--ink); }
.l2-nav-login {
  color: var(--ink) !important; font-weight: 600;
  padding: 9px 16px; border-radius: 9px; transition: background .2s;
}
.l2-nav-login:hover { background: rgba(0,0,0,0.04); }
.l2-nav-cta {
  color: #fff !important; background: var(--red);
  padding: 9px 18px; border-radius: 9px; transition: background .2s;
}
.l2-nav-cta:hover { background: var(--red-deep); }
@media (max-width: 860px) { .l2-nav-links a:not(.l2-nav-cta):not(.l2-nav-login) { display: none; } }

/* footer */
.l2f { background: #111316; color: #b9bcc4; }
.l2f-inner {
  max-width: 1280px; margin: 0 auto; padding: 72px 32px 48px;
  display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 48px;
}
@media (max-width: 980px) { .l2f-inner { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .l2f-inner { grid-template-columns: 1fr; } }
.l2f-brand p { font-size: 14.5px; line-height: 1.65; margin: 18px 0; max-width: 320px; color: #8d919b; }
.l2f-logolink { display: inline-block; }
.l2f-mail { font-family: var(--mono); font-size: 13px; color: #ff6f61; }
.l2f-mail:hover { color: #ff9b91; }
.l2f-head {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.16em;
  text-transform: uppercase; color: #ffffff; margin: 4px 0 16px; font-weight: 600;
}
.l2f-col { display: flex; flex-direction: column; gap: 10px; }
.l2f-col a { font-size: 14px; color: #8d919b; transition: color .2s; }
.l2f-col a:hover { color: #ffffff; }
.l2f-more { color: #ff6f61 !important; }
.l2f-note {
  max-width: 1280px; margin: 0 auto; padding: 0 32px 24px;
  font-size: 12px; line-height: 1.7; color: #6b6f7a;
  border-bottom: 1px solid #23262b;
}
.l2f-bottom {
  max-width: 1280px; margin: 0 auto; padding: 20px 32px 26px;
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  font-size: 12.5px; color: #6b6f7a;
}
.l2f-bottom-links { display: inline-flex; gap: 18px; }
.l2f-bottom-links a { color: #8d919b; }
.l2f-bottom-links a:hover { color: #ffffff; }

@media (max-width: 640px) {
  .l2-nav { padding: 10px 16px; }
  .l2-nav-links { gap: 8px; }
  .l2-nav-login { padding: 8px 10px; font-size: 13px; }
  .l2-nav-cta { padding: 8px 14px; font-size: 13px; }
  .l2f-inner { padding: 48px 16px 32px; gap: 32px; }
  .l2f-note { padding: 0 16px 20px; }
  .l2f-bottom { padding: 16px; }
  .l2-doc { padding: 120px 16px 60px; }
}

/* document pages (about / legal) */
.l2-doc { max-width: 840px; margin: 0 auto; padding: 150px 32px 90px; }
.l2-doc-kicker {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--red); margin: 0 0 14px;
}
.l2-doc h1 {
  font-family: var(--display); font-weight: 700; font-size: clamp(34px, 5vw, 52px);
  line-height: 1.05; letter-spacing: -0.015em; margin: 0 0 10px;
}
.l2-doc-updated { font-family: var(--mono); font-size: 12px; color: #a3a094; margin: 0 0 36px; }
.l2-doc h2 {
  font-family: var(--display); font-weight: 700; font-size: 24px;
  margin: 40px 0 12px; letter-spacing: -0.01em;
}
.l2-doc p, .l2-doc li { color: var(--muted); font-size: 15.5px; line-height: 1.75; }
.l2-doc p { margin: 0 0 16px; }
.l2-doc ul { padding-left: 22px; margin: 0 0 16px; }
.l2-doc li { margin-bottom: 8px; }
.l2-doc strong { color: var(--ink); }
.l2-doc a { color: var(--red); }
.l2-doc a:hover { text-decoration: underline; }
.l2-doc .l2-doc-lead { font-size: 17.5px; color: var(--ink); opacity: 0.85; }

/* team grid (about page) */
.l2-team { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 24px 0 8px; }
@media (max-width: 700px) { .l2-team { grid-template-columns: 1fr; } }
.l2-team-card {
  display: flex; gap: 16px; align-items: flex-start;
  background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
  padding: 18px;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.12);
}
.l2-team-card img {
  width: 84px; height: 84px; border-radius: 12px; object-fit: cover; flex-shrink: 0;
  border: 1px solid var(--line);
}
.l2-team-name {
  font-family: var(--display); font-weight: 700; font-size: 18px;
  color: var(--ink); margin: 2px 0 2px !important; line-height: 1.2;
}
.l2-team-role {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--red); margin: 0 0 8px !important;
}
.l2-team-role span { color: #a3a094; }
.l2-team-bio { font-size: 13.5px !important; line-height: 1.55 !important; margin: 0 !important; }
`;
