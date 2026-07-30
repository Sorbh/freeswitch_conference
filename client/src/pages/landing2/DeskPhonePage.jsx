import { useState } from "react";
import { Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL } from "./site";

const SIGNUP_URL = "https://hotlinehq.online/client/signup";
const PHONE_IMG = "/images/desk-phone-t31p.png";

const STEPS = [
  { title: "Order your phone", desc: "We ship a preconfigured Yealink T31P to your yard — or grab one from Amazon, B&H, or any VoIP retailer and we'll send the config." },
  { title: "Plug in one cable", desc: "Ethernet into your router. The phone boots, finds the hotline, and connects itself. No passwords, no SIP settings." },
  { title: "You're live", desc: "Within 30 seconds you hear the network. When someone asks for a part you have, pick up and respond." },
];

const BENEFITS = [
  { icon: "mic", title: "No mic permission issues", desc: "The #1 browser problem — blocked microphone — doesn't exist with a desk phone." },
  { icon: "power", title: "Always on, always connected", desc: "24/7 connection. No browser tab, no battery, no screen lock to manage." },
  { icon: "audio", title: "Crystal-clear HD voice", desc: "Wideband audio codecs. Every part number, VIN digit, and dollar amount comes through clearly." },
  { icon: "speaker", title: "Built-in speakerphone", desc: "Listen hands-free while you work. Hear a request? Pick up the handset or hit speaker." },
  { icon: "plug", title: "No computer required", desc: "Standalone device — just needs ethernet and power. Perfect for any counter." },
  { icon: "headset", title: "Headset ready", desc: "Standard RJ9 port for any compatible wired headset. Go hands-free all day." },
];

const SPECS = [
  ["Model", "Yealink SIP-T31P"],
  ["Display", '2.3" 132×64 backlit LCD'],
  ["Lines", "2 SIP accounts"],
  ["Audio", "HD Voice, hands-free speakerphone"],
  ["Network", "10/100 Ethernet, PoE"],
  ["Ports", "RJ9 headset, RJ45 LAN + PC"],
  ["Power", "PoE (802.3af) or AC adapter"],
  ["Setup", "Zero-touch — preconfigured"],
];

const FAQS = [
  { q: "Do I have to buy the phone from you?", a: "No. You can order a Yealink T31P from Amazon, B&H Photo, VoIP Supply, or any retailer. We'll send you the configuration file, or ship one preconfigured — your choice." },
  { q: "What if my internet goes down?", a: "The phone reconnects automatically when your internet comes back. No manual steps needed." },
  { q: "Can I use both the desk phone and the web app?", a: "Yes. Many members listen on the desk phone at the counter and switch to the web app when they're on the road." },
  { q: "Is there a monthly fee for the phone?", a: "The desk phone is included with your Hotline HQ membership. No extra hardware fees." },
  { q: "Can I use it with a headset?", a: "Yes. Standard RJ9 headset port. Plug in any compatible wired headset." },
  { q: "Does it work with my existing internet?", a: "If you have an ethernet port, yes. Uses about 100 Kbps — less than streaming a single song." },
];

