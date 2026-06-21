import { Link } from "react-router-dom";
import { SiteNav, SiteFooter, Seo, SITE_CSS } from "./site";

export function NotFoundPage() {
  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{NOT_FOUND_CSS}</style>
      <Seo
        title="Page Not Found | Hotline HQ"
        description="The requested Hotline HQ page could not be found."
        path="/404"
        robots="noindex, follow"
      />
      <SiteNav />

      <main className="l2-404">
        <p className="l2-doc-kicker">404</p>
        <h1>Page not found.</h1>
        <p>
          The page you requested does not exist or may have moved. Use the
          main landing page to explore the hotline network and request a line.
        </p>
        <div className="l2-404-actions">
          <Link className="l2-btn l2-btn-hot" to="/">
            Go to homepage
          </Link>
          <Link className="l2-btn l2-btn-ghost" to="/own-a-hotline">
            View own-a-hotline page
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

const NOT_FOUND_CSS = `
.l2-404 {
  max-width: 760px;
  margin: 0 auto;
  padding: 150px 32px 90px;
}
.l2-404 h1 {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(38px, 5vw, 62px);
  line-height: 1.04;
  letter-spacing: -0.02em;
  margin: 0 0 18px;
}
.l2-404 p {
  max-width: 620px;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.7;
  margin: 0 0 28px;
}
.l2-404-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
`;
