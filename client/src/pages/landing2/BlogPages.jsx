import { useState } from "react";
import { Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS, buildSiteUrl } from "./site";
import { BLOG_CATEGORIES, BLOG_POSTS, getPostUrl, getCategoryUrl } from "./blogRegistry";

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function BlogIndexPage() {
  const [filter, setFilter] = useState("all");
  const posts = filter === "all"
    ? [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date))
    : BLOG_POSTS.filter(p => p.category === filter).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{BLOG_INDEX_CSS}</style>
      <Seo
        title="Blog — Auto Parts Industry Guides & Network Updates | Hotline HQ"
        description="Industry guides, network updates, and parts market insights from Hotline HQ — the voice network connecting 500+ auto dismantler yards."
        keywords="auto parts blog, dismantler industry, salvage yard tips, used auto parts guide, hotline hq blog"
        path="/blog"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Hotline HQ Blog",
          description: "Industry guides, network updates, and parts market insights from Hotline HQ.",
          url: buildSiteUrl("/blog"),
          publisher: { "@type": "Organization", name: "Hotline HQ", url: buildSiteUrl("/") },
        }}
      />
      <SiteNav />

      <header className="bi-header">
        <div className="bi-header-scrim" aria-hidden="true" />
        <div className="bi-header-inner">
          <p className="bi-kicker">HOTLINE HQ</p>
          <h1 className="bi-title">Blog</h1>
          <p className="bi-desc">Industry guides, network updates, and parts market insights from the largest voice parts network in the US.</p>
        </div>
      </header>

      <main className="bi-main">
        <div className="bi-filters">
          <button
            className={`bi-filter ${filter === "all" ? "bi-filter-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Posts
          </button>
          {Object.entries(BLOG_CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              className={`bi-filter ${filter === key ? "bi-filter-active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {posts.length > 0 ? (
          <div className="bi-grid">
            {posts.map(post => (
              <Link to={getPostUrl(post)} className="bi-card" key={post.slug}>
                <div className="bi-card-top">
                  <span className="bi-card-cat">{BLOG_CATEGORIES[post.category]?.label}</span>
                  <span className="bi-card-date">{formatDate(post.date)}</span>
                </div>
                <h2 className="bi-card-title">{post.title}</h2>
                <p className="bi-card-desc">{post.description}</p>
                <div className="bi-card-bottom">
                  <span className="bi-card-read">{post.readTime}</span>
                  <span className="bi-card-arrow">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bi-empty">
            <p>No posts in this category yet.</p>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

export function BlogCategoryPage({ category }) {
  const cat = BLOG_CATEGORIES[category];
  const posts = BLOG_POSTS.filter(p => p.category === category).sort((a, b) => b.date.localeCompare(a.date));

  if (!cat) return null;

  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{BLOG_INDEX_CSS}</style>
      <Seo
        title={`${cat.label} — Hotline HQ Blog`}
        description={cat.description}
        keywords={`${cat.label.toLowerCase()}, auto parts blog, hotline hq`}
        path={`/blog/${category}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${cat.label} — Hotline HQ Blog`,
          description: cat.description,
          url: buildSiteUrl(`/blog/${category}`),
          isPartOf: { "@type": "Blog", name: "Hotline HQ Blog", url: buildSiteUrl("/blog") },
        }}
      />
      <SiteNav />

      <header className="bi-header">
        <div className="bi-header-scrim" aria-hidden="true" />
        <div className="bi-header-inner">
          <nav className="bi-breadcrumbs">
            <Link to="/">Home</Link>
            <span>/</span>
            <Link to="/blog">Blog</Link>
            <span>/</span>
            <span className="bi-bc-current">{cat.label}</span>
          </nav>
          <p className="bi-kicker">BLOG</p>
          <h1 className="bi-title">{cat.label}</h1>
          <p className="bi-desc">{cat.description}</p>
        </div>
      </header>

      <main className="bi-main">
        {posts.length > 0 ? (
          <div className="bi-grid">
            {posts.map(post => (
              <Link to={getPostUrl(post)} className="bi-card" key={post.slug}>
                <div className="bi-card-top">
                  <span className="bi-card-cat">{cat.label}</span>
                  <span className="bi-card-date">{formatDate(post.date)}</span>
                </div>
                <h2 className="bi-card-title">{post.title}</h2>
                <p className="bi-card-desc">{post.description}</p>
                <div className="bi-card-bottom">
                  <span className="bi-card-read">{post.readTime}</span>
                  <span className="bi-card-arrow">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bi-empty">
            <p>No posts in this category yet. Check back soon.</p>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

const BLOG_INDEX_CSS = `
/* Header */
.bi-header {
  position: relative;
  background: var(--ink);
  padding: 120px 32px 56px;
  overflow: hidden;
}
.bi-header-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(ellipse 70% 50% at 50% 20%, rgba(217,45,32,0.1), transparent 60%),
    radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1.4px);
  background-size: 100% 100%, 24px 24px;
}
.bi-header-inner {
  position: relative;
  z-index: 2;
  max-width: 1060px;
  margin: 0 auto;
}
.bi-kicker {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--red);
  margin: 0 0 14px;
}
.bi-title {
  font-family: var(--display);
  font-weight: 800;
  font-size: clamp(30px, 5vw, 44px);
  line-height: 1.1;
  letter-spacing: -0.025em;
  color: #ffffff;
  margin: 0 0 14px;
}
.bi-desc {
  font-size: 17px;
  line-height: 1.6;
  color: rgba(255,255,255,0.5);
  max-width: 640px;
}

/* Breadcrumbs in header */
.bi-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  margin-bottom: 28px;
}
.bi-breadcrumbs a { color: rgba(255,255,255,0.45) !important; transition: color 0.2s; }
.bi-breadcrumbs a:hover { color: rgba(255,255,255,0.8) !important; }
.bi-breadcrumbs span { color: rgba(255,255,255,0.2) !important; }
.bi-bc-current { color: rgba(255,255,255,0.6) !important; font-weight: 600; }

/* Main */
.bi-main {
  max-width: 1060px;
  margin: 0 auto;
  padding: 40px 32px 80px;
}

/* Filter tabs */
.bi-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}
.bi-filter {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
}
.bi-filter:hover {
  border-color: var(--ink);
  color: var(--ink);
}
.bi-filter-active {
  background: var(--ink);
  color: #fff !important;
  border-color: var(--ink);
}

/* Post grid */
.bi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
.bi-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 28px 28px 24px;
  transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 8px 24px -12px rgba(22,24,29,0.1);
}
.bi-card:hover {
  border-color: var(--red);
  transform: translateY(-3px);
  box-shadow: 0 2px 4px rgba(22,24,29,0.08), 0 16px 40px -12px rgba(22,24,29,0.18);
}
.bi-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.bi-card-cat {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--red);
  background: var(--red-soft);
  padding: 4px 10px;
  border-radius: 6px;
}
.bi-card-date {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
}
.bi-card-title {
  font-family: var(--display);
  font-weight: 700;
  font-size: 20px;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--ink) !important;
  margin: 0 0 10px;
}
.bi-card-desc {
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
  margin: 0;
  flex: 1;
}
.bi-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.bi-card-read {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
}
.bi-card-arrow {
  font-size: 18px;
  color: var(--red);
  transition: transform 0.2s;
}
.bi-card:hover .bi-card-arrow { transform: translateX(4px); }

/* Empty state */
.bi-empty {
  text-align: center;
  padding: 80px 24px;
  color: var(--muted);
  font-size: 16px;
}

/* Responsive */
@media (max-width: 640px) {
  .bi-header { padding: 96px 16px 40px; }
  .bi-main { padding: 28px 16px 56px; }
  .bi-grid { grid-template-columns: 1fr; }
  .bi-card { padding: 22px 22px 20px; }
}
`;
