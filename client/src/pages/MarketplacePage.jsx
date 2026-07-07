import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SiteNav, SiteFooter, SITE_CSS, Seo, buildSiteUrl } from "./landing2/site";

const SIGNUP_URL = "https://hotline.redlineusedautoparts.com/client/signup";

function formatRelativeTime(unixSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function parseParts(pd) {
  if (typeof pd === "object" && pd !== null) return pd;
  try {
    return JSON.parse(pd || "{}");
  } catch {
    return {};
  }
}

function isFreshListing(createdAt) {
  return (Math.floor(Date.now() / 1000) - createdAt) < 7200;
}

function isRealValue(v) {
  return v && v !== 'null' && v !== 'undefined' && String(v).trim() !== '';
}

function parseDisplayName(dn) {
  if (!dn) return { yard: null, person: null };
  const parts = dn.split('/').map(s => s.trim());
  if (parts.length >= 2) {
    return { yard: parts[0], person: parts.slice(1).join('/').trim() };
  }
  return { yard: dn.trim(), person: null };
}

function formatDuration(ms) {
  if (!ms) return null;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function CountUp({ to }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !to) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now) => {
          const k = Math.min((now - start) / 1200, 1);
          const ease = 1 - Math.pow(1 - k, 3);
          setVal(Math.round(to * ease));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref}>{val}</span>;
}

/* ------------------------------------------------------------------ */
/*  Filter bar                                                          */
/* ------------------------------------------------------------------ */