export function DeskPhonePage() {
  const [openFaq, setOpenFaq] = useState(null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://hotlinehq.online/" },
          { "@type": "ListItem", position: 2, name: "Features", item: "https://hotlinehq.online/own-a-hotline" },
          { "@type": "ListItem", position: 3, name: "Desk Phone", item: "https://hotlinehq.online/features/desk-phone" },
        ],
      },
      {
        "@type": "Product",
        name: "Hotline HQ Desk Phone — Yealink T31P",
        description: "Preconfigured Yealink T31P IP desk phone for the Hotline HQ auto parts voice network.",
        brand: { "@type": "Brand", name: "Yealink" },
        model: "SIP-T31P",
        image: "https://hotlinehq.online/images/desk-phone-t31p.png",
        offers: {
          "@type": "Offer", price: "0", priceCurrency: "USD",
          description: "Included with Hotline HQ membership",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map(f => ({
          "@type": "Question", name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{CSS}</style>
      <Seo
        title="Hotline Desk Phone — Plug In & You're Live | Yealink T31P | Hotline HQ"
        description="Get a preconfigured Yealink T31P desk phone for your yard. Plug in the ethernet cable — no setup, no app, no browser. Crystal-clear HD audio, always connected."
        keywords="hotline desk phone, yealink t31p auto parts, salvage yard phone, junkyard desk phone, preconfigured IP phone"
        canonicalUrl="https://hotlinehq.online/features/desk-phone"
        path="/features/desk-phone"
        jsonLd={jsonLd}
      />
      <SiteNav />

      {/* ── HERO — dark, matches other feature pages ── */}
      <header className="dp-hero">
        <div className="dp-hero-inner">
          <nav className="fd-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link><span>/</span>
            <Link to="/own-a-hotline">Features</Link><span>/</span>
            <span>Desk Phone</span>
          </nav>
          <div className="dp-hero-layout">
            <div className="dp-hero-text">
              <span className="fd-tag">HARDWARE</span>
              <h1 className="dp-title">Plug in.<br />You're live.</h1>
              <p className="fd-lede">A preconfigured Yealink T31P desk phone. One ethernet cable. Thirty seconds to your first broadcast.</p>
              <div className="fd-header-ctas">
                <a href={SIGNUP_URL} className="fd-btn-hot">Sign Up Free</a>
                <a href={`mailto:${CONTACT_EMAIL}?subject=Desk phone inquiry`} className="fd-btn-ghost">Talk to Us</a>
              </div>
            </div>
            <div className="dp-hero-phone">
              <img src={PHONE_IMG} alt="Yealink T31P desk phone for Hotline HQ" />
            </div>
          </div>
        </div>
      </header>

      {/* ── PROBLEM ── */}
      <section className="dp-section dp-problem">
        <div className="dp-narrow">
          <h2 className="dp-h2">Browser calling has limits. A desk phone doesn't.</h2>
          <p className="dp-body">Mic permissions get blocked. Tabs get closed. Batteries die. Notifications get missed. A dedicated desk phone sits on your counter, always on, always connected — like a landline that plugs you into every yard in the state.</p>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="dp-section dp-steps-section">
        <div className="dp-container">
          <h2 className="dp-h2 dp-center">How it works</h2>
          <ol className="dp-steps">
            {STEPS.map((s, i) => (
              <li className="dp-step" key={i}>
                <strong>{s.title}.</strong> {s.desc}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── PRODUCT SHOWCASE — dark ── */}
      <section className="dp-section dp-showcase">
        <div className="dp-container">
          <div className="dp-showcase-grid">
            <div className="dp-showcase-img">
              <img src={PHONE_IMG} alt="Yealink T31P — front view showing LCD display and keypad" />
            </div>
            <div className="dp-showcase-text">
              <span className="fd-tag">YEALINK SIP-T31P</span>
              <h2 className="dp-h2" style={{ color: "#fff", marginTop: 12 }}>Built for the counter.</h2>
              <p style={{ fontSize: 16.5, lineHeight: 1.7, color: "rgba(255,255,255,0.55)", margin: "0 0 28px" }}>
                2.3-inch backlit LCD. HD voice. Built-in speakerphone. PoE or adapter powered. Compact enough for any counter, rugged enough for a yard.
              </p>
              <div className="dp-spec-strip">
                {SPECS.slice(0, 4).map(([label, val], i) => (
                  <div className="dp-spec-card" key={i}>
                    <span className="dp-spec-label">{label}</span>
                    <span className="dp-spec-val">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="dp-section">
        <div className="dp-container">
          <h2 className="dp-h2 dp-center">Why a desk phone</h2>
          <div className="dp-benefits">
            {BENEFITS.map((b, i) => (
              <div className="dp-benefit" key={i}>
                <div className="dp-benefit-icon"><BenefitIcon type={b.icon} /></div>
                <h3 className="dp-benefit-title">{b.title}</h3>
                <p className="dp-benefit-desc">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FULL SPECS ── */}
      <section className="dp-section dp-specs-section">
        <div className="dp-narrow">
          <h2 className="dp-h2 dp-center">Specifications</h2>
          <div className="dp-specs-table">
            {SPECS.map(([label, val], i) => (
              <div className="dp-specs-row" key={i}>
                <span className="dp-specs-key">{label}</span>
                <span className="dp-specs-val2">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="dp-section">
        <div className="dp-narrow">
          <h2 className="dp-h2 dp-center">Frequently Asked Questions</h2>
          {FAQS.map((f, i) => (
            <details className="fd-faq" key={i} open={openFaq === i} onClick={(e) => { e.preventDefault(); setOpenFaq(openFaq === i ? null : i); }}>
              <summary>{f.q}</summary>
              {openFaq === i && <p>{f.a}</p>}
            </details>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA — matches other feature pages ── */}
      <section className="bl-cta">
        <div className="bl-cta-inner">
          <p className="bl-cta-kicker">INCLUDED WITH MEMBERSHIP</p>
          <h2 className="bl-cta-heading">Ready to skip the browser hassle?</h2>
          <p className="bl-cta-sub">Every Hotline HQ membership includes a preconfigured desk phone. Or order your own from Amazon — we'll handle the setup.</p>
          <a href={SIGNUP_URL} className="bl-cta-btn">Sign Up Free</a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function BenefitIcon({ type }) {
  const s = { fill: "none", stroke: "var(--red)", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (type) {
    case "mic": return <svg viewBox="0 0 24 24" {...s}><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.48-.35 2.15" /></svg>;
    case "power": return <svg viewBox="0 0 24 24" {...s}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
    case "audio": return <svg viewBox="0 0 24 24" {...s}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>;
    case "speaker": return <svg viewBox="0 0 24 24" {...s}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>;
    case "plug": return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3" /></svg>;
    case "headset": return <svg viewBox="0 0 24 24" {...s}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /><path d="M19 22v-2a4 4 0 0 0-4-4h-1" /></svg>;
    default: return null;
  }
}

const CSS = `
/* ── Hero ── */
.dp-hero { background: #0f1117; padding: 100px 24px 48px; border-bottom: 3px solid var(--red); }
.dp-hero-inner { max-width: 1140px; margin: 0 auto; }
.dp-hero-layout { display: flex; align-items: center; gap: 48px; margin-top: 24px; }
.dp-hero-text { flex: 1; min-width: 0; }
.dp-title {
  font-family: var(--display); font-weight: 700; font-size: clamp(32px, 5vw, 48px);
  line-height: 1.1; letter-spacing: -0.03em; color: #fff; margin: 16px 0 20px;
}
.dp-hero-phone { flex-shrink: 0; }
.dp-hero-phone img {
  width: 300px; height: auto;
  filter: drop-shadow(0 20px 40px rgba(255,255,255,0.06));
}

/* ── Shared ── */
.dp-section { padding: 64px 24px; }
.dp-container { max-width: 1140px; margin: 0 auto; }
.dp-narrow { max-width: 680px; margin: 0 auto; }
.dp-center { text-align: center; }
.dp-h2 {
  font-family: var(--display); font-weight: 700; font-size: clamp(22px, 3vw, 28px);
  line-height: 1.15; letter-spacing: -0.015em; color: var(--ink); margin: 0 0 16px;
}
.dp-body { font-size: 17px; line-height: 1.8; color: var(--muted); margin: 0; }

/* ── Problem ── */
.dp-problem { text-align: center; background: var(--surface, #f8f8f6); }
.dp-problem .dp-body { max-width: 600px; margin: 0 auto; }

/* ── Steps — uses same counter style as other feature pages ── */
.dp-steps-section { background: #fff; }
.dp-steps {
  list-style: none; padding: 0; margin: 32px auto 0; max-width: 680px;
  counter-reset: dp-step;
}
.dp-step {
  counter-increment: dp-step; padding-left: 44px; position: relative;
  margin-bottom: 20px; font-size: 17px; line-height: 1.8; color: var(--muted);
}
.dp-step:last-child { margin-bottom: 0; }
.dp-step::before {
  content: counter(dp-step); position: absolute; left: 0; top: 4px;
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--red-soft, rgba(217,45,32,0.08)); color: var(--red);
  font-family: var(--display); font-weight: 700; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
}
.dp-step strong { color: var(--ink); }

/* ── Showcase — dark ── */
.dp-showcase { background: #0f1117; }
.dp-showcase-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
.dp-showcase-img { text-align: center; }
.dp-showcase-img img { max-width: 300px; width: 100%; height: auto; filter: drop-shadow(0 16px 40px rgba(255,255,255,0.05)); }
.dp-spec-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dp-spec-card {
  padding: 14px 16px; border-radius: 12px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
}
.dp-spec-label {
  display: block; font-family: var(--mono); font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); margin-bottom: 4px;
}
.dp-spec-val { font-size: 13.5px; font-weight: 600; color: #fff; }

/* ── Benefits ── */
.dp-benefits { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; }
.dp-benefit {
  padding: 24px; border-radius: 16px; background: var(--surface, #f8f8f6);
  border: 1px solid var(--line, #e5e7eb);
}
.dp-benefit-icon { width: 36px; height: 36px; margin-bottom: 14px; }
.dp-benefit-icon svg { width: 36px; height: 36px; }
.dp-benefit-title { font-family: var(--display); font-size: 15px; font-weight: 700; color: var(--ink); margin: 0 0 6px; }
.dp-benefit-desc { font-size: 14px; line-height: 1.65; color: var(--muted); margin: 0; }

/* ── Specs table ── */
.dp-specs-section { background: var(--surface, #f8f8f6); }
.dp-specs-table { margin-top: 28px; border-radius: 16px; overflow: hidden; border: 1px solid var(--line, #e5e7eb); background: #fff; }
.dp-specs-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 24px; border-bottom: 1px solid var(--line, #f3f4f6);
}
.dp-specs-row:last-child { border-bottom: none; }
.dp-specs-row:nth-child(even) { background: var(--surface, #fafafa); }
.dp-specs-key { font-size: 14px; font-weight: 600; color: var(--ink); }
.dp-specs-val2 { font-size: 14px; color: var(--muted); text-align: right; }

/* ── FAQ — reuses fd-faq from feature pages ── */

/* ── Responsive ── */
@media (max-width: 768px) {
  .dp-hero-layout { flex-direction: column-reverse; text-align: center; gap: 24px; }
  .dp-hero-phone img { width: 200px; }
  .fd-header-ctas { justify-content: center; }
  .dp-showcase-grid { grid-template-columns: 1fr; gap: 32px; }
  .dp-showcase-img { order: -1; }
  .dp-showcase-img img { max-width: 200px; }
  .dp-spec-strip { grid-template-columns: 1fr; }
  .dp-benefits { grid-template-columns: 1fr; }
  .dp-section { padding: 48px 16px; }
}
`;
