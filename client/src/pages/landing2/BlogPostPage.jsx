import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, buildSiteUrl } from "./site";
import { BLOG_CATEGORIES, BLOG_POSTS, getPostUrl } from "./blogRegistry";

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function BlogPostPage() {
  const { category, slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/v1/blog/${category}/${slug}`)
      .then(r => r.json())
      .then(json => { if (json.status) setPost(json.data); else setError("Post not found"); })
      .catch(() => setError("Failed to load post"))
      .finally(() => setLoading(false));
  }, [category, slug]);

  useEffect(() => { window.scrollTo(0, 0); }, [category, slug]);

  const catLabel = BLOG_CATEGORIES[category]?.label || category;
  const shareUrl = buildSiteUrl(`/blog/${category}/${slug}`);
  const related = BLOG_POSTS.filter(p => p.category === category && p.slug !== slug).slice(0, 3);

  function handleCopy() {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="l2"><style>{SITE_CSS}</style><style>{CSS}</style><SiteNav />
      <div className="bp-loading">
        <div className="bp-brand-loader">
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#d92d20" />
            <path d="M33.8 30.7v2.6a2.3 2.3 0 0 1-2.5 2.3 23 23 0 0 1-10-3.6 22.7 22.7 0 0 1-7-7 23 23 0 0 1-3.5-10.1 2.3 2.3 0 0 1 2.3-2.5h2.6a2.3 2.3 0 0 1 2.3 2c.1 1 .4 2.1.7 3.1a2.3 2.3 0 0 1-.5 2.4l-1.1 1.1a18.4 18.4 0 0 0 6.7 6.7l1.1-1.1a2.3 2.3 0 0 1 2.4-.5c1 .3 2 .6 3.1.7a2.3 2.3 0 0 1 2 2.3z" fill="#ffffff" />
            <path className="bp-wave1" d="M30.5 13.6a8.6 8.6 0 0 1 5 5" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
            <path className="bp-wave2" d="M32.8 8.4a14.3 14.3 0 0 1 8 8" stroke="#ffb4ad" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          <span className="bp-brand-loader-text">Loading article&hellip;</span>
        </div>
      </div>
    <SiteFooter /></div>
  );

  if (error || !post) return (
    <div className="l2"><style>{SITE_CSS}</style><style>{CSS}</style><SiteNav />
      <div className="bp-empty"><h1>Post not found</h1><p>The article you're looking for doesn't exist.</p><Link to="/blog" className="bp-back">← Back to Blog</Link></div>
    <SiteFooter /></div>
  );

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{CSS}</style>
      <Seo
        title={`${post.title} — ${catLabel} | Hotline HQ`}
        description={post.description} keywords={post.keywords}
        path={`/blog/${category}/${slug}`}
        jsonLd={{ "@context": "https://schema.org", "@graph": [
          { "@type": "Article", headline: post.title, description: post.description, url: shareUrl, ...(post.coverImage ? { image: buildSiteUrl(post.coverImage) } : {}), publisher: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") }, datePublished: post.date, dateModified: post.lastUpdated || post.date },
          ...(post.faq?.length ? [{ "@type": "FAQPage", mainEntity: post.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
        ] }}
      />
      <SiteNav />

      {/* ─── Dark hero ─── */}
      <header className="bp-hero" style={post.coverImage ? {'--bp-hero-bg': `url(${post.coverImage})`} : undefined}>
        <div className="bp-container">
          <nav className="bp-crumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link><span>/</span>
            <Link to="/blog">Blog</Link><span>/</span>
            <Link to={`/blog/${category}`}>{catLabel}</Link>
          </nav>
          <h1>{post.title}</h1>
          <p className="bp-hero-desc">{post.description}</p>
          <div className="bp-hero-meta">
            <span className="bp-tag">{catLabel}</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.readTime && <span>{post.readTime}</span>}
          </div>
          <div className="bp-author">
            <div className="bp-avatar">HQ</div>
            <div>
              <div className="bp-author-name">{post.author || "Hotline HQ Team"}</div>
              <div className="bp-author-role">{post.authorRole || "The team behind the largest voice parts network in the US"}</div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Two-column layout: article + sidebar ─── */}
      <div className="bp-layout">
        <div className="bp-container">
          <div className="bp-grid">

            {/* LEFT: article body */}
            <main className="bp-article">
              <div className="bp-body" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />

              {/* FAQ inside article */}
              {post.faq?.length > 0 && (
                <div className="bp-faq">
                  <h2 id="faq">Frequently Asked Questions</h2>
                  {post.faq.map((f, i) => (
                    <details key={i} className="bp-faq-item">
                      <summary>{f.q}</summary>
                      <p>{f.a}</p>
                    </details>
                  ))}
                </div>
              )}
            </main>

            {/* RIGHT: sticky sidebar */}
            <aside className="bp-sidebar">
              <div className="bp-sidebar-sticky">

                {/* In this article */}
                {post.toc?.length > 0 && (
                  <div className="bp-sb-card">
                    <h4>In This Article</h4>
                    <ul className="bp-sb-toc">
                      {post.toc.map((item, i) => (
                        <li key={i} className={item.depth > 2 ? 'bp-sb-toc-sub' : ''}>
                          <a href={`#${item.id}`}>{item.text || item.label}</a>
                        </li>
                      ))}
                      {post.faq?.length > 0 && (
                        <li><a href="#faq">Frequently Asked Questions</a></li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Share article */}
                <div className="bp-sb-card">
                  <h4>Share Article</h4>
                  <div className="bp-sb-share">
                    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="bp-sb-share-btn" aria-label="Share on X">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                    <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="bp-sb-share-btn" aria-label="Share on LinkedIn">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </a>
                    <button className="bp-sb-share-btn" onClick={handleCopy} aria-label="Copy link">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    </button>
                  </div>
                  {copied && <div className="bp-sb-copied">Link copied!</div>}
                </div>

                {/* Explore the topic */}
                <div className="bp-sb-card">
                  <h4>Explore the Topic</h4>
                  <p className="bp-sb-explore-text">This article is part of our <Link to={`/blog/${category}`}>{catLabel}</Link>.</p>
                </div>

                {/* Network CTA */}
                <div className="bp-sb-cta">
                  <div className="bp-sb-cta-badge">Free to Join</div>
                  <h4>Join the Hotline HQ Network</h4>
                  <p>Connect with 500+ salvage yards across 12 regional rooms. Flat monthly fee, desk phone included.</p>
                  <a href={buildSiteUrl("/client/signup")} className="bp-sb-cta-btn">Sign Up Free →</a>
                </div>

              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* ─── Related articles (full width) ─── */}
      {related.length > 0 && (
        <section className="bp-related">
          <div className="bp-container">
            <div className="bp-related-divider">
              <span className="bp-related-line" />
              <span className="bp-related-label">More from {catLabel}</span>
              <span className="bp-related-line" />
            </div>
            <div className="bp-related-grid">
              {related.map(r => (
                <Link key={r.slug} to={getPostUrl(r)} className="bp-rc">
                  <div className="bp-rc-tag">{catLabel}</div>
                  <h3>{typeof r.title === 'string' ? r.title.replace(/^"|"$/g, '') : r.title}</h3>
                  <p>{typeof r.description === 'string' ? r.description.replace(/^"|"$/g, '') : r.description}</p>
                  <div className="bp-rc-foot">
                    <time>{formatDate(r.date)}</time>
                    {r.readTime && <span>{typeof r.readTime === 'string' ? r.readTime.replace(/^"|"$/g, '') : r.readTime}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}

const CSS = `
.bp-loading { display: flex; justify-content: center; align-items: center; min-height: 60vh; }
.bp-brand-loader {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px; border-radius: 12px;
  background: var(--surface, #fff); border: 1px solid var(--line);
  box-shadow: 0 4px 24px -6px rgba(22,24,29,0.12);
  animation: bp-fade-in .3s ease-out;
}
.bp-brand-loader-text { color: var(--muted); font-size: 14px; font-weight: 500; }
@keyframes bp-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bp-pulse1 { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@keyframes bp-pulse2 { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.15; } }
.bp-wave1 { animation: bp-pulse1 1.4s ease-in-out infinite; }
.bp-wave2 { animation: bp-pulse2 1.4s ease-in-out infinite 0.2s; }
.bp-empty { text-align: center; padding: 120px 24px 80px; min-height: 50vh; }
.bp-empty h1 { font-size: 28px; font-weight: 700; margin: 0 0 12px; }
.bp-empty p { font-size: 16px; color: var(--muted); margin: 0 0 24px; }
.bp-back { color: var(--red); font-weight: 600; text-decoration: none; }

/* Force white nav on blog posts — the dark hero behind makes the translucent nav look grey */
.l2:has(.bp-hero) .l2-nav { background: #fff; }

.bp-container { max-width: 1140px; margin: 0 auto; padding: 0 24px; }

/* ═══ Dark hero ═══ */
.bp-hero { background: #0f1117; padding: 100px 0 48px; border-bottom: 3px solid var(--red); position: relative; overflow: hidden; }
.bp-hero::before { content: ''; position: absolute; inset: 0; background: var(--bp-hero-bg) center/cover no-repeat; filter: blur(5px) brightness(0.3); transform: scale(1.1); z-index: 0; }
.bp-hero .bp-container { position: relative; z-index: 1; }
.bp-crumb { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; font-family: var(--mono); font-size: 12.5px; }
.bp-crumb a { color: rgba(255,255,255,0.45); text-decoration: none; }
.bp-crumb a:hover { color: #fff; }
.bp-crumb span { color: rgba(255,255,255,0.2); font-size: 11px; }
.bp-hero h1 { font-family: var(--display); font-size: clamp(28px, 4.5vw, 42px); font-weight: 700; line-height: 1.15; letter-spacing: -0.025em; color: #fff; margin: 0 0 16px; text-wrap: balance; max-width: 720px; }
.bp-hero-desc { font-size: 16.5px; line-height: 1.6; color: rgba(255,255,255,0.55); margin: 0 0 24px; max-width: 600px; }
.bp-hero-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 28px; }
.bp-tag { padding: 3px 10px; border-radius: 6px; background: rgba(217,45,32,0.15); color: #ff8a82; font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.bp-author { display: flex; align-items: center; gap: 12px; }
.bp-avatar { width: 38px; height: 38px; border-radius: 10px; background: var(--red); color: #fff; font-family: var(--mono); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.bp-author-name { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.85); }
.bp-author-role { font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 1px; }

/* ═══ Two-column grid: article + sidebar ═══ */
.bp-layout { padding: 48px 0 64px; }
.bp-grid { display: grid; grid-template-columns: 1fr 280px; gap: 48px; }

/* ─── Sidebar (matches autobodyshopnear pattern) ─── */
.bp-sidebar { display: block; }
.bp-sidebar-sticky { position: sticky; top: 96px; }
.bp-sb-card {
  margin-bottom: 24px; padding: 24px;
  border: 1px solid #e0e3de; border-radius: 16px;
  background: #fff; box-shadow: 0 2px 12px -2px rgba(0,0,0,0.08);
}
.bp-sb-card h4 {
  font-family: var(--mono); font-size: 12px; font-weight: 700;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--red); margin: 0 0 16px;
}

/* TOC */
.bp-sb-toc { list-style: none; padding: 0; margin: 0; }
.bp-sb-toc li { margin: 0; }
.bp-sb-toc li a {
  display: block; padding: 8px 12px; border-radius: 8px;
  font-size: 14px !important; line-height: 1.5 !important;
  color: #3f5465 !important; font-weight: 500 !important;
  text-decoration: none !important;
  transition: background 0.15s, color 0.15s;
}
.bp-sb-toc li a:hover { background: rgba(217,45,32,0.05) !important; color: #16181d !important; }
.bp-sb-toc-sub a { padding-left: 24px !important; color: #607286 !important; font-weight: 400 !important; }

/* Share */
.bp-sb-share { display: flex; gap: 8px; }
.bp-sb-share-btn {
  width: 40px; height: 40px; border-radius: 12px;
  border: 1px solid #e0e3de; background: #fff;
  color: #607286; display: flex; align-items: center; justify-content: center;
  cursor: pointer; text-decoration: none; transition: all 0.15s;
}
.bp-sb-share-btn:hover { border-color: var(--red); background: rgba(217,45,32,0.05); color: var(--red); }
.bp-sb-copied { font-size: 12px; color: var(--red); margin-top: 10px; font-weight: 600; }

/* Explore */
.bp-sb-explore-text { font-size: 14px; line-height: 1.6; color: #607286; margin: 0; }
.bp-sb-explore-text a { color: var(--red); font-weight: 600; text-decoration: none; }
.bp-sb-explore-text a:hover { text-decoration: underline; }

/* CTA */
.bp-sb-cta {
  margin-bottom: 24px; padding: 24px; border-radius: 16px;
  background: linear-gradient(to bottom right, #19253a, #101f4e);
  text-align: center; box-shadow: 0 4px 16px -4px rgba(16,31,78,0.3);
}
.bp-sb-cta-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 12px; border-radius: 20px;
  background: rgba(255,255,255,0.1); color: #fff;
  font-family: var(--mono); font-size: 11px; font-weight: 500;
  margin-bottom: 12px;
}
.bp-sb-cta h4 { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 8px; }
.bp-sb-cta p { font-size: 14px; color: rgba(255,255,255,0.7); margin: 0 0 16px; line-height: 1.55; }
.bp-sb-cta-btn {
  display: inline-block; padding: 12px 20px;
  background: #fff; color: #19253a;
  font-weight: 700; font-size: 14px; border-radius: 12px;
  text-decoration: none; transition: background 0.15s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.bp-sb-cta-btn:hover { background: #f0f5f2; }

/* ─── Article body ─── */
.bp-article { min-width: 0; }
.bp-body { font-size: 17px; line-height: 1.8; color: var(--ink); }
.bp-body h2 { font-family: var(--display); font-size: clamp(21px, 3vw, 26px); font-weight: 700; letter-spacing: -0.01em; margin: 48px 0 16px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--ink); scroll-margin-top: 80px; }
.bp-body h2:first-child { margin-top: 0; border-top: none; padding-top: 0; }
.bp-body h3 { font-size: 19px; font-weight: 700; margin: 32px 0 12px; scroll-margin-top: 80px; }
.bp-body p { margin: 0 0 18px; }
.bp-body strong { font-weight: 600; color: var(--ink); }
.bp-body a { color: var(--red); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
.bp-body a:hover { text-decoration-thickness: 2px; }
.bp-body ul, .bp-body ol { margin: 0 0 18px; padding-left: 22px; }
.bp-body li { margin-bottom: 8px; }
.bp-body li::marker { color: var(--red); }
.bp-body blockquote { margin: 24px 0; padding: 16px 20px; background: rgba(217,45,32,0.04); border-left: 3px solid var(--red); border-radius: 0 8px 8px 0; font-style: italic; color: var(--muted); }
.bp-body table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; display: block; overflow-x: auto; }
.bp-body th { text-align: left; padding: 10px 14px; background: #0f1117; color: #f0eeeb; font-weight: 600; font-size: 12.5px; white-space: nowrap; }
.bp-body th:first-child { border-radius: 8px 0 0 0; }
.bp-body th:last-child { border-radius: 0 8px 0 0; }
.bp-body td { padding: 10px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }
.bp-body tr:hover td { background: rgba(0,0,0,0.015); }
.bp-body img, .bp-body svg { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
.bp-body pre { background: #1e1e2e; color: #cdd6f4; padding: 16px 20px; border-radius: 10px; overflow-x: auto; font-size: 13px; margin: 24px 0; }
.bp-body code { font-family: var(--mono); font-size: 0.88em; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; }
.bp-body pre code { background: none; padding: 0; }

/* ─── FAQ ─── */
.bp-faq { margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--line); }
.bp-faq h2 { font-family: var(--display); font-size: 22px; font-weight: 700; margin: 0 0 20px; color: var(--ink); scroll-margin-top: 80px; border-top: none; padding-top: 0; }
.bp-faq-item { border: 1px solid var(--line); border-radius: 10px; margin-bottom: 8px; background: #fff; overflow: hidden; transition: border-color 0.15s; }
.bp-faq-item[open] { border-color: rgba(217,45,32,0.3); }
.bp-faq-item summary { padding: 14px 18px; font-size: 15px; font-weight: 600; color: var(--ink); cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.bp-faq-item summary::-webkit-details-marker { display: none; }
.bp-faq-item summary::after { content: '+'; font-size: 20px; font-weight: 300; color: var(--muted); flex-shrink: 0; }
.bp-faq-item[open] summary::after { content: '−'; color: var(--red); }
.bp-faq-item p { padding: 0 18px 16px; margin: 0; font-size: 14.5px; line-height: 1.7; color: var(--muted); }

/* ═══ Related ═══ */
.bp-related { padding: 52px 0 64px; background: #f7f6f3; border-top: 1px solid var(--line); }
.bp-related-divider { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
.bp-related-line { flex: 1; height: 1px; background: linear-gradient(to right, transparent, var(--line), transparent); }
.bp-related-label { font-family: var(--mono); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.bp-related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.bp-rc { display: flex; flex-direction: column; padding: 22px; border-radius: 14px; border: 1px solid var(--line); background: #fff; text-decoration: none; transition: box-shadow 0.2s, border-color 0.2s; }
.bp-rc:hover { box-shadow: 0 6px 20px -6px rgba(0,0,0,0.1); border-color: rgba(217,45,32,0.3); }
.bp-rc-tag { display: inline-block; width: fit-content; padding: 2px 8px; border-radius: 5px; background: rgba(217,45,32,0.07); color: var(--red); font-family: var(--mono); font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 10px; }
.bp-rc h3 { font-size: 15px; font-weight: 700; line-height: 1.35; color: var(--ink); margin: 0 0 8px; }
.bp-rc p { font-size: 13px; line-height: 1.5; color: var(--muted); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }
.bp-rc-foot { display: flex; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); font-family: var(--mono); font-size: 11px; color: var(--muted); }

/* ═══ Dark mode ═══ */
@media (prefers-color-scheme: dark) {
  .bp-sb-card { background: #1a1a1f; border-color: rgba(255,255,255,0.06); }
  .bp-sb-card h4 { color: #e4e0db; }
  .bp-sb-toc a { color: #a09b93; border-color: rgba(255,255,255,0.04); }
  .bp-sb-toc li { border-color: rgba(255,255,255,0.04); }
  .bp-sb-share-btn { background: #111114; border-color: rgba(255,255,255,0.08); color: #7a756d; }
  .bp-sb-explore-text { color: #a09b93; }
  .bp-faq-item { background: #1a1a1f; border-color: rgba(255,255,255,0.06); }
  .bp-related { background: #0f1117; }
  .bp-rc { background: #1a1a1f; border-color: rgba(255,255,255,0.06); }
  .bp-rc:hover { border-color: rgba(217,45,32,0.3); box-shadow: 0 6px 20px -6px rgba(0,0,0,0.4); }
  .bp-rc h3 { color: #e4e0db; }
  .bp-rc-foot { border-color: rgba(255,255,255,0.06); }
  .bp-body code { background: rgba(255,255,255,0.07); }
  .bp-body th { background: #1a1a1f; }
  .bp-body td { border-color: rgba(255,255,255,0.06); }
}

/* ═══ Mobile: sidebar stacks below ═══ */
@media (max-width: 900px) {
  .bp-grid { grid-template-columns: 1fr; gap: 0; }
  .bp-sidebar { margin-top: 48px; }
  .bp-sidebar-sticky { position: static; }
  .bp-sb-card, .bp-sb-cta { margin-bottom: 12px; }
  .bp-related-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .bp-hero { padding: 80px 0 36px; }
  .bp-hero h1 { font-size: clamp(24px, 7vw, 32px); }
  .bp-hero-desc { font-size: 15px; }
  .bp-layout { padding: 32px 0 48px; }
  .bp-body { font-size: 16px; }
  .bp-body h2 { font-size: 20px; margin: 36px 0 14px; padding-top: 18px; }
  .bp-container { padding: 0 16px; }
}
`;
