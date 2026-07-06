import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { HQLogo, SiteFooter, SITE_CSS, Seo, landingJsonLd, CONTACT_EMAIL } from "./landing2/site";
import ListenLive from "../components/ListenLive";
import LanguageSwitcher from "../components/LanguageSwitcher";

/* ------------------------------------------------------------------ */
/*  Landing 2 — Hotline HQ. Light B2B theme, no heavy 3D:             */
/*  - Hero: static headline + real broadcast audio player             */
/*  - "Try it" section: playable sell-call demo with a scoreboard     */
/* ------------------------------------------------------------------ */

/* The 12 regional rooms (used by the coverage section). */
const HUBS = [
  { name: "CALIFORNIA" }, { name: "TEXAS" }, { name: "FLORIDA" },
  { name: "MEXICO" }, { name: "ENS" }, { name: "ARIZONA" },
  { name: "OHIO" }, { name: "NEW YORK" }, { name: "GEORGIA" },
  { name: "INDIANA" }, { name: "MICHIGAN" }, { name: "CAROLINAS" },
];

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/* ------------------------------------------------------------------ */
/*  Page content                                                       */
/* ------------------------------------------------------------------ */

const TICKER = [
  ["10:42:08", "TX ROOM", "’06 Silverado 2500 transfer case", "Answered · 2s"],
  ["10:43:51", "CA ROOM", "’14 Accord passenger fender, white", "Answered · 3s"],
  ["10:47:12", "FL ROOM", "’09 Camry alternator", "Answered · 2s"],
  ["10:49:40", "OH ROOM", "’17 F-150 3.5 EcoBoost long block", "Answered · 5s"],
  ["10:52:03", "AZ ROOM", "’11 Jetta TDI turbo", "Escalated → CA"],
  ["10:55:27", "GA ROOM", "’15 Altima CVT, 62k", "Answered · 2s"],
  ["10:58:44", "MI ROOM", "’08 Sierra tailgate, black", "Answered · 4s"],
  ["11:01:19", "NY ROOM", "’13 Rogue transfer case AWD", "Answered · 3s"],
];

/* STEPS, COMPARES, FEATURES — now built inside the component with t() */

/* Count-up stat that animates when scrolled into view. */
function Stat({ to, suffix = "", label }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now) => {
          const k = Math.min((now - start) / 1400, 1);
          setVal(Math.round(to * easeOutCubic(k)));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <div ref={ref}>
      <strong>
        {val}
        {suffix}
      </strong>
      <span>{label}</span>
    </div>
  );
}

const HERO_CLIPS = [
  {
    file: "./broadcasts/clip1.mp3",
    part: "2018 Honda Civic — Wreck Opinion",
    yard: "Fast Auto Parts",
    city: "Phoenix",
    partData: ["2018", "Honda", "Civic", "Wreck opinion"],
    responses: [
      { at: 7.3, city: "Tucson", yard: "A&G Auto Wrecking", reply: "Got it" },
      { at: 8.5, city: "Yuma", yard: "J&A Auto Parts", reply: "J&A got it" },
      { at: 10.0, city: "Prescott", yard: "ODR Auto Wrecking", reply: "Got two" },
      { at: 11.5, city: "Flagstaff", yard: "Fast Auto Parts", reply: "In stock" },
    ],
  },
  {
    file: "./broadcasts/clip2.mp3",
    part: "2020 Camry — Trunk & Taillights",
    yard: "Reeves Auto Wrecking",
    city: "Tucson",
    partData: ["2020", "Toyota", "Camry", "Trunk & taillights"],
    responses: [
      { at: 5.2, city: "Phoenix", yard: "Reeves", reply: "Checking" },
      { at: 8.5, city: "Prescott", yard: "Phoenix Salvage", reply: "Got it" },
      { at: 12.5, city: "Yuma", yard: "Chapin Auto", reply: "Thank you" },
    ],
  },
  {
    file: "./broadcasts/clip3.mp3",
    part: "2021 Chevy Tahoe — Wreck Opinion",
    yard: "Carrillo Auto Parts",
    city: "Flagstaff",
    partData: ["2021", "Chevrolet", "Tahoe", "Wreck opinion"],
    responses: [
      { at: 3.8, city: "Phoenix", yard: "J&A Auto Parts", reply: "J&A got it" },
      { at: 5.5, city: "Tucson", yard: "Parts Plus", reply: "Ready to go" },
      { at: 7.0, city: "Prescott", yard: "Jordan Auto", reply: "Got it" },
    ],
  },
  {
    file: "./broadcasts/clip4.mp3",
    part: "2018 Honda Civic — Rack & Pinion",
    yard: "Jordan Auto Wrecking",
    city: "Prescott",
    partData: ["2018", "Honda", "Civic", "Rack & pinion"],
    responses: [
      { at: 9.5, city: "Phoenix", yard: "Jordan Auto", reply: "Got one" },
      { at: 11.5, city: "Tucson", yard: "A&G Auto", reply: "Got a 15" },
      { at: 14.0, city: "Flagstaff", yard: "Fast Auto Parts", reply: "In stock" },
    ],
  },
];

