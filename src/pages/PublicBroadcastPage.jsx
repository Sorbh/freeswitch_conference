import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { HQMark } from "@/pages/landing2/site";

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

function AudioPlayer({ src, knownDurationMs }) {
  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const animRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(knownDurationMs ? knownDurationMs / 1000 : 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveform, setWaveform] = useState(null);

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
      setPlaying(true);
    }
  }, [playing]);

  const seek = useCallback((e) => {
    const a = audioRef.current;
    const el = trackRef.current;
    const dur = getDur();
    if (!a || !dur || !el) return;
    const r = el.getBoundingClientRect();
    a.currentTime =
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
  }, [getDur]);

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
      />
      <div className="bp-player-row">
        <button className="bp-play-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
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

        <span className="bp-time bp-time-current">{ft(currentTime)}</span>

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
            <div className="bp-track-fallback">
              <div className="bp-track-fill" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
        </div>

        <span className="bp-time bp-time-total">{ft(duration)}</span>
      </div>

      <span className="bp-time-combined">{ft(currentTime)} / {ft(duration)}</span>
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
          <h2 className="bp-error-title">Broadcast Not Found</h2>
          <p className="bp-error-msg">
            {message || "This broadcast link may have been revoked or is no longer available."}
          </p>
          <Link to="/" className="bp-error-link">
            Go to Hotline HQ &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function PublicBroadcastPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
      document.title = `Broadcast by ${data.display_name || "Unknown"} — Hotline HQ`;
    } else {
      document.title = "Broadcast — Hotline HQ";
    }
  }, [data]);

  const respondedList = data?.responded_by
    ? data.responded_by.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

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
        <span className="bp-header-label">Shared Broadcast</span>
      </div>

      <main className="bp-main">
        <div className="bp-card">
          {/* Status + Timestamp row */}
          <div className="bp-top-row">
            <span className={`bp-badge ${data.answered ? "bp-badge-ok" : "bp-badge-miss"}`}>
              <span className="bp-badge-dot" />
              {data.answered ? "Answered" : "Unanswered"}
            </span>
            <span className="bp-timestamp">
              {formatTimestamp(data.created_at)}
              {" at "}
              {formatTime(data.created_at)}
            </span>
          </div>

          {/* Speaker */}
          <h1 className="bp-speaker">{data.display_name || "Unknown Speaker"}</h1>

          {/* Meta chips */}
          <div className="bp-meta-row">
            {data.room_name && (
              <span className="bp-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                {data.room_name}
              </span>
            )}
            <span className="bp-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {formatDuration(data.duration_ms)}
            </span>
            <span className="bp-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {data.participant_count || 1} participant{(data.participant_count || 1) !== 1 ? "s" : ""}
            </span>
            {data.listener_count > 0 && (
              <span className="bp-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {data.listener_count} listener{data.listener_count !== 1 ? "s" : ""}
              </span>
            )}
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
                Recording
              </div>
              <AudioPlayer src={`/api/v1/public/broadcast/${token}/audio`} knownDurationMs={data.duration_ms} />
            </div>
          )}

          {/* Stats grid */}
          {data.answered && (
            <div className="bp-stats">
              {data.response_time_ms != null && (
                <div className="bp-stat">
                  <span className="bp-stat-value">
                    {data.response_time_ms === 0
                      ? "Instant"
                      : formatDuration(data.response_time_ms)}
                  </span>
                  <span className="bp-stat-label">Response Time</span>
                </div>
              )}
              {respondedList.length > 0 && (
                <div className="bp-stat bp-stat-wide">
                  <span className="bp-stat-value">{respondedList.join(", ")}</span>
                  <span className="bp-stat-label">Responded By</span>
                </div>
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
                Broadcaster
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
                Responders
              </div>
              <div className="bp-participant-list">
                {data.participants.filter(p => p.displayName !== data.display_name).map((p, i) => (
                  <div key={i} className="bp-participant">
                    <span className="bp-participant-avatar">
                      {(p.displayName || "?")[0].toUpperCase()}
                    </span>
                    <span className="bp-participant-name">
                      {p.displayName || "Unknown"}
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
                Transcript
              </div>
              <div className="bp-transcript-text">{data.transcription}</div>
            </div>
          )}
        </div>
      </main>

      <footer className="bp-footer">
        <HQMark size={20} />
        <span>Powered by Hotline HQ</span>
      </footer>
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
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

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

/* Main */
.bp-main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 20px 64px;
}

/* Card */
.bp-card {
  width: 100%;
  max-width: 620px;
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
  display: contents;
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
  padding: 20px;
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

/* Mobile */
@media (max-width: 640px) {
  .bp-main { padding: 28px 12px 48px; }
  .bp-card { padding: 24px 20px; border-radius: 14px; }
  .bp-header { padding: 14px 16px; }
  .bp-header-label { display: none; }
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
}
`;
