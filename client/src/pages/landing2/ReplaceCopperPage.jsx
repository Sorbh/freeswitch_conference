import { useState } from "react";
import { Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL, buildSiteUrl } from "./site";

const SIGNUP_URL = "https://hotlinehq.online/client/signup";

const MAPPING = [
  { copper: "Dedicated phone on the wall", hq: "Dedicated Yealink desk phone on the counter" },
  { copper: "Always on, always connected", hq: "Always on, always connected" },
  { copper: "Pick up and everyone hears you", hq: "Pick up and broadcast to your room" },
];

const COMPARISON = [
  { dim: "Reach", copper: "Local only", hq: "Switch between any region" },
  { dim: "Voice quality", copper: "Analog", hq: "HD digital" },
  { dim: "Recordings", copper: "None", hq: "Every call recorded" },
  { dim: "Caller ID", copper: "No display", hq: "See who's talking in real time" },
  { dim: "Portability", copper: "Stuck at the wall", hq: "Desk phone + web panel on the go" },
  { dim: "Cost per yard", copper: "Rising (telco sunset)", hq: "Flat monthly" },
  { dim: "Reliability", copper: "Declining infrastructure", hq: "99.9% uptime" },
  { dim: "Scalability", copper: "Fixed capacity", hq: "Add yards anytime" },
  { dim: "Cross-room", copper: "Not possible", hq: "Yes" },
];

const PAIN_POINTS = [
  {
    title: "Copper lines are dying",
    body: "Telcos across the country are sunsetting POTS (Plain Old Telephone Service). Maintenance crews are shrinking, prices are rising, and some areas can't get copper service at all anymore. The infrastructure your hotline depends on is being retired — not next decade, now.",
  },
  {
    title: "One region isn't enough",
    body: "A copper hotline covers one local area — the yards within your telco's reach. HQ connects 12 regional rooms across the US. A yard in Texas can broadcast to California, Florida, or Arizona with a single button press. Cross-room broadcasting means your network doesn't stop at the county line.",
  },
  {
    title: "No recordings, no accountability",
    body: "Copper is a black box. You don't know who called, what was said, or whether anyone answered. HQ records every broadcast, shows who's connected, tracks response times, and logs broadcast history. When a dispute arises or a request goes unanswered, you have the data.",
  },
];

const FAQS = [
  {
    q: "Is this a phone or a computer thing?",
    a: "It's a phone. A Yealink T31P desk phone ships to each yard. Plug in one ethernet cable and you're live. There's also a browser option for when you're on the road, but the desk phone is what sits on your counter.",
  },
  {
    q: "Do all yards need to switch at once?",
    a: "We'll work with you on the best approach for your group. The important thing is that your group stays together.",
  },
  {
    q: "What does each yard get?",
    a: "A preconfigured Yealink T31P desk phone, ready to go. Plug it in, and you're connected to your room. No setup, no IT department needed.",
  },
  {
    q: "What happens to our copper line?",
    a: "That's between you and your telco. Many groups keep the copper line running briefly during transition, then cancel it once everyone's on HQ.",
  },
  {
    q: "Can one yard try it first?",
    a: "Yes. Any yard can sign up and try the web client immediately, or request a phone. But the real value is when your whole group is on the line together.",
  },
];

