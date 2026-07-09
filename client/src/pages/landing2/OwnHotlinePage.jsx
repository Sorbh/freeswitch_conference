import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL, buildSiteUrl } from "./site";

/* ------------------------------------------------------------------ */
/*  /own-a-hotline — operator-intent page.                             */
/*  Target searches: auto parts hotline, own a hotline,                */
/*  used auto parts hotline, start a hotline business.                 */
/* ------------------------------------------------------------------ */

export function OwnHotlinePage() {
  const { t } = useTranslation("own");

  const MODEL = [
    { n: "1", title: t("model.step1.title"), copy: t("model.step1.copy") },
    { n: "2", title: t("model.step2.title"), copy: t("model.step2.copy") },
    { n: "3", title: t("model.step3.title"), copy: t("model.step3.copy") },
  ];

  const TRADES = [
    [t("trades.usedAuto"), t("trades.usedAutoNote")],
    [t("trades.heavyTruck"), t("trades.heavyTruckNote")],
    [t("trades.equipment"), t("trades.equipmentNote")],
    [t("trades.building"), t("trades.buildingNote")],
    [t("trades.wholesale"), t("trades.wholesaleNote")],
  ];

  const INCLUDED = t("included.items", { returnObjects: true });

  const FEATURES = [
    { slug: "always-on-voice-network", icon: FeatIconNetwork, title: "Always-On Voice Network", desc: "Live voice hotline running 24/7. No dialing, no waiting. Members are connected the moment their phone powers on.", accent: "#d92d20" },
    { slug: "caller-id", icon: FeatIconCallerId, title: "Real-Time Caller ID", desc: "See who's talking — company name, rep name, phone, city. Know exactly which yard is broadcasting before you respond.", accent: "#2563eb" },
    { slug: "any-device", icon: FeatIconDevice, title: "Works On Any Device", desc: "Preconfigured desk phone or just open the web app on your mobile. No hardware required — push-to-talk from your pocket.", accent: "#7c3aed" },
    { slug: "direct-calls", icon: FeatIconDirect, title: "Private Direct Calls", desc: "Every member gets a 3-digit extension. Call any yard privately over the network — zero phone bills.", accent: "#0891b2" },
    { slug: "broadcast-recording", icon: FeatIconRecord, title: "Broadcast Recording", desc: "Every broadcast recorded automatically. Browse history, track response times, replay any conversation.", accent: "#ea580c" },
    { slug: "notifications", icon: FeatIconNotify, title: "Smart Notifications", desc: "Push notifications on mobile, Telegram alerts, lock screen controls. Your members never miss a part request.", accent: "#16a34a" },
    { slug: "unanswered-capture", icon: FeatIconCapture, title: "Unanswered Broadcast Capture", desc: "No request goes to waste. Unanswered broadcasts are auto-transcribed, parsed for year/make/model, and listed on the marketplace.", accent: "#ca8a04" },
    { slug: "parts-marketplace", icon: FeatIconMarket, title: "Parts Marketplace", desc: "Every captured broadcast becomes a searchable part listing. SEO-optimized pages bring new members straight from Google.", accent: "#db2777" },
    { slug: "admin-dashboard", icon: FeatIconDashboard, title: "Admin Dashboard", desc: "Real-time analytics, room management, member health monitoring, broadcast stats. Full control from one screen.", accent: "#4f46e5" },
    { slug: "multi-language", icon: FeatIconLang, title: "Multi-Language", desc: "Available in 6 languages with RTL support. Your members use the app in their own language.", accent: "#0d9488" },
    { slug: "enterprise-security", icon: FeatIconSecurity, title: "Enterprise Security", desc: "JWT auth, rate limiting, SIP digest auth, encrypted connections. Built for always-on production use.", accent: "#64748b" },
  ];

  const FAQS = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
  ];

  function ownJsonLd() {
    const homepageUrl = buildSiteUrl("/");
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Service",
          name: t("jsonLd.serviceName"),
          serviceType: t("jsonLd.serviceType"),
          provider: { "@type": "Organization", name: "Hotline HQ", url: homepageUrl, email: CONTACT_EMAIL },
          areaServed: "US",
          description: t("jsonLd.serviceDescription"),
        },
        {
          "@type": "FAQPage",
          mainEntity: FAQS.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.a,
            },
          })),
        },
      ],
    };
  }

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{OWN_CSS}</style>
      <Seo
        title={t("seo.title")}
        description={t("seo.description")}
        keywords={t("seo.keywords")}
        canonicalUrl="https://hotlinehq.online/own-a-hotline"
        path="/own-a-hotline"
        jsonLd={ownJsonLd()}
      />
      <SiteNav />

      <main className="l2-ownpage">
        {/* hero */}
        <section className="l2-own-hero">
          <p className="l2-doc-kicker">{t("hero.kicker")}</p>
          <h1 dangerouslySetInnerHTML={{ __html: t("hero.heading") }} />
          <p className="l2-own-lede">{t("hero.lede")}</p>
          <div className="l2-own-ctas">
            <Link className="l2-btn l2-btn-hot" to="/">
              {t("hero.seeNetwork")}
            </Link>
            <a
              className="l2-btn l2-btn-ghost"
              href={`mailto:${CONTACT_EMAIL}?subject=Launching an auto parts hotline`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("hero.talkToUs")}
            </a>
          </div>
        </section>

        {/* proof bar */}
        <section className="l2-own-proof">
          <p dangerouslySetInnerHTML={{ __html: t("proof") }} />
        </section>

        {/* the model */}
        <section className="l2-own-section">
          <h2>{t("whyWins.heading")}</h2>
          <p className="l2-own-sub">{t("whyWins.sub")}</p>
        </section>

        <section className="l2-own-section">
          <h2>{t("model.heading")}</h2>
          <div className="l2-own-grid3">
            {MODEL.map((m) => (
              <div className="l2-own-card" key={m.n}>
                <span className="l2-own-n">{m.n}</span>
                <h3>{m.title}</h3>
                <p>{m.copy}</p>
              </div>
            ))}
          </div>
        </section>

        {/* trades */}
        <section className="l2-own-section">
          <h2>{t("trades.heading")}</h2>
          <p className="l2-own-sub">{t("trades.sub")}</p>
          <div className="l2-own-trades">
            {TRADES.map(([name, note], i) => (
              <div className="l2-own-trade" key={name}>
                <span className="l2-own-trade-name">
                  {name}
                  {i === 0 && <span className="l2-own-live">{t("trades.live")}</span>}
                </span>
                <span className="l2-own-trade-note">{note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* included */}
        <section className="l2-own-section">
          <h2>{t("included.heading")}</h2>
          <ul className="l2-own-included">
            {INCLUDED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* platform features */}
        <section className="l2-own-section">
          <div className="l2-feat-header">
            <span className="l2-feat-eyebrow">PLATFORM</span>
            <h2>Everything included.<br />Nothing extra to buy.</h2>
            <p className="l2-own-sub" style={{ margin: '0' }}>Your members get all of this from day one — desk phone or mobile.</p>
          </div>
          <div className="l2-feat-bento">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Link to={`/features/${f.slug}`} className={`l2-feat-card${i < 2 ? ' l2-feat-wide' : ''}`} key={f.slug} style={{ '--accent': f.accent, textDecoration: 'none', color: 'inherit' }}>
                  <div className="l2-feat-icon-wrap">
                    <Icon />
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <span className="l2-feat-arrow">Learn more &rarr;</span>
                  <div className="l2-feat-glow" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="l2-own-section">
          <h2>{t("faq.heading")}</h2>
          <div className="l2-own-faqs">
            {FAQS.map((item) => (
              <article className="l2-own-faq" key={item.q}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="l2-own-final">
          <h2>{t("final.heading")}</h2>
          <p>{t("final.sub")}</p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              className="l2-btn l2-btn-hot"
              href={`mailto:${CONTACT_EMAIL}?subject=Launching an auto parts hotline`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("final.startConversation")}
            </a>
            <a
              className="l2-btn l2-btn-ghost"
              href="https://hotlinehq.online/client/signup"
              style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', background: 'transparent' }}
            >
              Sign Up Free
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

const OWN_CSS = `
.l2-ownpage { max-width: 1080px; margin: 0 auto; padding: 150px 32px 60px; }
.l2-ownpage h1 {
  font-family: var(--display); font-weight: 700; font-size: clamp(40px, 5.6vw, 68px);
  line-height: 1.02; letter-spacing: -0.015em; margin: 0 0 22px;
}
.l2-ownpage h1 em { font-style: normal; color: var(--red); }
.l2-ownpage h2 {
  font-family: var(--display); font-weight: 700; font-size: clamp(28px, 3.6vw, 40px);
  letter-spacing: -0.01em; margin: 0 0 14px;
}
.l2-own-hero { max-width: 760px; }
.l2-own-lede { color: var(--muted); font-size: 17.5px; line-height: 1.7; margin: 0 0 30px; }
.l2-own-ctas { display: flex; gap: 14px; flex-wrap: wrap; }
.l2-btn {
  font-family: var(--body); font-weight: 600; font-size: 15.5px;
  padding: 14px 28px; border-radius: 11px; border: 1px solid transparent;
  cursor: pointer; display: inline-block;
  transition: transform .15s, background .2s, box-shadow .2s, border-color .2s;
}
.l2 .l2-btn-hot { background: var(--red); color: #fff; box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5); }
.l2 .l2-btn-hot:hover { background: var(--red-deep); }
.l2-btn-ghost { background: var(--surface); border-color: var(--line); color: var(--ink); }
.l2-btn-ghost:hover { border-color: #c9c4ba; }

.l2-own-proof {
  margin: 56px 0; padding: 22px 28px;
  background: var(--red-soft); border: 1px solid rgba(217,45,32,0.25); border-radius: 14px;
}
.l2-own-proof p { margin: 0; color: var(--ink); font-size: 16px; line-height: 1.6; }
.l2-own-proof strong { color: var(--red-deep); }

.l2-own-section { margin: 72px 0; }
.l2-own-sub { color: var(--muted); font-size: 16.5px; line-height: 1.65; max-width: 640px; margin: 0 0 28px; }
.l2-own-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; }
@media (max-width: 860px) { .l2-own-grid3 { grid-template-columns: 1fr; } }
.l2-own-card {
  background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
  padding: 28px 26px 30px;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.12);
}
.l2-own-n {
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--red-soft); color: var(--red);
  font-family: var(--display); font-weight: 700; font-size: 22px;
  display: flex; align-items: center; justify-content: center; margin-bottom: 18px;
}
.l2-own-card h3 { font-family: var(--display); font-weight: 700; font-size: 21px; margin: 0 0 10px; }
.l2-own-card p { color: var(--muted); font-size: 15px; line-height: 1.65; margin: 0; }

.l2-own-trades { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.l2-own-trade {
  display: flex; justify-content: space-between; gap: 18px; flex-wrap: wrap;
  padding: 18px 22px; background: var(--surface);
}
.l2-own-trade + .l2-own-trade { border-top: 1px solid var(--line); }
.l2-own-trade-name { font-family: var(--display); font-weight: 700; font-size: 18px; display: inline-flex; align-items: center; gap: 10px; }
.l2-own-live { font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em; color: var(--green); }
.l2-own-trade-note { color: var(--muted); font-size: 14.5px; }

.l2-own-included { list-style: none; padding: 0; margin: 24px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 28px; }
@media (max-width: 720px) { .l2-own-included { grid-template-columns: 1fr; } }
.l2-own-included li {
  color: var(--muted); font-size: 15.5px; line-height: 1.55;
  padding-left: 28px; position: relative;
}
.l2-own-included li::before { content: "\\2713"; position: absolute; left: 0; color: var(--green); font-weight: 700; }

.l2-feat-header { margin-bottom: 36px; }
.l2-feat-eyebrow {
  font-family: var(--mono); font-size: 11px; font-weight: 600;
  letter-spacing: 0.16em; color: var(--red); margin-bottom: 14px; display: block;
}
.l2-feat-bento {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 0;
}
.l2-feat-card {
  position: relative; overflow: hidden;
  background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
  padding: 28px 24px 26px;
  transition: border-color .25s, transform .25s, box-shadow .25s;
}
.l2-feat-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--accent); opacity: 0; transition: opacity .25s;
}
.l2-feat-card:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  transform: translateY(-2px);
  box-shadow: 0 8px 30px -8px color-mix(in srgb, var(--accent) 18%, transparent);
}
.l2-feat-card:hover::before { opacity: 1; }
.l2-feat-glow {
  position: absolute; top: -40px; right: -40px; width: 120px; height: 120px;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 8%, transparent), transparent 70%);
  pointer-events: none; transition: opacity .3s; opacity: 0;
}
.l2-feat-card:hover .l2-feat-glow { opacity: 1; }
.l2-feat-wide { grid-column: span 1; }
.l2-feat-icon-wrap {
  width: 44px; height: 44px; border-radius: 12px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 18px;
}
.l2-feat-icon-wrap svg { width: 22px; height: 22px; }
.l2-feat-card h3 {
  font-family: var(--display); font-weight: 700; font-size: 17px;
  letter-spacing: -0.01em; margin: 0 0 8px;
}
.l2-feat-card p { color: var(--muted); font-size: 14px; line-height: 1.6; margin: 0; }
.l2-feat-arrow {
  display: inline-block; margin-top: 14px;
  font-size: 13px; font-weight: 600; color: var(--accent);
  opacity: 0; transform: translateX(-4px);
  transition: opacity .2s, transform .2s;
}
.l2-feat-card:hover .l2-feat-arrow { opacity: 1; transform: translateX(0); }
@media (min-width: 900px) {
  .l2-feat-wide { grid-column: span 2; }
  .l2-feat-wide .l2-feat-icon-wrap { width: 48px; height: 48px; }
  .l2-feat-wide h3 { font-size: 19px; }
  .l2-feat-wide p { font-size: 15px; max-width: 520px; }
}
@media (max-width: 900px) { .l2-feat-bento { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) {
  .l2-feat-bento { grid-template-columns: 1fr; gap: 12px; }
  .l2-feat-card { padding: 22px 18px 20px; }
  .l2-feat-card h3 { font-size: 16px; }
}

.l2-own-faqs { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 24px; }
@media (max-width: 820px) { .l2-own-faqs { grid-template-columns: 1fr; } }
.l2-own-faq {
  background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
  padding: 24px 24px 22px;
}
.l2-own-faq h3 { font-family: var(--display); font-weight: 700; font-size: 19px; margin: 0 0 10px; }
.l2-own-faq p { color: var(--muted); font-size: 15px; line-height: 1.65; margin: 0; }

.l2-own-final {
  margin: 80px 0 40px; padding: 56px 40px; text-align: center;
  background: #16181d; border-radius: 20px; color: #f4f2ee;
}
.l2-own-final h2 { color: #fff; }
.l2-own-final p { color: #b9bcc4; font-size: 16.5px; line-height: 1.65; max-width: 560px; margin: 0 auto 28px; }

@media (max-width: 640px) {
  .l2-ownpage { padding: 120px 16px 40px; }
  .l2-ownpage h1 { font-size: clamp(28px, 7vw, 40px); }
  .l2-ownpage h2 { font-size: clamp(22px, 5vw, 28px); }
  .l2-own-lede { font-size: 15px; }
  .l2-own-ctas { flex-direction: column; }
  .l2-own-ctas .l2-btn { text-align: center; }
  .l2-own-proof { padding: 18px 16px; margin: 36px 0; }
  .l2-own-sec { margin: 48px 0; }
  .l2-own-sub { font-size: 14.5px; }
  .l2-own-grid3 { gap: 12px; }
  .l2-own-card { padding: 20px 16px; }
  .l2-own-card h3 { font-size: 17px; }
  .l2-own-card p { font-size: 14px; }
  .l2-own-faq { padding: 18px 16px; }
  .l2-own-faq h3 { font-size: 16px; }
  .l2-own-faq p { font-size: 14px; }
  .l2-own-final { padding: 36px 20px; margin: 48px 0 32px; border-radius: 14px; }
  .l2-own-final p { font-size: 14.5px; }
}
`;

/* ── Feature SVG icons (stroke-based, inherit accent color via currentColor) ── */
const si = { fill: 'none', stroke: 'var(--accent)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
function FeatIconNetwork() { return <svg viewBox="0 0 24 24" {...si}><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /><circle cx="12" cy="12" r="3" /><path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>; }
function FeatIconCallerId() { return <svg viewBox="0 0 24 24" {...si}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6-1h4m-4 4h4m-4 4h4M7 17c0-1.1.9-2 2-2h0c1.1 0 2 .9 2 2" /></svg>; }
function FeatIconDevice() { return <svg viewBox="0 0 24 24" {...si}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>; }
function FeatIconDirect() { return <svg viewBox="0 0 24 24" {...si}><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 8.1 18.36a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 1.1 4.18 2 2 0 0 1 3.08 2h3a2 2 0 0 1 2 1.72c.13.97.36 1.92.69 2.84a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.92.33 1.87.56 2.84.69a2 2 0 0 1 1.72 2z" /><path d="M14.5 2c2.49.53 4.47 2.51 5 5m-5-1.5c1.24.33 2.17 1.26 2.5 2.5" /></svg>; }
function FeatIconRecord() { return <svg viewBox="0 0 24 24" {...si}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="var(--accent)" stroke="none" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2" /></svg>; }
function FeatIconNotify() { return <svg viewBox="0 0 24 24" {...si}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>; }
function FeatIconCapture() { return <svg viewBox="0 0 24 24" {...si}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function FeatIconMarket() { return <svg viewBox="0 0 24 24" {...si}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>; }
function FeatIconDashboard() { return <svg viewBox="0 0 24 24" {...si}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>; }
function FeatIconLang() { return <svg viewBox="0 0 24 24" {...si}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" /></svg>; }
function FeatIconSecurity() { return <svg viewBox="0 0 24 24" {...si}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>; }
