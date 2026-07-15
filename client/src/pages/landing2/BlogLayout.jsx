import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, buildSiteUrl } from "./site";

const SIGNUP_URL = "https://hotlinehq.online/client/signup";

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── Breadcrumbs ─── */

function Breadcrumbs({ items }) {
  return (
    <nav className="bl-crumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span className="bl-crumb-sep" aria-hidden="true">/</span>}
          {item.to ? (
            <Link to={item.to} className="bl-crumb-link">{item.label}</Link>
          ) : (
            <span className="bl-crumb-current" aria-current={i === items.length - 1 ? "page" : undefined}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ─── Table of Contents (sticky sidebar) ─── */

function TableOfContents({ items }) {
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!items?.length) return;
    const ids = items.map(t => t.id);
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
  }, [items]);

  if (!items?.length) return null;

  return (
    <aside className="bl-toc" aria-label="Table of contents">
      <p className="bl-toc-label">In this article</p>
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

/* ─── Callout boxes ─── */

export function BlogCallout({ type = "info", title, children }) {
  return (
    <div className={`bl-callout bl-callout-${type}`}>
      {title && <p className="bl-callout-title">{title}</p>}
      <div className="bl-callout-body">{children}</div>
    </div>
  );
}

/* ─── BlogLayout ─── */

export default function BlogLayout({
  breadcrumbs,
  kicker,
  title,
  description,
  date,
  readTime,
  author,
  toc,
  seoProps,
  children,
}) {
  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{BLOG_CSS}</style>
      {seoProps && <Seo {...seoProps} />}
      <SiteNav />

      {/* Full-width header band */}
      <header className="bl-header">
        <div className="bl-header-scrim" aria-hidden="true" />
        <div className="bl-header-inner">
          {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
          {kicker && <p className="bl-kicker">{kicker}</p>}
          <h1 className="bl-title">{title}</h1>
          {description && <p className="bl-desc">{description}</p>}
          <div className="bl-meta-row">
            <div className="bl-meta">
              {date && <span className="bl-meta-date">{formatDate(date)}</span>}
              {date && readTime && <span className="bl-meta-dot" aria-hidden="true">·</span>}
              {readTime && <span className="bl-meta-read">{readTime}</span>}
            </div>
            {author && (
              <div className="bl-author">
                <div className="bl-author-avatar">
                  {author.name?.charAt(0) || "H"}
                </div>
                <div className="bl-author-info">
                  <span className="bl-author-name">{author.name}</span>
                  {author.role && <span className="bl-author-role">{author.role}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Two-column: article + TOC */}
      <div className="bl-body">
        <article className="bl-article">
          {children}
        </article>
        {toc && <TableOfContents items={toc} />}
      </div>

      {/* Bottom CTA */}
      <section className="bl-cta">
        <div className="bl-cta-inner">
          <p className="bl-cta-kicker">JOIN THE NETWORK</p>
          <h2 className="bl-cta-heading">Hear every part request the second it's broadcast</h2>
          <p className="bl-cta-sub">Free to join. No credit card. A preconfigured desk phone ships to your yard.</p>
          <a href={SIGNUP_URL} className="bl-cta-btn">Sign Up Free</a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ─── Blog CSS ─── */

const BLOG_CSS = `
/* ═══ Full-width header band (light, matches landing) ═══ */
.bl-header {
  position: relative;
  padding: 130px 32px 56px;
  overflow: hidden;
}
.bl-header-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(ellipse 62% 46% at 50% 30%, rgba(251,250,248,0.94) 36%, rgba(251,250,248,0.55) 68%, transparent 100%),
    radial-gradient(ellipse 55% 40% at 50% 42%, rgba(217,45,32,0.05), transparent 70%),
    radial-gradient(#dcd7cc 1px, transparent 1.4px);
  background-size: 100% 100%, 100% 100%, 26px 26px;
}
.bl-header-inner {
  position: relative;
  z-index: 2;
  max-width: 1060px;
  margin: 0 auto;
}

/* Breadcrumbs (inside header) */
.bl-crumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  margin-bottom: 28px;
}
.bl-crumb-link {
  color: var(--muted) !important;
  transition: color 0.2s;
}
.bl-crumb-link:hover { color: var(--ink) !important; }
.bl-crumb-sep {
  margin: 0 8px;
  color: var(--line) !important;
  user-select: none;
}
.bl-crumb-current {
  color: var(--ink) !important;
  font-weight: 600;
}

/* Title area */
.bl-kicker {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--red);
  margin: 0 0 14px;
}
.bl-title {
  font-family: var(--display);
  font-weight: 800;
  font-size: clamp(30px, 5vw, 44px);
  line-height: 1.1;
  letter-spacing: -0.025em;
  color: var(--ink);
  margin: 0 0 16px;
  text-wrap: balance;
}
.bl-desc {
  font-size: 17px;
  line-height: 1.6;
  color: var(--muted);
  margin: 0 0 28px;
  max-width: 640px;
}

/* Meta + author row */
.bl-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  flex-wrap: wrap;
}
.bl-meta {
  display: flex;
  align-items: center;
  gap: 0;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.02em;
}
.bl-meta-dot {
  margin: 0 8px;
  color: var(--line);
}
.bl-author {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bl-author-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--red);
  color: #fff;
  font-family: var(--display);
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bl-author-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.bl-author-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--ink);
}
.bl-author-role {
  font-size: 11px;
  color: var(--muted);
}

/* ═══ Two-column body ═══ */
.bl-body {
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 56px;
  max-width: 1060px;
  margin: 0 auto;
  padding: 48px 32px 64px;
  align-items: start;
}

/* ═══ Article content ═══ */
.bl-article {
  min-width: 0;
  max-width: 740px;
}
.bl-article section {
  margin-bottom: 48px;
}
.bl-article section:last-child { margin-bottom: 0; }

.bl-article h2 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(22px, 3vw, 28px);
  line-height: 1.15;
  letter-spacing: -0.015em;
  color: var(--ink);
  margin: 0 0 16px;
  padding-top: 8px;
  scroll-margin-top: 100px;
}
.bl-article h3 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 19px;
  line-height: 1.2;
  color: var(--ink);
  margin: 32px 0 12px;
}
.bl-article p {
  font-size: 17px;
  line-height: 1.8;
  color: var(--muted);
  margin: 0 0 18px;
}
.bl-article p:last-child { margin-bottom: 0; }
.bl-article p strong { color: var(--ink); }

.bl-article ul,
.bl-article ol {
  padding-left: 24px;
  margin: 0 0 18px;
}
.bl-article li {
  font-size: 17px;
  line-height: 1.8;
  color: var(--muted);
  margin-bottom: 10px;
}
.bl-article li:last-child { margin-bottom: 0; }
.bl-article li strong { color: var(--ink); }

/* Numbered steps (custom) */
.bl-steps {
  list-style: none;
  padding: 0;
  margin: 20px 0 24px;
  counter-reset: bl-step;
}
.bl-steps li {
  counter-increment: bl-step;
  padding-left: 40px;
  position: relative;
  margin-bottom: 16px;
}
.bl-steps li::before {
  content: counter(bl-step);
  position: absolute;
  left: 0;
  top: 4px;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--red-soft);
  color: var(--red);
  font-family: var(--display);
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Tables */
.bl-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
  margin: 20px 0 24px;
}
.bl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.bl-table th {
  text-align: left;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 14px 20px;
  background: var(--band);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.bl-table td {
  padding: 13px 20px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  line-height: 1.55;
}
.bl-table tr:last-child td { border-bottom: none; }
.bl-table td strong { color: var(--ink); font-weight: 600; }
.bl-table tr:first-child td {
  background: rgba(217, 45, 32, 0.03);
}

/* Diagrams / images */
.bl-diagram {
  margin: 28px 0;
  overflow-x: auto;
}
.bl-diagram svg {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
}
.bl-figure {
  margin: 28px 0;
}
.bl-figure img {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--line);
}
.bl-figure figcaption {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  margin-top: 10px;
}

/* Coverage grid */
.bl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  margin: 20px 0;
}
.bl-grid-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 9px;
}
.bl-grid-card.active {
  border-color: var(--red);
  background: var(--red-soft);
}
.bl-grid-card .abbr {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--red);
}
.bl-grid-card .name {
  font-weight: 700;
  font-size: 14px;
  color: var(--ink);
}
.bl-grid-card .detail {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
}
.bl-grid-card:not(.active) .abbr { color: var(--muted); }
.bl-grid-card:not(.active) .name { color: var(--muted); }

/* ═══ Callout boxes ═══ */
.bl-callout {
  border-radius: 10px;
  padding: 22px 24px;
  margin: 24px 0;
  border: 1px solid var(--line);
  border-left: 3px solid var(--line);
}
.bl-callout-info {
  background: #f0f5ff;
  border-color: #c5d5f7;
  border-left-color: #2563eb;
}
.bl-callout-tip {
  background: var(--red-soft);
  border-color: #fecdca;
  border-left-color: var(--red);
}
.bl-callout-note {
  background: var(--band);
  border-color: var(--line);
  border-left-color: var(--muted);
}
.bl-callout-title {
  font-family: var(--display);
  font-weight: 700;
  font-size: 14px;
  margin: 0 0 8px;
  color: var(--ink);
}
.bl-callout-info .bl-callout-title { color: #1d4ed8; }
.bl-callout-tip .bl-callout-title { color: var(--red); }
.bl-callout-body p {
  font-size: 15px;
  line-height: 1.65;
  color: var(--muted);
  margin: 0 0 8px;
}
.bl-callout-body p:last-child { margin-bottom: 0; }

/* ═══ Table of Contents ═══ */
.bl-toc {
  position: sticky;
  top: 96px;
  align-self: start;
}
.bl-toc-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}
.bl-toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.bl-toc-list li {
  margin-bottom: 2px;
}
.bl-toc-link {
  display: block;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--muted);
  padding: 6px 0 6px 14px;
  border-left: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
  text-decoration: none;
}
.bl-toc-link:hover {
  color: var(--ink);
}
.bl-toc-active {
  color: var(--red) !important;
  border-left-color: var(--red);
  font-weight: 600;
}

/* ═══ Bottom CTA ═══ */
.bl-cta {
  background: var(--ink);
  padding: 80px 32px;
}
.bl-cta-inner {
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
}
.bl-cta-kicker {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: rgba(255,255,255,0.4);
  margin: 0 0 16px;
}
.bl-cta-heading {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(26px, 4vw, 38px);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #fff;
  margin: 0 0 14px;
}
.bl-cta-sub {
  font-size: 16px;
  line-height: 1.6;
  color: rgba(255,255,255,0.45);
  margin: 0 0 28px;
}
.bl-cta-btn {
  display: inline-flex;
  padding: 14px 32px;
  font-family: var(--body);
  font-size: 15px;
  font-weight: 700;
  color: #fff !important;
  background: var(--red);
  border-radius: 11px;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5);
  transition: background 0.2s, transform 0.15s;
}
.bl-cta-btn:hover {
  background: var(--red-deep);
  transform: translateY(-1px);
}

/* ═══ Responsive ═══ */
@media (max-width: 900px) {
  .bl-body {
    grid-template-columns: 1fr;
    gap: 0;
    padding: 32px 24px 48px;
  }
  .bl-toc {
    position: static;
    order: -1;
    margin-bottom: 32px;
    padding: 20px;
    background: var(--band);
    border-radius: 10px;
    border: 1px solid var(--line);
  }
  .bl-toc-label {
    border-bottom: none;
    padding-bottom: 0;
    margin-bottom: 10px;
  }
  .bl-toc-link {
    padding: 4px 0 4px 14px;
    font-size: 13px;
  }
}
@media (max-width: 640px) {
  .bl-header { padding: 96px 16px 40px; }
  .bl-title { font-size: clamp(24px, 7vw, 32px); }
  .bl-desc { font-size: 16px; }
  .bl-meta-row { flex-direction: column; align-items: flex-start; gap: 16px; }
  .bl-body { padding: 24px 16px 40px; }
  .bl-cta { padding: 56px 16px; }
  .bl-article h2 { font-size: 22px; }
  .bl-article p, .bl-article li { font-size: 16px; line-height: 1.75; }
  .bl-grid { grid-template-columns: 1fr 1fr; }
}

`;
