import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
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

function isRealValue(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s !== "" && s !== "null" && s !== "undefined" && s !== "n/a";
}

function parseDisplayName(dn) {
  if (!dn) return { yard: null, person: null };
  const parts = dn.split('/').map(s => s.trim());
  if (parts.length >= 2) return { yard: parts[0], person: parts.slice(1).join('/').trim() };
  return { yard: dn.trim(), person: null };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ------------------------------------------------------------------ */
/*  Response form — just phone + name                                   */
/* ------------------------------------------------------------------ */

const CACHE_KEY = "hq_responder";

function loadCachedContact() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; }
}

function saveCachedContact(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

function ResponseForm({ slug, onSuccess }) {
  const cached = loadCachedContact();
  const [form, setForm] = useState({
    name: cached.name || "",
    phone: cached.phone || "",
    email: cached.email || "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.phone.trim()) errs.phone = "Phone is required";
    if (form.email.trim() && !validateEmail(form.email.trim())) errs.email = "Enter a valid email";
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitError(null);
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    fetch(`/api/v1/marketplace/listings/${slug}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
      }),
    })
      .then((r) => {
        if (r.status === 429) throw new Error("rate_limit");
        if (!r.ok) throw new Error("submit_error");
        return r.json();
      })
      .then(() => {
        saveCachedContact({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() });
        onSuccess?.();
      })
      .catch((err) => {
        setSubmitError(
          err.message === "rate_limit"
            ? "Too many responses. Please try again later."
            : "Something went wrong. Please try again."
        );
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <form className="pl-form" onSubmit={handleSubmit}>
      <div className="pl-fields-row">
        <div className="pl-field">
          <label className="pl-label" htmlFor="resp-name">Name *</label>
          <input
            id="resp-name"
            type="text"
            className={`pl-input ${errors.name ? "pl-input-error" : ""}`}
            value={form.name}
            onChange={handleChange("name")}
            placeholder="Your name"
          />
          {errors.name && <span className="pl-field-error">{errors.name}</span>}
        </div>
        <div className="pl-field">
          <label className="pl-label" htmlFor="resp-phone">Phone *</label>
          <input
            id="resp-phone"
            type="tel"
            className={`pl-input ${errors.phone ? "pl-input-error" : ""}`}
            value={form.phone}
            onChange={handleChange("phone")}
            placeholder="(555) 123-4567"
          />
          {errors.phone && <span className="pl-field-error">{errors.phone}</span>}
        </div>
      </div>
      <div className="pl-field">
        <label className="pl-label" htmlFor="resp-email">Email <span className="pl-optional">(optional)</span></label>
        <input
          id="resp-email"
          type="email"
          className={`pl-input ${errors.email ? "pl-input-error" : ""}`}
          value={form.email}
          onChange={handleChange("email")}
          placeholder="you@company.com"
        />
        {errors.email && <span className="pl-field-error">{errors.email}</span>}
      </div>

      {submitError && <div className="pl-submit-error">{submitError}</div>}

      <button type="submit" className="pl-submit-btn" disabled={submitting}>
        {submitting ? "Sending..." : "Send My Info"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function PartsListingPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (!slug) { setError("Invalid listing"); setLoading(false); return; }
    fetch(`/api/v1/marketplace/listings/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "not_found" : "error");
        return r.json();
      })
      .then((json) => {
        if (json.status && json.data) setData(json.data);
        else throw new Error("not_found");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <>
        <style>{SITE_CSS}</style>
        <style>{PAGE_CSS}</style>
        <div className="l2 pl-page">
          <SiteNav />
          <main className="pl-main">
            <div className="pl-container">
              <div className="pl-shimmer" style={{ width: 160, height: 16, borderRadius: 4 }} />
              <div className="pl-card" style={{ marginTop: 20 }}>
                <div className="pl-shimmer" style={{ width: "50%", height: 28, borderRadius: 6 }} />
                <div className="pl-shimmer" style={{ width: "35%", height: 22, borderRadius: 6, marginTop: 12 }} />
                <div className="pl-shimmer" style={{ width: "100%", height: 180, borderRadius: 12, marginTop: 32 }} />
              </div>
            </div>
          </main>
          <SiteFooter />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <style>{SITE_CSS}</style>
        <style>{PAGE_CSS}</style>
        <div className="l2 pl-page">
          <SiteNav />
          <main className="pl-main">
            <div className="pl-container">
              <div className="pl-error-card">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M15 9l-6 6M9 9l6 6" />
                </svg>
                <h2>Listing not found</h2>
                <p>This listing may have been removed or the link is incorrect.</p>
                <Link to="/marketplace" className="pl-back-link">Browse Marketplace</Link>
              </div>
            </div>
          </main>
          <SiteFooter />
        </div>
      </>
    );
  }

  const parts = parseParts(data.part_details);
  const makeModel = [parts.make, parts.model].filter(isRealValue).join(" ");
  const partName = isRealValue(parts.part) ? parts.part : null;
  const spec = parts.specification;
  const expired = data.is_expired;
  const { yard, person } = parseDisplayName(data.display_name);

  const vehicle = [parts.year, makeModel].filter(Boolean).join(" ");
  const specText = isRealValue(spec) ? ` (${spec})` : "";
  const seoTitle = `${vehicle} ${partName || "Part"} Needed in ${data.room_name} | Used Auto Parts | Hotline HQ`;
  const seoDesc = `${data.room_name} dismantler needs a used ${vehicle} ${partName || "part"}${specText}. Have this part in stock? Respond now and get connected on Hotline HQ Marketplace.`;
  const seoKeywords = [parts.make, parts.model, partName, "used auto parts", "salvage parts", data.room_name, "car parts", "dismantler", parts.year].filter(Boolean).join(", ");

  return (
    <>
      <style>{SITE_CSS}</style>
      <style>{PAGE_CSS}</style>
      <Seo
        title={seoTitle}
        description={seoDesc}
        keywords={seoKeywords}
        path={`/parts/${slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: `${vehicle} ${partName || ""}`.trim() || "Auto Part",
          description: seoDesc,
          url: buildSiteUrl(`/parts/${slug}`),
          category: "Used Auto Parts",
          brand: parts.make ? { "@type": "Brand", name: parts.make } : undefined,
          offers: {
            "@type": "Demand",
            areaServed: data.room_name,
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/UsedCondition",
          },
          isRelatedTo: {
            "@type": "Vehicle",
            name: vehicle,
            manufacturer: parts.make || undefined,
            model: parts.model || undefined,
            vehicleModelDate: parts.year || undefined,
          },
        }}
      />

      <div className="l2 pl-page">
        <SiteNav />

        <main className="pl-main">
          <div className="pl-container">
            <Link to="/marketplace" className="pl-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Marketplace
            </Link>

            <div className="pl-split">
              {/* LEFT — Listing card */}
              <div className="pl-left">
                <div className="pl-card">
                  {/* Dark origin header */}
                  <div className="pl-origin">
                    <div className="pl-origin-left">
                      <span className="pl-origin-label">Broadcast from</span>
                      <span className="pl-origin-yard">{yard || "Yard"}</span>
                      {person && <span className="pl-origin-person">{person}</span>}
                    </div>
                    <div className="pl-origin-right">
                      <span>{data.room_name}</span>
                      <span>{formatRelativeTime(data.created_at)}</span>
                      {data.listener_count > 0 && <span>{data.listener_count} on line</span>}
                    </div>
                  </div>

                  {/* Request details */}
                  <div className="pl-request">
                    {isRealValue(parts.year) && <span className="pl-year">{parts.year}</span>}
                    <h1 className="pl-vehicle">{makeModel || "Vehicle"}</h1>
                    {partName && <span className="pl-part-chip">{partName}</span>}
                    {spec && isRealValue(spec) && <p className="pl-spec">{spec}</p>}

                    {expired && (
                      <div className="pl-expired-notice">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        This request has expired
                      </div>
                    )}

                    {!expired && data.response_count > 0 && (
                      <div className="pl-response-count">
                        {data.response_count} {data.response_count === 1 ? "person has" : "people have"} responded
                      </div>
                    )}
                  </div>

                  {/* Action section */}
                  <div className="pl-action">
                    {expired ? (
                      <div className="pl-action-expired">
                        <h3>Parts like this are requested every day</h3>
                        <p>Join Hotline HQ and hear requests live — respond the moment someone needs what you carry.</p>
                        <a href={SIGNUP_URL} className="pl-cta-primary">Join Hotline HQ</a>
                      </div>
                    ) : submitted ? (
                      <div className="pl-action-success">
                        <div className="pl-success-icon">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#12b76a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <h3>Your info has been sent</h3>
                        <p>The requester will contact you directly. Keep an eye on your phone.</p>
                        <Link to="/marketplace" className="pl-back-link">Browse more requests</Link>
                      </div>
                    ) : (
                      <>
                        <h3 className="pl-action-heading">Have this part?</h3>
                        <p className="pl-action-sub">Leave your info — we'll connect you with the requester.</p>
                        <ResponseForm slug={slug} onSuccess={() => setSubmitted(true)} />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT — Mini landing page */}
              <div className="pl-right">
                <div className="pl-sidebar">
                  <div className="pl-sidebar-scrim" aria-hidden="true" />
                  <div className="pl-sidebar-inner">
                    <div className="pl-sidebar-chip">
                      <span className="pl-live-dot" />
                      LIVE NETWORK
                    </div>

                    <h2 className="pl-sidebar-h2">Every part request,<br /><em>the second it's broadcast</em></h2>

                    <p className="pl-sidebar-sub">
                      Hotline HQ is an always-on voice network connecting 500+ auto dismantler yards.
                      Hear requests live and answer in seconds — no waiting for the board.
                    </p>

                    <div className="pl-sidebar-stats">
                      <div className="pl-sidebar-stat">
                        <strong>500+</strong>
                        <span>Member yards</span>
                      </div>
                      <div className="pl-sidebar-stat">
                        <strong>12</strong>
                        <span>Regional rooms</span>
                      </div>
                      <div className="pl-sidebar-stat">
                        <strong>2s</strong>
                        <span>Typical answer</span>
                      </div>
                      <div className="pl-sidebar-stat">
                        <strong>24/7</strong>
                        <span>Line monitoring</span>
                      </div>
                    </div>

                    <a href={SIGNUP_URL} className="pl-sidebar-cta">Sign Up Free</a>
                    <p className="pl-sidebar-fine">No credit card required. Cancel anytime.</p>

                    <Link to="/marketplace" className="pl-sidebar-link">
                      Browse all {data.room_name ? `${data.room_name} ` : ""}requests
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
.pl-page {
  --surface: #ffffff;
  --ink-secondary: #3d3d3a;
  --subtle: #a8a8a0;
  --red-glow: rgba(217,45,32,0.06);
  --red-soft: #fef3f2;
  --green: #12b76a;
  --green-soft: #e8f5ed;
  --radius: 14px;
  --shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);
}

/* ---- Main ---- */
.pl-main {
  padding: 110px 32px 80px;
}
.pl-container {
  max-width: 1280px;
  margin: 0 auto;
}

/* ---- Split layout ---- */
.pl-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  align-items: stretch;
}
.pl-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.pl-left .pl-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.pl-left .pl-request {
  flex: 1;
}
.pl-right {
  display: flex;
  flex-direction: column;
}

/* ---- Sidebar (mini landing) ---- */
.pl-sidebar {
  position: relative;
  background: var(--ink);
  border-radius: var(--radius);
  overflow: hidden;
  padding: 44px 36px 40px;
  box-shadow: 0 2px 4px rgba(22,24,29,0.08), 0 16px 48px -12px rgba(22,24,29,0.2);
  flex: 1;
  display: flex;
  flex-direction: column;
}
.pl-sidebar-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(ellipse 70% 50% at 50% 20%, rgba(217,45,32,0.08), transparent 60%),
    radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1.4px);
  background-size: 100% 100%, 22px 22px;
}
.pl-sidebar-inner {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.pl-sidebar-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.6);
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  padding: 6px 14px;
  margin-bottom: 28px;
}
.pl-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f04438;
  box-shadow: 0 0 0 3px rgba(240,68,56,0.3);
  animation: pl-live 1.6s infinite;
}
@keyframes pl-live {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.pl-sidebar-h2 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(24px, 2.5vw, 32px);
  line-height: 1.1;
  letter-spacing: -0.015em;
  color: #ffffff;
  margin: 0 0 16px;
}
.pl-sidebar-h2 em {
  font-style: normal;
  color: var(--red);
  background: linear-gradient(transparent 68%, rgba(217,45,32,0.2) 68%);
}
.pl-sidebar-sub {
  font-size: 15px;
  line-height: 1.7;
  color: rgba(255,255,255,0.5);
  margin: 0 0 auto;
}
.pl-sidebar-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: auto;
  padding: 28px 0;
  border-top: 1px solid rgba(255,255,255,0.08);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.pl-sidebar-stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.pl-sidebar-stat strong {
  font-family: var(--display);
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
}
.pl-sidebar-stat span {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
}
.pl-sidebar-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 14px 28px;
  margin-top: 28px;
  font-family: var(--body);
  font-size: 15.5px;
  font-weight: 700;
  color: #fff !important;
  background: var(--red);
  border-radius: 11px;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5);
  transition: all 0.2s;
}
.pl-sidebar-cta:hover {
  background: var(--red-deep);
  box-shadow: 0 12px 32px -8px rgba(217,45,32,0.6);
  transform: translateY(-1px);
}
.pl-sidebar-fine {
  font-family: var(--mono);
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  text-align: center;
  margin: 12px 0 0;
}
.pl-sidebar-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: rgba(255,255,255,0.5) !important;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.08);
  transition: color 0.2s;
}
.pl-sidebar-link:hover { color: #fff !important; }

/* ---- Back link ---- */
.pl-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 24px;
  transition: color 0.2s;
}
.pl-back:hover { color: var(--ink); }

/* ---- Card ---- */
.pl-card {
  background: var(--surface);
  border: 1px solid rgba(22,24,29,0.1);
  border-top: none;
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(22,24,29,0.06), 0 12px 40px -12px rgba(22,24,29,0.14);
  animation: pl-fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes pl-fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---- Origin header (dark) ---- */
.pl-origin {
  background: var(--ink);
  padding: 24px 32px 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.pl-origin-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pl-origin-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
}
.pl-origin-yard {
  font-family: var(--body);
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
}
.pl-origin-person {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  color: rgba(255,255,255,0.45);
  text-transform: capitalize;
}
.pl-origin-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: rgba(255,255,255,0.4);
  flex-shrink: 0;
}

/* ---- Request section ---- */
.pl-request {
  padding: 32px 32px 28px;
  background: linear-gradient(180deg, #faf9f7 0%, var(--surface) 40%);
}
.pl-year {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.pl-vehicle {
  font-family: var(--display);
  font-weight: 800;
  font-size: clamp(30px, 5vw, 42px);
  line-height: 1.08;
  letter-spacing: -0.025em;
  color: var(--ink);
  margin: 6px 0 0;
}
.pl-part-chip {
  display: inline-block;
  font-family: var(--display);
  font-weight: 700;
  font-size: 16px;
  color: var(--red);
  margin-top: 14px;
  padding: 6px 16px;
  background: var(--red-soft);
  border-radius: 8px;
  text-transform: capitalize;
}
.pl-spec {
  font-size: 15px;
  color: var(--muted);
  font-style: italic;
  margin: 10px 0 0;
  line-height: 1.5;
}
.pl-expired-notice {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--subtle);
  background: var(--band);
  padding: 10px 16px;
  border-radius: 8px;
  margin-top: 18px;
}
.pl-response-count {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--green);
  margin-top: 16px;
}

/* ---- Action section ---- */
.pl-action {
  padding: 28px 32px 32px;
  border-top: 1px solid var(--line);
}
.pl-action-heading {
  font-family: var(--display);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.01em;
  margin: 0 0 6px;
  color: var(--ink);
}
.pl-action-sub {
  font-size: 14.5px;
  color: var(--muted);
  margin: 0 0 22px;
  line-height: 1.5;
}

/* ---- Form ---- */
.pl-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.pl-fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.pl-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.pl-label {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-secondary);
}
.pl-optional {
  color: var(--subtle);
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
.pl-input {
  display: block;
  width: 100%;
  font-family: var(--body);
  font-size: 15px;
  color: var(--ink);
  background: var(--band);
  border: 1.5px solid transparent;
  border-radius: 8px;
  padding: 12px 16px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.pl-input:focus {
  background: var(--surface);
  border-color: var(--red);
  box-shadow: 0 0 0 3px var(--red-glow);
}
.pl-input-error {
  border-color: var(--red) !important;
}
.pl-field-error {
  font-size: 12px;
  color: var(--red);
  font-weight: 500;
}
.pl-submit-error {
  font-size: 14px;
  color: var(--red);
  background: var(--red-soft);
  border: 1px solid #fecdca;
  border-radius: 10px;
  padding: 12px 16px;
}
.pl-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 14px 28px;
  font-family: var(--body);
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: var(--red);
  border: none;
  border-radius: 11px;
  cursor: pointer;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.4);
  transition: all 0.2s;
  margin-top: 4px;
}
.pl-submit-btn:hover {
  background: var(--red-deep);
  box-shadow: 0 12px 32px -8px rgba(217,45,32,0.5);
  transform: translateY(-1px);
}
.pl-submit-btn:active { transform: translateY(1px); }
.pl-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

/* ---- Expired CTA ---- */
.pl-action-expired {
  text-align: center;
  padding: 8px 0;
}
.pl-action-expired h3 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.01em;
  margin: 0 0 10px;
  color: var(--ink);
}
.pl-action-expired p {
  font-size: 15px;
  color: var(--muted);
  margin: 0 0 20px;
  line-height: 1.6;
  max-width: 440px;
  margin-left: auto;
  margin-right: auto;
}
.pl-cta-primary {
  display: inline-flex;
  padding: 14px 28px;
  font-family: var(--body);
  font-size: 15px;
  font-weight: 700;
  color: #fff !important;
  background: var(--red);
  border-radius: 11px;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.4);
  transition: all 0.2s;
}
.pl-cta-primary:hover {
  background: var(--red-deep);
  box-shadow: 0 12px 32px -8px rgba(217,45,32,0.5);
  transform: translateY(-1px);
}

/* ---- Success state ---- */
.pl-action-success {
  text-align: center;
  padding: 16px 0;
}
.pl-success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--green-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}
.pl-action-success h3 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 22px;
  color: var(--ink);
  margin: 0 0 8px;
}
.pl-action-success p {
  font-size: 15px;
  color: var(--muted);
  line-height: 1.6;
  max-width: 380px;
  margin: 0 auto 20px;
}
.pl-back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--red) !important;
  letter-spacing: 0.02em;
  transition: opacity 0.2s;
}
.pl-back-link:hover { opacity: 0.7; }

/* ---- Error card ---- */
.pl-error-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  text-align: center;
  padding: 72px 28px;
  box-shadow: var(--shadow);
  animation: pl-fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.pl-error-card h2 {
  font-family: var(--display);
  font-weight: 700;
  font-size: 26px;
  letter-spacing: -0.02em;
  margin: 20px 0 10px;
  color: var(--ink);
}
.pl-error-card p {
  font-size: 15px;
  color: var(--muted);
  margin: 0 0 24px;
  max-width: 360px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

/* ---- Shimmer ---- */
.pl-shimmer {
  background: linear-gradient(90deg, #eae7e0 25%, #f5f3ee 50%, #eae7e0 75%);
  background-size: 200% 100%;
  animation: pl-shimmer 1.6s ease infinite;
  border-radius: 4px;
}
@keyframes pl-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ---- Tablet ---- */
@media (max-width: 960px) {
  .pl-split {
    grid-template-columns: 1fr;
    gap: 28px;
  }
  .pl-right {
    position: static;
  }
  .pl-sidebar { padding: 36px 28px 32px; }
}

/* ---- Mobile ---- */
@media (max-width: 640px) {
  .pl-main { padding: 80px 16px 48px; }
  .pl-origin {
    flex-direction: column;
    padding: 20px 22px 16px;
    gap: 10px;
  }
  .pl-origin-right {
    align-items: flex-start;
    flex-direction: row;
    gap: 10px;
    flex-wrap: wrap;
  }
  .pl-request { padding: 24px 22px 20px; }
  .pl-vehicle { font-size: 28px; }
  .pl-action { padding: 22px 22px 26px; }
  .pl-fields-row { grid-template-columns: 1fr; }
  .pl-sidebar { padding: 28px 20px 24px; }
  .pl-sidebar-h2 { font-size: 22px; }
  .pl-sidebar-stats { gap: 14px; }
}
`;
