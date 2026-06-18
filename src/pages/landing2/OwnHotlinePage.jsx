import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL } from "./site";

/* ------------------------------------------------------------------ */
/*  /own-a-hotline — operator-intent page.                             */
/*  Target searches: own a hotline, start a hotline business,          */
/*  voice hotline network for an industry, membership network.         */
/* ------------------------------------------------------------------ */

const MODEL = [
  {
    n: "1",
    title: "You bring the community",
    copy: "You know your trade — the dealers, yards, or wholesalers who call each other all day looking for inventory. They're your members.",
  },
  {
    n: "2",
    title: "We run the network",
    copy: "Hotline HQ runs the lines, the regional rooms, the recordings, the preconfigured phones, and the 24/7 monitoring. No telecom knowledge needed on your side.",
  },
  {
    n: "3",
    title: "You own the revenue",
    copy: "Members pay a flat monthly fee for their line. It's your network and your brand — the membership revenue is yours, month after month.",
  },
];

const TRADES = [
  ["Used auto parts", "Live today — 500+ salvage yards across 12 regional rooms"],
  ["Heavy truck & trailer parts", "Same hunt, bigger inventory, fewer players per region"],
  ["Equipment & machinery dealers", "Attachments, parts, and whole units traded dealer to dealer"],
  ["Building material suppliers", "Sourcing odd-lot and discontinued stock across a region"],
  ["Wholesale & surplus dealers", "Any trade where 'who has one?' is asked out loud every day"],
];

const INCLUDED = [
  "Regional voice rooms with always-on member lines",
  "Preconfigured desk phones and a browser client for members",
  "Every broadcast logged and recorded automatically",
  "Auto-reconnect and 24/7 line monitoring with alerts",
  "Answer-rate and activity reporting for you and your members",
  "Member onboarding — a new line is live the day the phone arrives",
];

function ownJsonLd() {
  const origin = window.location.origin;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Own a Hotline HQ network",
    serviceType: "Turnkey voice hotline network for industries",
    provider: { "@type": "Organization", name: "Hotline HQ", url: origin, email: CONTACT_EMAIL },
    areaServed: "US",
    description:
      "Launch and own an always-on voice hotline network for your industry. Hotline HQ runs the lines, rooms, recordings, and equipment; the network owner earns flat monthly membership revenue.",
  };
}

export function OwnHotlinePage() {
  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{OWN_CSS}</style>
      <Seo
        title="Own a Hotline — Start an Always-On Voice Network for Your Industry | Hotline HQ"
        description="Launch and own a 24/7 voice hotline that connects businesses in your trade. You bring the community; Hotline HQ runs the lines, rooms, recordings, and equipment. You earn the monthly membership revenue."
        keywords="own a hotline, start a hotline business, business hotline network, voice network for business, industry hotline, start a membership network, dealer trading hotline, turnkey hotline network"
        canonicalUrl="https://redlineusedautoparts.com/hotlinehq/own-a-hotline"
        path="/own-a-hotline"
        jsonLd={ownJsonLd()}
      />
      <SiteNav />

      <main className="l2-ownpage">
        {/* hero */}
        <section className="l2-own-hero">
          <p className="l2-doc-kicker">Own a hotline</p>
          <h1>
            Own the always-on hotline
            <br />
            for <em>your industry.</em>
          </h1>
          <p className="l2-own-lede">
            In every trade, businesses spend their day calling around to find
            what a customer needs. A Hotline HQ network replaces the phone tree
            with one always-on voice room per region — members broadcast a
            request once, somebody who has it answers in seconds. You own the
            network. We run it.
          </p>
          <div className="l2-own-ctas">
            <a
              className="l2-btn l2-btn-hot"
              href={`mailto:${CONTACT_EMAIL}?subject=Launching a hotline for my industry`}
            >
              Talk to us about your hotline
            </a>
            <a className="l2-btn l2-btn-ghost" href="/">
              See a live network →
            </a>
          </div>
        </section>

        {/* proof bar */}
        <section className="l2-own-proof">
          <p>
            Proven in production: our used auto parts network runs{" "}
            <strong>500+ salvage yards</strong> across{" "}
            <strong>12 regional rooms</strong> with a typical answer time of{" "}
            <strong>2 seconds</strong> — monitored 24/7.
          </p>
        </section>

        {/* the model */}
        <section className="l2-own-section">
          <h2>The model is simple.</h2>
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
          <h2>Built for trades that talk.</h2>
          <p className="l2-own-sub">
            If businesses in your industry already call each other asking "who
            has one?", a hotline turns those calls into a network.
          </p>
          <div className="l2-own-trades">
            {TRADES.map(([name, note], i) => (
              <div className="l2-own-trade" key={name}>
                <span className="l2-own-trade-name">
                  {name}
                  {i === 0 && <span className="l2-own-live">● LIVE</span>}
                </span>
                <span className="l2-own-trade-note">{note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* included */}
        <section className="l2-own-section">
          <h2>What we run for you.</h2>
          <ul className="l2-own-included">
            {INCLUDED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="l2-own-final">
          <h2>Your industry. Your hotline. Your revenue.</h2>
          <p>
            Tell us about your trade and your region — we'll walk you through
            what a launch looks like and what the live parts network earns.
          </p>
          <a
            className="l2-btn l2-btn-hot"
            href={`mailto:${CONTACT_EMAIL}?subject=Launching a hotline for my industry`}
          >
            Start the conversation
          </a>
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
.l2-own-included li::before { content: "✓"; position: absolute; left: 0; color: var(--green); font-weight: 700; }

.l2-own-final {
  margin: 80px 0 40px; padding: 56px 40px; text-align: center;
  background: #16181d; border-radius: 20px; color: #f4f2ee;
}
.l2-own-final h2 { color: #fff; }
.l2-own-final p { color: #b9bcc4; font-size: 16.5px; line-height: 1.65; max-width: 560px; margin: 0 auto 28px; }
`;
