import { Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL, buildSiteUrl } from "./site";

/* ------------------------------------------------------------------ */
/*  /own-a-hotline — operator-intent page.                             */
/*  Target searches: auto parts hotline, own a hotline,                */
/*  used auto parts hotline, start a hotline business.                 */
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

const FAQS = [
  {
    q: "What is an auto parts hotline?",
    a: "An auto parts hotline is a live voice network where salvage yards and auto recyclers stay connected to the same regional room. A member broadcasts a part request once, and yards that have the part answer immediately.",
  },
  {
    q: "Can I own the auto parts hotline while Hotline HQ runs the technology?",
    a: "Yes. You own the member relationships, local brand, and recurring revenue. Hotline HQ runs the phones, browser lines, recordings, monitoring, and day-to-day network operations behind the scenes.",
  },
  {
    q: "Is this built for used auto parts yards first?",
    a: "Yes. The model is already proven with a live used auto parts hotline spanning 500+ salvage yards across 12 regional rooms, and that operating playbook can be launched in additional markets or adapted to similar dealer networks.",
  },
];

function ownJsonLd() {
  const homepageUrl = buildSiteUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Auto parts hotline network by Hotline HQ",
        serviceType: "Turnkey used auto parts hotline network",
        provider: { "@type": "Organization", name: "Hotline HQ", url: homepageUrl, email: CONTACT_EMAIL },
        areaServed: "US",
        description:
          "Launch and own a used auto parts hotline for salvage yards and auto recyclers. Hotline HQ runs the lines, regional rooms, recordings, and equipment while the network owner earns monthly membership revenue.",
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

export function OwnHotlinePage() {
  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{OWN_CSS}</style>
      <Seo
        title="Auto Parts Hotline — Own a Used Auto Parts Hotline Network | Hotline HQ"
        description="Own a used auto parts hotline for salvage yards and auto recyclers. Hotline HQ runs the lines, regional rooms, phones, recordings, and monitoring while you own the member revenue."
        keywords="auto parts hotline, used auto parts hotline, own an auto parts hotline, salvage yard hotline, auto recycler hotline, used auto parts network, hotline for salvage yards, parts locating hotline, own a hotline, start a hotline business"
        canonicalUrl="https://hotline.redlineusedautoparts.com/own-a-hotline"
        path="/own-a-hotline"
        jsonLd={ownJsonLd()}
      />
      <SiteNav />

      <main className="l2-ownpage">
        {/* hero */}
        <section className="l2-own-hero">
          <p className="l2-doc-kicker">Auto parts hotline</p>
          <h1>
            Own the used auto parts hotline
            <br />
            for <em>your market.</em>
          </h1>
          <p className="l2-own-lede">
            If you want to build an auto parts hotline for salvage yards and
            auto recyclers, this is the operating model. Hotline HQ replaces
            the phone tree with one always-on regional voice room where members
            broadcast a part request once and somebody who has it answers in
            seconds. You own the network and revenue. We run the system.
          </p>
          <div className="l2-own-ctas">
            <a
              className="l2-btn l2-btn-hot"
              href={`mailto:${CONTACT_EMAIL}?subject=Launching an auto parts hotline`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Talk to us about your auto parts hotline
            </a>
            <Link className="l2-btn l2-btn-ghost" to="/">
              See the live auto parts hotline →
            </Link>
          </div>
        </section>

        {/* proof bar */}
        <section className="l2-own-proof">
          <p>
            Proven in production: our used auto parts hotline runs{" "}
            <strong>500+ salvage yards</strong> across{" "}
            <strong>12 regional rooms</strong> with a typical answer time of{" "}
            <strong>2 seconds</strong> — monitored 24/7.
          </p>
        </section>

        {/* the model */}
        <section className="l2-own-section">
          <h2>Why an auto parts hotline still wins.</h2>
          <p className="l2-own-sub">
            Used auto parts yards need a live answer, not another stale
            database. When a counterperson can say the request once and reach a
            whole region instantly, more customer jobs stay alive and more
            member yards close sales they would have missed.
          </p>
        </section>

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
          <h2>Built first for used auto parts, adaptable to other trades.</h2>
          <p className="l2-own-sub">
            The playbook starts with the used auto parts hotline already live
            today. If businesses in your industry already call each other
            asking "who has one?", the same network model can be adapted.
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

        <section className="l2-own-section">
          <h2>Auto parts hotline FAQ.</h2>
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
          <h2>Your market. Your auto parts hotline. Your revenue.</h2>
          <p>
            Tell us about your region and member base. We'll walk you through
            what an auto parts hotline launch looks like and what the live
            network model earns.
          </p>
          <a
            className="l2-btn l2-btn-hot"
            href={`mailto:${CONTACT_EMAIL}?subject=Launching an auto parts hotline`}
            target="_blank"
            rel="noopener noreferrer"
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
`;
