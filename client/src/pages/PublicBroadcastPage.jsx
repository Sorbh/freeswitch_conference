import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HQMark } from "./landing2/site";

const PUBLIC_LOGIN_URL = "https://hotline.redlineusedautoparts.com/client/login";
const PUBLIC_SIGNUP_URL = "https://hotline.redlineusedautoparts.com/client/signup";

function formatDuration(ms) {
  if (!ms) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatTimestamp(unix) {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(unix) {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function setClarityTags(tags) {
  if (typeof window === "undefined" || typeof window.clarity !== "function") return;
  try {
    Object.entries(tags).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      window.clarity("set", key, String(value));
    });
  } catch {
    // Analytics should never affect the public page experience.
  }
}

function trackClarityEvent(name) {
  if (typeof window === "undefined" || typeof window.clarity !== "function") return;
  try {
    window.clarity("event", name);
  } catch {
    // Analytics should never affect the public page experience.
  }
}

function buildSignupUrl(roomName) {
  const incoming = new URLSearchParams(window.location.search);
  const url = new URL(PUBLIC_SIGNUP_URL);
  for (const [k, v] of incoming) {
    if (v) url.searchParams.set(k, v);
  }
  if (roomName && !incoming.has("room")) url.searchParams.set("room", roomName);
  return url.toString();
}

function AudioPlayer({ src, knownDurationMs, onPlayStart }) {
  const { t } = useTranslation("landing");
  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const animRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(knownDurationMs ? knownDurationMs / 1000 : 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveform, setWaveform] = useState(null);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    fetch(src)
      .then((r) => r.arrayBuffer())
      .then(
        (buf) =>
          new (window.AudioContext || window.webkitAudioContext)().decodeAudioData(
            buf
          )
      )
      .then((audioBuffer) => {
        if (cancelled) return;
        if (audioBuffer.duration && isFinite(audioBuffer.duration)) {
          setDuration(audioBuffer.duration);
        }
        const raw = audioBuffer.getChannelData(0);
        const n = 80;
        const blockSize = Math.floor(raw.length / n);
        const peaks = [];
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[i * blockSize + j]);
          peaks.push(sum / blockSize);
        }
        const max = Math.max(...peaks, 0.01);
        setWaveform(peaks.map((p) => Math.max(0.08, p / max)));
      })
      .catch(() => {
        if (!cancelled)
          setWaveform(
            Array.from({ length: 80 }, () => Math.random() * 0.4 + 0.1)
          );
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const getDur = useCallback(() => {
    const a = audioRef.current;
    if (a && isFinite(a.duration) && a.duration > 0) return a.duration;
    return duration || 0;
  }, [duration]);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(animRef.current);
      return;
    }
    const tick = () => {
      const a = audioRef.current;
      if (a) {
        const dur = getDur();
        if (dur > 0) {
          setProgress(a.currentTime / dur);
          setDuration(dur);
        }
        setCurrentTime(a.currentTime);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, getDur]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().catch(() => {});
      onPlayStart?.();
      setPlaying(true);
    }
  }, [onPlayStart, playing]);

  const seek = useCallback((e) => {
    const a = audioRef.current;
    const el = trackRef.current;
    const dur = getDur();
    if (!a || !el) return;
    if (!dur) { toggle(); return; }
    const r = el.getBoundingClientRect();
    a.currentTime =
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
  }, [getDur, toggle]);

  const ft = (s) => {
    if (!s || !isFinite(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="bp-player">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onLoadedMetadata={(e) => {
          if (isFinite(e.target.duration) && e.target.duration > 0) {
            setDuration(e.target.duration);
          }
        }}
        onDurationChange={(e) => {
          if (isFinite(e.target.duration) && e.target.duration > 0) {
            setDuration(e.target.duration);
          }
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }}
        onCanPlay={() => setAudioReady(true)}
      />
      <div className="bp-player-row">
        <button className="bp-play-btn" onClick={toggle} aria-label={playing ? t("publicBroadcast.pause") : t("publicBroadcast.play")} disabled={!audioReady} style={{ opacity: audioReady ? 1 : 0.5 }}>
          {!audioReady ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
            </svg>
          )}
        </button>

        <span className="bp-time bp-time-current" onClick={toggle} style={{ cursor: 'pointer' }}>{ft(currentTime)}</span>

        <div className="bp-track" ref={trackRef} onClick={seek}>
          {waveform ? (
            <div className="bp-waveform">
              {waveform.map((peak, i) => {
                const played = i / waveform.length < progress;
                return (
                  <div
                    key={i}
                    className="bp-bar"
                    style={{
                      height: `${Math.max(8, peak * 100)}%`,
                      backgroundColor: played ? "#d92d20" : "#d5d2cc",
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="bp-waveform">
              {Array.from({ length: 80 }, (_, i) => (
                <div key={i} className="bp-bar bp-shimmer" style={{ height: `${20 + (i % 5) * 12}%`, backgroundColor: '#e7e4dd' }} />
              ))}
            </div>
          )}
        </div>

        <span className="bp-time bp-time-total" onClick={toggle} style={{ cursor: 'pointer' }}>{ft(duration)}</span>
      </div>

      <span className="bp-time-combined" onClick={toggle} style={{ cursor: 'pointer' }}>{ft(currentTime)} / {ft(duration)}</span>
    </div>
  );
}

function Skeleton({ w, h, r = 8 }) {
  return (
    <div
      className="bp-shimmer"
      style={{ width: w, height: h, borderRadius: r }}
    />
  );
}

function LoadingState() {
  return (
    <div className="bp-wrap">
      <div className="bp-header">
        <Link to="/" className="bp-logo">
          <HQMark size={30} />
          <span className="bp-logo-text">
            Hotline&nbsp;<em>HQ</em>
          </span>
        </Link>
      </div>
      <main className="bp-main">
        <div className="bp-card">
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 28 }}>
            <Skeleton w={90} h={26} r={6} />
            <Skeleton w={140} h={18} />
          </div>
          <Skeleton w="60%" h={32} />
          <div style={{ marginTop: 14 }}><Skeleton w="40%" h={16} /></div>
          <div style={{ marginTop: 32 }}><Skeleton w="100%" h={64} r={12} /></div>
          <div style={{ display: "flex", gap: 16, marginTop: 28 }}>
            <Skeleton w="30%" h={60} r={10} />
            <Skeleton w="30%" h={60} r={10} />
            <Skeleton w="30%" h={60} r={10} />
          </div>
        </div>
      </main>
    </div>
  );
}

function ErrorState({ message }) {
  const { t } = useTranslation("landing");
  return (
    <div className="bp-wrap">
      <div className="bp-header">
        <Link to="/" className="bp-logo">
          <HQMark size={30} />
          <span className="bp-logo-text">
            Hotline&nbsp;<em>HQ</em>
          </span>
        </Link>
      </div>
      <main className="bp-main">
        <div className="bp-card bp-card-error">
          <div className="bp-error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d92d20" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          </div>
          <h2 className="bp-error-title">{t("publicBroadcast.errorTitle")}</h2>
          <p className="bp-error-msg">
            {message || t("publicBroadcast.errorMessage")}
          </p>
          <Link to="/" className="bp-error-link">
            {t("publicBroadcast.errorLink")}
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function PublicBroadcastPage() {
  const { t } = useTranslation("landing");
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAudioNudge, setShowAudioNudge] = useState(false);
  const audioPlayTrackedRef = useRef(false);

  useEffect(() => {
    setClarityTags({
      page_type: "public_broadcast",
      public_broadcast_token: token,
    });
    trackClarityEvent("public_broadcast_view");

    if (!token) {
      setError("Invalid link");
      setLoading(false);
      return;
    }
    fetch(`/api/v1/public/broadcast/${token}`)
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
  }, [token]);

  useEffect(() => {
    if (data) {
      document.title = t("publicBroadcast.docTitle", { name: data.display_name || t("publicBroadcast.unknown") });
      setClarityTags({
        public_broadcast_id: data.id,
        public_broadcast_room: data.room_name || "unknown",
        public_broadcast_answered: data.answered ? "yes" : "no",
        public_broadcast_has_recording: data.has_recording ? "yes" : "no",
        public_broadcast_listener_count: data.listener_count ?? 0,
      });
      trackClarityEvent("public_broadcast_loaded");
    } else {
      document.title = t("publicBroadcast.docTitleFallback");
    }
  }, [data]);

  const handleAudioPlayStart = useCallback(() => {
    if (audioPlayTrackedRef.current) return;
    audioPlayTrackedRef.current = true;
    setShowAudioNudge(true);
    setClarityTags({
      page_type: "public_broadcast",
      public_broadcast_token: token,
      public_broadcast_id: data?.id,
      public_broadcast_audio_played: "yes",
    });
    trackClarityEvent("public_broadcast_audio_play");
  }, [data?.id, token]);

  const handleSignupClick = useCallback(() => {
    setClarityTags({
      page_type: "public_broadcast",
      public_broadcast_token: token,
      public_broadcast_id: data?.id,
      public_broadcast_cta: "signup",
    });
    trackClarityEvent("public_broadcast_signup_click");
  }, [data?.id, token]);

  const handleLoginClick = useCallback(() => {
    setClarityTags({
      page_type: "public_broadcast",
      public_broadcast_token: token,
      public_broadcast_id: data?.id,
      public_broadcast_cta: "login",
    });
    trackClarityEvent("public_broadcast_login_click");
  }, [data?.id, token]);

  const signupUrl = buildSignupUrl(data?.room_name);

  const content = loading ? (
    <LoadingState />
  ) : error ? (
    <ErrorState />
  ) : (
    <div className="bp-wrap">
      <div className="bp-header">
        <Link to="/" className="bp-logo">
          <HQMark size={30} />
          <span className="bp-logo-text">
            Hotline&nbsp;<em>HQ</em>
          </span>
        </Link>
        <div className="bp-header-side">
          <span className="bp-header-label">{t("publicBroadcast.sharedBroadcast")}</span>
        </div>
      </div>

      <main className="bp-main">
        <div className="bp-split">
          {/* LEFT — Hero / selling section */}
          <div className="bp-hero-col">
            <div className="bp-hero-mesh" aria-hidden="true" />
            <div className="bp-hero-scrim" aria-hidden="true" />
            <div className="bp-hero-inner">
              <div className="bp-hero-chip">
                <span className="bp-hero-live-dot" />
                {t("hero.chip")}
              </div>

              <p className="bp-hero-eyebrow">{t("hero.eyebrow")}</p>

              <h1 className="bp-hero-headline" dangerouslySetInnerHTML={{ __html: t("hero.heading") }} />

              <p className="bp-hero-sub">
                {t("publicBroadcast.heroSub")}
              </p>

              <div className="bp-hero-ctas">
                <a href={signupUrl} className="bp-hero-btn-hot" onClick={handleSignupClick}>
                  {t("common:nav.signUpFree")}
                </a>
                <a href={PUBLIC_LOGIN_URL} className="bp-hero-btn-ghost" onClick={handleLoginClick}>
                  {t("common:nav.login")}
                </a>
              </div>

              <div className="bp-hero-stats-row">
                <div className="bp-hero-stat-item">
                  <strong>500+</strong>
                  <span>{t("stats.memberYards")}</span>
                </div>
                <div className="bp-hero-stat-item">
                  <strong>12</strong>
                  <span>{t("stats.regionalRooms")}</span>
                </div>
                <div className="bp-hero-stat-item">
                  <strong>2s</strong>
                  <span>{t("stats.typicalAnswer")}</span>
                </div>
                <div className="bp-hero-stat-item">
                  <strong>24/7</strong>
                  <span>{t("stats.lineMonitoring")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Broadcast proof card */}
          <div className="bp-proof-col">
        <div className="bp-card">
          <div className="bp-dashboard-head">
            <div className="bp-head-main">
              <span className="bp-avatar">
                {(data.display_name || "H")[0].toUpperCase()}
              </span>
              <div className="bp-head-copy">
                <p className="bp-kicker">{t("publicBroadcast.kicker")}</p>
                <h1 className="bp-speaker">{data.display_name || t("publicBroadcast.unknownSpeaker")}</h1>
                <p className="bp-timestamp">
                  {t("publicBroadcast.dateAtTime", {
                    date: formatTimestamp(data.created_at),
                    time: formatTime(data.created_at),
                  })}
                </p>
              </div>
            </div>

            <span className={`bp-badge ${data.answered ? "bp-badge-ok" : "bp-badge-miss"}`}>
              <span className="bp-badge-dot" />
              {data.answered ? t("publicBroadcast.answered") : t("publicBroadcast.unanswered")}
            </span>
          </div>

          <div className="bp-stat-grid">
            <div className="bp-stat-pill">
              <span className="bp-stat-dot" style={{ background: "var(--red)" }} />
              <div>
                <span className="bp-stat-value">{data.room_name || t("publicBroadcast.roomFallback")}</span>
                <span className="bp-stat-label">{t("publicBroadcast.roomLabel")}</span>
              </div>
            </div>
            <div className="bp-stat-pill">
              <span className="bp-stat-dot" style={{ background: "var(--green)" }} />
              <div>
                <span className="bp-stat-value">{data.listener_count || 0}</span>
                <span className="bp-stat-label">{t("publicBroadcast.listenersLabel")}</span>
              </div>
            </div>
            <div className="bp-stat-pill">
              <span className="bp-stat-dot" style={{ background: "#f59e0b" }} />
              <div>
                <span className="bp-stat-value">{data.participant_count || 1}</span>
                <span className="bp-stat-label">{t("publicBroadcast.participantsLabel")}</span>
              </div>
            </div>
            <div className="bp-stat-pill">
              <span className="bp-stat-dot" style={{ background: data.answered ? "var(--green)" : "var(--red)" }} />
              <div>
                <span className="bp-stat-value">
                  {data.answered
                    ? data.response_time_ms === 0
                      ? t("publicBroadcast.instant")
                      : data.response_time_ms == null
                        ? t("publicBroadcast.answered")
                        : formatDuration(data.response_time_ms)
                    : t("publicBroadcast.noReply")}
                </span>
                <span className="bp-stat-label">{t("publicBroadcast.responseLabel")}</span>
              </div>
            </div>
          </div>

          {/* Audio Player */}
          {data.has_recording && (
            <div className="bp-player-section">
              <div className="bp-section-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                {t("publicBroadcast.recording")}
              </div>
              <AudioPlayer
                src={`/api/v1/public/broadcast/${token}/audio`}
                knownDurationMs={data.duration_ms}
                onPlayStart={handleAudioPlayStart}
              />
              {showAudioNudge && (
                <p className="bp-audio-nudge">
                  {t("publicBroadcast.nudgeLead")}{" "}
                  <a href={signupUrl} target="_blank" rel="noopener noreferrer" onClick={handleSignupClick}>
                    {data.room_name
                      ? t("publicBroadcast.nudgeRoomLive", { room: data.room_name })
                      : t("publicBroadcast.nudgeRoomsLive")}
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Broadcaster */}
          {data.display_name && (
            <div className="bp-participants-section">
              <div className="bp-section-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                {t("publicBroadcast.broadcaster")}
              </div>
              <div className="bp-participant-list">
                <div className="bp-participant bp-broadcaster">
                  <span className="bp-participant-avatar bp-avatar-broadcaster">
                    {data.display_name[0].toUpperCase()}
                  </span>
                  <span className="bp-participant-name">
                    {data.display_name}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Responders */}
          {data.participants && data.participants.filter(p => p.displayName !== data.display_name).length > 0 && (
            <div className="bp-participants-section bp-responders-section">
              <div className="bp-section-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {t("publicBroadcast.responders")}
              </div>
              <div className="bp-participant-list">
                {data.participants.filter(p => p.displayName !== data.display_name).map((p, i) => (
                  <div key={i} className="bp-participant">
                    <span className="bp-participant-avatar">
                      {(p.displayName || "?")[0].toUpperCase()}
                    </span>
                    <span className="bp-participant-name">
                      {p.displayName || t("publicBroadcast.unknown")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcription */}
          {data.transcription && (
            <div className="bp-transcript-section">
              <div className="bp-section-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                {t("publicBroadcast.transcript")}
              </div>
              <div className="bp-transcript-text">{data.transcription}</div>
            </div>
          )}

          {/* In-card CTA */}
          <div className="bp-cta-section">
            <h2 className="bp-cta-title">{t("publicBroadcast.ctaTitle")}</h2>
            <p className="bp-cta-text">{t("publicBroadcast.ctaText")}</p>
            <div className="bp-cta-trust-grid">
              <div className="bp-cta-trust">
                <span className="bp-cta-trust-value">500+</span>
                <span className="bp-cta-trust-label">{t("stats.memberYards")}</span>
              </div>
              <div className="bp-cta-trust">
                <span className="bp-cta-trust-value">2s</span>
                <span className="bp-cta-trust-label">{t("stats.typicalAnswer")}</span>
              </div>
              <div className="bp-cta-trust">
                <span className="bp-cta-trust-value">24/7</span>
                <span className="bp-cta-trust-label">{t("stats.lineMonitoring")}</span>
              </div>
            </div>
            <div className="bp-cta-actions">
              <a href={signupUrl} className="bp-cta-btn bp-cta-btn-primary" onClick={handleSignupClick}>
                {t("common:nav.signUpFree")}
              </a>
              <a href={PUBLIC_LOGIN_URL} className="bp-cta-btn bp-cta-btn-secondary" onClick={handleLoginClick}>
                {t("common:nav.login")}
              </a>
            </div>
            <p className="bp-cta-footnote">{t("publicBroadcast.ctaFootnote")}</p>
          </div>

        </div>
          </div>
        </div>
      </main>

      <footer className="bp-footer">
        <HQMark size={20} />
        <span>{t("publicBroadcast.poweredBy")}</span>
      </footer>

      {/* Sticky bottom CTA bar */}
      <div className="bp-sticky-cta">
        <div className="bp-sticky-cta-inner">
          <div className="bp-sticky-cta-copy">
            <strong>{t("publicBroadcast.stickyTitle")}</strong>
            <span>{t("publicBroadcast.stickySub")}</span>
          </div>
          <a
            href={signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bp-sticky-cta-btn"
            onClick={handleSignupClick}
          >
            {t("publicBroadcast.stickyButton")}
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{PAGE_CSS}</style>
      {content}
    </>
  );
}

const PAGE_CSS = `
/* fonts loaded via index.html (non-blocking) */

.bp-wrap {
  --bg: #fbfaf8;
  --surface: #ffffff;
  --ink: #16181d;
  --muted: #5d6370;
  --subtle: #a3a094;
  --line: #e7e4dd;
  --red: #d92d20;
  --red-deep: #b42318;
  --green: #12b76a;
  --green-soft: #ecfdf3;
  --red-soft: #fef3f2;
  --display: "Bricolage Grotesque", "Georgia", sans-serif;
  --body: "Instrument Sans", sans-serif;
  --mono: "IBM Plex Mono", monospace;

  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--body);
  display: flex;
  flex-direction: column;
}
.bp-wrap *, .bp-wrap *::before, .bp-wrap *::after { box-sizing: border-box; }
.bp-wrap a { text-decoration: none; color: inherit; }

/* Header */
.bp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  border-bottom: 1px solid var(--line);
  background: rgba(251,250,248,0.92);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.bp-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.bp-logo-text {
  font-family: var(--display);
  font-weight: 700;
  font-size: 19px;
  letter-spacing: -0.01em;
  color: var(--ink);
}
.bp-logo-text em { font-style: normal; color: var(--red); }
.bp-header-label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--subtle);
  font-weight: 500;
}
.bp-header-side {
  display: flex;
  align-items: center;
  gap: 14px;
}
.bp-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bp-header-link,
.bp-header-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, color 0.16s ease;
}
.bp-header-link {
  color: var(--ink) !important;
  background: #f7f5f1;
  border: 1px solid var(--line);
}
.bp-header-btn {
  color: #fff !important;
  background: var(--red);
  border: 1px solid var(--red);
  box-shadow: 0 8px 18px rgba(217,45,32,0.2);
}
.bp-header-link:hover,
.bp-header-btn:hover {
  transform: translateY(-1px);
}
.bp-header-btn:hover {
  background: var(--red-deep);
}

/* Main */
.bp-main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 20px 64px;
}

/* Split layout */
.bp-split {
  display: flex;
  gap: 40px;
  max-width: 1140px;
  width: 100%;
  align-items: flex-start;
}

/* Hero column (left) */
.bp-hero-col {
  flex: 1;
  position: sticky;
  top: 80px;
  border-radius: 20px;
  overflow: hidden;
  min-height: 580px;
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}
.bp-hero-mesh {
  position: absolute;
  inset: -40%;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(217,45,32,0.25), transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba(18,183,106,0.15), transparent 50%),
    radial-gradient(ellipse at 60% 80%, rgba(217,45,32,0.12), transparent 50%),
    #16181d;
  animation: bp-mesh-drift 12s ease-in-out infinite alternate;
  z-index: 0;
}
@keyframes bp-mesh-drift {
  0%   { transform: translate(0, 0) scale(1); }
  33%  { transform: translate(5%, -3%) scale(1.05); }
  66%  { transform: translate(-3%, 5%) scale(1.02); }
  100% { transform: translate(2%, -2%) scale(1.08); }
}
.bp-hero-scrim {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 50% 40%, rgba(22,24,29,0.6) 30%, rgba(22,24,29,0.3) 70%, transparent 100%),
    linear-gradient(180deg, rgba(22,24,29,0.7) 0%, transparent 30%),
    linear-gradient(0deg, rgba(22,24,29,0.8) 0%, transparent 25%);
  z-index: 1;
  pointer-events: none;
}
.bp-hero-inner {
  position: relative;
  z-index: 2;
  max-width: 480px;
  padding: 48px 36px;
  text-align: center;
}
.bp-hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.7);
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  padding: 7px 14px;
  margin-bottom: 22px;
}
.bp-hero-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 0 3px rgba(217,45,32,0.25);
  animation: bp-pulse 1.6s infinite;
}
@keyframes bp-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
.bp-hero-eyebrow {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--red);
  margin: 0 0 18px;
}
.bp-hero-headline {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(26px, 3vw, 36px);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin: 0 0 18px;
}
.bp-hero-headline em {
  font-style: normal;
  color: var(--red);
  background: linear-gradient(transparent 68%, rgba(217,45,32,0.2) 68%);
}
.bp-hero-sub {
  font-size: 15.5px;
  line-height: 1.65;
  color: rgba(255,255,255,0.65);
  font-weight: 500;
  margin: 0 0 28px;
}
.bp-hero-ctas {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 32px;
}
.bp-hero-btn-hot {
  font-family: var(--body);
  font-weight: 600;
  font-size: 15.5px;
  padding: 14px 28px;
  border-radius: 11px;
  background: var(--red);
  color: #fff !important;
  box-shadow: 0 8px 24px -8px rgba(217,45,32,0.5);
  transition: transform .15s, background .2s, box-shadow .2s;
  cursor: pointer;
}
.bp-hero-btn-hot:hover { background: var(--red-deep); box-shadow: 0 10px 30px -8px rgba(217,45,32,0.6); transform: translateY(-2px); }
.bp-hero-btn-hot:active { transform: translateY(1px); }
.bp-hero-btn-ghost {
  font-family: var(--body);
  font-weight: 600;
  font-size: 15.5px;
  padding: 14px 28px;
  border-radius: 11px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff !important;
  transition: transform .15s, background .2s, border-color .2s;
  cursor: pointer;
}
.bp-hero-btn-ghost:hover { border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.12); transform: translateY(-2px); }
.bp-hero-btn-ghost:active { transform: translateY(1px); }
.bp-hero-stats-row {
  display: flex;
  justify-content: center;
  gap: clamp(24px, 4vw, 48px);
  flex-wrap: wrap;
}
.bp-hero-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.bp-hero-stat-item strong {
  font-family: var(--display);
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
}
.bp-hero-stat-item span {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}

/* Proof column (right) */
.bp-proof-col {
  flex: 1;
  max-width: 560px;
}

/* Card */
.bp-card {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 36px 38px;
  box-shadow:
    0 1px 3px rgba(22,24,29,0.04),
    0 8px 40px -12px rgba(22,24,29,0.10);
  animation: bp-fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes bp-fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Top row */
.bp-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

/* Badge */
.bp-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 5px 14px 5px 11px;
  border-radius: 8px;
}
.bp-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.bp-badge-ok {
  background: var(--green-soft);
  color: #067647;
  border: 1px solid #abefc6;
}
.bp-badge-ok .bp-badge-dot { background: var(--green); }
.bp-badge-miss {
  background: var(--red-soft);
  color: var(--red-deep);
  border: 1px solid #fecdca;
}
.bp-badge-miss .bp-badge-dot { background: var(--red); }

.bp-timestamp {
  font-family: var(--mono);
  font-size: 12.5px;
  color: var(--subtle);
  letter-spacing: 0.01em;
}

/* Speaker */
.bp-speaker {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(26px, 4.5vw, 34px);
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0 0 16px;
  color: var(--ink);
}

/* Meta chips */
.bp-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 0;
}
.bp-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  background: #f7f5f1;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--line);
}
.bp-chip svg { color: var(--subtle); flex-shrink: 0; }

/* Section labels */
.bp-section-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--subtle);
  margin-bottom: 14px;
}
.bp-section-label svg { color: var(--subtle); }

/* Audio player section */
.bp-player-section {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
}

/* Player */
.bp-player {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f9f8f5;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 18px;
}
.bp-play-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: none;
  background: var(--red);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s, transform 0.15s;
  box-shadow: 0 2px 8px rgba(217,45,32,0.25);
}
.bp-play-btn:hover { background: var(--red-deep); transform: scale(1.06); }
.bp-play-btn:active { transform: scale(0.97); }
.bp-play-btn svg { margin-left: 1px; }

.bp-player-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}
.bp-time-combined {
  display: none;
}
.bp-time {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--subtle);
  min-width: 34px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.bp-time-total { text-align: left; }

.bp-track {
  flex: 1;
  height: 36px;
  cursor: pointer;
  position: relative;
}
.bp-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 100%;
}
.bp-bar {
  flex: 1;
  border-radius: 1px;
  transition: background-color 0.08s;
}
.bp-track-fallback {
  width: 100%;
  height: 4px;
  background: #e7e4dd;
  border-radius: 2px;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}
.bp-track-fill {
  height: 100%;
  background: var(--red);
  border-radius: 2px;
  transition: width 0.1s linear;
}

/* Stats */
.bp-stats {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}
.bp-stat {
  flex: 1;
  min-width: 120px;
  background: #f9f8f5;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
}
.bp-stat-wide { flex: 2; }
.bp-stat-value {
  display: block;
  font-family: var(--display);
  font-weight: 700;
  font-size: 17px;
  color: var(--ink);
  letter-spacing: -0.01em;
  margin-bottom: 2px;
}
.bp-stat-label {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--subtle);
}

/* Participants */
.bp-participants-section {
  margin-top: 24px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
}
.bp-participant-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.bp-participant {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f9f8f5;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 16px 10px 10px;
}
.bp-participant-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #ffe0de 0%, #fef3f2 100%);
  border: 1px solid #fecdca;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-weight: 700;
  font-size: 14px;
  color: var(--red);
  flex-shrink: 0;
}
.bp-participant-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
}
.bp-avatar-broadcaster {
  background: linear-gradient(135deg, #d92d20 0%, #b42318 100%);
  border-color: #d92d20;
  color: #ffffff;
}
.bp-responders-section {
  margin-top: 16px;
  padding-top: 0;
  border-top: none;
}

/* Dashboard makeover */
.bp-header {
  background: rgba(255,255,255,0.86);
  box-shadow: 0 1px 2px rgba(22,24,29,0.04);
}
.bp-main {
  padding: 38px 18px 54px;
}
.bp-card {
  max-width: 760px;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);
}
.bp-dashboard-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  padding: 22px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.bp-head-main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}
.bp-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--red);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: var(--display);
  font-size: 17px;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(217,45,32,0.24);
}
.bp-head-copy {
  min-width: 0;
}
.bp-kicker {
  margin: 0 0 6px;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.bp-speaker {
  margin: 0;
  font-size: clamp(21px, 3.8vw, 30px);
  line-height: 1.12;
}
.bp-timestamp {
  display: block;
  margin-top: 7px;
  font-size: 12px;
}
.bp-badge {
  border-radius: 999px;
  white-space: nowrap;
  margin-top: 2px;
}
.bp-badge-ok .bp-badge-dot {
  box-shadow: 0 0 0 4px rgba(18,183,106,0.15);
}
.bp-badge-miss .bp-badge-dot {
  box-shadow: 0 0 0 4px rgba(217,45,32,0.13);
}
.bp-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 14px 22px;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}
.bp-stat-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.bp-stat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.bp-stat-pill .bp-stat-value {
  margin: 0;
  font-family: var(--display);
  font-size: 17px;
  line-height: 1;
  font-weight: 800;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
.bp-stat-pill .bp-stat-label {
  display: block;
  margin-top: 4px;
  font-size: 9px;
}
.bp-player-section {
  margin-top: 0;
  padding: 22px;
  border-top: none;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.bp-player {
  background: var(--bg);
  border-radius: 14px;
  padding: 16px;
}
.bp-play-btn {
  border-radius: 12px;
  box-shadow: 0 8px 18px rgba(217,45,32,0.26);
}
.bp-participants-section,
.bp-transcript-section {
  margin: 22px 22px 0;
  padding-top: 0;
  border-top: none;
}
.bp-participants-section:last-of-type {
  margin-bottom: 22px;
}
.bp-participant,
.bp-transcript-text {
  background: var(--bg);
}
.bp-cta-section {
  margin: 22px;
  padding: 22px;
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(217,45,32,0.08), transparent 36%),
    linear-gradient(180deg, #fff8f7 0%, #ffffff 100%);
  border: 1px solid #f6d4cf;
  box-shadow: 0 12px 30px -20px rgba(217,45,32,0.35);
}
.bp-cta-title {
  margin: 0;
  font-family: var(--display);
  font-size: clamp(24px, 4vw, 32px);
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.bp-cta-text {
  margin: 10px 0 0;
  max-width: 560px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--muted);
}
.bp-cta-trust-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}
.bp-cta-trust {
  padding: 14px 14px;
  border-radius: 12px;
  background: rgba(255,255,255,0.84);
  border: 1px solid #f3ddd9;
}
.bp-cta-trust-value {
  display: block;
  font-family: var(--display);
  font-size: 17px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--ink);
}
.bp-cta-trust-label {
  display: block;
  margin-top: 5px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.bp-cta-actions {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}
.bp-cta-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 18px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 800;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, border-color 0.16s ease;
}
.bp-cta-btn:hover {
  transform: translateY(-1px);
}
.bp-cta-btn-primary {
  color: #fff !important;
  background: var(--red);
  border: 1px solid var(--red);
  box-shadow: 0 10px 24px rgba(217,45,32,0.24);
}
.bp-cta-btn-primary:hover {
  background: var(--red-deep);
}
.bp-cta-btn-secondary {
  color: var(--ink) !important;
  background: #fff;
  border: 1px solid var(--line);
}
.bp-cta-footnote {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--muted);
}
.bp-footer {
  margin-top: auto;
  background: var(--surface);
}

/* Error state */
.bp-card-error {
  text-align: center;
  padding: 56px 38px;
}
.bp-error-icon {
  margin-bottom: 20px;
  opacity: 0.7;
}
.bp-error-title {
  font-family: var(--display);
  font-weight: 700;
  font-size: 26px;
  letter-spacing: -0.02em;
  margin: 0 0 10px;
}
.bp-error-msg {
  font-size: 15px;
  color: var(--muted);
  line-height: 1.6;
  margin: 0 0 28px;
  max-width: 360px;
  margin-left: auto;
  margin-right: auto;
}
.bp-error-link {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--red) !important;
  letter-spacing: 0.02em;
  transition: opacity 0.2s;
}
.bp-error-link:hover { opacity: 0.7; }

/* Transcript */
.bp-transcript-section {
  margin-top: 32px;
}
.bp-transcript-text {
  font-family: var(--body);
  font-size: 14px;
  line-height: 1.7;
  color: var(--ink);
  background: #f9f8f6;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px 22px;
  margin-top: 10px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Footer */
.bp-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 20px 72px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--subtle);
  border-top: 1px solid var(--line);
}

/* Shimmer */
.bp-shimmer {
  background: linear-gradient(90deg, #f0ede8 25%, #f7f5f1 50%, #f0ede8 75%);
  background-size: 200% 100%;
  animation: bp-shimmer 1.6s ease infinite;
}
@keyframes bp-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Tablet — stack split */
@media (max-width: 960px) {
  .bp-split { flex-direction: column; gap: 0; }
  .bp-hero-col { position: static; border-radius: 16px; min-height: 480px; }
  .bp-proof-col { max-width: 100%; margin-top: 28px; }
  .bp-hero-inner { max-width: 100%; }
}

/* Mobile */
@media (max-width: 640px) {
  .bp-main { padding: 28px 12px 48px; }
  .bp-card { padding: 0; border-radius: 14px; }
  .bp-header { padding: 14px 16px; }
  .bp-header-side { gap: 10px; }
  .bp-header-label { display: none; }
  .bp-header-actions { gap: 8px; }
  .bp-header-link,
  .bp-header-btn {
    min-height: 34px;
    padding: 0 11px;
    font-size: 12px;
  }
  .bp-hero-col { min-height: 420px; border-radius: 12px; }
  .bp-hero-inner { padding: 36px 20px; }
  .bp-hero-headline { font-size: 24px; }
  .bp-hero-stats-row { gap: 16px; }
  .bp-hero-stat-item strong { font-size: 24px; }
  .bp-hero-ctas { flex-direction: column; }
  .bp-hero-btn-hot, .bp-hero-btn-ghost { width: 100%; text-align: center; display: block; }
  .bp-dashboard-head { flex-direction: column; padding: 18px; gap: 14px; }
  .bp-badge { margin-top: 0; }
  .bp-stat-grid { grid-template-columns: 1fr 1fr; padding: 12px; gap: 8px; }
  .bp-stat-pill { padding: 10px; }
  .bp-stat-pill .bp-stat-value { max-width: 110px; font-size: 15px; }
  .bp-player-section { padding: 16px; }
  .bp-player { padding: 10px; flex-direction: column; gap: 6px; align-items: stretch; }
  .bp-player-row { display: flex !important; align-items: center; gap: 10px; }
  .bp-play-btn { width: 38px; height: 38px; flex-shrink: 0; }
  .bp-time-combined { display: block; font-family: var(--mono); font-size: 11px; color: var(--subtle); font-variant-numeric: tabular-nums; white-space: nowrap; padding-left: 48px; }
  .bp-time-current { display: none; }
  .bp-time-total { display: none; }
  .bp-track { flex: 1; min-width: 0; height: 38px; position: relative; }
  .bp-waveform { gap: 1px; display: flex; align-items: center; height: 38px; }
  .bp-stats { flex-direction: column; }
  .bp-stat-wide { flex: 1; }
  .bp-meta-row { gap: 6px; }
  .bp-chip { padding: 5px 10px; font-size: 12px; }
  .bp-participant-list { flex-direction: column; }
  .bp-participant { width: 100%; }
  .bp-participants-section,
  .bp-transcript-section {
    margin-left: 16px;
    margin-right: 16px;
  }
}

/* Audio nudge */
.bp-audio-nudge {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--muted);
  animation: bp-fadeIn 0.5s ease-out;
}
.bp-audio-nudge a {
  color: var(--red) !important;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.bp-audio-nudge a:hover {
  color: var(--red-deep) !important;
}
@keyframes bp-fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Sticky bottom CTA bar */
.bp-sticky-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: rgba(251,250,248,0.96);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--line);
  padding: 12px 20px;
  animation: bp-slideUp 0.4s ease-out;
}
@keyframes bp-slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.bp-sticky-cta-inner {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.bp-sticky-cta-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bp-sticky-cta-copy strong {
  font-family: var(--display);
  font-size: 15px;
  color: var(--ink);
}
.bp-sticky-cta-copy span {
  font-size: 14px;
  color: var(--muted);
}
.bp-sticky-cta-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  background: var(--red);
  color: #fff !important;
  font-family: var(--body);
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  white-space: nowrap;
  transition: background 0.15s;
  text-decoration: none;
}
.bp-sticky-cta-btn:hover {
  background: var(--red-deep);
}
@media (max-width: 640px) {
  .bp-sticky-cta { padding: 10px 14px; }
  .bp-sticky-cta-btn { padding: 10px 18px; font-size: 13px; }
}
`;

function ShieldCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