export default function Landing2Page() {
  const { t, i18n } = useTranslation("landing");
  const rootRef = useRef(null);
  const wireRef = useRef(null);
  const formRef = useRef(null);

  const STEPS = [
    { n: "1", title: t("steps.step1.title"), copy: t("steps.step1.copy") },
    { n: "2", title: t("steps.step2.title"), copy: t("steps.step2.copy") },
    { n: "3", title: t("steps.step3.title"), copy: t("steps.step3.copy") },
  ];
  const COMPARES = [
    { label: t("compares.inventoryDb.label"), viz: "db", time: t("compares.inventoryDb.time"), flaw: t("compares.inventoryDb.flaw") },
    { label: t("compares.callingAround.label"), viz: "hold", time: t("compares.callingAround.time"), flaw: t("compares.callingAround.flaw") },
    { label: t("compares.facebook.label"), viz: "fb", time: t("compares.facebook.time"), flaw: t("compares.facebook.flaw") },
    { label: t("compares.hotline.label"), viz: "hot", time: t("compares.hotline.time"), flaw: t("compares.hotline.flaw"), hot: true },
  ];
  const FEATURES = [
    { code: "1", title: t("features.f1.title"), copy: t("features.f1.copy") },
    { code: "2", title: t("features.f2.title"), copy: t("features.f2.copy") },
    { code: "3", title: t("features.f3.title"), copy: t("features.f3.copy") },
    { code: "4", title: t("features.f4.title"), copy: t("features.f4.copy") },
    { code: "5", title: t("features.f5.title"), copy: t("features.f5.copy") },
    { code: "6", title: t("features.f6.title"), copy: t("features.f6.copy") },
  ];
  const JOIN_LIST = t("join.list", { returnObjects: true });

  const signupBase = "https://hotline.redlineusedautoparts.com/client/signup";
  const loginBase = "https://hotline.redlineusedautoparts.com/client/login";
  const referralParams = useMemo(() => {
    return new URLSearchParams(window.location.search).toString();
  }, []);
  const signupUrl = referralParams ? `${signupBase}?${referralParams}` : signupBase;
  const loginUrl = referralParams ? `${loginBase}?${referralParams}` : loginBase;
  function signupWithRoom(room) {
    const p = new URLSearchParams(referralParams);
    p.set('room', room);
    return `${signupBase}?${p.toString()}`;
  }

  const [sent, setSent] = useState(false);

  /* hero audio — real broadcasts with live reply captions */
  const heroAudioRef = useRef(null);
  const heroClipIdx = useRef(0);
  const heroTimers = useRef([]);
  const [heroAudioState, setHeroAudioState] = useState("idle");
  const [heroClipInfo, setHeroClipInfo] = useState(null);
  const [heroReplies, setHeroReplies] = useState([]);

  const clearHeroTimers = () => {
    heroTimers.current.forEach(clearTimeout);
    heroTimers.current = [];
  };

  const playHeroBroadcast = () => {
    const audio = heroAudioRef.current;
    if (!audio) return;

    if (heroAudioState === "playing") {
      audio.pause();
      clearHeroTimers();
      setHeroAudioState("idle");
      setHeroClipInfo(null);
      setHeroReplies([]);
      return;
    }

    const idx = heroClipIdx.current % HERO_CLIPS.length;
    const clip = HERO_CLIPS[idx];
    heroClipIdx.current = idx + 1;

    audio.src = clip.file;
    setHeroAudioState("playing");
    setHeroClipInfo(clip);
    setHeroReplies([]);
    clearHeroTimers();

    audio.play().then(() => {
      if (clip.responses) {
        clip.responses.forEach((r) => {
          const timer = setTimeout(() => {
            setHeroReplies((rs) => [...rs, r]);
          }, r.at * 1000);
          heroTimers.current.push(timer);
        });
      }
    }).catch(() => {});
  }

  useEffect(() => {
    const audio = heroAudioRef.current;
    if (!audio) return;
    const onEnd = () => {
      clearHeroTimers();
      setHeroAudioState("idle");
      setHeroClipInfo(null);
      setHeroReplies([]);
    };
    audio.addEventListener("ended", onEnd);
    return () => audio.removeEventListener("ended", onEnd);
  }, []);

  /* clear any pending demo timers on unmount */
  useEffect(() => {
    return () => {
      clearHeroTimers();
    };
  }, []);

  /* scroll reveal — re-runs on language change so remounted elements get re-observed */
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll(".l2-reveal") ?? [];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("l2-in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [i18n.language]);

  /* scroll progress wire */
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const d = document.documentElement;
        const max = d.scrollHeight - window.innerHeight;
        const k = max > 0 ? Math.min(d.scrollTop / max, 1) : 0;
        if (wireRef.current) wireRef.current.style.height = `${k * 100}%`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  function confettiBurst() {
    const host = formRef.current;
    if (!host) return;
    const colors = ["#d92d20", "#12b76a", "#f79009", "#16181d"];
    for (let i = 0; i < 28; i++) {
      const s = document.createElement("span");
      s.className = "l2-confetti";
      s.style.setProperty("--dx", `${(Math.random() - 0.5) * 360}px`);
      s.style.setProperty("--dy", `${-40 - Math.random() * 260}px`);
      s.style.setProperty("--rot", `${(Math.random() - 0.5) * 540}deg`);
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = `${Math.random() * 0.12}s`;
      host.appendChild(s);
      setTimeout(() => s.remove(), 1400);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const businessName = (fd.get("businessName") || "").trim();
    const phone = (fd.get("phone") || "").trim();
    const region = (fd.get("region") || "").trim();

    setSent(true);
    confettiBurst();
    toast.success(t("toast.requestReceived"));

    try {
      const payload = JSON.stringify({
        email: `${businessName} — ${region}`,
        feature: "get-listed",
        name: region,
        businessName,
        phone,
      });
      navigator.sendBeacon(
        "https://script.google.com/macros/s/AKfycbwX_nAG62h6qlqF1bD9QjxDGPuOmp9ruGAPwhNq6ZRLj0NYVxKEwzdnN3io8nLsEmoS/exec",
        new Blob([payload], { type: "text/plain" })
      );
    } catch (_) {}
  }


  return (
    <div className="l2" ref={rootRef}>
      <style>{SITE_CSS}</style>
      <style>{CSS}</style>
      <Seo
        title={t("seo.title")}
        description={t("seo.description")}
        keywords={t("seo.keywords")}
        canonicalUrl="https://hotline.redlineusedautoparts.com/"
        path="/"
        jsonLd={landingJsonLd()}
      />

      {/* scroll progress wire */}
      <div className="l2-wire" aria-hidden="true">
        <div className="l2-wire-fill" ref={wireRef} />
      </div>

      {/* ───────────────── nav ───────────────── */}
      <header className="l2-nav">
        <a className="l2-logo" href="#top">
          <HQLogo />
        </a>
        <nav className="l2-nav-links">
          <a href="#how">{t("common:nav.howItWorks")}</a>
          <a href="#try">{t("common:nav.tryIt")}</a>
          <a href="#rooms">{t("common:nav.coverage")}</a>
          <a href="./own-a-hotline">{t("common:nav.ownHotline")}</a>
          <a href={loginUrl} className="l2-nav-login">{t("common:nav.login")}</a>
          <a href={signupUrl} className="l2-nav-cta">
            {t("common:nav.signUpFree")}
          </a>
          <LanguageSwitcher />
        </nav>
      </header>

      {/* ───────────────── hero ───────────────── */}
      <section className="l2-hero" id="top">
        <div className="l2-hero-scrim" aria-hidden="true" />

        <div className="l2-stage-chip l2-stage-tl">
          <span className="l2-live-dot" /> {t("hero.chip")}
        </div>

        <div className="l2-hero-copy">
          <p className="l2-eyebrow">{t("hero.eyebrow")}</p>
          <h1 dangerouslySetInnerHTML={{ __html: t("hero.heading") }} />
          <p className="l2-sub">{t("hero.subheading")}</p>
          <div className="l2-hero-ctas">
            <a className="l2-btn l2-btn-hot" href={signupUrl}>
              {t("common:nav.signUpFree")}
            </a>
            <a className="l2-btn l2-btn-ghost" href={loginUrl}>
              {t("common:nav.login")}
            </a>
          </div>

          <audio ref={heroAudioRef} preload="none" />
          <button
            type="button"
            className={`l2-listen-btn ${heroAudioState === "playing" ? "on" : ""}`}
            onClick={playHeroBroadcast}
          >
            <span className="l2-listen-icon">
              {heroAudioState === "playing" ? (
                <span className="l2-listen-eq"><span /><span /><span /><span /><span /></span>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </span>
            <span className="l2-listen-text">
              {heroAudioState === "playing" ? (
                <>
                  <strong>{t("hero.listenNowPlaying")}</strong>
                  <span>{heroClipInfo?.part}</span>
                </>
              ) : (
                <>
                  <strong>{t("hero.listenCta")}</strong>
                  <span>{t("hero.listenSub")}</span>
                </>
              )}
            </span>
          </button>

          {heroAudioState === "playing" && heroReplies.length > 0 && (
            <div className="l2-hero-replies" aria-live="polite">
              {heroReplies.map((r, i) => (
                <span className="l2-hero-reply" key={i}>
                  <strong>{r.yard}</strong> · {r.city} — “{r.reply}”
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="l2-stats">
          <Stat to={500} suffix="+" label={t("stats.memberYards")} />
          <Stat to={12} label={t("stats.regionalRooms")} />
          <Stat to={2} suffix="s" label={t("stats.typicalAnswer")} />
          <Stat to={24} suffix="/7" label={t("stats.lineMonitoring")} />
        </div>
      </section>

      {/* ───────────────── ticker ───────────────── */}
      <div className="l2-ticker" aria-hidden="true">
        <div className="l2-ticker-track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span className="l2-tick" key={i}>
              <span className="l2-tick-time">{t[0]}</span>
              <span className="l2-tick-room">{t[1]}</span>
              <span className="l2-tick-part">{t[2]}</span>
              <span className={`l2-tick-status ${t[3].startsWith("Answered") ? "ok" : "esc"}`}>
                {t[3]}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ───────────────── listen live ───────────────── */}
      <ListenLive signupUrl={signupUrl} steps={STEPS} footnote={t("how.footnote")} />

      {/* ───────────────── problem ───────────────── */}
      <section className="l2-section l2-band">
        <div className="l2-section-head l2-reveal">
          <p className="l2-kicker">{t("problem.kicker")}</p>
          <h2>{t("problem.heading")}</h2>
          <p className="l2-lede l2-lede-wide l2-two-sec" dangerouslySetInnerHTML={{ __html: t("problem.networkAvg") }} />
        </div>
        <div className="l2-compare">
          {COMPARES.map((c, i) => (
            <div
              className={`l2-compare-card l2-reveal ${c.hot ? "hot" : ""}`}
              key={c.viz}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <p className="l2-compare-label">{c.label}</p>
              <div className={`l2-compare-time ${c.hot ? "good" : ""}`}>
                <span>{t("problem.avgResponse")}</span>
                <strong>{c.time}</strong>
              </div>
              <p className="l2-compare-copy">{c.flaw}</p>
              {c.hot && <span className="l2-compare-badge">{t("problem.compareBadge")}</span>}
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── mid-page CTA ───────────────── */}
      <section className="l2-mid-cta-band" id="get-started">
        <div className="l2-mid-cta-inner l2-reveal">
          <h2>{t("midCta.heading")}</h2>
          <p>{t("midCta.subheading")}</p>
          <div style={{display:'flex',gap:'14px',justifyContent:'center',marginBottom:'28px',flexWrap:'wrap'}}>
            <a className="l2-btn l2-btn-hot" href={signupUrl} style={{background:'#fff',color:'var(--red)',boxShadow:'0 8px 24px -8px rgba(0,0,0,0.2)',fontSize:'15.5px',padding:'14px 32px'}}>{t("common:nav.signUpFree")}</a>
            <a className="l2-btn l2-btn-ghost" href={loginUrl} style={{border:'2px solid rgba(255,255,255,0.4)',color:'#fff',background:'transparent',fontSize:'15.5px',padding:'14px 32px'}}>{t("common:nav.login")}</a>
          </div>
        </div>
      </section>

      {/* ───────────────── rooms ───────────────── */}
      <section className="l2-section" id="rooms">
        <div className="l2-section-head l2-reveal">
          <p className="l2-kicker">{t("rooms.kicker")}</p>
          <h2>{t("rooms.heading")}</h2>
          <p className="l2-lede">{t("rooms.subheading")}</p>
        </div>
        <div className="l2-rooms">
          {HUBS.map((h, i) => (
            <a className="l2-room l2-reveal" key={h.name} style={{ transitionDelay: `${i * 40}ms` }}
              href={signupWithRoom(h.name.charAt(0) + h.name.slice(1).toLowerCase())}>
              <span className="l2-room-code">RM-{String(i + 1).padStart(2, "0")}</span>
              <span className="l2-room-name">{h.name.charAt(0) + h.name.slice(1).toLowerCase()}</span>
              <span className="l2-room-live">{t("rooms.live")}</span>
            </a>
          ))}
        </div>
        <div className="l2-reveal" style={{textAlign:'center',marginTop:'40px'}}>
          <a className="l2-btn l2-btn-hot" href={signupUrl}>{t("rooms.signupPickRoom")}</a>
        </div>
      </section>

      {/* ───────────────── system ───────────────── */}
      <section className="l2-section l2-band" id="system">
        <div className="l2-section-head l2-center l2-reveal">
          <p className="l2-kicker">{t("system.kicker")}</p>
          <h2>{t("system.heading")}</h2>
          <p className="l2-lede">{t("system.subheading")}</p>
        </div>
        <div className="l2-features">
          {FEATURES.map((f, i) => (
            <div className="l2-feature l2-reveal" key={f.code} style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="l2-feature-code">{f.code}</span>
              <h3>{f.title}</h3>
              <p>{f.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── join ───────────────── */}
      <section className="l2-join" id="join">
        <div className="l2-join-inner">
          <div className="l2-reveal">
            <p className="l2-kicker l2-kicker-light">{t("join.kicker")}</p>
            <h2>{t("join.heading")}</h2>
            <ul className="l2-join-list">
              {JOIN_LIST.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div className="l2-form l2-reveal" style={{textAlign:'center'}}>
            <p className="l2-form-title">{t("join.formTitle")}</p>
            <a className="l2-btn l2-btn-hot" href={signupUrl} style={{width:'100%',display:'block',textAlign:'center',marginBottom:'14px'}}>
              {t("common:nav.signUpFree")}
            </a>
            <p style={{color:'rgba(255,255,255,0.6)',fontSize:'14px',marginBottom:'14px'}}>
              {t("join.alreadyHaveAccount")} <a href={loginUrl} style={{color:'#fff',fontWeight:600,textDecoration:'underline'}}>{t("common:nav.login")}</a>
            </p>
            <p className="l2-form-fine">
              {t("join.noCreditCard")}
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────── footer ───────────────── */}
      <SiteFooter />

      {/* sticky mobile CTA */}
      <a className="l2-sticky-cta" href={signupUrl}>
        {t("common:nav.signUpFree")}
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles — scoped under .l2 (light B2B theme)                        */
/* ------------------------------------------------------------------ */

const CSS = `


.l2 {
  --bg: #fbfaf8;
  --surface: #ffffff;
  --band: #f4f2ee;
  --ink: #16181d;
  --muted: #5d6370;
  --line: #e7e4dd;
  --red: #d92d20;
  --red-deep: #b42318;
  --red-soft: #fef3f2;
  --green: #12b76a;
  --amber: #b45309;
  --display: "Bricolage Grotesque", "Georgia", sans-serif;
  --body: "Instrument Sans", sans-serif;
  --mono: "IBM Plex Mono", monospace;
  --radius: 14px;
  --shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);

  background: var(--bg);
  color: var(--ink);
  font-family: var(--body);
  min-height: 100vh;
  overflow-x: hidden;
}
.l2 *, .l2 *::before, .l2 *::after { box-sizing: border-box; }
.l2 a { text-decoration: none; color: inherit; }
.l2 h1, .l2 h2, .l2 h3 {
  font-family: var(--display);
  line-height: 1.04;
  margin: 0;
  letter-spacing: -0.015em;
}

/* scroll wire */
.l2-wire {
  position: fixed; left: 16px; top: 0; bottom: 0; width: 2px;
  background: var(--line); z-index: 60;
}
.l2-wire-fill {
  position: absolute; top: 0; left: 0; width: 100%; height: 0%;
  background: linear-gradient(var(--red-deep), var(--red));
}
.l2-wire-fill::after {
  content: ""; position: absolute; bottom: -11px; left: -10px;
  width: 22px; height: 22px;
  background-color: var(--bg);
  border-radius: 50%;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d92d20'%3E%3Cpath d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'/%3E%3C/svg%3E");
  background-size: 16px 16px;
  background-position: center;
  background-repeat: no-repeat;
  transform: rotate(90deg);
  filter: drop-shadow(0 0 6px rgba(217,45,32,0.55));
}
@media (max-width: 1100px) { .l2-wire { display: none; } }

/* nav */
.l2-nav {
  position: fixed; inset: 0 0 auto 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 32px;
  background: rgba(251,250,248,0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.l2-logo { display: inline-flex; align-items: center; }
.l2-nav-links { display: flex; gap: 26px; align-items: center; font-size: 14.5px; font-weight: 500; }
.l2-nav-links a { color: var(--muted); transition: color .2s; }
.l2-nav-links a:hover { color: var(--ink); }
.l2-nav-login {
  color: var(--ink) !important;
  font-weight: 600;
  padding: 9px 16px; border-radius: 9px;
  transition: background .2s;
}
.l2-nav-login:hover { background: rgba(0,0,0,0.04); }
.l2-nav-cta {
  color: #fff !important;
  background: var(--red);
  padding: 9px 18px; border-radius: 9px;
  transition: background .2s;
}
.l2-nav-cta:hover { background: var(--red-deep); }
@media (max-width: 860px) { .l2-nav-links a:not(.l2-nav-cta):not(.l2-nav-login) { display: none; } }

/* hero */
.l2-hero {
  position: relative;
  min-height: 100vh;
  padding: 160px 32px 0;
  display: flex; flex-direction: column; justify-content: space-between;
  overflow: hidden;
}
.l2-hero-scrim {
  position: absolute; inset: 0; pointer-events: none;
  background-image:
    radial-gradient(ellipse 62% 46% at 50% 30%, rgba(251,250,248,0.94) 36%, rgba(251,250,248,0.55) 68%, transparent 100%),
    radial-gradient(ellipse 55% 40% at 50% 42%, rgba(217,45,32,0.05), transparent 70%),
    radial-gradient(#dcd7cc 1px, transparent 1.4px);
  background-size: 100% 100%, 100% 100%, 26px 26px;
}
.l2-hero-copy { position: relative; z-index: 2; max-width: 800px; margin: 0 auto; text-align: center; pointer-events: none; }
.l2-hero-copy a, .l2-hero-copy button { pointer-events: auto; }
.l2-eyebrow {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--red); margin: 0 0 22px;
}
.l2-hero-copy h1 { font-size: clamp(42px, 6vw, 76px); font-weight: 700; }
.l2-hero-copy h1 em {
  font-style: normal; color: var(--red);
  background: linear-gradient(transparent 68%, var(--red-soft) 68%);
}
.l2-sub { max-width: 600px; margin: 24px auto 34px; color: var(--ink); font-size: 18.5px; font-weight: 600; line-height: 1.65; }
.l2-hero-ctas { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.l2-btn {
  font-family: var(--body); font-weight: 600; font-size: 15.5px;
  padding: 14px 28px; border-radius: 11px; border: 1px solid transparent;
  cursor: pointer; display: inline-block;
  transition: transform .15s, background .2s, box-shadow .2s, border-color .2s;
}
.l2-btn:active { transform: translateY(1px); }
.l2 .l2-btn-hot {
  background: var(--red); color: #fff;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5);
}
.l2 .l2-btn-hot:hover { background: var(--red-deep); box-shadow: 0 10px 30px -8px rgba(217,45,32,0.6); }
.l2-btn-ghost { background: var(--surface); border-color: var(--line); color: var(--ink); }
.l2-btn-ghost:hover { border-color: #c9c4ba; }

/* hero overlay chips */
.l2-stage-chip {
  position: absolute; z-index: 3;
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted);
  background: rgba(255,255,255,0.85); backdrop-filter: blur(6px);
  border: 1px solid var(--line); border-radius: 999px;
  padding: 7px 14px;
  pointer-events: none;
}
.l2-stage-tl { top: 86px; left: 24px; }
@keyframes l2chip-pop { 0% { transform: scale(1.1); } 100% { transform: scale(1); } }
@media (max-width: 760px) { .l2-stage-tl { display: none; } }
.l2-live-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--red);
  box-shadow: 0 0 0 3px rgba(217,45,32,0.15);
  animation: l2pulse 1.6s infinite;
}
@keyframes l2pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

/* hero listen button */
.l2-listen-btn {
  display: inline-flex; align-items: center; gap: 14px;
  margin-top: 28px;
  padding: 12px 24px 12px 16px;
  background: rgba(22,24,29,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px; cursor: pointer;
  pointer-events: auto;
  transition: background .2s, border-color .2s, transform .2s;
}
.l2-listen-btn:hover { background: rgba(22,24,29,0.95); border-color: rgba(217,45,32,0.5); transform: translateY(-2px); }
.l2-listen-btn:active { transform: translateY(0); }
.l2-listen-btn.on { border-color: var(--red); background: rgba(217,45,32,0.15); }
.l2-listen-icon {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--red);
  display: flex; align-items: center; justify-content: center;
  color: #fff; flex-shrink: 0;
  box-shadow: 0 0 0 4px rgba(217,45,32,0.2);
  position: relative;
}
.l2-listen-btn:not(.on) .l2-listen-icon::before {
  content: ""; position: absolute; inset: 0; border-radius: 50%;
  border: 1.5px solid rgba(217,45,32,0.6);
  animation: l2-pill-ring 2.4s cubic-bezier(.2,.6,.25,1) infinite;
}
.l2-listen-text {
  display: flex; flex-direction: column; gap: 2px; text-align: left;
}
.l2-listen-text strong { font-family: var(--body); font-size: 15px; font-weight: 700; color: #fff; }
.l2-listen-text span {
  font-family: var(--mono); font-size: 11.5px; color: rgba(255,255,255,0.55);
  letter-spacing: 0.02em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;
}

/* EQ bars inside listen button */
.l2-listen-eq {
  display: flex; align-items: flex-end; gap: 2.5px; height: 20px;
}
.l2-listen-eq span {
  width: 3px; border-radius: 1.5px; background: #fff;
  animation: l2eq 0.8s ease-in-out infinite alternate;
}
.l2-listen-eq span:nth-child(1) { height: 6px; animation-delay: 0s; }
.l2-listen-eq span:nth-child(2) { height: 14px; animation-delay: 0.15s; }
.l2-listen-eq span:nth-child(3) { height: 20px; animation-delay: 0.3s; }
.l2-listen-eq span:nth-child(4) { height: 10px; animation-delay: 0.45s; }
.l2-listen-eq span:nth-child(5) { height: 16px; animation-delay: 0.6s; }

/* replies that appear while a hero broadcast clip plays */
.l2-hero-replies {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  margin-top: 14px; pointer-events: none;
}
.l2-hero-reply {
  font-family: var(--mono); font-size: 12px; color: var(--ink);
  background: #fff; border: 1px solid rgba(18,183,106,0.5);
  border-radius: 999px; padding: 6px 14px;
  animation: l2chip-pop .3s ease;
}
.l2-hero-reply strong { color: var(--green); font-weight: 700; }
@keyframes l2eq {
  0% { height: 4px; }
  100% { height: 20px; }
}

/* stats */
.l2-stats {
  position: relative; z-index: 2;
  display: flex; justify-content: center; gap: clamp(36px, 7vw, 96px);
  flex-wrap: wrap; padding: 44px 0 48px;
  pointer-events: none;
}
.l2-stats div { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.l2-stats strong { font-family: var(--display); font-size: 40px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.l2-stats span { font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }

/* ticker */
.l2-ticker {
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  background: var(--surface); overflow: hidden; padding: 13px 0;
}
.l2-ticker-track { display: inline-flex; gap: 56px; white-space: nowrap; animation: l2marquee 48s linear infinite; }
.l2-ticker:hover .l2-ticker-track { animation-play-state: paused; }
@keyframes l2marquee { to { transform: translateX(-50%); } }
.l2-tick { font-family: var(--mono); font-size: 12px; letter-spacing: 0.02em; display: inline-flex; gap: 14px; }
.l2-tick-time { color: #a3a094; }
.l2-tick-room { color: var(--red); font-weight: 600; }
.l2-tick-part { color: var(--ink); }
.l2-tick-status.ok { color: var(--amber); }
.l2-tick-status.esc { color: #a3a094; }

/* sections */
.l2-section { padding: 110px 32px; max-width: 1280px; margin: 0 auto; }
.l2-band {
  max-width: none;
  background: var(--band);
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
}
.l2-band > * { max-width: 1216px; margin-left: auto; margin-right: auto; }
.l2-kicker {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--red); margin: 0 0 16px;
}
.l2-section-head h2 { font-size: clamp(32px, 4.2vw, 54px); font-weight: 700; }
.l2-lede { color: var(--muted); max-width: 600px; font-size: 17px; line-height: 1.65; margin-top: 18px; }
.l2-lede-wide { max-width: 920px; }
.l2-two-sec { font-size: 22px; }
.l2-two-sec strong {
  font-family: var(--display); font-size: clamp(36px, 4.5vw, 56px);
  font-weight: 800; color: var(--red); display: block; margin-top: 6px;
  line-height: 1.1;
}
.l2-section-head { margin-bottom: 56px; }
.l2-center { text-align: center; }
.l2-center .l2-lede { margin-left: auto; margin-right: auto; }

/* video */
.l2-video-section { padding-top: 128px; }
.l2-video-section .l2-section-head { margin-bottom: 68px; }
.l2-video-section .l2-kicker { font-size: 13px; }
.l2-video-section .l2-section-head h2 {
  font-size: clamp(44px, 5.4vw, 76px);
  line-height: 0.98;
}
.l2-video-section .l2-lede {
  max-width: 820px;
  font-size: clamp(21px, 2.1vw, 28px);
  line-height: 1.55;
}
.l2-video-frame {
  position: relative; max-width: 1120px; margin: 0 auto;
  border-radius: 22px; overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: 0 2px 4px rgba(22,24,29,0.05), 0 36px 80px -24px rgba(22,24,29,0.34);
  background: #0e0f12;
}
.l2-video-frame video { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.l2-video-overlay {
  position: absolute; inset: 0; border: 0; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: linear-gradient(rgba(14,15,18,0.18), rgba(14,15,18,0.5));
  transition: background .25s;
}
.l2-video-overlay:hover { background: linear-gradient(rgba(14,15,18,0.06), rgba(14,15,18,0.42)); }
.l2-play-btn {
  position: relative;
  width: 112px; height: 112px; border-radius: 50%;
  background: var(--red);
  display: block;
  box-shadow: 0 16px 46px -8px rgba(217,45,32,0.7), 0 0 0 14px rgba(255,255,255,0.14);
  transition: transform .2s;
}
.l2-play-btn::before {
  content: "";
  position: absolute;
  left: 44px; top: 34px;
  width: 0; height: 0;
  border-top: 22px solid transparent;
  border-bottom: 22px solid transparent;
  border-left: 30px solid #fff;
}
.l2-video-overlay:hover .l2-play-btn { transform: scale(1.07); }
.l2-play-label {
  font-family: var(--mono); font-size: 15px; letter-spacing: 0.1em;
  text-transform: uppercase; color: #fff;
  background: rgba(14,15,18,0.62); padding: 10px 20px; border-radius: 999px;
}

/* compare cards */
.l2-compare { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 18px; }
.l2-compare-card {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 28px 26px 34px; position: relative; box-shadow: var(--shadow);
}
.l2-compare-card.hot { border-color: rgba(217,45,32,0.35); background: linear-gradient(170deg, var(--red-soft), #fff 55%); }
.l2-compare-time {
  display: flex; align-items: baseline; gap: 10px;
  margin: 0 0 14px; padding-bottom: 14px;
  border-bottom: 1px dashed var(--line);
}
.l2-compare-time span {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
  text-transform: uppercase; color: #a3a094;
}
.l2-compare-time strong {
  font-family: var(--display); font-size: 24px; font-weight: 700;
  color: var(--red-deep); line-height: 1;
}
.l2-compare-time.good strong { color: var(--green); font-size: 28px; }
.l2-compare-label { font-family: var(--mono); font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); margin: 0 0 14px; }
.l2-compare-card.hot .l2-compare-label { color: var(--red); }
.l2-compare-copy { color: var(--ink); opacity: .82; font-size: 15px; line-height: 1.6; margin: 0; }
.l2-compare-badge {
  position: absolute; top: -12px; right: 16px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase;
  color: #fff; background: var(--red); border-radius: 999px; padding: 5px 12px;
  box-shadow: 0 6px 16px -4px rgba(217,45,32,0.5);
}

/* steps */
.l2-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 22px; }
.l2-step {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 30px 28px 34px; box-shadow: var(--shadow);
}
.l2-step-n {
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--red-soft); color: var(--red);
  font-family: var(--display); font-weight: 700; font-size: 22px;
  display: flex; align-items: center; justify-content: center; margin-bottom: 20px;
}
.l2-step h3 { font-size: 22px; font-weight: 700; margin-bottom: 10px; }
.l2-step p { color: var(--muted); font-size: 15px; line-height: 1.65; margin: 0; }
.l2-footnote {
  margin: 52px auto 0; max-width: 820px;
  font-size: 16px; font-weight: 600; color: #fff; line-height: 1.7; text-align: center;
  background: var(--red); border: 1px solid var(--red-deep); border-radius: 12px;
  padding: 18px 26px;
  box-shadow: 0 12px 32px -10px rgba(217,45,32,0.45);
}

/* playable demo */
.l2-demo {
  display: grid; grid-template-columns: 0.85fr 1.35fr; gap: 26px; align-items: stretch;
}
@media (max-width: 900px) { .l2-demo { grid-template-columns: 1fr; } }
.l2-demo-panel {
  background: var(--surface); border: 1px solid var(--line); border-radius: 18px;
  padding: 30px 28px; box-shadow: var(--shadow);
  display: flex; flex-direction: column; gap: 18px;
}
.l2-demo-label {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--muted); margin: 0;
}
.l2-part-picker {
  display: flex; align-items: stretch; gap: 10px;
}
.l2-part-picker > button {
  width: 46px; border: 1px solid var(--line); border-radius: 12px;
  background: var(--bg); color: var(--ink); font-size: 24px; cursor: pointer;
  transition: border-color .2s, background .2s;
}
.l2-part-picker > button:hover:not(:disabled) { border-color: var(--red); color: var(--red); }
.l2-part-picker > button:disabled { opacity: 0.4; cursor: default; }
.l2-part-display {
  flex: 1; border: 1px solid var(--line); border-radius: 12px; background: var(--bg);
  padding: 14px 18px; display: flex; flex-direction: column; gap: 3px; min-width: 0;
}
.l2-part-line { font-family: var(--mono); font-size: 13px; color: var(--muted); letter-spacing: 0.02em; }
.l2-part-name { font-family: var(--display); font-weight: 700; font-size: 22px; color: var(--red); }
.l2-broadcast-btn {
  font-family: var(--body); font-weight: 700; font-size: 17px; letter-spacing: 0.01em;
  text-transform: uppercase;
  padding: 18px; border: 0; border-radius: 13px; cursor: pointer;
  background: var(--red); color: #fff;
  box-shadow: 0 10px 30px -8px rgba(217,45,32,0.55);
  transition: background .2s, transform .15s;
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
}
.l2-broadcast-btn:hover:not(:disabled) { background: var(--red-deep); }
.l2-broadcast-btn:active:not(:disabled) { transform: translateY(1px); }
.l2-broadcast-btn.onair { background: #16181d; cursor: default; }
.l2-onair-dot {
  width: 10px; height: 10px; border-radius: 50%; background: #f04438;
  animation: l2pulse 0.9s infinite;
}
.l2-scoreboard {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.l2-scoreboard div {
  background: var(--bg); border: 1px solid var(--line); border-radius: 12px;
  padding: 14px 16px; display: flex; flex-direction: column; gap: 2px;
}
.l2-scoreboard strong {
  font-family: var(--display); font-size: 30px; font-weight: 700;
  color: var(--green); font-variant-numeric: tabular-nums;
}
.l2-scoreboard span {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--muted);
}
.l2-demo-fine { font-size: 12.5px; color: var(--muted); margin: 0; }
.l2-demo-stage {
  position: relative; min-height: 460px;
  border: 1px solid var(--line); border-radius: 18px; overflow: hidden;
  background:
    radial-gradient(ellipse 70% 60% at 50% 45%, #ffffff 0%, transparent 75%),
    linear-gradient(#fdfcfb, #f3f1ec);
  box-shadow: var(--shadow);
}
.l2-demo-board {
  position: absolute; inset: 0;
  padding: 58px 18px 18px;
  display: flex; flex-direction: column; gap: 12px;
}
.l2-demo-yard {
  background: #fff; border: 1px solid var(--line); border-radius: 12px;
  padding: 12px 14px;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  transition: border-color .25s, background .25s, box-shadow .25s;
}
.l2-demo-yard.you { border-color: rgba(217,45,32,0.35); }
.l2-demo-yard.you.onair {
  border-color: var(--red);
  box-shadow: 0 0 0 3px rgba(217,45,32,0.14);
}
.l2-demo-yard.hot { border-color: rgba(18,183,106,0.55); }
.l2-demo-yard.hot .l2-demo-yard-status { color: var(--green); }
.l2-demo-yard.won { background: rgba(18,183,106,0.08); border-color: var(--green); }
.l2-demo-yard-name { font-family: var(--display); font-weight: 700; font-size: 14.5px; }
.l2-demo-yard-status {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted);
  white-space: nowrap;
}
.l2-demo-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  flex: 1; align-content: start;
}
@media (max-width: 480px) { .l2-demo-grid { grid-template-columns: 1fr; } }
.l2-demo-chip { top: 14px; left: 14px; }
@media (max-width: 760px) { .l2-demo-chip { display: inline-flex; } }

/* rooms */
.l2-rooms { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
.l2-room {
  background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
  padding: 18px; display: flex; flex-direction: column; gap: 8px;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.l2-room { cursor: pointer; text-decoration: none; color: inherit; }
.l2-room:hover { border-color: rgba(217,45,32,0.4); transform: translateY(-2px); box-shadow: var(--shadow); }
.l2-room-code { font-family: var(--mono); font-size: 10px; letter-spacing: 0.16em; color: #a3a094; }
.l2-room-name { font-family: var(--display); font-weight: 700; font-size: 19px; }
.l2-room-live { font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--red); }

/* features */
.l2-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
@media (max-width: 1000px) { .l2-features { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .l2-features { grid-template-columns: 1fr; } }
.l2-feature {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 28px 26px 32px; box-shadow: var(--shadow);
  transition: transform .2s, border-color .2s;
}
.l2-feature { cursor: default; }
.l2-feature:hover { border-color: rgba(217,45,32,0.15); }
.l2-feature-code {
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--red-soft); color: var(--red);
  font-family: var(--display); font-weight: 700; font-size: 22px;
  display: flex; align-items: center; justify-content: center;
}
.l2-feature h3 { font-size: 20px; font-weight: 700; margin: 18px 0 9px; }
.l2-feature p { color: var(--muted); font-size: 14.5px; line-height: 1.62; margin: 0; }

/* own the hotline */
.l2-own { max-width: 860px; }
.l2-own-list { list-style: none; padding: 0; margin: 26px 0 30px; display: flex; flex-direction: column; gap: 12px; }
.l2-own-list li { color: var(--muted); font-size: 15.5px; line-height: 1.6; padding-left: 26px; position: relative; }
.l2-own-list li::before { content: "▸"; position: absolute; left: 0; color: var(--red); }

/* join */
.l2-join {
  background:
    radial-gradient(ellipse 70% 90% at 80% 0%, rgba(217,45,32,0.12), transparent 60%),
    #16181d;
  color: #f4f2ee; position: relative; overflow: hidden;
}
.l2-join-inner {
  position: relative; z-index: 1;
  max-width: 1280px; margin: 0 auto; padding: 110px 32px;
  display: grid; grid-template-columns: 1.15fr 1fr; gap: 72px; align-items: start;
}
@media (max-width: 900px) { .l2-join-inner { grid-template-columns: 1fr; } }
.l2-join h2 { font-size: clamp(32px, 4vw, 52px); font-weight: 700; color: #fff; }
.l2-kicker-light { color: #ff6f61; }
.l2-join-list { list-style: none; padding: 0; margin: 32px 0 0; display: flex; flex-direction: column; gap: 14px; }
.l2-join-list li { color: #b9bcc4; font-size: 16px; padding-left: 28px; position: relative; line-height: 1.55; }
.l2-join-list li::before {
  content: "✓"; position: absolute; left: 0; color: #ff6f61; font-weight: 700;
}
.l2-form { background: #fff; color: var(--ink); border-radius: 18px; padding: 36px 32px 30px; box-shadow: 0 30px 80px -20px rgba(0,0,0,0.5); position: relative; }
.l2-form-title { font-family: var(--display); font-weight: 700; font-size: 24px; margin: 0 0 24px; }
.l2-form label { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; font-size: 13px; font-weight: 600; color: var(--muted); }
.l2-form input {
  background: var(--bg); border: 1px solid var(--line); border-radius: 10px; color: var(--ink);
  font-family: var(--body); font-size: 15px; padding: 12px 14px; outline: none;
  transition: border-color .2s, box-shadow .2s;
}
.l2-form input:focus { border-color: var(--red); box-shadow: 0 0 0 3px rgba(217,45,32,0.12); }
.l2-form input::placeholder { color: #b3afa6; }
.l2-form .l2-btn { width: 100%; margin-top: 6px; }
.l2-form-fine { font-size: 12.5px; color: var(--muted); text-align: center; margin: 14px 0 0; }
.l2-form-done { font-size: 15px; color: var(--ink); line-height: 1.7; margin: 0; }

/* confetti */
.l2-confetti {
  position: absolute; top: 50%; left: 50%;
  width: 8px; height: 12px; border-radius: 2px; pointer-events: none; z-index: 5;
  animation: l2confetti 1.15s ease-out forwards;
}
@keyframes l2confetti {
  0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot)); }
}

/* mid-page CTA band */
.l2-mid-cta-band {
  background: var(--red);
  padding: 80px 32px;
  text-align: center;
}
.l2-mid-cta-inner {
  max-width: 820px; margin: 0 auto;
}
.l2-mid-cta-band h2 {
  font-family: var(--display); font-weight: 700;
  font-size: clamp(30px, 4vw, 48px); color: #fff;
  line-height: 1.08; margin: 0 0 14px;
}
.l2-mid-cta-band > .l2-reveal > p { color: rgba(255,255,255,0.82); font-size: 17px; line-height: 1.6; margin: 0 0 36px; }
/* sticky mobile CTA */
.l2-sticky-cta {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 55;
  background: var(--red); color: #fff;
  font-family: var(--body); font-weight: 700; font-size: 16px; letter-spacing: 0.02em;
  text-transform: uppercase; text-align: center;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -4px 20px rgba(217,45,32,0.35);
  transition: background .2s;
}
.l2-sticky-cta:hover { background: var(--red-deep); }
@media (max-width: 860px) { .l2-sticky-cta { display: block; } }

/* ── mobile responsive ── */
@media (max-width: 640px) {
  .l2-nav { padding: 10px 16px; }
  .l2-nav-links { gap: 8px; }
  .l2-nav-login { padding: 8px 10px; font-size: 13px; }
  .l2-nav-cta { padding: 8px 14px; font-size: 13px; }
  .l2-hero { padding: 120px 16px 0; min-height: auto; }
  .l2-hero-scrim { display: none; }
  .l2-hero-copy { padding: 0; }
  .l2-hero-copy h1 { font-size: clamp(26px, 7vw, 38px); }
  .l2-eyebrow { font-size: 10px; letter-spacing: 0.1em; }
  .l2-sub { font-size: 14.5px; margin: 14px auto 22px; }
  .l2-hero-ctas { flex-direction: column; align-items: stretch; gap: 10px; }
  .l2-hero-ctas .l2-btn { text-align: center; padding: 14px 20px; }
  .l2-stage-chip { display: none !important; }
  .l2-listen-btn { font-size: 12px; padding: 9px 16px; }
  .l2-stats { flex-direction: row; flex-wrap: wrap; gap: 12px; padding: 20px 16px; justify-content: center; }
  .l2-stats div { min-width: 100px; }
  .l2-stats strong { font-size: 26px; }
  .l2-stats span { font-size: 9px; }
  .l2-section { padding: 48px 16px; }
  .l2-section-head { margin-bottom: 28px; }
  .l2-section-head h2 { font-size: clamp(22px, 6vw, 30px); }
  .l2-lede { font-size: 14.5px; }
  .l2-rooms { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .l2-room { padding: 14px; }
  .l2-room-name { font-size: 15px; }
  .l2-steps { gap: 12px; }
  .l2-step { padding: 18px 14px; }
  .l2-step h3 { font-size: 15px; }
  .l2-step p { font-size: 13.5px; }
  .l2-demo { gap: 14px; }
  .l2-feature { padding: 18px 14px; }
  .l2-feature h3 { font-size: 15px; }
  .l2-feature p { font-size: 13.5px; }
  .l2-mid-cta-band { padding: 40px 16px; }
  .l2-mid-cta-inner h2 { font-size: clamp(22px, 6vw, 32px); }
  .l2-mid-cta-inner p { font-size: 14px; }
  .l2-video-overlay { gap: 0; justify-content: center; align-items: center; }
  .l2-play-btn { width: 64px; height: 64px; box-shadow: 0 8px 24px -6px rgba(217,45,32,0.5), 0 0 0 7px rgba(255,255,255,0.14); }
  .l2-play-btn::before {
    left: 26px; top: 20px;
    border-top-width: 12px;
    border-bottom-width: 12px;
    border-left-width: 17px;
  }
  .l2-play-label { position: absolute; bottom: 18px; left: 0; right: 0; font-size: 11px; letter-spacing: 0.08em; }
  .l2-join-inner { padding: 40px 16px; }
  .l2-join-inner h2 { font-size: clamp(22px, 6vw, 32px); }
  .l2-join-list { font-size: 13.5px; padding-left: 18px; }
  .l2-join-list li { margin-bottom: 6px; }
  .l2-form { padding: 20px 16px; }
  .l2-own { padding: 28px 16px; }
  .l2-tick { overflow: hidden; }
  .l2-compare-cards { gap: 12px; }
  .l2-compare-card { padding: 18px 14px; }
}
@media (max-width: 400px) {
  .l2-nav-login { padding: 6px 8px; font-size: 12px; }
  .l2-nav-cta { padding: 6px 10px; font-size: 12px; }
  .l2-rooms { grid-template-columns: 1fr; }
  .l2-hero-copy h1 { font-size: 24px; }
}
@media (max-width: 320px) {
  .l2-hero { padding: 100px 12px 0; }
  .l2-hero-copy h1 { font-size: 21px; }
  .l2-eyebrow { font-size: 9px; letter-spacing: 0.08em; }
  .l2-sub { font-size: 13px; margin: 10px auto 18px; }
  .l2-hero-ctas .l2-btn { font-size: 14px; padding: 12px 16px; }
  .l2-listen-btn { padding: 8px 12px; gap: 10px; }
  .l2-listen-icon { width: 36px; height: 36px; }
  .l2-listen-icon svg { width: 16px; height: 16px; }
  .l2-listen-text strong { font-size: 13px; }
  .l2-listen-text span { font-size: 10px; max-width: 160px; }
  .l2-stats strong { font-size: 22px; }
  .l2-stats div { min-width: 80px; }
  .l2-section { padding: 36px 12px; }
  .l2-section-head h2 { font-size: 20px; }
  .l2-lede { font-size: 13px; }
  .l2-step { padding: 14px 12px; }
  .l2-step-n { width: 36px; height: 36px; font-size: 18px; }
  .l2-step h3 { font-size: 14px; }
  .l2-step p { font-size: 12.5px; }
  .l2-compare-card { padding: 14px 12px; }
  .l2-compare-label { font-size: 11px; }
  .l2-compare-time strong { font-size: 20px; }
  .l2-compare-copy { font-size: 13px; }
  .l2-feature { padding: 14px 12px; }
  .l2-feature h3 { font-size: 14px; }
  .l2-feature p { font-size: 12.5px; }
  .l2-mid-cta-band { padding: 32px 12px; }
  .l2-mid-cta-inner h2 { font-size: 20px; }
  .l2-join-inner { padding: 32px 12px; }
  .l2-join-inner h2 { font-size: 20px; }
  .l2-form { padding: 16px 12px; }
  .l2-form-title { font-size: 20px; }
  .l2-nav { padding: 8px 10px; }
  .l2-nav-links { gap: 6px; }
  .l2-nav-login { padding: 6px 6px; font-size: 11px; }
  .l2-nav-cta { padding: 6px 8px; font-size: 11px; }
  .l2-sticky-cta { font-size: 14px; padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px)); }
}

/* reveal */
.l2-reveal { opacity: 0; transform: translateY(24px); transition: opacity .7s ease, transform .7s ease; }
.l2-reveal.l2-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .l2-reveal { opacity: 1; transform: none; transition: none; }
  .l2-ticker-track { animation: none; }
}
`;
