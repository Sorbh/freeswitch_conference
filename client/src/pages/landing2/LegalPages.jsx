import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { PageShell, CONTACT_EMAIL } from "./site";

const UPDATED = "June 11, 2026";

const TEAM = [
  { name: "Luis E. Woolley", key: "luis", photo: "/team/luis.jpg" },
  { name: "Adriano Fernandez de Soto", key: "adriano", photo: "/team/adriano.jpg" },
  { name: "Saurabh K. Sharma", key: "saurabh", photo: "/team/saurabh.jpg" },
  { name: "Gaurav K. Sharma", key: "gaurav", photo: "/team/gaurav.jpg" },
];

/* ------------------------------------------------------------------ */
/*  About                                                              */
/* ------------------------------------------------------------------ */

export function AboutPage() {
  const { t } = useTranslation("legal");
  return (
    <PageShell
      kicker={t("about.kicker")}
      title={t("about.title")}
      seo={{
        title: t("about.seoTitle"),
        description: t("about.seoDescription"),
        path: "/about",
      }}
    >
      <p className="l2-doc-lead">{t("about.lead")}</p>

      <h2>{t("about.whyTitle")}</h2>
      <p>{t("about.whyP1")}</p>
      <p>{t("about.whyP2")}</p>

      <h2>{t("about.howTitle")}</h2>
      <p>{t("about.howP")}</p>

      <h2>{t("about.whoTitle")}</h2>
      <p>{t("about.whoP")}</p>

      <h2>{t("about.teamTitle")}</h2>
      <p>
        <Trans
          i18nKey="legal:about.teamP"
          components={{
            1: <a href="https://globalsolutionssoftware.com" target="_blank" rel="noreferrer" />,
          }}
        />
      </p>
      <div className="l2-team">
        {TEAM.map((m) => (
          <div className="l2-team-card" key={m.name}>
            <img src={m.photo} alt={m.name} loading="lazy" />
            <div className="l2-team-info">
              <p className="l2-team-name">{m.name}</p>
              <p className="l2-team-role">
                {t(`about.team.${m.key}.role`)} ·{" "}
                <span>{t(`about.team.${m.key}.exp`)}</span>
              </p>
              <p className="l2-team-bio">{t(`about.team.${m.key}.bio`)}</p>
            </div>
          </div>
        ))}
      </div>

      <h2>{t("about.contactTitle")}</h2>
      <p>
        <Trans
          i18nKey="legal:about.contactP"
          values={{ email: CONTACT_EMAIL }}
          components={{
            1: <a href={`mailto:${CONTACT_EMAIL}`} target="_blank" rel="noopener noreferrer" />,
            2: <Link to="/#join" />,
          }}
        />
      </p>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Privacy Policy                                                     */
/* ------------------------------------------------------------------ */

export function PrivacyPage() {
  const { t } = useTranslation("legal");
  return (
    <PageShell
      kicker={t("privacy.kicker")}
      title={t("privacy.title")}
      updated={UPDATED}
      seo={{
        title: t("privacy.seoTitle"),
        description: t("privacy.seoDescription"),
        path: "/privacy-policy",
        robots: "noindex, follow",
      }}
    >
      <p className="l2-doc-lead">{t("privacy.lead")}</p>

      <h2>{t("privacy.collectTitle")}</h2>
      <ul>
        <li dangerouslySetInnerHTML={{ __html: t("privacy.collectAccount") }} />
        <li dangerouslySetInnerHTML={{ __html: t("privacy.collectRecordings") }} />
        <li dangerouslySetInnerHTML={{ __html: t("privacy.collectDevice") }} />
        <li dangerouslySetInnerHTML={{ __html: t("privacy.collectWebsite") }} />
      </ul>

      <h2>{t("privacy.useTitle")}</h2>
      <ul>
        <li>{t("privacy.use1")}</li>
        <li>{t("privacy.use2")}</li>
        <li>{t("privacy.use3")}</li>
        <li>{t("privacy.use4")}</li>
        <li>{t("privacy.use5")}</li>
        <li>{t("privacy.use6")}</li>
      </ul>

      <h2>{t("privacy.recordingTitle")}</h2>
      <p>{t("privacy.recordingP")}</p>

      <h2>{t("privacy.sharingTitle")}</h2>
      <p>{t("privacy.sharingP")}</p>

      <h2>{t("privacy.retentionTitle")}</h2>
      <p>{t("privacy.retentionP")}</p>

      <h2>{t("privacy.choicesTitle")}</h2>
      <p>
        <Trans
          i18nKey="legal:privacy.choicesP"
          values={{ email: CONTACT_EMAIL }}
          components={{
            1: <a href={`mailto:${CONTACT_EMAIL}`} target="_blank" rel="noopener noreferrer" />,
          }}
        />
      </p>

      <h2>{t("privacy.changesTitle")}</h2>
      <p>{t("privacy.changesP")}</p>

      <h2>{t("privacy.contactTitle")}</h2>
      <p>
        <Trans
          i18nKey="legal:privacy.contactP"
          values={{ email: CONTACT_EMAIL }}
          components={{
            1: <a href={`mailto:${CONTACT_EMAIL}`} target="_blank" rel="noopener noreferrer" />,
          }}
        />
      </p>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Terms & Conditions                                                 */
/* ------------------------------------------------------------------ */

export function TermsPage() {
  const { t } = useTranslation("legal");
  return (
    <PageShell
      kicker={t("terms.kicker")}
      title={t("terms.title")}
      updated={UPDATED}
      seo={{
        title: t("terms.seoTitle"),
        description: t("terms.seoDescription"),
        path: "/terms-and-conditions",
        robots: "noindex, follow",
      }}
    >
      <p className="l2-doc-lead">{t("terms.lead")}</p>

      <h2>{t("terms.s1Title")}</h2>
      <p>{t("terms.s1P")}</p>

      <h2>{t("terms.s2Title")}</h2>
      <ul>
        <li>{t("terms.s2L1")}</li>
        <li>{t("terms.s2L2")}</li>
        <li>{t("terms.s2L3")}</li>
        <li>{t("terms.s2L4")}</li>
      </ul>

      <h2>{t("terms.s3Title")}</h2>
      <ul>
        <li>{t("terms.s3L1")}</li>
        <li>{t("terms.s3L2")}</li>
        <li>{t("terms.s3L3")}</li>
      </ul>

      <h2>{t("terms.s4Title")}</h2>
      <p dangerouslySetInnerHTML={{ __html: t("terms.s4P") }} />

      <h2>{t("terms.s5Title")}</h2>
      <p>{t("terms.s5P")}</p>

      <h2>{t("terms.s6Title")}</h2>
      <p>
        <Trans
          i18nKey="legal:terms.s6P"
          components={{
            1: <Link to="/privacy-policy" />,
          }}
        />
      </p>

      <h2>{t("terms.s7Title")}</h2>
      <p>{t("terms.s7P")}</p>

      <h2>{t("terms.s8Title")}</h2>
      <p>{t("terms.s8P")}</p>

      <h2>{t("terms.s9Title")}</h2>
      <p>{t("terms.s9P")}</p>

      <h2>{t("terms.s10Title")}</h2>
      <p>
        <Trans
          i18nKey="legal:terms.s10P"
          values={{ email: CONTACT_EMAIL }}
          components={{
            1: <a href={`mailto:${CONTACT_EMAIL}`} target="_blank" rel="noopener noreferrer" />,
          }}
        />
      </p>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Disclaimer                                                         */
/* ------------------------------------------------------------------ */

export function DisclaimerPage() {
  const { t } = useTranslation("legal");
  return (
    <PageShell
      kicker={t("disclaimer.kicker")}
      title={t("disclaimer.title")}
      updated={UPDATED}
      seo={{
        title: t("disclaimer.seoTitle"),
        description: t("disclaimer.seoDescription"),
        path: "/disclaimer",
        robots: "noindex, follow",
      }}
    >
      <p className="l2-doc-lead">{t("disclaimer.lead")}</p>

      <h2>{t("disclaimer.noGuaranteeTitle")}</h2>
      <p>{t("disclaimer.noGuaranteeP")}</p>

      <h2>{t("disclaimer.notPartyTitle")}</h2>
      <p>{t("disclaimer.notPartyP")}</p>

      <h2>{t("disclaimer.demosTitle")}</h2>
      <p>{t("disclaimer.demosP")}</p>

      <h2>{t("disclaimer.adviceTitle")}</h2>
      <p>{t("disclaimer.adviceP")}</p>

      <h2>{t("disclaimer.questionsTitle")}</h2>
      <p>
        <Trans
          i18nKey="legal:disclaimer.questionsP"
          values={{ email: CONTACT_EMAIL }}
          components={{
            1: <a href={`mailto:${CONTACT_EMAIL}`} target="_blank" rel="noopener noreferrer" />,
          }}
        />
      </p>
    </PageShell>
  );
}
