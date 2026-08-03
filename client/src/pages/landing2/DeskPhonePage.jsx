import { useState } from "react";
import { Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL } from "./site";

const SIGNUP_URL = "/client/signup";
const HERO_IMG = "/images/t31p-desk-phone.webp";
const CLOSEUP_IMG = "/images/t31p-lcd.webp";

const STEPS = [
  { num: "01", title: "Order your phone", desc: "We ship a preconfigured Yealink T31P to your yard — or grab one from Amazon, B&H, or any VoIP retailer and we'll send the config." },
  { num: "02", title: "Plug in one cable", desc: "Ethernet into your router. The phone boots, finds the hotline, and connects itself. No passwords, no SIP settings." },
  { num: "03", title: "You're live", desc: "Within 30 seconds you hear the network. When someone asks for a part you have, pick up and respond." },
];

const BENEFITS = [
  { icon: "mic", title: "No mic permission issues", desc: "The #1 browser problem — blocked microphone — doesn't exist with a desk phone." },
  { icon: "power", title: "Always on, always connected", desc: "24/7 connection. No browser tab, no battery, no screen lock to manage." },
  { icon: "audio", title: "Crystal-clear HD voice", desc: "Wideband audio codecs. Every part number, VIN digit, and dollar amount comes through clearly." },
  { icon: "id", title: "Caller ID on every broadcast", desc: "See who's talking before you pick up. Know exactly which yard is asking." },
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
        image: "https://hotlinehq.online/images/t31p-desk-phone.webp",
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
    <div className="l2 dp-page">
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

      {/* ── HERO ── */}
      <header className="dp-hero">
        <div className="dp-hero-inner">
          <nav className="dp-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link><span>/</span>
            <Link to="/own-a-hotline">Features</Link><span>/</span>
            <span>Desk Phone</span>
          </nav>
          <div className="dp-hero-layout">
            <div className="dp-hero-text">
              <h1 className="dp-title">This is the product.<br /><em>Not an app. A phone.</em></h1>
              <p className="dp-lede">A preconfigured Yealink T31P desk phone with HD audio sits on your counter, always connected to your room. One ethernet cable. Thirty seconds to your first broadcast.</p>
              <div className="dp-hero-ctas">
                <a href={SIGNUP_URL} className="dp-btn dp-btn-hot">Sign Up Free</a>
                <a href={`mailto:${CONTACT_EMAIL}?subject=Desk phone inquiry`} className="dp-btn dp-btn-ghost">Talk to Us</a>
              </div>
            </div>
            <div className="dp-hero-img">
              <img src={HERO_IMG} alt="Yealink T31P desk phone with Hotline HQ branding on a salvage yard counter" />
            </div>
          </div>
        </div>
      </header>

      {/* ── PROBLEM ── */}
      <section className="dp-section dp-problem">
        <div className="dp-narrow">
          <h2 className="dp-h2">Browser calling has limits.<br />A desk phone doesn't.</h2>
          <p className="dp-body">Mic permissions get blocked. Tabs get closed. Batteries die. Notifications get missed. A dedicated desk phone sits on your counter, always on, always connected — like a landline that plugs you into every yard in the state.</p>
        </div>
      </section>

      {/* ── WHY YARDS ARE DITCHING BROWSER ── */}
      <section className="dp-section">
        <div className="dp-container">
          <div className="dp-content-split">
            <div className="dp-content-text">
              <h2 className="dp-h2">Why salvage yards are ditching browser calling</h2>
              <p className="dp-body">Chrome pushes an update overnight and resets your microphone permissions. An employee closes "that weird tab with the speaker icon." The screen lock kicks in during a slow afternoon and you miss three broadcasts.</p>
              <p className="dp-body">A desk phone doesn't have tabs. It doesn't run Chrome. It doesn't need a login, a password, or a Windows update. It sits on the counter like a landline — except this one connects you to every yard in the state.</p>
            </div>
            <div className="dp-content-aside">
              <div className="dp-aside-card">
                <div className="dp-aside-header dp-aside-header-red">Browser Problems</div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Microphone</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> Permissions silently revoked</span>
                </div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Browser Tabs</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> Employee closed "the noisy tab"</span>
                </div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Screen Lock</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> Missed 3 broadcasts</span>
                </div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Shared Computer</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> Someone else logged in</span>
                </div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Wi-Fi</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> 10-second drop — call gone</span>
                </div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Battery</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> Died mid-broadcast</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY YARDS ARE DITCHING COPPER ── */}
      <section className="dp-section" style={{ background: "var(--surface)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="dp-container">
          <div className="dp-content-split">
            <div className="dp-content-text">
              <h2 className="dp-h2">Why yards are leaving copper hotlines behind</h2>
              <p className="dp-body">Telcos are sunsetting POTS (Plain Old Telephone Service) lines across the country. Maintenance crews are shrinking, prices are climbing every year, and some areas can't get copper service at all anymore. The infrastructure your hotline runs on is being retired.</p>
              <p className="dp-body">The HQ desk phone delivers the exact same experience — a dedicated phone on the counter, always on, pick up and your room hears you. But now with HD digital audio, caller ID showing who's talking, every call recorded and transcribed, and the ability to switch between any region instead of being stuck in one local area.</p>
              <p className="dp-body">Your group doesn't lose anything in the switch. Same workflow, same muscle memory. Just better tools underneath. See the full <Link to="/use-case/replace-copper-hotline" style={{color:'var(--red)'}}>copper-to-HQ comparison</Link> for everything your old line is missing.</p>
            </div>
            <div className="dp-content-aside">
              <div className="dp-aside-card">
                <div className="dp-aside-header dp-aside-header-copper">Copper Can't Do This</div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Caller ID</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> No display — don't know who's talking</span>
                </div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Recordings</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> No way to review a deal</span>
                </div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Transcription</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> Nothing searchable</span>
                </div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Reach</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> Stuck in one local region</span>
                </div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Cost</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> Rising every year</span>
                </div>
                <div className="dp-aside-item">
                  <span className="dp-aside-dim">Reliability</span>
                  <span className="dp-aside-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--muted)" strokeWidth="1.5" opacity=".4" /><path d="M5 5l6 6M11 5l-6 6" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" /></svg> Fewer repair crews every year</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT HOTLINE HQ GIVES YOU ── */}
      <section className="dp-section">
        <div className="dp-container">
          <h2 className="dp-h2 dp-center">What you get with Hotline HQ</h2>
          <p className="dp-body dp-center-text" style={{ maxWidth: 560, margin: "0 auto 36px" }}>Everything a browser and copper line can't do — built into one desk phone.</p>
          <div className="dp-hq-card">
            <div className="dp-hq-header">Hotline HQ</div>
            <div className="dp-hq-item">
              <span className="dp-hq-dim">HD Audio</span>
              <span className="dp-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Crystal-clear wideband voice</span>
            </div>
            <div className="dp-hq-item">
              <span className="dp-hq-dim">Caller ID</span>
              <span className="dp-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> See who's talking before you pick up</span>
            </div>
            <div className="dp-hq-item">
              <span className="dp-hq-dim">Recordings</span>
              <span className="dp-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Every call recorded automatically</span>
            </div>
            <div className="dp-hq-item">
              <span className="dp-hq-dim">Transcription</span>
              <span className="dp-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Full text of every broadcast, searchable</span>
            </div>
            <div className="dp-hq-item">
              <span className="dp-hq-dim">Reach</span>
              <span className="dp-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Switch between any region</span>
            </div>
            <div className="dp-hq-item">
              <span className="dp-hq-dim">Portability</span>
              <span className="dp-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Desk phone + web panel on the go</span>
            </div>
            <div className="dp-hq-item">
              <span className="dp-hq-dim">Always On</span>
              <span className="dp-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> 24/7 connection, no browser needed</span>
            </div>
            <div className="dp-hq-item">
              <span className="dp-hq-dim">Private Calls</span>
              <span className="dp-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Direct yard-to-yard calls off the room</span>
            </div>
            <div className="dp-hq-item">
              <span className="dp-hq-dim">Cost</span>
              <span className="dp-hq-val"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--red)" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Flat monthly — phone included</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="dp-section">
        <div className="dp-container">
          <h2 className="dp-h2 dp-center">Three steps. Thirty seconds.</h2>
          <div className="dp-steps">
            {STEPS.map((s, i) => (
              <div className="dp-step" key={i}>
                <span className="dp-step-num">{s.num}</span>
                <div>
                  <h3 className="dp-step-title">{s.title}</h3>
                  <p className="dp-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT YOU HEAR ── */}
      <section className="dp-section dp-experience">
        <div className="dp-narrow">
          <h2 className="dp-h2 dp-center">What you actually hear on the hotline</h2>
          <p className="dp-body dp-center-text">The phone sits on your counter with the speaker on low. All day, you hear yards broadcasting requests:</p>
          <div className="dp-broadcast-examples">
            <div className="dp-broadcast">
              <span className="dp-broadcast-caller">Mike's Auto — Phoenix, AZ</span>
              <p>"Looking for a 2019 Camry driver's side fender, any color. Who's got one?"</p>
            </div>
            <div className="dp-broadcast">
              <span className="dp-broadcast-caller">Valley Salvage — Houston, TX</span>
              <p>"Need a transmission for an '18 F-150, 3.5 EcoBoost. Preferably under 80k miles."</p>
            </div>
            <div className="dp-broadcast">
              <span className="dp-broadcast-caller">Tri-State Parts — Newark, NJ</span>
              <p>"Customer waiting on a 2020 Accord headlight assembly, passenger side. Anyone close?"</p>
            </div>
          </div>
          <p className="dp-body dp-center-text">When you hear a part you have, you pick up the handset and respond. Caller ID shows exactly who's asking — no guessing. The conversation is recorded and transcribed automatically, so you can review every deal later. Your customer gets the part. Their customer drives away happy. That's the hotline.</p>
        </div>
      </section>

      {/* ── SHOWCASE — dark with close-up ── */}
      <section className="dp-showcase">
        <div className="dp-container">
          <div className="dp-showcase-grid">
            <div className="dp-showcase-img">
              <img src={CLOSEUP_IMG} alt="Yealink T31P LCD showing Hotline HQ conference with 3 participants" />
            </div>
            <div className="dp-showcase-text">
              <span className="dp-tag">YEALINK SIP-T31P</span>
              <h2 className="dp-h2" style={{ color: "#fff", marginTop: 12 }}>Built for the counter.</h2>
              <p className="dp-showcase-body">
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

      {/* ── DESK PHONE VS WEB CLIENT ── */}
      <section className="dp-section dp-vs-section">
        <div className="dp-container">
          <h2 className="dp-h2 dp-center">Desk phone vs web client</h2>
          <p className="dp-body dp-center-text" style={{ maxWidth: 600, margin: "0 auto 36px" }}>Every Hotline HQ membership includes both. Here's when to use each.</p>
          <div className="dp-vs-grid">
            <div className="dp-vs-card dp-vs-phone">
              <span className="dp-vs-badge">THE COUNTER LINE</span>
              <h3>Desk Phone</h3>
              <p className="dp-vs-when">For the shop floor — where the work gets done</p>
              <ul>
                <li>Always on, always listening — never misses a broadcast</li>
                <li>HD audio through a real speaker and handset</li>
                <li>Caller ID shows who's talking before you pick up</li>
                <li>No computer, no browser, no login needed</li>
                <li>Survives dust, heat, and a busy counter</li>
                <li>Hands-free speakerphone or headset mode</li>
              </ul>
              <p className="dp-vs-verdict">This is how 90% of yards use the hotline every day.</p>
            </div>
            <div className="dp-vs-card dp-vs-web">
              <span className="dp-vs-badge dp-vs-badge-alt">THE MOBILE LINE</span>
              <h3>Web Client</h3>
              <p className="dp-vs-when">For the road — when you're away from the counter</p>
              <ul>
                <li>Works in any browser on any device</li>
                <li>Listen from auctions, trade shows, or a second location</li>
                <li>Available the minute you sign up — no shipping wait</li>
                <li>Good backup if your phone needs service</li>
              </ul>
              <p className="dp-vs-verdict">Your hotline goes where you go.</p>
            </div>
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
        <div className="dp-container">
          <h2 className="dp-h2">Frequently Asked Questions</h2>
          <div className="dp-faq-wrap">
            {FAQS.map((f, i) => (
              <details className="dp-faq" key={i} open={openFaq === i} onClick={(e) => { e.preventDefault(); setOpenFaq(openFaq === i ? null : i); }}>
                <summary>{f.q}</summary>
                {openFaq === i && <p>{f.a}</p>}
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="dp-cta-section">
        <div className="dp-cta-inner">
          <p className="dp-cta-kicker">INCLUDED WITH MEMBERSHIP</p>
          <h2>Ready to skip the browser hassle?</h2>
          <p className="dp-cta-sub">Every Hotline HQ membership includes a preconfigured desk phone. Or order your own from Amazon — we'll handle the setup.</p>
          <a href={SIGNUP_URL} className="dp-btn dp-btn-hot">Sign Up Free</a>
          <p style={{color:'rgba(255,255,255,0.4)',fontSize:'14px',marginTop:'20px'}}>
            Also: <Link to="/sell-used-auto-parts" style={{color:'rgba(255,255,255,0.7)',textDecoration:'underline',textUnderlineOffset:'2px'}}>Sell parts on the network</Link>
            {' · '}<Link to="/own-a-hotline" style={{color:'rgba(255,255,255,0.7)',textDecoration:'underline',textUnderlineOffset:'2px'}}>Own a hotline</Link>
            {' · '}<Link to="/use-case/replace-copper-hotline" style={{color:'rgba(255,255,255,0.7)',textDecoration:'underline',textUnderlineOffset:'2px'}}>Replace your copper line</Link>
          </p>
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
    case "id": return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="4" width="20" height="16" rx="2" /><circle cx="9" cy="11" r="2.5" /><path d="M5 18c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" /><path d="M15 8h4M15 12h3" /></svg>;
    case "plug": return <svg viewBox="0 0 24 24" {...s}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3" /></svg>;
    case "headset": return <svg viewBox="0 0 24 24" {...s}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /><path d="M19 22v-2a4 4 0 0 0-4-4h-1" /></svg>;
    default: return null;
  }
}

const CSS = `
/* ── Nav override — white header ── */
.dp-page .l2-nav {
  background: #fff;
  border-bottom: 1px solid var(--line);
  position: relative;
  z-index: 10;
}
.dp-page .l2-nav .l2-nav-cta {
  background: var(--red);
  color: #fff;
  border-radius: 8px;
  padding: 8px 18px;
}
.dp-page .l2-nav .l2-nav-cta:hover {
  background: var(--red-deep);
}

/* ── Hero ── */
.dp-hero {
  background: #0f1117;
  padding: 100px 24px 0;
  overflow: hidden;
}
.dp-hero-inner { max-width: 1140px; margin: 0 auto; }
.dp-crumbs {
  display: flex; gap: 6px; align-items: center;
  font-size: 12.5px; color: rgba(255,255,255,0.3);
}
.dp-crumbs a { color: rgba(255,255,255,0.4); text-decoration: none; }
.dp-crumbs a:hover { color: rgba(255,255,255,0.7); }
.dp-crumbs span { color: rgba(255,255,255,0.2); }
.dp-crumbs span:last-child { color: rgba(255,255,255,0.6); }
.dp-hero-layout {
  display: flex; align-items: flex-end; gap: 48px; margin-top: 32px;
}
.dp-hero-text { flex: 1; min-width: 0; padding-bottom: 60px; }
.dp-title {
  font-family: var(--display); font-weight: 700;
  font-size: clamp(32px, 5vw, 52px);
  line-height: 1.08; letter-spacing: -0.03em;
  color: #fff; margin: 0 0 20px;
}
.dp-title em {
  font-style: normal;
  color: var(--red);
}
.dp-lede {
  font-size: 17.5px; line-height: 1.7;
  color: rgba(255,255,255,0.5); margin: 0 0 32px;
  max-width: 480px;
}
.dp-hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; }
.dp-btn {
  font-family: var(--body); font-weight: 600; font-size: 15px;
  padding: 14px 28px; border-radius: 10px;
  text-decoration: none; display: inline-block;
  transition: background .2s, color .2s, border-color .2s;
}
.dp-btn-hot {
  background: var(--red) !important; color: #fff !important;
  border: 1.5px solid var(--red) !important;
}
.dp-btn-hot:hover { background: var(--red-deep) !important; border-color: var(--red-deep) !important; }
.dp-btn-ghost {
  background: rgba(255,255,255,0.08) !important;
  color: #fff !important;
  border: 1.5px solid rgba(255,255,255,0.25) !important;
}
.dp-btn-ghost:hover { background: rgba(255,255,255,0.15) !important; border-color: rgba(255,255,255,0.4) !important; }
.dp-hero-img {
  flex-shrink: 0; max-width: 440px;
}
.dp-hero-img img {
  display: block; width: 100%; height: auto;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 40px rgba(217,45,32,0.12);
}

/* ── Shared ── */
.dp-section { padding: 72px 24px; }
.dp-container { max-width: 1140px; margin: 0 auto; }
.dp-narrow { max-width: 680px; margin: 0 auto; }
.dp-center { text-align: center; }
.dp-h2 {
  font-family: var(--display); font-weight: 700;
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.15; letter-spacing: -0.015em;
  color: var(--ink); margin: 0 0 16px;
}
.dp-body { font-size: 17px; line-height: 1.8; color: var(--muted); margin: 0; }
.dp-tag {
  display: inline-block; font-size: 10px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: #fff; background: var(--red); padding: 4px 12px;
  border-radius: 4px;
}

/* ── Problem ── */
.dp-problem {
  text-align: center;
  background: var(--surface, #f8f8f6);
  border-bottom: 1px solid var(--line);
}
.dp-problem .dp-h2 { max-width: 520px; margin-left: auto; margin-right: auto; }
.dp-problem .dp-body { max-width: 560px; margin: 0 auto; }

/* ── Steps ── */
.dp-steps {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 28px; margin-top: 40px;
}
.dp-step {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 14px; padding: 28px 24px;
  display: flex; flex-direction: column; gap: 16px;
}
.dp-step-num {
  font-family: var(--display); font-size: 32px; font-weight: 700;
  color: var(--red); opacity: 0.25; line-height: 1;
}
.dp-step-title {
  font-family: var(--display); font-size: 17px; font-weight: 700;
  color: var(--ink); margin: 0 0 6px;
}
.dp-step-desc { font-size: 14.5px; line-height: 1.7; color: var(--muted); margin: 0; }

/* ── Showcase — dark ── */
.dp-showcase { background: #0f1117; padding: 72px 24px; }
.dp-showcase-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 48px; align-items: center;
  max-width: 1140px; margin: 0 auto;
}
.dp-showcase-img { border-radius: 12px; overflow: hidden; }
.dp-showcase-img img {
  display: block; width: 100%; height: auto;
  box-shadow: 0 8px 40px rgba(0,0,0,0.4);
}
.dp-showcase-body {
  font-size: 16.5px; line-height: 1.7;
  color: rgba(255,255,255,0.5); margin: 0 0 28px;
}
.dp-spec-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dp-spec-card {
  padding: 14px 16px; border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
}
.dp-spec-label {
  display: block; font-family: var(--mono); font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: rgba(255,255,255,0.3); margin-bottom: 4px;
}
.dp-spec-val { font-size: 13.5px; font-weight: 600; color: #fff; }

/* ── Benefits ── */
.dp-benefits {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 20px; margin-top: 40px;
}
.dp-benefit {
  padding: 24px; border-radius: 14px;
  background: var(--surface, #f8f8f6);
  border: 1px solid var(--line, #e5e7eb);
  transition: border-color .2s, box-shadow .2s;
}
.dp-benefit:hover {
  border-color: rgba(217,45,32,0.2);
  box-shadow: 0 4px 20px rgba(217,45,32,0.06);
}
.dp-benefit-icon { width: 36px; height: 36px; margin-bottom: 14px; }
.dp-benefit-icon svg { width: 36px; height: 36px; }
.dp-benefit-title {
  font-family: var(--display); font-size: 15px;
  font-weight: 700; color: var(--ink); margin: 0 0 6px;
}
.dp-benefit-desc { font-size: 14px; line-height: 1.65; color: var(--muted); margin: 0; }

/* ── Content split (browser/copper sections) ── */
.dp-content-split {
  display: grid; grid-template-columns: 1.4fr 1fr; gap: 48px;
  align-items: start;
}
.dp-content-text .dp-body { margin-bottom: 16px; }
.dp-content-text .dp-body:last-child { margin-bottom: 0; }
.dp-aside-card {
  border: 1px solid var(--line); border-radius: 16px;
  overflow: hidden; position: sticky; top: 100px;
  box-shadow: 0 2px 12px rgba(22,24,29,0.06);
}
.dp-aside-header {
  padding: 14px 20px; font-size: 12px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  border-bottom: 1px solid var(--line);
}
.dp-aside-header-red { background: var(--red); color: #fff; border-bottom-color: var(--red); }
.dp-aside-header-copper { background: #92400e; color: #fff; border-bottom-color: #92400e; }
.dp-aside-item {
  padding: 14px 20px; border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.dp-aside-item:last-child { border-bottom: none; }
.dp-aside-dim {
  display: block; font-size: 10px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--red); opacity: 0.7; margin-bottom: 4px;
}
.dp-aside-val {
  display: flex; align-items: center; gap: 8px;
  font-size: 14.5px; font-weight: 600; color: var(--ink);
  line-height: 1.4;
}

/* ── What HQ gives you card ── */
.dp-hq-card {
  max-width: 520px; margin: 0 auto;
  border: 1px solid rgba(217,45,32,0.25); border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(217,45,32,0.08), 0 12px 40px -12px rgba(22,24,29,0.1);
}
.dp-hq-header {
  padding: 16px 22px; font-size: 13px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  background: var(--red); color: #fff;
}
.dp-hq-item {
  padding: 16px 22px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(170deg, #fef7f6, #fff 60%);
}
.dp-hq-item:last-child { border-bottom: none; }
.dp-hq-dim {
  display: block; font-size: 10.5px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--red); opacity: 0.7; margin-bottom: 5px;
}
.dp-hq-val {
  display: flex; align-items: center; gap: 8px;
  font-size: 15.5px; font-weight: 600; color: var(--ink);
  line-height: 1.4;
}

/* ── What you hear (experience) ── */
.dp-experience { background: var(--surface); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.dp-center-text { text-align: center; }
.dp-broadcast-examples {
  display: flex; flex-direction: column; gap: 12px;
  max-width: 560px; margin: 28px auto;
}
.dp-broadcast {
  background: #fff; border: 1px solid var(--line);
  border-left: 3px solid var(--red); border-radius: 10px;
  padding: 16px 20px;
}
.dp-broadcast-caller {
  display: block; font-size: 12px; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--red); margin-bottom: 4px;
}
.dp-broadcast p {
  margin: 0; font-size: 15px; line-height: 1.6;
  color: var(--ink); font-style: italic;
}

/* ── Desk phone vs web client ── */
.dp-vs-section { background: var(--surface); border-top: 1px solid var(--line); }
.dp-vs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 860px; margin: 0 auto; }
.dp-vs-card {
  border-radius: 14px; padding: 32px 28px;
  border: 1px solid var(--line); background: #fff;
}
.dp-vs-phone {
  border-color: rgba(217,45,32,0.25);
  box-shadow: 0 4px 24px rgba(217,45,32,0.06);
}
.dp-vs-badge {
  display: inline-block; font-size: 10px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  background: var(--red); color: #fff; padding: 4px 12px;
  border-radius: 4px; margin-bottom: 12px;
}
.dp-vs-badge-alt { background: var(--muted); }
.dp-vs-card h3 {
  font-family: var(--display); font-size: 22px; font-weight: 700;
  color: var(--ink); margin: 0 0 6px;
}
.dp-vs-when { font-size: 14px; color: var(--muted); margin: 0 0 18px; }
.dp-vs-card ul { list-style: none; padding: 0; margin: 0 0 18px; }
.dp-vs-card li {
  font-size: 14px; line-height: 1.6; color: var(--ink);
  padding: 6px 0 6px 22px; position: relative;
}
.dp-vs-card li::before {
  content: "✓"; position: absolute; left: 0; top: 6px;
  color: var(--red); font-weight: 700; font-size: 13px;
}
.dp-vs-verdict {
  font-size: 14px; font-weight: 600; color: var(--ink);
  margin: 0; padding-top: 14px; border-top: 1px solid var(--line);
}

/* ── Specs table ── */
.dp-specs-section { background: var(--surface, #f8f8f6); }
.dp-specs-table {
  margin-top: 28px; border-radius: 14px; overflow: hidden;
  border: 1px solid var(--line, #e5e7eb); background: #fff;
}
.dp-specs-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 24px; border-bottom: 1px solid var(--line, #f3f4f6);
}
.dp-specs-row:last-child { border-bottom: none; }
.dp-specs-row:nth-child(even) { background: var(--surface, #fafafa); }
.dp-specs-key { font-size: 14px; font-weight: 600; color: var(--ink); }
.dp-specs-val2 { font-size: 14px; color: var(--muted); text-align: right; }

/* ── FAQ ── */
.dp-faq-wrap { max-width: 680px; }
.dp-faq {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 12px; margin-bottom: 10px; overflow: hidden;
}
.dp-faq summary {
  padding: 16px 20px; cursor: pointer; font-weight: 600;
  font-size: 15px; color: var(--ink); list-style: none;
  display: flex; justify-content: space-between; align-items: center;
}
.dp-faq summary::-webkit-details-marker { display: none; }
.dp-faq summary::after {
  content: "+"; font-size: 20px; font-weight: 300;
  color: var(--muted); transition: transform .2s;
}
.dp-faq[open] summary::after { content: "−"; }
.dp-faq p {
  padding: 0 20px 16px; margin: 0;
  font-size: 14.5px; line-height: 1.7; color: var(--muted);
}

/* ── CTA ── */
.dp-cta-section {
  background: #0f1117; padding: 80px 24px; text-align: center;
  border-top: 3px solid var(--red);
}
.dp-cta-inner { max-width: 560px; margin: 0 auto; }
.dp-cta-kicker {
  font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--red); margin: 0 0 16px;
}
.dp-cta-section h2 {
  font-family: var(--display); font-weight: 700;
  font-size: clamp(24px, 4vw, 32px); color: #fff;
  margin: 0 0 14px; line-height: 1.15;
}
.dp-cta-sub {
  font-size: 16px; line-height: 1.7; color: rgba(255,255,255,0.45);
  margin: 0 0 28px;
}
.dp-cta-section .dp-btn-hot {
  font-size: 17px; padding: 16px 36px;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .dp-steps { grid-template-columns: 1fr; }
  .dp-benefits { grid-template-columns: 1fr 1fr; }
  .dp-content-split { grid-template-columns: 1fr; gap: 28px; }
  .dp-aside-card { position: static; }
  .dp-vs-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .dp-hero { padding: 90px 16px 0; }
  .dp-hero-layout { flex-direction: column-reverse; text-align: center; gap: 32px; }
  .dp-hero-text { padding-bottom: 40px; }
  .dp-hero-img { max-width: 320px; margin: 0 auto; }
  .dp-hero-img img { border-radius: 12px; }
  .dp-lede { margin-left: auto; margin-right: auto; }
  .dp-hero-ctas { justify-content: center; }
  .dp-showcase-grid { grid-template-columns: 1fr; gap: 32px; }
  .dp-showcase-img { order: -1; }
  .dp-spec-strip { grid-template-columns: 1fr; }
  .dp-benefits { grid-template-columns: 1fr; }
  .dp-section { padding: 56px 16px; }
  .dp-showcase { padding: 56px 16px; }
}
`;
