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
        canonicalUrl="https://hotline.redlineusedautoparts.com/own-a-hotline"
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
              href="https://hotline.redlineusedautoparts.com/client/signup"
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
