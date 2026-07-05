import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SiteNav, SiteFooter, Seo, SITE_CSS } from "./site";

export function NotFoundPage() {
  const { t } = useTranslation("common");
  return (
    <div className="l2">
      <style>{SITE_CSS}</style>
      <style>{NOT_FOUND_CSS}</style>
      <Seo
        title={t("notFound.seoTitle")}
        description={t("notFound.seoDescription")}
        path="/404"
        robots="noindex, follow"
      />
      <SiteNav />

      <main className="l2-404">
        <p className="l2-doc-kicker">404</p>
        <h1>{t("notFound.title")}</h1>
        <p>{t("notFound.description")}</p>
        <div className="l2-404-actions">
          <Link className="l2-btn l2-btn-hot" to="/">
            {t("notFound.goHome")}
          </Link>
          <Link className="l2-btn l2-btn-ghost" to="/own-a-hotline">
            {t("notFound.viewOwn")}
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