function FilterBar({ rooms, filters, onChange, total }) {
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const out = [];
    for (let y = current + 1; y >= 1990; y--) out.push(String(y));
    return out;
  }, []);

  return (
    <div className="mp-filters">
      <div className="mp-filters-row">
        <div className="mp-filter-group">
          <label className="mp-filter-label">Region</label>
          <select
            className="mp-select"
            value={filters.room}
            onChange={(e) => onChange({ ...filters, room: e.target.value })}
          >
            <option value="">All Regions</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mp-filter-group">
          <label className="mp-filter-label">Year</label>
          <select
            className="mp-select"
            value={filters.year}
            onChange={(e) => onChange({ ...filters, year: e.target.value })}
          >
            <option value="">Any Year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="mp-filter-group mp-filter-group--search">
          <label className="mp-filter-label">Search</label>
          <div className="mp-input-wrap">
            <svg className="mp-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="mp-input"
              placeholder="Make or model..."
              value={filters.make}
              onChange={(e) => onChange({ ...filters, make: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="mp-filters-meta">
        <span className="mp-count">
          <span className="mp-count-num">{total}</span> active requests
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Listing card                                                        */
/* ------------------------------------------------------------------ */

function ListingCard({ listing }) {
  const parts = parseParts(listing.part_details);
  const makeModel = [parts.make, parts.model].filter(isRealValue).join(" ");
  const partName = isRealValue(parts.part) ? parts.part : null;
  const spec = parts.specification;
  const expired = listing.is_expired;
  const isFresh = isFreshListing(listing.created_at);
  const { yard, person } = parseDisplayName(listing.display_name);

  return (
    <Link
      to={`/parts/${listing.slug}`}
      className={`mp-card ${expired ? "mp-card--expired" : ""} ${isFresh ? "mp-card--fresh" : ""}`}
    >
      {/* Broadcast origin — who called */}
      <div className="mp-card-origin">
        <div className="mp-card-caller">
          {isFresh && <span className="mp-pulse" />}
          <span className="mp-card-yard-name">{yard || "Yard"}</span>
          {person && <span className="mp-card-person">{person}</span>}
        </div>
        <div className="mp-card-origin-meta">
          <span>{listing.room_name}</span>
          <span className="mp-card-dot" />
          <span>{formatRelativeTime(listing.created_at)}</span>
          {listing.listener_count > 0 && (
            <>
              <span className="mp-card-dot" />
              <span>{listing.listener_count} on line</span>
            </>
          )}
        </div>
      </div>

      {/* The request — what they need */}
      <div className="mp-card-request">
        {isRealValue(parts.year) && <span className="mp-card-year">{parts.year}</span>}
        <h3 className="mp-card-vehicle">{makeModel || "Vehicle"}</h3>
        {partName && <span className="mp-card-part">{partName}</span>}
        {spec && isRealValue(spec) && <p className="mp-card-spec">{spec}</p>}
      </div>

      {/* Footer */}
      <div className="mp-card-footer">
        <span className={`mp-card-responses ${listing.response_count > 0 ? "mp-card-responses--has" : ""}`}>
          {listing.response_count > 0
            ? `${listing.response_count} ${listing.response_count === 1 ? "response" : "responses"}`
            : "No responses yet"}
        </span>
        <span className="mp-card-cta">
          I have this
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="mp-card mp-card--skeleton">
      <div className="mp-card-origin">
        <div className="mp-shimmer" style={{ width: 140, height: 14, borderRadius: 4 }} />
        <div className="mp-shimmer" style={{ width: 100, height: 12, borderRadius: 3, marginTop: 6 }} />
      </div>
      <div className="mp-card-request">
        <div className="mp-shimmer" style={{ width: 40, height: 13, borderRadius: 3 }} />
        <div className="mp-shimmer" style={{ width: "80%", height: 24, borderRadius: 5, marginTop: 6 }} />
        <div className="mp-shimmer" style={{ width: 100, height: 28, borderRadius: 6, marginTop: 10 }} />
      </div>
      <div className="mp-card-footer">
        <div className="mp-shimmer" style={{ width: 100, height: 14, borderRadius: 4 }} />
        <div className="mp-shimmer" style={{ width: 90, height: 32, borderRadius: 9 }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({ hasFilters }) {
  return (
    <div className="mp-empty">
      <div className="mp-empty-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <h3>{hasFilters ? "No matching requests" : "No active requests"}</h3>
      <p>
        {hasFilters
          ? "Try adjusting your filters to see more results."
          : "Check back soon — new part requests come in throughout the day."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    room: searchParams.get("room") || "",
    year: searchParams.get("year") || "",
    make: searchParams.get("q") || "",
  });

  const fetchListings = useCallback(
    (pg = 1) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", pg);
      params.set("pageSize", "20");
      if (filters.room) params.set("room", filters.room);
      if (filters.year) params.set("year", filters.year);
      if (filters.make) params.set("make", filters.make);

      fetch(`/api/v1/marketplace/listings?${params}`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load listings");
          return r.json();
        })
        .then((json) => {
          if (json.status && json.data) {
            if (pg === 1) {
              setListings(json.data);
            } else {
              setListings((prev) => [...prev, ...json.data]);
            }
            setTotal(json.total || 0);
            setTotalPages(json.totalPages || 1);
            setPage(json.page || pg);
            if (json.rooms) setRooms(json.rooms);
          } else {
            throw new Error("Invalid response");
          }
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [filters]
  );

  useEffect(() => {
    fetchListings(1);
  }, [fetchListings]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.room) params.set("room", filters.room);
    if (filters.year) params.set("year", filters.year);
    if (filters.make) params.set("q", filters.make);
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const handleLoadMore = () => {
    if (page < totalPages) {
      fetchListings(page + 1);
    }
  };

  const hasFilters = filters.room || filters.year || filters.make;

  return (
    <>
      <style>{SITE_CSS}</style>
      <style>{PAGE_CSS}</style>
      <Seo
        title="Used Auto Parts Wanted — Parts Marketplace | Hotline HQ"
        description="Browse unanswered used auto parts requests from 500+ dismantler yards across the US. Have the part they need? Respond and get connected directly."
        keywords="used auto parts, auto parts marketplace, car parts wanted, dismantler parts, junkyard parts, salvage auto parts, used car parts near me"
        path="/marketplace"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Parts Marketplace",
          description: "Browse unanswered used auto parts requests from 500+ dismantler yards across the US.",
          url: buildSiteUrl("/marketplace"),
          isPartOf: { "@type": "WebSite", name: "Hotline HQ", url: buildSiteUrl("/") },
          provider: { "@type": "Organization", name: "Hotline HQ" },
        }}
      />

      <div className="l2 mp-page">
        <SiteNav />

        <main className="mp-main">
          {/* Hero */}
          <section className="mp-hero">
            <div className="mp-hero-scrim" aria-hidden="true" />
            <div className="mp-hero-inner">
              <div className="mp-hero-live-chip">
                <span className="mp-live-dot" />
                LIVE BOARD
              </div>
              <h1 className="mp-hero-h1">
                <span className="mp-hero-number"><CountUp to={total} /></span>
                <span className="mp-hero-label">unanswered part requests</span>
              </h1>
              <p className="mp-hero-sub">
                Real broadcasts from the Hotline&nbsp;HQ voice network that still need a seller. Have the part? Respond and get connected.
              </p>
              <div className="mp-hero-stats">
                <div className="mp-hero-stat">
                  <strong>500+</strong>
                  <span>yards on network</span>
                </div>
                <div className="mp-hero-stat">
                  <strong>~115</strong>
                  <span>listeners per call</span>
                </div>
                <div className="mp-hero-stat">
                  <strong>12</strong>
                  <span>regional rooms</span>
                </div>
                <div className="mp-hero-stat">
                  <strong>7 day</strong>
                  <span>request window</span>
                </div>
              </div>
            </div>
          </section>

          {/* Content */}
          <section className="mp-content">
            <FilterBar
              rooms={rooms}
              filters={filters}
              onChange={setFilters}
              total={total}
            />

            {error && !listings.length ? (
              <div className="mp-error">
                <p>Something went wrong loading listings.</p>
                <button className="mp-retry-btn" onClick={() => fetchListings(1)}>
                  Try again
                </button>
              </div>
            ) : loading && !listings.length ? (
              <div className="mp-grid">
                {Array.from({ length: 6 }, (_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <EmptyState hasFilters={!!hasFilters} />
            ) : (
              <>
                <div className="mp-grid">
                  {listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))}
                </div>

                {page < totalPages && (
                  <div className="mp-load-more">
                    <button
                      className="mp-load-more-btn"
                      onClick={handleLoadMore}
                      disabled={loading}
                    >
                      {loading ? "Loading..." : "Load More Requests"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Bottom CTA */}
          <section className="mp-bottom-cta">
            <div className="mp-bottom-inner">
              <span className="mp-bottom-kicker">SKIP THE BOARD</span>
              <h2>Get these requests live, the instant they're broadcast</h2>
              <p>Join 500+ yards on Hotline HQ. Hear every part request in your region the moment someone picks up the mic.</p>
              <div className="mp-bottom-actions">
                <a href={SIGNUP_URL} className="mp-join-btn">Sign Up Free</a>
                <a href="/" className="mp-learn-btn">Learn How It Works</a>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const PAGE_CSS = `
/* Page-level overrides on l2 shell */
.mp-page {
  --surface: #ffffff;
  --ink-secondary: #3d3d3a;
  --subtle: #a8a8a0;
  --red-glow: rgba(217,45,32,0.06);
  --red-soft: #fef3f2;
  --green: #1a7a3a;
  --green-soft: #e8f5ed;
  --radius: 14px;
  --shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);
}

/* ---- Main ---- */
.mp-main {
  padding-top: 58px;
}

/* ---- Hero ---- */
.mp-hero {
  position: relative;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  padding: 80px 32px 0;
  overflow: hidden;
}
.mp-hero-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(ellipse 60% 50% at 50% 30%, rgba(251,250,248,0.95) 30%, rgba(251,250,248,0.6) 65%, transparent 100%),
    radial-gradient(ellipse 50% 40% at 50% 45%, rgba(217,45,32,0.04), transparent 70%),
    radial-gradient(#dcd7cc 1px, transparent 1.4px);
  background-size: 100% 100%, 100% 100%, 26px 26px;
}
.mp-hero-inner {
  position: relative;
  z-index: 2;
  max-width: 1280px;
  margin: 0 auto;
}
.mp-hero-live-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(6px);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 7px 16px;
  margin-bottom: 24px;
}
.mp-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 0 3px rgba(217,45,32,0.15);
  animation: mp-live-dot 1.6s infinite;
}
@keyframes mp-live-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.mp-hero-h1 {
  margin: 0 0 18px;
  display: flex;
  align-items: baseline;
  gap: 14px;
  flex-wrap: wrap;
}
.mp-hero-number {
  font-family: var(--display);
  font-weight: 800;
  font-size: clamp(56px, 9vw, 84px);
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--red);
  font-variant-numeric: tabular-nums;
}
.mp-hero-label {
  font-family: var(--display);
  font-weight: 600;
  font-size: clamp(20px, 3vw, 30px);
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--muted);
}
.mp-hero-sub {
  font-size: 17px;
  line-height: 1.65;
  color: var(--muted);
  max-width: 560px;
  margin: 0;
  font-weight: 500;
}
.mp-hero-stats {
  display: flex;
  gap: clamp(28px, 5vw, 72px);
  flex-wrap: wrap;
  padding: 40px 0 44px;
  margin-top: 32px;
  border-top: 1px dashed var(--line);
}
.mp-hero-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mp-hero-stat strong {
  font-family: var(--display);
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.mp-hero-stat span {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

/* ---- Content ---- */
.mp-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 48px 32px 80px;
}

/* ---- Filters ---- */
.mp-filters {
  margin-bottom: 40px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 24px 28px;
  box-shadow: var(--shadow);
}
.mp-filters-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.mp-filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 150px;
}
.mp-filter-group--search {
  flex: 1;
  min-width: 200px;
}
.mp-filter-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--subtle);
}
.mp-select,
.mp-input {
  font-family: var(--body);
  font-size: 14px;
  color: var(--ink);
  background: var(--band);
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 10px 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.mp-select {
  cursor: pointer;
  padding-right: 32px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235d6370' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}
.mp-input-wrap {
  position: relative;
}
.mp-input-icon {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--subtle);
  pointer-events: none;
}
.mp-input {
  width: 100%;
  padding-left: 36px;
}
.mp-select:focus,
.mp-input:focus {
  background: var(--surface);
  border-color: var(--red);
  box-shadow: 0 0 0 3px rgba(217,45,32,0.08);
}
.mp-filters-meta {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.mp-count {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--subtle);
}
.mp-count-num {
  font-weight: 700;
  color: var(--ink);
}

/* ---- Card grid ---- */
.mp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}

/* ---- Card ---- */
.mp-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid rgba(22,24,29,0.1);
  border-top: none;
  border-radius: var(--radius);
  overflow: hidden;
  transition: box-shadow 0.3s, transform 0.2s;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(22,24,29,0.06), 0 8px 24px -8px rgba(22,24,29,0.12);
}
.mp-card:hover {
  box-shadow: 0 4px 8px rgba(22,24,29,0.08), 0 24px 56px -16px rgba(22,24,29,0.22);
  transform: translateY(-4px);
}
.mp-card--expired {
  opacity: 0.5;
}
.mp-card--expired:hover {
  opacity: 0.7;
}
.mp-card--skeleton {
  pointer-events: none;
  cursor: default;
}

/* Origin — dark dispatch header */
.mp-card-origin {
  background: var(--ink);
  padding: 16px 22px 14px;
  border-radius: var(--radius) var(--radius) 0 0;
}
.mp-card--fresh .mp-card-origin {
  background: linear-gradient(135deg, #2a1a18, var(--ink));
}
.mp-card-caller {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.mp-card-yard-name {
  font-family: var(--body);
  font-size: 13.5px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mp-card-person {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  color: rgba(255,255,255,0.45);
  text-transform: capitalize;
  flex-shrink: 0;
}
.mp-card-person::before {
  content: "·";
  margin-right: 6px;
}
.mp-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f04438;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(240,68,56,0.25);
  animation: mp-pulse 1.6s ease-in-out infinite;
}
@keyframes mp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.mp-card-origin-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: rgba(255,255,255,0.4);
}
.mp-card-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  flex-shrink: 0;
}

/* Request — the actual part need */
.mp-card-request {
  padding: 20px 22px 18px;
  flex: 1;
  background: linear-gradient(180deg, #faf9f7 0%, var(--surface) 40%);
}
.mp-card-year {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.mp-card-vehicle {
  font-family: var(--display);
  font-weight: 800;
  font-size: 22px;
  line-height: 1.12;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin: 4px 0 0;
}
.mp-card-part {
  display: inline-block;
  font-family: var(--display);
  font-weight: 700;
  font-size: 14.5px;
  color: var(--red);
  margin-top: 10px;
  padding: 5px 12px;
  background: var(--red-soft);
  border-radius: 6px;
  text-transform: capitalize;
}
.mp-card-spec {
  font-size: 13px;
  color: var(--muted);
  font-style: italic;
  margin: 8px 0 0;
  line-height: 1.4;
}

/* Footer */
.mp-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 22px;
  border-top: 1px solid var(--line);
}
.mp-card-responses {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--subtle);
}
.mp-card-responses--has {
  color: var(--green);
  font-weight: 600;
}
.mp-card-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--body);
  font-size: 13px;
  font-weight: 700;
  color: var(--red);
  padding: 8px 14px;
  border: 1.5px solid rgba(217,45,32,0.2);
  border-radius: 9px;
  background: var(--red-soft);
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}
.mp-card:hover .mp-card-cta {
  background: var(--red);
  border-color: var(--red);
  color: #fff;
}

/* ---- Load more ---- */
.mp-load-more {
  display: flex;
  justify-content: center;
  margin-top: 44px;
}
.mp-load-more-btn {
  font-family: var(--body);
  font-size: 15.5px;
  font-weight: 600;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 14px 36px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.mp-load-more-btn:hover {
  border-color: #c9c4ba;
  background: var(--band);
}
.mp-load-more-btn:active { transform: translateY(1px); }
.mp-load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ---- Empty state ---- */
.mp-empty {
  text-align: center;
  padding: 80px 20px;
}
.mp-empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--band);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: var(--subtle);
}
.mp-empty h3 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 22px;
  margin: 0 0 8px;
}
.mp-empty p {
  font-size: 15px;
  color: var(--muted);
  margin: 0;
  max-width: 360px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

/* ---- Error ---- */
.mp-error {
  text-align: center;
  padding: 80px 20px;
}
.mp-error p {
  font-size: 15px;
  color: var(--muted);
  margin: 0 0 16px;
}
.mp-retry-btn {
  font-family: var(--body);
  font-size: 14px;
  font-weight: 600;
  color: var(--red);
  background: var(--red-soft);
  border: 1px solid #fecdca;
  border-radius: 8px;
  padding: 10px 24px;
  cursor: pointer;
  transition: background 0.2s;
}
.mp-retry-btn:hover {
  background: #fde4e1;
}

/* ---- Bottom CTA ---- */
.mp-bottom-cta {
  background: var(--ink);
  padding: 110px 32px;
}
.mp-bottom-inner {
  max-width: 620px;
  margin: 0 auto;
  text-align: center;
}
.mp-bottom-kicker {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--red);
  display: block;
  margin-bottom: 20px;
}
.mp-bottom-cta h2 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.08;
  letter-spacing: -0.015em;
  color: #ffffff;
  margin: 0 0 18px;
}
.mp-bottom-cta p {
  font-size: 17px;
  line-height: 1.65;
  color: rgba(255,255,255,0.5);
  margin: 0 0 36px;
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
}
.mp-bottom-actions {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}
.mp-join-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 28px;
  font-family: var(--body);
  font-size: 15.5px;
  font-weight: 600;
  color: #fff !important;
  background: var(--red);
  border-radius: 11px;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5);
  transition: all 0.2s;
}
.mp-join-btn:hover {
  background: var(--red-deep);
  transform: translateY(-2px);
  box-shadow: 0 12px 32px -8px rgba(217,45,32,0.6);
}
.mp-learn-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 28px;
  font-family: var(--body);
  font-size: 15.5px;
  font-weight: 600;
  color: #fff !important;
  background: transparent;
  border: 2px solid rgba(255,255,255,0.25);
  border-radius: 11px;
  transition: all 0.2s;
}
.mp-learn-btn:hover {
  border-color: rgba(255,255,255,0.5);
  transform: translateY(-2px);
}

/* ---- Shimmer ---- */
.mp-shimmer {
  background: linear-gradient(90deg, #eae7e0 25%, #f5f3ee 50%, #eae7e0 75%);
  background-size: 200% 100%;
  animation: mp-shimmer 1.6s ease infinite;
}
@keyframes mp-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ---- Responsive ---- */

/* Tablet: 2 columns */
@media (max-width: 1024px) {
  .mp-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
  }
  .mp-content { padding: 40px 24px 64px; }
  .mp-hero { padding: 64px 24px 0; }
}

/* Mobile */
@media (max-width: 640px) {
  .mp-main { padding-top: 48px; }

  .mp-hero {
    padding: 48px 16px 0;
  }
  .mp-hero-h1 {
    flex-direction: column;
    gap: 4px;
  }
  .mp-hero-stats {
    gap: 24px;
    padding: 28px 0 32px;
    margin-top: 24px;
  }
  .mp-hero-stat strong { font-size: 24px; }
  .mp-hero-sub { font-size: 15.5px; }

  .mp-content {
    padding: 32px 16px 48px;
  }

  .mp-filters {
    padding: 18px;
    border-radius: 12px;
  }
  .mp-filters-row {
    flex-direction: column;
    gap: 10px;
  }
  .mp-filter-group {
    min-width: 100%;
  }
  .mp-filter-group--search {
    min-width: 100%;
  }

  .mp-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .mp-card-vehicle { font-size: 20px; }
  .mp-card-origin { padding: 14px 18px 12px; }
  .mp-card-request { padding: 18px 18px 14px; }
  .mp-card-footer { padding: 12px 18px; }

  .mp-bottom-cta { padding: 72px 16px; }
  .mp-bottom-actions { flex-direction: column; align-items: center; }
  .mp-join-btn, .mp-learn-btn { width: 100%; max-width: 320px; justify-content: center; }
}

/* Extra small */
@media (max-width: 380px) {
  .mp-hero-number { font-size: 40px; }
  .mp-hero-label { font-size: 18px; }
  .mp-card-origin-meta { flex-wrap: wrap; }
  .mp-card-footer { flex-direction: column; align-items: flex-start; gap: 10px; }
  .mp-card-cta { align-self: stretch; justify-content: center; }
}
`;
