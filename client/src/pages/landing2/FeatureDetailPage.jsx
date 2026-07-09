import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, CONTACT_EMAIL } from "./site";

const SIGNUP_URL = "https://hotlinehq.online/client/signup";

const ICON_MAP = {
  "always-on-voice-network": IconNetwork,
  "caller-id": IconCallerId,
  "any-device": IconDevice,
  "direct-calls": IconDirect,
  "broadcast-recording": IconRecord,
  "notifications": IconNotify,
  "unanswered-capture": IconCapture,
  "parts-marketplace": IconMarket,
  "admin-dashboard": IconDashboard,
  "multi-language": IconLang,
  "enterprise-security": IconSecurity,
};

const TOC_ITEMS = [
  { id: "problem", label: "The Problem" },
  { id: "how-it-works", label: "How It Works" },
  { id: "benefits", label: "Key Benefits" },
  { id: "scenario", label: "Real-World Scenario" },
  { id: "faq", label: "FAQ" },
  { id: "related", label: "Related Features" },
];

function TableOfContents({ items, activeId }) {
  return (
    <aside className="bl-toc" aria-label="Table of contents">
      <p className="bl-toc-label">On this page</p>
      <ul className="bl-toc-list">
        {items.map(item => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`bl-toc-link ${activeId === item.id ? "bl-toc-active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function useActiveSection(ids) {
  const [activeId, setActiveId] = useState(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return activeId;
}

export function FeatureDetailPage() {
  const { slug } = useParams();
  const [f, setF] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relatedData, setRelatedData] = useState([]);
  const activeId = useActiveSection(TOC_ITEMS.map(t => t.id));

  useEffect(() => {
    setLoading(true);
    setF(null);
    setRelatedData([]);
    fetch(`/api/v1/features/${slug}`)
      .then(r => r.json())
      .then(json => {
        if (json.status && json.data) {
          setF(json.data);
          if (json.data.related?.length) {
            fetch('/api/v1/features')
              .then(r => r.json())
              .then(all => {
                if (all.status && all.data) {
                  setRelatedData(all.data.filter(x => json.data.related.includes(x.slug)));
                }
              }).catch(() => {});
          }
        } else {
          setF(null);
        }
      })
      .catch(() => setF(null))
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

  if (!f) {
    return (
      <div className="l2">
        <style>{SITE_CSS}</style>
        <SiteNav />
        <div style={{ textAlign: 'center', padding: '200px 24px 100px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Feature not found</h1>
          <p style={{ color: 'var(--muted)', marginTop: 12 }}>
            <Link to="/own-a-hotline" style={{ color: 'var(--red)' }}>View all features &rarr;</Link>
          </p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const Icon = ICON_MAP[slug] || IconNetwork;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://hotlinehq.online/" },
          { "@type": "ListItem", position: 2, name: "Features", item: "https://hotlinehq.online/own-a-hotline" },
          { "@type": "ListItem", position: 3, name: f.title, item: `https://hotlinehq.online/features/${slug}` },
        ],
      },
      {
        "@type": "Service",
        name: `${f.title} — Hotline HQ`,
        serviceType: "Voice Hotline Network Feature",
        provider: { "@type": "Organization", name: "Hotline HQ", url: "https://hotlinehq.online/" },
        description: f.seo?.description,
      },
      ...(f.faqs?.length ? [{
        "@type": "FAQPage",
        mainEntity: f.faqs.map(item => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }] : []),
    ],
  };

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{PAGE_CSS}</style>
      <Seo
        title={f.seo?.title || f.title}
        description={f.seo?.description || ''}
        keywords={f.seo?.keywords}
        canonicalUrl={`https://hotlinehq.online/features/${slug}`}
        path={`/features/${slug}`}
        jsonLd={jsonLd}
      />
      <SiteNav />

      {/* Light header — matches landing page */}
      <header className="fd-header">
        <div className="fd-header-scrim" aria-hidden="true" />
        <div className="fd-header-inner">
          <nav className="fd-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link to="/own-a-hotline">Features</Link>
            <span aria-hidden="true">/</span>
            <span>{f.title}</span>
          </nav>
          <div className="fd-header-row">
            <div className="fd-hero-icon-header" style={{ '--accent': f.accent || '#d92d20' }}>
              <Icon />
            </div>
            <span className="fd-kicker">{f.hero?.kicker}</span>
          </div>
          <h1 className="fd-title">{f.hero?.heading}</h1>
          <p className="fd-lede">{f.hero?.lede}</p>
          <div className="fd-header-ctas">
            <a href={SIGNUP_URL} className="fd-btn-hot">Sign Up Free</a>
            <a href={`mailto:${CONTACT_EMAIL}?subject=Feature inquiry: ${f.title}`} target="_blank" rel="noopener noreferrer" className="fd-btn-ghost">Talk to Us</a>
          </div>
        </div>
      </header>

      {/* Two-column body: article + TOC */}
      <div className="bl-body">
        <article className="bl-article">

          {/* The Problem */}
          {f.problem && (
            <section>
              <h2 id="problem" style={{ scrollMarginTop: 100 }}>{f.problem.heading}</h2>
              <p>{f.problem.text}</p>
            </section>
          )}

          {/* How It Works */}
          {f.steps?.length > 0 && (
            <section>
              <h2 id="how-it-works" style={{ scrollMarginTop: 100 }}>How It Works</h2>
              <ol className="bl-steps">
                {f.steps.map((s, i) => (
                  <li key={i}><strong>{s.title}.</strong> {s.desc}</li>
                ))}
              </ol>
            </section>
          )}

          {/* Key Benefits */}
          {f.benefits?.length > 0 && (
            <section>
              <h2 id="benefits" style={{ scrollMarginTop: 100 }}>Key Benefits</h2>
              <div className="fd-benefits-grid">
                {f.benefits.map((b, i) => (
                  <div className="fd-benefit-card" key={i} style={{ '--accent': f.accent }}>
                    <h3>{b.title}</h3>
                    <p>{b.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Real-World Scenario */}
          {f.scenario && (
            <section>
              <h2 id="scenario" style={{ scrollMarginTop: 100 }}>{f.scenario.heading}</h2>
              <div className="fd-scenario-box" style={{ '--accent': f.accent }}>
                <p>{f.scenario.text}</p>
              </div>
            </section>
          )}

          {/* FAQ */}
          {f.faqs?.length > 0 && (
            <section>
              <h2 id="faq" style={{ scrollMarginTop: 100 }}>Frequently Asked Questions</h2>
              {f.faqs.map((item, i) => (
                <details className="fd-faq" key={i}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </section>
          )}

          {/* Related Features */}
          {relatedData.length > 0 && (
            <section>
              <h2 id="related" style={{ scrollMarginTop: 100 }}>Related Features</h2>
              <div className="fd-related-grid">
                {relatedData.map(r => {
                  const RIcon = ICON_MAP[r.slug] || IconNetwork;
                  return (
                    <Link to={`/features/${r.slug}`} className="fd-related-card" key={r.slug} style={{ '--accent': r.accent }}>
                      <div className="fd-related-icon"><RIcon /></div>
                      <div>
                        <h3>{r.title}</h3>
                        <p>{r.seo?.description?.split('.')[0]}.</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </article>

        <TableOfContents items={TOC_ITEMS} activeId={activeId} />
      </div>

      {/* Bottom CTA — matches blog */}
      <section className="bl-cta">
        <div className="bl-cta-inner">
          <p className="bl-cta-kicker">JOIN THE NETWORK</p>
          <h2 className="bl-cta-heading">Ready to build your network?</h2>
          <p className="bl-cta-sub">Start with the platform that has everything — or talk to us about launching a hotline in your industry.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={SIGNUP_URL} className="bl-cta-btn">Sign Up Free</a>
            <a href={`mailto:${CONTACT_EMAIL}?subject=Launching a hotline`} target="_blank" rel="noopener noreferrer" className="bl-cta-btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', boxShadow: 'none' }}>Talk to Us</a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ── Feature-specific styles (extends blog CSS classes) ── */

const PAGE_CSS = `
/* ═══ Light header (matches landing page) ═══ */
.fd-header {
  position: relative; padding: 140px 32px 56px; overflow: hidden;
}
.fd-header-scrim {
  position: absolute; inset: 0; pointer-events: none;
  background-image:
    radial-gradient(ellipse 62% 46% at 50% 30%, rgba(251,250,248,0.94) 36%, rgba(251,250,248,0.55) 68%, transparent 100%),
    radial-gradient(ellipse 55% 40% at 50% 42%, rgba(217,45,32,0.05), transparent 70%),
    radial-gradient(#dcd7cc 1px, transparent 1.4px);
  background-size: 100% 100%, 100% 100%, 26px 26px;
}
.fd-header-inner { position: relative; z-index: 2; max-width: 800px; margin: 0 auto; }
.fd-crumbs { display: flex; align-items: center; flex-wrap: wrap; font-family: var(--mono); font-size: 12px; font-weight: 500; letter-spacing: 0.02em; margin-bottom: 28px; }
.fd-crumbs a { color: var(--muted); text-decoration: none; transition: color 0.2s; }
.fd-crumbs a:hover { color: var(--ink); }
.fd-crumbs span { margin: 0 8px; color: var(--line); }
.fd-crumbs span:last-child { margin: 0; color: var(--ink); font-weight: 600; }
.fd-header-row { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.fd-kicker { font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--red); }
.fd-title {
  font-family: var(--display); font-weight: 700; font-size: clamp(32px, 5vw, 52px);
  line-height: 1.08; letter-spacing: -0.02em; color: var(--ink); margin: 0 0 18px;
}
.fd-lede { font-size: 18px; line-height: 1.7; color: var(--muted); margin: 0 0 28px; max-width: 640px; }
.fd-header-ctas { display: flex; gap: 14px; flex-wrap: wrap; }
.fd-btn-hot {
  font-family: var(--body); font-weight: 600; font-size: 15px; padding: 13px 28px;
  border-radius: 11px; background: var(--red); color: #fff !important; text-decoration: none;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5);
  transition: background 0.2s, transform 0.15s;
}
.fd-btn-hot:hover { background: #b42318; transform: translateY(-1px); }
.fd-btn-ghost {
  font-family: var(--body); font-weight: 600; font-size: 15px; padding: 13px 28px;
  border-radius: 11px; background: var(--surface); border: 1px solid var(--line); color: var(--ink) !important; text-decoration: none;
  transition: border-color 0.2s;
}
.fd-btn-ghost:hover { border-color: #c9c4ba; }

/* ═══ Two-column body ═══ */
.bl-body { display: grid; grid-template-columns: 1fr 220px; gap: 56px; max-width: 1060px; margin: 0 auto; padding: 48px 32px 64px; align-items: start; }

/* ═══ Article ═══ */
.bl-article { min-width: 0; max-width: 740px; }
.bl-article section { margin-bottom: 48px; }
.bl-article section:last-child { margin-bottom: 0; }
.bl-article h2 { font-family: var(--display); font-weight: 700; font-size: clamp(22px, 3vw, 28px); line-height: 1.15; letter-spacing: -0.015em; color: var(--ink); margin: 0 0 16px; padding-top: 8px; scroll-margin-top: 100px; }
.bl-article h3 { font-family: var(--display); font-weight: 700; font-size: 19px; line-height: 1.2; color: var(--ink); margin: 32px 0 12px; }
.bl-article p { font-size: 17px; line-height: 1.8; color: var(--muted); margin: 0 0 18px; }
.bl-article p:last-child { margin-bottom: 0; }
.bl-article p strong { color: var(--ink); }
.bl-article ul, .bl-article ol { padding-left: 24px; margin: 0 0 18px; }
.bl-article li { font-size: 17px; line-height: 1.8; color: var(--muted); margin-bottom: 10px; }
.bl-article li:last-child { margin-bottom: 0; }
.bl-article li strong { color: var(--ink); }

.bl-steps { list-style: none; padding: 0; margin: 20px 0 24px; counter-reset: bl-step; }
.bl-steps li { counter-increment: bl-step; padding-left: 40px; position: relative; margin-bottom: 16px; }
.bl-steps li::before { content: counter(bl-step); position: absolute; left: 0; top: 4px; width: 26px; height: 26px; border-radius: 8px; background: var(--red-soft); color: var(--red); font-family: var(--display); font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; }

/* ═══ TOC ═══ */
.bl-toc { position: sticky; top: 96px; align-self: start; }
.bl-toc-label { font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.bl-toc-list { list-style: none; padding: 0; margin: 0; }
.bl-toc-list li { margin-bottom: 2px; }
.bl-toc-link { display: block; font-size: 13px; font-weight: 500; line-height: 1.4; color: var(--muted); padding: 6px 0 6px 14px; border-left: 2px solid transparent; transition: color 0.2s, border-color 0.2s; text-decoration: none; }
.bl-toc-link:hover { color: var(--ink); }
.bl-toc-active { color: var(--red) !important; border-left-color: var(--red); font-weight: 600; }

/* ═══ Bottom CTA ═══ */
.bl-cta { background: var(--ink); padding: 80px 32px; }
.bl-cta-inner { max-width: 560px; margin: 0 auto; text-align: center; }
.bl-cta-kicker { font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: rgba(255,255,255,0.4); margin: 0 0 16px; }
.bl-cta-heading { font-family: var(--display); font-weight: 700; font-size: clamp(26px, 4vw, 38px); line-height: 1.1; letter-spacing: -0.02em; color: #fff; margin: 0 0 14px; }
.bl-cta-sub { font-size: 16px; line-height: 1.6; color: rgba(255,255,255,0.45); margin: 0 0 28px; }
.bl-cta-btn { display: inline-flex; padding: 14px 32px; font-family: var(--body); font-size: 15px; font-weight: 700; color: #fff !important; background: var(--red); border-radius: 11px; box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5); transition: background 0.2s, transform 0.15s; text-decoration: none; }
.bl-cta-btn:hover { background: var(--red-deep); transform: translateY(-1px); }

/* ═══ Responsive ═══ */
@media (max-width: 900px) {
  .bl-body { grid-template-columns: 1fr; gap: 0; padding: 32px 24px 48px; }
  .bl-toc { position: static; order: -1; margin-bottom: 32px; padding: 20px; background: var(--band); border-radius: 10px; border: 1px solid var(--line); }
  .bl-toc-label { border-bottom: none; padding-bottom: 0; margin-bottom: 10px; }
  .bl-toc-link { padding: 4px 0 4px 14px; font-size: 13px; }
}
@media (max-width: 640px) {
  .fd-header { padding: 110px 16px 40px; }
  .fd-title { font-size: clamp(26px, 7vw, 36px); }
  .fd-lede { font-size: 15.5px; }
  .fd-header-ctas { flex-direction: column; }
  .fd-header-ctas a { text-align: center; }
  .bl-body { padding: 24px 16px 40px; }
  .bl-cta { padding: 56px 16px; }
  .bl-article h2 { font-size: 22px; }
  .bl-article p, .bl-article li { font-size: 16px; line-height: 1.75; }
}

/* ═══ Feature-specific ═══ */

.fd-hero-icon-header {
  width: 48px; height: 48px; border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  display: flex; align-items: center; justify-content: center;
}
.fd-hero-icon-header svg {
  width: 24px; height: 24px; fill: none;
  stroke: var(--accent, #d92d20); stroke-width: 2;
  stroke-linecap: round; stroke-linejoin: round;
}

/* Benefits grid inside article */
.fd-benefits-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 20px 0 24px;
}
.fd-benefit-card {
  background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
  padding: 20px 18px;
  transition: border-color .2s, box-shadow .2s;
}
.fd-benefit-card:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  box-shadow: 0 4px 16px -4px color-mix(in srgb, var(--accent) 12%, transparent);
}
.fd-benefit-card h3 {
  font-family: var(--display); font-weight: 700; font-size: 15px;
  margin: 0 0 6px; color: var(--ink);
}
.fd-benefit-card p {
  font-size: 14px !important; line-height: 1.6 !important;
  color: var(--muted); margin: 0 !important;
}

/* Scenario callout */
.fd-scenario-box {
  border-radius: 10px; padding: 22px 24px; margin: 12px 0;
  background: color-mix(in srgb, var(--accent) 4%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 15%, transparent);
  border-left: 3px solid var(--accent);
}
.fd-scenario-box p {
  font-size: 16px !important; line-height: 1.7 !important;
  color: var(--muted); margin: 0 !important;
}

/* FAQ accordion */
.fd-faq { border-bottom: 1px solid var(--line); }
.fd-faq summary {
  font-family: var(--display); font-weight: 600; font-size: 16px;
  padding: 18px 0; cursor: pointer; list-style: none;
  display: flex; justify-content: space-between; align-items: center;
  color: var(--ink);
}
.fd-faq summary::-webkit-details-marker { display: none; }
.fd-faq summary::after {
  content: '+'; font-size: 20px; font-weight: 400; color: var(--muted);
  transition: transform .2s; flex-shrink: 0; margin-left: 16px;
}
.fd-faq[open] summary::after { content: '\\2212'; }
.fd-faq p {
  font-size: 15px !important; line-height: 1.7 !important;
  color: var(--muted); margin: 0 !important; padding: 0 0 18px;
}

/* Related features */
.fd-related-grid {
  display: flex; flex-direction: column; gap: 12px; margin: 16px 0;
}
.fd-related-card {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 18px 20px; border-radius: 10px;
  background: var(--surface); border: 1px solid var(--line);
  text-decoration: none; color: var(--ink);
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.fd-related-card:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  transform: translateX(4px);
  box-shadow: 0 4px 16px -4px color-mix(in srgb, var(--accent) 12%, transparent);
}
.fd-related-icon {
  width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  display: flex; align-items: center; justify-content: center;
}
.fd-related-icon svg {
  width: 20px; height: 20px; fill: none;
  stroke: var(--accent); stroke-width: 2;
  stroke-linecap: round; stroke-linejoin: round;
}
.fd-related-card h3 {
  font-family: var(--display); font-weight: 700; font-size: 15px;
  margin: 0 0 4px;
}
.fd-related-card p {
  font-size: 13px !important; line-height: 1.5 !important;
  color: var(--muted); margin: 0 !important;
}

@media (max-width: 640px) {
  .fd-benefits-grid { grid-template-columns: 1fr; }
  .fd-scenario-box { padding: 18px 16px; }
}
`;

/* ── SVG icons ── */
const si = { fill: 'none', stroke: 'var(--accent)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
function IconNetwork() { return <svg viewBox="0 0 24 24" {...si}><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /><circle cx="12" cy="12" r="3" /><path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>; }
function IconCallerId() { return <svg viewBox="0 0 24 24" {...si}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6-1h4m-4 4h4m-4 4h4M7 17c0-1.1.9-2 2-2h0c1.1 0 2 .9 2 2" /></svg>; }
function IconDevice() { return <svg viewBox="0 0 24 24" {...si}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>; }
function IconDirect() { return <svg viewBox="0 0 24 24" {...si}><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 8.1 18.36a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 1.1 4.18 2 2 0 0 1 3.08 2h3a2 2 0 0 1 2 1.72c.13.97.36 1.92.69 2.84a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.92.33 1.87.56 2.84.69a2 2 0 0 1 1.72 2z" /><path d="M14.5 2c2.49.53 4.47 2.51 5 5m-5-1.5c1.24.33 2.17 1.26 2.5 2.5" /></svg>; }
function IconRecord() { return <svg viewBox="0 0 24 24" {...si}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="var(--accent)" stroke="none" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2" /></svg>; }
function IconNotify() { return <svg viewBox="0 0 24 24" {...si}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>; }
function IconCapture() { return <svg viewBox="0 0 24 24" {...si}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function IconMarket() { return <svg viewBox="0 0 24 24" {...si}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>; }
function IconDashboard() { return <svg viewBox="0 0 24 24" {...si}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>; }
function IconLang() { return <svg viewBox="0 0 24 24" {...si}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" /></svg>; }
function IconSecurity() { return <svg viewBox="0 0 24 24" {...si}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>; }
