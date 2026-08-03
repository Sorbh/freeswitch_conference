import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL, buildSiteUrl } from "./site";

const CONTACT_URL = `mailto:${CONTACT_EMAIL}?subject=Industry%20Inquiry`;

function ProofBar() {
  return (
    <div className="fp-proof-bar">
      <div className="fp-proof-item"><strong>15,000+</strong><span>parts located in auto</span></div>
      <div className="fp-proof-item"><strong>500+</strong><span>member yards</span></div>
      <div className="fp-proof-item"><strong>2s</strong><span>avg response</span></div>
      <div className="fp-proof-item"><strong>~97</strong><span>hear each request</span></div>
    </div>
  );
}

function IndustryLinks({ current, industries }) {
  return (
    <p className="ind-cta-alt">
      {industries.filter(ind => ind.to !== current).map((ind, i) => (
        <span key={ind.to}>{i > 0 && ' · '}<Link to={ind.to}>{ind.label}</Link></span>
      ))}
    </p>
  );
}

export function IndustryDetailPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [allIndustries, setAllIndustries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPage(null);
    Promise.all([
      fetch(`/api/v1/industries/${slug}`).then(r => r.json()),
      fetch('/api/v1/industries').then(r => r.json()),
    ]).then(([detail, list]) => {
      if (detail.status && detail.data) setPage(detail.data);
      if (list.status && list.data) {
        setAllIndustries(list.data
          .filter(p => p.type === 'industry')
          .map(p => ({ label: p.title.replace(/ Parts Hotline| Hotline/i, ''), to: `/use-case/${p.slug}` }))
        );
      }
    }).catch(() => setPage(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="l2">
        <style>{SITE_CSS}</style>
        <SiteNav />
        <div style={{ textAlign: 'center', padding: '200px 24px 100px', color: 'var(--muted)' }}>Loading...</div>
        <SiteFooter />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="l2">
        <style>{SITE_CSS}</style>
        <SiteNav />
        <div style={{ textAlign: 'center', padding: '200px 24px 100px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Industry not found</h1>
          <p style={{ color: 'var(--muted)', marginTop: 12 }}>
            <Link to="/" style={{ color: 'var(--red)' }}>Back to home &rarr;</Link>
          </p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const hero = page.hero || {};
  const seo = page.seo || {};
  const sections = page.sections || [];
  const parts = page.parts || [];
  const faqs = page.faqs || [];
  const resources = page.resources || [];
  const currentPath = `/use-case/${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: `${page.title} — Hotline HQ`,
        serviceType: `${page.title} Network`,
        provider: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
        areaServed: { "@type": "Country", name: "US" },
        description: seo.description,
      },
      ...(faqs.length ? [{
        "@type": "FAQPage",
        mainEntity: faqs.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }] : []),
    ],
  };

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{IND_CSS}</style>
      <Seo
        title={seo.title || page.title}
        description={seo.description || ''}
        keywords={seo.keywords}
        path={currentPath}
        jsonLd={jsonLd}
      />
      <SiteNav />

      <section className="ind-hero" style={hero.image ? { backgroundImage: `url(${hero.image})` } : undefined}>
        <div className="ind-hero-scrim" />
        <div className="ind-hero-inner">
          <p className="ind-kicker">{hero.kicker || page.title}</p>
          <h1 dangerouslySetInnerHTML={{ __html: hero.heading || page.title }} />
          <p className="ind-hero-sub">{hero.lede || seo.description}</p>
          <div className="ind-hero-ctas">
            <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
            <Link to="/#top" className="ind-btn ind-btn-ghost">Hear a Live Auto Parts Call</Link>
          </div>
        </div>
      </section>

      <ProofBar />

      {sections.map((section, si) => (
        <section className={`ind-section${si % 2 === 1 ? ' ind-band' : ''}`} key={si}>
          <div className="ind-section-head">
            <p className="ind-kicker">{section.kicker}</p>
            <h2>{section.heading}</h2>
            {section.lede && <p className="ind-lede">{section.lede}</p>}
          </div>
          {section.cards?.length > 0 && (
            <div className="ind-grid">
              {section.cards.map((card, ci) => (
                <div className="ind-card" key={ci}>
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {parts.length > 0 && (
        <section className="ind-section">
          <div className="ind-section-head">
            <p className="ind-kicker">PARTS IN DEMAND</p>
            <h2>Most-searched {page.title.toLowerCase().replace(' hotline', '')} parts</h2>
          </div>
          <div className="ind-parts-grid">
            {parts.map((p, i) => <div className="ind-part-tag" key={i}>{p}</div>)}
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section className="ind-section ind-band">
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div className="ind-section-head" style={{ textAlign: 'left', maxWidth: 'none', marginLeft: 0, marginRight: 0 }}>
              <p className="ind-kicker">FAQ</p>
              <h2>Frequently Asked Questions</h2>
            </div>
            <div className="ind-faq-list">
              {faqs.map((f, i) => (
                <details className="ind-faq" key={i}><summary>{f.q}</summary><p>{f.a}</p></details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="ind-cta">
        <div className="ind-cta-inner">
          <p className="ind-kicker" style={{ color: 'var(--red)' }}>COMING SOON</p>
          <h2>The {page.title.toLowerCase()}</h2>
          <p>Proven in auto parts (500+ yards, 15,000+ requests). Now expanding. Join the waitlist to get early access.</p>
          <a href={CONTACT_URL} className="ind-btn ind-btn-hot">Join the Waitlist</a>
          <p className="ind-cta-alt">
            See it working now: <Link to="/#top">listen to a live auto parts call</Link>
            {' '}· <Link to="/used-auto-parts-hotline">how the hotline works</Link>
          </p>
          <p className="ind-cta-alt">
            <Link to="/features/desk-phone">The desk phone</Link>
            {' · '}<Link to="/own-a-hotline">Own a hotline</Link>
            {' · '}<Link to="/sell-used-auto-parts">Sell parts on the network</Link>
          </p>
          {allIndustries.length > 0 && <IndustryLinks current={currentPath} industries={allIndustries} />}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

const IND_CSS = `
.ind-hero { position: relative; padding: 160px 32px 80px; overflow: hidden; text-align: center; background: linear-gradient(170deg, #16181d 0%, #1e2024 100%); background-size: cover; background-position: center; }
.ind-hero-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(22,24,29,0.82) 0%, rgba(22,24,29,0.92) 60%, rgba(22,24,29,0.98) 100%); pointer-events: none; }
.ind-hero-inner { position: relative; z-index: 2; max-width: 800px; margin: 0 auto; }
.ind-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--red, #d92d20); margin: 0 0 16px; }
.ind-hero h1 { font-size: clamp(36px, 5vw, 64px); font-weight: 700; color: #fff; line-height: 1.08; letter-spacing: -0.015em; margin: 0 0 22px; }
.ind-hero h1 em { font-style: normal; color: var(--red, #d92d20); }
.ind-hero-sub { font-size: 18px; line-height: 1.65; color: rgba(255,255,255,0.6); max-width: 620px; margin: 0 auto 32px; }
.ind-hero-ctas { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.ind-btn { font-weight: 600; font-size: 15.5px; padding: 14px 28px; border-radius: 11px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; cursor: pointer; border: none; }
.ind-btn:active { transform: translateY(1px); }
.ind-btn-hot { background: var(--red, #d92d20); color: #fff; box-shadow: 0 8px 24px -6px rgba(217,45,32,0.5); }
.ind-btn-hot:hover { background: #b52a23; box-shadow: 0 10px 30px -8px rgba(217,45,32,0.6); }
.ind-btn-ghost { background: rgba(255,255,255,0.12); color: #fff !important; border: 2px solid rgba(255,255,255,0.5); backdrop-filter: blur(4px); }
.ind-btn-ghost:hover { background: rgba(255,255,255,0.22); border-color: #fff; }

div:has(> .fp-proof-item) { display: flex; justify-content: center; gap: 0; background: #16181d; border-top: 1px solid rgba(255,255,255,0.06); padding: 0; }
.fp-proof-item { padding: 20px 32px; text-align: center; border-right: 1px solid rgba(255,255,255,0.06); }
.fp-proof-item:last-child { border-right: none; }
.fp-proof-item strong { display: block; font-size: 22px; font-weight: 700; color: #fff; }
.fp-proof-item span { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.4); }

.ind-section { padding: 90px 32px; max-width: 1100px; margin: 0 auto; }
.ind-band { background: #f8f7f5; max-width: 100%; }
.ind-band .ind-section-head, .ind-band .ind-grid { max-width: 1100px; margin-left: auto; margin-right: auto; }
.ind-section-head { text-align: center; margin-bottom: 48px; }
.ind-section-head h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 700; line-height: 1.08; letter-spacing: -0.015em; color: #16181d; margin: 0 0 16px; }
.ind-lede { font-size: 17px; line-height: 1.65; color: #6b7075; max-width: 640px; margin: 0 auto; }
.ind-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.ind-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px 26px; }
.ind-band .ind-card { background: #fff; }
.ind-card h3 { font-size: 17px; font-weight: 700; color: #16181d; margin: 0 0 10px; }
.ind-card p { font-size: 15px; line-height: 1.65; color: #6b7075; margin: 0; }

.ind-parts-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: 800px; margin: 0 auto; }
.ind-part-tag { padding: 10px 18px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-weight: 500; color: #16181d; }

.ind-faq-list { max-width: 680px; }
.ind-faq { border-bottom: 1px solid #e5e7eb; }
.ind-faq summary { padding: 20px 0; font-size: 16px; font-weight: 600; color: #16181d; cursor: pointer; list-style: none; }
.ind-faq summary::-webkit-details-marker { display: none; }
.ind-faq summary::before { content: '+'; margin-right: 12px; font-weight: 700; color: var(--red, #d92d20); }
.ind-faq[open] summary::before { content: '\\2212'; }
.ind-faq p { padding: 0 0 20px 24px; font-size: 15px; line-height: 1.65; color: #6b7075; margin: 0; }

.ind-cta { background: #16181d; padding: 110px 32px; }
.ind-cta-inner { max-width: 560px; margin: 0 auto; text-align: center; }
.ind-cta-inner h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 700; color: #fff; margin: 0 0 16px; }
.ind-cta-inner p { font-size: 17px; line-height: 1.65; color: rgba(255,255,255,0.5); margin: 0 0 32px; }
.ind-cta-alt { margin-top: 20px; font-size: 14px; color: rgba(255,255,255,0.4); }
.ind-cta-alt a { color: rgba(255,255,255,0.7); text-decoration: underline; text-underline-offset: 2px; }
.ind-cta-alt a:hover { color: #fff; }

@media (max-width: 600px) {
  .ind-hero { padding: 120px 16px 60px; }
  .ind-section { padding: 60px 16px; }
  .ind-cta { padding: 64px 16px; }
  .ind-hero-ctas { flex-direction: column; align-items: center; }
  .ind-btn { width: 100%; max-width: 320px; text-align: center; justify-content: center; }
  .fp-proof-item { padding: 14px 16px; }
  .fp-proof-item strong { font-size: 18px; }
}
`;