export function ReplaceCopperPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    yard: "",
    contact: "",
    yardCount: "",
    region: "",
  });
  const [formStatus, setFormStatus] = useState(null); // null | 'sending' | 'sent' | 'error'

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormStatus("sending");
    try {
      // TODO: Create POST /api/copper-lead backend endpoint
      const res = await fetch("/api/copper-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormStatus("sent");
        return;
      }
      throw new Error("API not available");
    } catch {
      // Fallback: open mailto with form data
      const subject = encodeURIComponent("Copper Hotline Upgrade Inquiry");
      const body = encodeURIComponent(
        `Name: ${formData.name}\nYard: ${formData.yard}\nContact: ${formData.contact}\nYards on line: ${formData.yardCount}\nRegion: ${formData.region}`
      );
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
      setFormStatus("sent");
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Hotline HQ — Replace Your Copper Hotline",
        serviceType: "Copper Hotline Replacement",
        provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
        areaServed: { "@type": "Country", name: "US" },
        description:
          "Replace your copper wire hotline with Hotline HQ. Same dedicated desk phone, same always-on connection. HD digital audio, 12 regional rooms, every call recorded.",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{PAGE_CSS}</style>
      <Seo
        title="Replace Your Copper Hotline | Hotline HQ"
        description="Upgrade your copper wire hotline to Hotline HQ. Same dedicated desk phone on the counter, same always-on connection. Now with HD digital audio, 12 regional rooms, and every call recorded."
        keywords="replace copper hotline, copper hotline upgrade, POTS replacement, salvage yard hotline, auto parts hotline, copper wire hotline alternative, digital hotline"
        path="/replace-copper-hotline"
        jsonLd={jsonLd}
      />
      <SiteNav />

      {/* ── HERO ── */}
      <section className="fp-hero">
        <div className="fp-hero-scrim" aria-hidden="true" />
        <div className="fp-hero-inner">
          <p className="fp-kicker">COPPER HOTLINE UPGRADE</p>
          <h1>Your hotline group deserves <em>a better line.</em></h1>
          <p className="fp-hero-sub">
            Same dedicated phone on the counter. Same always-on connection.
            Now with HD digital audio, every call recorded, private calling, and full transcription so you can review everything later.
          </p>
          <div className="fp-hero-ctas">
            <a href="#bring-your-group" className="fp-btn fp-btn-hot">Bring Your Group to HQ</a>
            <a href={SIGNUP_URL} className="fp-btn fp-btn-ghost">Sign Up Free</a>
          </div>
          <img className="rc-hero-phone" src="/images/t31p-desk-phone.webp" alt="Yealink T31P desk phone with Hotline HQ branding in a salvage yard" width="600" height="448" loading="eager" />
        </div>
      </section>

      {/* ── SAME EXPERIENCE, BETTER TECHNOLOGY ── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">SAME EXPERIENCE</p>
          <h2>Same experience, better technology</h2>
          <p className="fp-lede">
            If you've used a copper hotline, you already know how HQ works.
            The phone sits on the counter, stays connected, and when you pick up, your room hears you.
          </p>
        </div>
        <div className="rc-mapping">
          <div className="rc-map-headers">
            <div className="rc-map-hdr">
              <img src="/images/copper-phone.webp" alt="Old copper wall phone from a salvage yard" width="80" height="80" />
              <span>Copper Line</span>
            </div>
            <div className="rc-map-hdr-spacer" />
            <div className="rc-map-hdr rc-map-hdr-hq">
              <img src="/images/t31p-thumb.webp" alt="Yealink T31P with Hotline HQ branding" width="80" height="80" />
              <span>Hotline HQ</span>
            </div>
          </div>
          {MAPPING.map((m, i) => (
            <div className="rc-map-row" key={i}>
              <div className="rc-map-cell rc-map-copper">
                <span className="rc-map-badge">Copper</span>
                <p>{m.copper}</p>
              </div>
              <div className="rc-map-arrow" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="11" fill="var(--red)" />
                  <path d="M8 12h8M13 8l4 4-4 4" stroke="#fff" strokeWidth="2" />
                </svg>
              </div>
              <div className="rc-map-cell rc-map-hq">
                <span className="rc-map-badge rc-map-badge-hq">Hotline HQ</span>
                <p>{m.hq}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="fp-section fp-band">
        <div className="fp-section-head">
          <p className="fp-kicker">SIDE BY SIDE</p>
          <h2>Copper Hotline vs Hotline HQ</h2>
          <p className="fp-lede">
            Everything your copper line does, HQ does — plus everything it can't.
          </p>
        </div>
        <div className="rc-compare">
          <div className="rc-compare-col rc-compare-copper">
            <div className="rc-compare-header">
              <span>Copper Hotline</span>
            </div>
            {COMPARISON.map((row, i) => (
              <div className="rc-compare-item" key={i}>
                <span className="rc-compare-dim">{row.dim}</span>
                <span className="rc-compare-val rc-compare-val-old">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" opacity=".5" /></svg>
                  {row.copper}
                </span>
              </div>
            ))}
          </div>
          <div className="rc-compare-col rc-compare-hq">
            <div className="rc-compare-header rc-compare-header-hq">
              <span>Hotline HQ</span>
            </div>
            {COMPARISON.map((row, i) => (
              <div className="rc-compare-item" key={i}>
                <span className="rc-compare-dim rc-compare-dim-hq">{row.dim}</span>
                <span className="rc-compare-val rc-compare-val-new">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {row.hq}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT HOTLINE HQ GIVES YOU ── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">WHAT YOU GET</p>
          <h2>Everything your copper line can't do</h2>
          <p className="fp-lede">One desk phone. One flat membership. All of this included.</p>
        </div>
        <div className="rc-hq-card">
          <div className="rc-hq-header">Hotline HQ</div>
          <div className="rc-hq-item">
            <span className="rc-hq-dim">HD Audio</span>
            <span className="rc-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Crystal-clear wideband voice — no static, no line noise</span>
          </div>
          <div className="rc-hq-item">
            <span className="rc-hq-dim">Caller ID</span>
            <span className="rc-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> See who's talking before you pick up</span>
          </div>
          <div className="rc-hq-item">
            <span className="rc-hq-dim">Recordings</span>
            <span className="rc-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Every call recorded automatically</span>
          </div>
          <div className="rc-hq-item">
            <span className="rc-hq-dim">Transcription</span>
            <span className="rc-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Full text of every broadcast, searchable</span>
          </div>
          <div className="rc-hq-item">
            <span className="rc-hq-dim">Reach</span>
            <span className="rc-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Switch between any region</span>
          </div>
          <div className="rc-hq-item">
            <span className="rc-hq-dim">Portability</span>
            <span className="rc-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Desk phone + web panel on the go</span>
          </div>
          <div className="rc-hq-item">
            <span className="rc-hq-dim">Always On</span>
            <span className="rc-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> 24/7 connection, no browser needed</span>
          </div>
          <div className="rc-hq-item">
            <span className="rc-hq-dim">Private Calls</span>
            <span className="rc-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Direct yard-to-yard calls off the room</span>
          </div>
          <div className="rc-hq-item">
            <span className="rc-hq-dim">Cost</span>
            <span className="rc-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Flat monthly — phone included</span>
          </div>
        </div>
      </section>

      {/* ── THREE PAIN POINTS ── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">WHY NOW</p>
          <h2>Three reasons your group can't wait</h2>
        </div>
        <div className="rc-pains">
          {PAIN_POINTS.map((p, i) => (
            <div className="rc-pain" key={i}>
              <span className="fp-step-n">{i + 1}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BRING YOUR GROUP FORM ── */}
      <section className="fp-section fp-band" id="bring-your-group">
        <div className="fp-section-head">
          <p className="fp-kicker">GET STARTED</p>
          <h2>Bring Your Group to HQ</h2>
          <p className="fp-lede">
            Your hotline group already works. We just give it better tools.
            Tell us about your group and we'll show you what switching looks like.
          </p>
        </div>
        <div className="rc-form-wrap">
          {formStatus === "sent" ? (
            <div className="rc-form-success">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h3>We got your info.</h3>
              <p>We'll call you within 24-48 hours to discuss your group's switch.</p>
            </div>
          ) : (
            <form className="rc-form" onSubmit={handleSubmit}>
              <div className="rc-form-row">
                <label>
                  <span>Your name</span>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="John Smith" />
                </label>
                <label>
                  <span>Yard name</span>
                  <input type="text" name="yard" value={formData.yard} onChange={handleChange} required placeholder="Smith Auto Salvage" />
                </label>
              </div>
              <div className="rc-form-row">
                <label>
                  <span>Phone or email</span>
                  <input type="text" name="contact" value={formData.contact} onChange={handleChange} required placeholder="(555) 123-4567 or john@example.com" />
                </label>
                <label>
                  <span>How many yards on your line?</span>
                  <select name="yardCount" value={formData.yardCount} onChange={handleChange} required>
                    <option value="">Select...</option>
                    <option value="5-10">5 - 10</option>
                    <option value="10-15">10 - 15</option>
                    <option value="15-25">15 - 25</option>
                    <option value="25-50">25 - 50</option>
                    <option value="50+">50+</option>
                  </select>
                </label>
              </div>
              <label className="rc-form-full">
                <span>What state / region?</span>
                <input type="text" name="region" value={formData.region} onChange={handleChange} required placeholder="e.g. Southern California, Dallas-Fort Worth" />
              </label>
              <button type="submit" className="fp-btn fp-btn-hot rc-form-btn" disabled={formStatus === "sending"}>
                {formStatus === "sending" ? "Sending..." : "Get in Touch"}
              </button>
              <p className="rc-form-note">We'll call you within 24-48 hours to discuss your group's switch.</p>
            </form>
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="fp-section">
        <div className="fp-section-head">
          <p className="fp-kicker">FAQ</p>
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="fp-faq-list">
          {FAQS.map((f, i) => (
            <details
              className="fp-faq"
              key={i}
              open={openFaq === i}
              onClick={(e) => {
                e.preventDefault();
                setOpenFaq(openFaq === i ? null : i);
              }}
            >
              <summary className="fp-faq-q">{f.q}</summary>
              {openFaq === i && <p className="fp-faq-a">{f.a}</p>}
            </details>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="fp-cta-section">
        <div className="fp-cta-inner">
          <p className="fp-kicker" style={{ color: "var(--red)" }}>READY TO UPGRADE?</p>
          <h2>Your group. Better tools.</h2>
          <p>Same phone on the counter. Same always-on connection. HD audio, 12 rooms, every call recorded.</p>
          <a href="#bring-your-group" className="fp-btn fp-btn-hot">Bring Your Group to HQ</a>
          <p className="fp-cta-alt">
            Want to try it yourself first? <a href={SIGNUP_URL}>Sign up free</a>
            {" "}or <a href={`mailto:${CONTACT_EMAIL}`}>email us your questions</a>.
          </p>
          <p className="fp-cta-alt">
            Also: <Link to="/features/desk-phone">The desk phone</Link> · <Link to="/find-used-auto-parts">Find parts</Link> · <Link to="/sell-used-auto-parts">Sell parts</Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ── Page-specific CSS ── */
const PAGE_CSS = `
/* ── Hero ── */
.fp-hero {
  position: relative;
  padding: 160px 32px 80px;
  overflow: hidden;
}
.fp-hero-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(ellipse 60% 50% at 50% 30%, rgba(251,250,248,0.95) 30%, rgba(251,250,248,0.6) 65%, transparent 100%),
    radial-gradient(ellipse 50% 40% at 50% 45%, rgba(217,45,32,0.04), transparent 70%),
    radial-gradient(#dcd7cc 1px, transparent 1.4px);
  background-size: 100% 100%, 100% 100%, 26px 26px;
}
.fp-hero-inner {
  position: relative;
  z-index: 2;
  max-width: 1140px;
  margin: 0 auto;
  text-align: center;
}
.fp-kicker {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--red);
  margin: 0 0 18px;
}
.fp-hero h1 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(36px, 5vw, 56px);
  line-height: 1.06;
  letter-spacing: -0.015em;
  margin: 0 0 22px;
}
.fp-hero h1 em {
  font-style: normal;
  color: var(--red);
  background: linear-gradient(transparent 68%, #fef3f2 68%);
}
.fp-hero-sub {
  font-size: 18px;
  line-height: 1.65;
  color: var(--muted);
  max-width: 620px;
  margin: 0 auto 32px;
  font-weight: 500;
}
.fp-hero-sub strong { color: var(--ink); }
.rc-hero-phone {
  display: block;
  max-width: 480px;
  margin: 32px auto 0;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.fp-hero-ctas {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}
.fp-btn {
  font-family: var(--body);
  font-weight: 600;
  font-size: 15.5px;
  padding: 14px 28px;
  border-radius: 11px;
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-block;
  transition: transform .15s, background .2s, box-shadow .2s, border-color .2s;
  text-decoration: none;
}
.fp-btn:active { transform: translateY(1px); }
.fp-btn-hot {
  background: var(--red);
  color: #fff !important;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5);
}
.fp-btn-hot:hover { background: var(--red-deep); box-shadow: 0 10px 30px -8px rgba(217,45,32,0.6); }
.fp-btn-ghost {
  background: var(--surface);
  border-color: var(--line);
  color: var(--ink) !important;
}
.fp-btn-ghost:hover { border-color: #c9c4ba; }

/* ── Sections ── */
.fp-section {
  padding: 110px 32px;
  max-width: 1280px;
  margin: 0 auto;
}
.fp-band {
  max-width: none;
  background: var(--band);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.fp-band > * { max-width: 1216px; margin-left: auto; margin-right: auto; }
.fp-section-head {
  margin-bottom: 56px;
}
.fp-section-head h2 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(28px, 3.5vw, 44px);
  line-height: 1.08;
  letter-spacing: -0.015em;
  margin: 0;
}
.fp-lede {
  color: var(--muted);
  font-size: 17px;
  line-height: 1.65;
  max-width: 600px;
  margin-top: 16px;
}

/* ── Step numbers ── */
.fp-step-n {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #fef3f2;
  color: var(--red);
  font-family: var(--display);
  font-weight: 700;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

/* ── Comparison table ── */
.rc-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  max-width: 860px;
  margin: 0 auto;
}
.rc-compare-col {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--line);
}
.rc-compare-hq {
  border-color: rgba(217,45,32,0.25);
  box-shadow: 0 4px 24px rgba(217,45,32,0.08), 0 12px 40px -12px rgba(22,24,29,0.12);
}
.rc-compare-header {
  padding: 16px 22px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.rc-compare-header-hq {
  background: var(--red);
  color: #fff;
  border-bottom-color: var(--red);
}
.rc-compare-item {
  padding: 14px 22px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.rc-compare-hq .rc-compare-item {
  background: linear-gradient(170deg, #fef7f6, #fff 60%);
}
.rc-compare-item:last-child { border-bottom: none; }
.rc-compare-dim {
  display: block;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 4px;
}
.rc-compare-dim-hq { color: var(--red); opacity: 0.7; }
.rc-compare-val {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
}
.rc-compare-val-old { color: var(--muted); }
.rc-compare-val-new { font-weight: 600; }

/* ── FAQ ── */
.fp-faq-list {
  max-width: 720px;
}
.fp-faq {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
}
.fp-faq[open] {
  border-color: var(--red);
}
.fp-faq-q {
  font-family: var(--display);
  font-weight: 700;
  font-size: 17px;
  line-height: 1.3;
  padding: 22px 28px;
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.fp-faq-q::-webkit-details-marker { display: none; }
.fp-faq-q::after {
  content: '+';
  font-size: 22px;
  font-weight: 300;
  color: var(--red);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.fp-faq[open] .fp-faq-q::after {
  transform: rotate(45deg);
}
.fp-faq-a {
  font-size: 15px;
  line-height: 1.7;
  color: var(--muted);
  padding: 0 28px 24px;
  margin: 0;
}

/* ── Bottom CTA ── */
.fp-cta-section {
  background: var(--ink);
  padding: 110px 32px;
}
.fp-cta-inner {
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
}
.fp-cta-inner h2 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.08;
  letter-spacing: -0.015em;
  color: #fff;
  margin: 0 0 16px;
}
.fp-cta-inner p {
  font-size: 17px;
  line-height: 1.65;
  color: rgba(255,255,255,0.5);
  margin: 0 0 32px;
}
.fp-cta-alt {
  margin-top: 20px !important;
  font-size: 14px !important;
  color: rgba(255,255,255,0.4) !important;
}
.fp-cta-alt a {
  color: rgba(255,255,255,0.7);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.2s;
}
.fp-cta-alt a:hover { color: #fff; }

/* ── Copper-to-HQ mapping cards ── */
.rc-mapping {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 820px;
  margin: 0 auto;
}
.rc-map-headers {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 24px;
}
.rc-map-hdr {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 14px;
}
.rc-map-hdr img {
  width: 72px; height: 72px;
  border-radius: 12px;
  object-fit: cover;
  border: 2px solid var(--line);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.rc-map-hdr span {
  font-family: var(--display);
  font-size: 18px;
  font-weight: 700;
  color: var(--muted);
}
.rc-map-hdr-hq span { color: var(--red); }
.rc-map-hdr-hq img { border-color: rgba(217,45,32,0.3); }
.rc-map-hdr-spacer { width: 48px; flex-shrink: 0; }
.rc-map-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 8px 24px -8px rgba(22,24,29,0.1);
}
.rc-map-cell {
  flex: 1;
  padding: 20px 24px;
}
.rc-map-cell p {
  margin: 0;
  font-size: 15.5px;
  line-height: 1.5;
  color: var(--ink);
  font-weight: 500;
}
.rc-map-copper p { color: var(--muted); }
.rc-map-hq {
  background: linear-gradient(170deg, #fef3f2, #fff 55%);
}
.rc-map-hq p { font-weight: 600; }
.rc-map-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #fff;
  background: var(--muted);
  padding: 3px 10px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.rc-map-badge-hq {
  background: var(--red);
}
.rc-map-arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  background: rgba(0,0,0,0.015);
}

/* ── What HQ gives you card ── */
.rc-hq-card {
  max-width: 520px; margin: 0 auto;
  border: 1px solid rgba(217,45,32,0.25); border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(217,45,32,0.08), 0 12px 40px -12px rgba(22,24,29,0.1);
}
.rc-hq-header {
  padding: 16px 22px; font-size: 13px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  background: var(--red); color: #fff;
}
.rc-hq-item {
  padding: 16px 22px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(170deg, #fef7f6, #fff 60%);
}
.rc-hq-item:last-child { border-bottom: none; }
.rc-hq-dim {
  display: block; font-size: 10.5px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--red); opacity: 0.7; margin-bottom: 5px;
}
.rc-hq-val {
  display: flex; align-items: center; gap: 8px;
  font-size: 15.5px; font-weight: 600; color: var(--ink);
  line-height: 1.4;
}

/* ── Pain point cards ── */
.rc-pains {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}
.rc-pain {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 30px 28px 34px;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);
  display: flex;
  flex-direction: column;
}
.rc-pain h3 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 20px;
  margin: 0 0 10px;
  line-height: 1.12;
}
.rc-pain p {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.65;
  margin: 0;
}

/* ── Lead form ── */
.rc-form-wrap {
  max-width: 600px;
  margin: 0 auto;
}
.rc-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.rc-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.rc-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rc-form label span {
  font-family: var(--display);
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}
.rc-form input,
.rc-form select {
  font-family: var(--body);
  font-size: 15px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  outline: none;
  transition: border-color 0.2s;
}
.rc-form input:focus,
.rc-form select:focus {
  border-color: var(--red);
}
.rc-form input::placeholder {
  color: #b5b0a6;
}
.rc-form-full {
  width: 100%;
}
.rc-form-btn {
  align-self: flex-start;
  margin-top: 4px;
}
.rc-form-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.rc-form-note {
  font-size: 13px;
  color: var(--muted);
  margin: 0;
}
.rc-form-success {
  text-align: center;
  padding: 48px 24px;
}
.rc-form-success h3 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 22px;
  margin: 20px 0 8px;
  color: var(--ink);
}
.rc-form-success p {
  font-size: 15px;
  color: var(--muted);
  margin: 0;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .rc-pains { grid-template-columns: 1fr; }
  .rc-form-row { grid-template-columns: 1fr; }
  .rc-compare { grid-template-columns: 1fr; gap: 24px; }
}
@media (max-width: 640px) {
  .fp-hero { padding: 120px 16px 48px; }
  .fp-hero h1 { font-size: 32px; }
  .fp-hero-sub { font-size: 16px; }
  .fp-section { padding: 64px 16px; }
  .fp-cta-section { padding: 64px 16px; }
  .fp-hero-ctas { flex-direction: column; align-items: center; }
  .fp-btn { width: 100%; max-width: 320px; text-align: center; }
  .rc-map-headers { display: none; }
  .rc-map-row { flex-direction: column; }
  .rc-map-arrow { transform: rotate(90deg); width: 100%; height: 32px; }
  .rc-hero-phone { max-width: 100%; }
  .rc-form-btn { align-self: stretch; text-align: center; }
}
`;
