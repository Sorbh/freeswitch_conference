import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { HQMark } from "./landing2/site";

const PUBLIC_LOGIN_URL = "https://hotline.redlineusedautoparts.com/client/login";
const PUBLIC_SIGNUP_URL = "https://hotline.redlineusedautoparts.com/client/signup";

// ─── Helpers ─────────────────────────────────────────────

function formatDuration(ms) {
  if (!ms) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatTimeSince(unix) {
  if (!unix) return "";
  const now = Date.now() / 1000;
  const diff = now - unix;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unix * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCountdown(remainingMs) {
  if (remainingMs <= 0) return "Expired";
  const s = Math.floor(remainingMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatLiveDuration(startTime) {
  if (!startTime) return "0:00";
  const diff = Math.floor(Date.now() / 1000 - startTime);
  if (diff < 0) return "0:00";
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ft(s) {
  if (!s || !isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

function setClarityTags(tags) {
  if (typeof window === "undefined" || typeof window.clarity !== "function") return;
  try {
    Object.entries(tags).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      window.clarity("set", key, String(value));
    });
  } catch {}
}

function trackClarityEvent(name) {
  if (typeof window === "undefined" || typeof window.clarity !== "function") return;
  try { window.clarity("event", name); } catch {}
}

// ─── AudioPlayer ─────────────────────────────────────────

function AudioPlayer({ src, knownDurationMs, onPlayStart }) {
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
      .then((buf) => new (window.AudioContext || window.webkitAudioContext)().decodeAudioData(buf))
      .then((audioBuffer) => {
        if (cancelled) return;
        if (audioBuffer.duration && isFinite(audioBuffer.duration)) setDuration(audioBuffer.duration);
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
        if (!cancelled) setWaveform(Array.from({ length: 80 }, () => Math.random() * 0.4 + 0.1));
      });
    return () => { cancelled = true; };
  }, [src]);

  const getDur = useCallback(() => {
    const a = audioRef.current;
    if (a && isFinite(a.duration) && a.duration > 0) return a.duration;
    return duration || 0;
  }, [duration]);

  useEffect(() => {
    if (!playing) { cancelAnimationFrame(animRef.current); return; }
    const tick = () => {
      const a = audioRef.current;
      if (a) {
        const dur = getDur();
        if (dur > 0) { setProgress(a.currentTime / dur); setDuration(dur); }
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
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); onPlayStart?.(); setPlaying(true); }
  }, [onPlayStart, playing]);

  const seek = useCallback((e) => {
    const a = audioRef.current;
    const el = trackRef.current;
    const dur = getDur();
    if (!a || !dur || !el) return;
    const r = el.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
  }, [getDur]);

  return (
    <div className="bp-player">
      <audio
        ref={audioRef} src={src} preload="auto"
        onLoadedMetadata={(e) => { if (isFinite(e.target.duration) && e.target.duration > 0) setDuration(e.target.duration); }}
        onDurationChange={(e) => { if (isFinite(e.target.duration) && e.target.duration > 0) setDuration(e.target.duration); }}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0); }}
      />
      <div className="bp-player-row">
        <button className="bp-play-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" /></svg>
          )}
        </button>
        <span className="bp-time bp-time-current">{ft(currentTime)}</span>
        <div className="bp-track" ref={trackRef} onClick={seek}>
          {waveform ? (
            <div className="bp-waveform">
              {waveform.map((peak, i) => {
                const played = i / waveform.length < progress;
                return (
                  <div key={i} className="bp-bar" style={{
                    height: `${Math.max(8, peak * 100)}%`,
                    backgroundColor: played ? "#d92d20" : "#d5d2cc",
                  }} />
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

// ─── Live Audio Engine (MediaSource + WebSocket) ─────────

function useLiveAudio(wsUrl, isLive) {
  const wsRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const audioElRef = useRef(null);
  const pendingBuffers = useRef([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isLive || !wsUrl) return;
    const audio = new Audio();
    audio.autoplay = true;
    audioElRef.current = audio;

    let mediaSource;
    try {
      mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      audio.src = URL.createObjectURL(mediaSource);
    } catch { return; }

    const onSourceOpen = () => {
      try {
        const sb = mediaSource.addSourceBuffer('audio/webm; codecs="opus"');
        sourceBufferRef.current = sb;
        sb.addEventListener("updateend", () => {
          if (pendingBuffers.current.length > 0 && !sb.updating) sb.appendBuffer(pendingBuffers.current.shift());
        });
      } catch {}
    };
    mediaSource.addEventListener("sourceopen", onSourceOpen);

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      if (typeof event.data === "string") return;
      const sb = sourceBufferRef.current;
      if (!sb) return;
      const buf = new Uint8Array(event.data);
      if (sb.updating) pendingBuffers.current.push(buf);
      else { try { sb.appendBuffer(buf); } catch { pendingBuffers.current.push(buf); } }
    };

    return () => {
      ws.close();
      audio.pause();
      audio.src = "";
      if (mediaSource.readyState === "open") { try { mediaSource.endOfStream(); } catch {} }
      pendingBuffers.current = [];
      setConnected(false);
    };
  }, [wsUrl, isLive]);

  return { connected, wsRef, audioElRef };
}

// ─── Skeleton ────────────────────────────────────────────

function Skeleton({ w, h, r = 8 }) {
  return <div className="bp-shimmer" style={{ width: w, height: h, borderRadius: r }} />;
}

// ─── Main Page Component ─────────────────────────────────

export default function PublicListenPage() {
  const { room } = useParams();
  const [searchParams] = useSearchParams();
  const exp = searchParams.get("exp");
  const sig = searchParams.get("sig");

  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastTotal, setBroadcastTotal] = useState(0);
  const [broadcastPage, setBroadcastPage] = useState(1);
  const [broadcastPages, setBroadcastPages] = useState(1);
  const [hourly, setHourly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [liveDuration, setLiveDuration] = useState("0:00");
  const [expandedBroadcast, setExpandedBroadcast] = useState(null);

  const qs = useMemo(() => `exp=${encodeURIComponent(exp || "")}&sig=${encodeURIComponent(sig || "")}`, [exp, sig]);
  const baseUrl = `/api/v1/public/live/${room}`;

  useEffect(() => {
    setClarityTags({ page_type: "public_live_listen", live_room: room });
    trackClarityEvent("public_live_view");
  }, [room]);

  useEffect(() => {
    if (!exp) return;
    const expMs = Number(exp) * 1000;
    const tick = () => setRemaining(expMs - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [exp]);

  const isExpired = remaining !== null && remaining <= 0;

  const apiFetch = useCallback(
    async (path, extra = "") => {
      const url = `${baseUrl}${path}?${qs}${extra ? "&" + extra : ""}`;
      const res = await fetch(url);
      if (res.status === 403) throw { code: 403, message: "Invalid or tampered link" };
      if (res.status === 410) throw { code: 410, message: "This link has expired" };
      if (!res.ok) throw { code: res.status, message: "Something went wrong" };
      return res.json();
    },
    [baseUrl, qs]
  );

  useEffect(() => {
    if (!room || !exp || !sig) {
      setError({ code: 403, message: "Invalid or tampered link" });
      setLoading(false);
      return;
    }
    Promise.all([
      apiFetch("/status"),
      apiFetch("/stats"),
      apiFetch("/broadcasts", "page=1&limit=20"),
      apiFetch("/hourly"),
    ])
      .then(([statusRes, statsRes, broadcastRes, hourlyRes]) => {
        setStatus(statusRes.data);
        setStats(statsRes.data);
        setBroadcasts(broadcastRes.data?.broadcasts || []);
        setBroadcastTotal(broadcastRes.data?.total || 0);
        setBroadcastPages(broadcastRes.data?.pages || 1);
        setHourly(hourlyRes.data || []);
      })
      .catch((e) => setError({ code: e.code || 500, message: e.message || "Something went wrong" }))
      .finally(() => setLoading(false));
  }, [room, exp, sig, apiFetch]);

  useEffect(() => {
    if (error || isExpired || !room || !exp || !sig) return;
    const id = setInterval(() => { apiFetch("/status").then(r => setStatus(r.data)).catch(() => {}); }, 10000);
    return () => clearInterval(id);
  }, [error, isExpired, room, exp, sig, apiFetch]);

  useEffect(() => {
    if (!status?.broadcasting || !status?.startTime) return;
    const tick = () => setLiveDuration(formatLiveDuration(status.startTime));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.broadcasting, status?.startTime]);

  const wsUrl = useMemo(() => {
    if (!room || !exp || !sig) return null;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/ws/live/${room}?${qs}`;
  }, [room, exp, sig, qs]);

  const { connected } = useLiveAudio(wsUrl, status?.broadcasting);

  useEffect(() => {
    if (!wsUrl || isExpired) return;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "status":
            setStatus((prev) => ({ ...prev, ...msg }));
            break;
          case "broadcast_start":
            setStatus((prev) => ({ ...prev, broadcasting: true, speaker: msg.speaker, roomName: msg.roomName, startTime: msg.startTime, participants: msg.participants }));
            break;
          case "broadcast_update":
            setStatus((prev) => ({ ...prev, speaker: msg.speaker || prev?.speaker, participants: msg.participants || prev?.participants }));
            break;
          case "broadcast_end":
            setStatus((prev) => ({ ...prev, broadcasting: false }));
            apiFetch("/broadcasts", `page=1&limit=20`).then((r) => { setBroadcasts(r.data?.broadcasts || []); setBroadcastTotal(r.data?.total || 0); setBroadcastPages(r.data?.pages || 1); setBroadcastPage(1); }).catch(() => {});
            apiFetch("/stats").then(r => setStats(r.data)).catch(() => {});
            break;
          case "expired":
            setRemaining(0);
            break;
        }
      } catch {}
    };
    return () => ws.close();
  }, [wsUrl, isExpired, apiFetch]);

  const loadPage = useCallback(
    (page) => {
      apiFetch("/broadcasts", `page=${page}&limit=20`).then((r) => { setBroadcasts(r.data?.broadcasts || []); setBroadcastTotal(r.data?.total || 0); setBroadcastPages(r.data?.pages || 1); setBroadcastPage(page); }).catch(() => {});
    },
    [apiFetch]
  );

  const handleSignupClick = useCallback(() => { trackClarityEvent("live_listen_signup_click"); }, []);
  const handleLoginClick = useCallback(() => { trackClarityEvent("live_listen_login_click"); }, []);

  // ── Error / Expired ──
  if (error || isExpired) {
    const is403 = error?.code === 403;
    const is410 = error?.code === 410 || isExpired;
    return (
      <>
        <style>{PAGE_CSS}</style>
        <div className="bp-wrap">
          <div className="bp-header">
            <Link to="/" className="bp-logo"><HQMark size={30} /><span className="bp-logo-text">Hotline&nbsp;<em>HQ</em></span></Link>
          </div>
          <main className="bp-main">
            <div className="bp-card bp-card-error" style={{ animation: "bp-fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
              <div className="bp-error-icon">
                {is410 ? (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d92d20" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                )}
              </div>
              <h2 className="bp-error-title">{is410 ? "Link Expired" : is403 ? "Invalid Link" : "Error"}</h2>
              <p className="bp-error-msg">
                {is410 ? "This link has expired. Request a new one or sign up for full access."
                  : is403 ? "Invalid or tampered link. Please check the URL or request a new one."
                  : error?.message || "Something went wrong."}
              </p>
              <a href={PUBLIC_SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="bp-error-link" onClick={handleSignupClick}>
                Sign up for access &rarr;
              </a>
            </div>
          </main>
        </div>
      </>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <>
        <style>{PAGE_CSS}</style>
        <div className="bp-wrap">
          <div className="bp-header">
            <Link to="/" className="bp-logo"><HQMark size={30} /><span className="bp-logo-text">Hotline&nbsp;<em>HQ</em></span></Link>
          </div>
          <main className="bp-main">
            <div className="bp-card">
              <div style={{ padding: 22 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 28 }}>
                  <Skeleton w={90} h={26} r={6} />
                  <Skeleton w={140} h={18} />
                </div>
                <Skeleton w="60%" h={32} />
                <div style={{ marginTop: 14 }}><Skeleton w="40%" h={16} /></div>
              </div>
              <div style={{ padding: "14px 22px", background: "var(--bg)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {[1,2,3,4].map(i => <Skeleton key={i} w="100%" h={60} r={12} />)}
                </div>
              </div>
              <div style={{ padding: 22 }}>
                <Skeleton w="100%" h={64} r={12} />
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  const roomName = status?.roomName || `Room ${room}`;

  const content = (
    <div className="bp-wrap">
      <div className="bp-header">
        <Link to="/" className="bp-logo">
          <HQMark size={30} />
          <span className="bp-logo-text">Hotline&nbsp;<em>HQ</em></span>
        </Link>
        <div className="bp-header-side">
          {remaining != null && remaining > 0 && (
            <span className="bp-expires-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              {formatCountdown(remaining)}
            </span>
          )}
          <div className="bp-header-actions">
            <a href={PUBLIC_LOGIN_URL} target="_blank" rel="noopener noreferrer" className="bp-header-link" onClick={handleLoginClick}>Log in</a>
            <a href={PUBLIC_SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="bp-header-btn" onClick={handleSignupClick}>Sign up free</a>
          </div>
        </div>
      </div>

      <main className="bp-main">
        <div className="bp-card" style={{ animation: "bp-fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>

          {/* ── Head Section ── */}
          <div className="bp-dashboard-head">
            <div className="bp-head-main">
              <span className="bp-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/></svg>
              </span>
              <div className="bp-head-copy">
                <p className="bp-kicker">Live listen link</p>
                <h1 className="bp-speaker">{roomName}</h1>
                <p className="bp-timestamp">
                  {status?.broadcasting ? "Broadcasting now" : "No active broadcast"}
                </p>
              </div>
            </div>
            {status?.broadcasting ? (
              <span className="bp-badge bp-badge-live">
                <span className="bp-badge-dot bp-dot-live" />
                LIVE
              </span>
            ) : (
              <span className="bp-badge bp-badge-idle">
                <span className="bp-badge-dot" style={{ background: "var(--subtle)" }} />
                Idle
              </span>
            )}
          </div>

          {/* ── Live Banner (only when broadcasting) ── */}
          {status?.broadcasting && (
            <div className="ll-live-section">
              <div className="ll-live-top">
                <div>
                  <h2 className="ll-live-speaker">{status.speaker || "Unknown"} is broadcasting</h2>
                  <p className="ll-live-meta">
                    {status.participants > 0 && `${status.participants} participant${status.participants !== 1 ? "s" : ""}`}
                    {status.listeners > 0 && ` · ${status.listeners} listener${status.listeners !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <span className="ll-live-timer">{liveDuration}</span>
              </div>
              {connected && (
                <div className="ll-live-audio-indicator">
                  <span className="ll-eq-bar" style={{ animationDelay: "0s" }} />
                  <span className="ll-eq-bar" style={{ animationDelay: "0.15s" }} />
                  <span className="ll-eq-bar" style={{ animationDelay: "0.3s" }} />
                  <span className="ll-eq-bar" style={{ animationDelay: "0.1s" }} />
                  <span className="ll-eq-bar" style={{ animationDelay: "0.25s" }} />
                  <span style={{ fontSize: 12, color: "var(--green)", marginLeft: 8, fontWeight: 600, fontFamily: "var(--mono)" }}>Listening live</span>
                </div>
              )}
            </div>
          )}

          {/* ── Stats Grid ── */}
          {stats && (
            <div className="bp-stat-grid">
              <div className="bp-stat-pill">
                <span className="bp-stat-dot" style={{ background: "var(--red)" }} />
                <div>
                  <span className="bp-stat-value">{stats.total || 0}</span>
                  <span className="bp-stat-label">Broadcasts</span>
                </div>
              </div>
              <div className="bp-stat-pill">
                <span className="bp-stat-dot" style={{ background: "var(--green)" }} />
                <div>
                  <span className="bp-stat-value">{stats.responseRate != null ? `${Math.round(stats.responseRate)}%` : "N/A"}</span>
                  <span className="bp-stat-label">Answered</span>
                </div>
              </div>
              <div className="bp-stat-pill">
                <span className="bp-stat-dot" style={{ background: "#f59e0b" }} />
                <div>
                  <span className="bp-stat-value">{formatDuration(stats.avgDurationMs)}</span>
                  <span className="bp-stat-label">Avg Duration</span>
                </div>
              </div>
              <div className="bp-stat-pill">
                <span className="bp-stat-dot" style={{ background: "#6366f1" }} />
                <div>
                  <span className="bp-stat-value">{formatDuration(stats.avgResponseTimeMs)}</span>
                  <span className="bp-stat-label">Avg Response</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Hourly Chart ── */}
          {hourly.length > 0 && (
            <div className="ll-chart-section">
              <div className="bp-section-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                Hourly Activity
              </div>
              <HourlyChart data={hourly} />
            </div>
          )}

          {/* ── Broadcast List ── */}
          <div className="ll-broadcasts-wrap">
            <div className="bp-section-label" style={{ marginBottom: 14 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              Recent Broadcasts
              {broadcastTotal > 0 && <span style={{ color: "var(--subtle)", fontWeight: 400, letterSpacing: 0 }}>&nbsp;({broadcastTotal})</span>}
            </div>

            {broadcasts.length === 0 ? (
              <div style={{ padding: "28px 0", textAlign: "center", color: "var(--subtle)", fontSize: 14 }}>
                No broadcasts recorded yet.
              </div>
            ) : (
              <div className="ll-broadcast-list">
                {broadcasts.map((b) => (
                  <BroadcastItem
                    key={b.id}
                    broadcast={b}
                    qs={qs}
                    room={room}
                    expanded={expandedBroadcast === b.id}
                    onToggle={() => setExpandedBroadcast(expandedBroadcast === b.id ? null : b.id)}
                  />
                ))}
              </div>
            )}

            {broadcastPages > 1 && (
              <div className="ll-pagination">
                <button className="ll-page-btn" disabled={broadcastPage <= 1} onClick={() => loadPage(broadcastPage - 1)}>Prev</button>
                <span style={{ fontSize: 12, color: "var(--subtle)", fontFamily: "var(--mono)" }}>Page {broadcastPage} of {broadcastPages}</span>
                <button className="ll-page-btn" disabled={broadcastPage >= broadcastPages} onClick={() => loadPage(broadcastPage + 1)}>Next</button>
              </div>
            )}
          </div>

          {/* ── CTA Section ── */}
          <div className="bp-cta-section ll-cta">
            <div className="bp-cta-copy">
              <p className="bp-section-label" style={{ marginBottom: 10 }}>
                <ShieldCheckIcon />
                Join the network
              </p>
              <h2 className="bp-cta-title">Want access to live parts calls like this?</h2>
              <p className="bp-cta-text">
                Join Hotline HQ to hear live room traffic, broadcast your own parts requests, and answer calls as they happen.
              </p>
            </div>

            <div className="bp-cta-trust-grid">
              <div className="bp-cta-trust">
                <span className="bp-cta-trust-value">Free signup</span>
                <span className="bp-cta-trust-label">No card required</span>
              </div>
              <div className="bp-cta-trust">
                <span className="bp-cta-trust-value">{stats?.total || 0} broadcasts</span>
                <span className="bp-cta-trust-label">In this time window</span>
              </div>
              <div className="bp-cta-trust">
                <span className="bp-cta-trust-value">{roomName}</span>
                <span className="bp-cta-trust-label">Room ready on signup</span>
              </div>
            </div>

            <div className="bp-cta-actions">
              <a href={PUBLIC_SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="bp-cta-btn bp-cta-btn-primary" onClick={handleSignupClick}>Sign up free</a>
              <a href={PUBLIC_LOGIN_URL} target="_blank" rel="noopener noreferrer" className="bp-cta-btn bp-cta-btn-secondary" onClick={handleLoginClick}>Log in</a>
            </div>

            <p className="bp-cta-footnote">
              Existing member? Log in and get back to the room faster. New yard? Start free and join the network in minutes.
            </p>
          </div>

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

// ─── Sub-components ──────────────────────────────────────

function HourlyChart({ data }) {
  const max = Math.max(...data.map((d) => d.count || 0), 1);
  return (
    <div className="ll-chart">
      {data.map((d, i) => (
        <div key={i} className="ll-chart-col" title={`${d.hour || i}:00 — ${d.count || 0} broadcasts`}>
          <div className="ll-chart-bar-wrap">
            <div className="ll-chart-bar" style={{ height: `${Math.max(4, ((d.count || 0) / max) * 100)}%` }} />
          </div>
          <span className="ll-chart-label">{d.hour != null ? d.hour : i}</span>
        </div>
      ))}
    </div>
  );
}

function BroadcastItem({ broadcast: b, qs, room, expanded, onToggle }) {
  const hasRecording = b.has_recording || b.hasRecording;
  const answered = b.answered;
  const audioUrl = hasRecording ? `/api/v1/public/live/${room}/audio/${b.id}?${qs}` : null;
  const transcription = b.transcription_preview || b.transcription || b.transcript || "";
  const preview = transcription.length > 80 ? transcription.slice(0, 80) + "..." : transcription;

  return (
    <div className={`ll-broadcast-item ${expanded ? "ll-broadcast-expanded" : ""}`}>
      <div className="ll-broadcast-row" onClick={hasRecording ? onToggle : undefined} style={{ cursor: hasRecording ? "pointer" : "default" }}>
        <div className="ll-broadcast-left">
          <span className="bp-participant-avatar bp-avatar-broadcaster">
            {(b.speaker || b.display_name || "?")[0].toUpperCase()}
          </span>
          <div className="ll-broadcast-info">
            <span className="ll-broadcast-name">{b.speaker || b.display_name || "Unknown"}</span>
            <span className="ll-broadcast-meta">{formatDuration(b.duration_ms || b.durationMs)} · {formatTimeSince(b.created_at || b.createdAt)}</span>
          </div>
        </div>
        <div className="ll-broadcast-right">
          <span className={`bp-badge ${answered ? "bp-badge-ok" : "bp-badge-miss"}`} style={{ fontSize: 10, padding: "3px 10px 3px 8px" }}>
            <span className="bp-badge-dot" />
            {answered ? "Answered" : "Unanswered"}
          </span>
          {hasRecording && <span className="ll-expand-hint">{expanded ? "▲" : "▼"}</span>}
        </div>
      </div>
      {preview && !expanded && (
        <p className="ll-broadcast-preview">{preview}</p>
      )}
      {expanded && hasRecording && (
        <div className="ll-broadcast-player" style={{ animation: "bp-fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both" }}>
          <AudioPlayer src={audioUrl} knownDurationMs={b.duration_ms || b.durationMs} />
          {transcription && (
            <div className="bp-transcript-text" style={{ marginTop: 12 }}>
              <p className="bp-section-label" style={{ marginBottom: 6, fontSize: 10 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Transcript
              </p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--ink)" }}>{transcription}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

// ─── CSS ─────────────────────────────────────────────────
// Reuses bp- classes from PublicBroadcastPage design system.
// ll- prefix for live-listen-specific additions.

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
  background: rgba(255,255,255,0.86);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(22,24,29,0.04);
  position: sticky;
  top: 0;
  z-index: 10;
}
.bp-logo { display: inline-flex; align-items: center; gap: 10px; }
.bp-logo-text { font-family: var(--display); font-weight: 700; font-size: 19px; letter-spacing: -0.01em; color: var(--ink); }
.bp-logo-text em { font-style: normal; color: var(--red); }
.bp-header-side { display: flex; align-items: center; gap: 14px; }
.bp-header-actions { display: flex; align-items: center; gap: 10px; }
.bp-header-link,
.bp-header-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 38px; padding: 0 14px; border-radius: 10px;
  font-size: 13px; font-weight: 700; letter-spacing: 0;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, color 0.16s ease;
}
.bp-header-link { color: var(--ink) !important; background: #f7f5f1; border: 1px solid var(--line); }
.bp-header-btn { color: #fff !important; background: var(--red); border: 1px solid var(--red); box-shadow: 0 8px 18px rgba(217,45,32,0.2); }
.bp-header-link:hover, .bp-header-btn:hover { transform: translateY(-1px); }
.bp-header-btn:hover { background: var(--red-deep); }

.bp-expires-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--mono); font-size: 11px; font-weight: 500;
  color: #b45309; background: rgba(180,83,9,0.06);
  border: 1px solid rgba(180,83,9,0.15);
  padding: 5px 10px; border-radius: 8px;
}

/* Main */
.bp-main { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 38px 18px 54px; }

/* Card */
.bp-card {
  width: 100%; max-width: 760px; background: var(--surface);
  border: 1px solid var(--line); border-radius: 16px; padding: 0; overflow: hidden;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 12px 32px -12px rgba(22,24,29,0.14);
}
@keyframes bp-fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Dashboard Head */
.bp-dashboard-head {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 18px;
  padding: 22px; background: var(--surface); border-bottom: 1px solid var(--line);
}
.bp-head-main { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }
.bp-avatar {
  width: 44px; height: 44px; border-radius: 12px; background: var(--red); color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  font-family: var(--display); font-size: 17px; font-weight: 800;
  box-shadow: 0 8px 18px rgba(217,45,32,0.24);
}
.bp-head-copy { min-width: 0; }
.bp-kicker { margin: 0 0 6px; font-family: var(--mono); font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.bp-speaker { margin: 0; font-family: var(--display); font-weight: 700; font-size: clamp(21px, 3.8vw, 30px); line-height: 1.12; letter-spacing: -0.02em; color: var(--ink); }
.bp-timestamp { display: block; margin-top: 7px; font-family: var(--mono); font-size: 12px; color: var(--subtle); letter-spacing: 0.01em; }

/* Badge */
.bp-badge {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--mono); font-size: 12px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase;
  padding: 5px 14px 5px 11px; border-radius: 999px; white-space: nowrap; margin-top: 2px;
}
.bp-badge-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.bp-badge-ok { background: var(--green-soft); color: #067647; border: 1px solid #abefc6; }
.bp-badge-ok .bp-badge-dot { background: var(--green); box-shadow: 0 0 0 4px rgba(18,183,106,0.15); }
.bp-badge-miss { background: var(--red-soft); color: var(--red-deep); border: 1px solid #fecdca; }
.bp-badge-miss .bp-badge-dot { background: var(--red); box-shadow: 0 0 0 4px rgba(217,45,32,0.13); }
.bp-badge-live { background: var(--red-soft); color: var(--red); border: 1px solid #fecdca; }
.bp-badge-live .bp-dot-live { background: var(--red); animation: ll-pulse 1.5s ease-in-out infinite; }
.bp-badge-idle { background: #f4f2ee; color: var(--subtle); border: 1px solid var(--line); }

/* Stat Grid */
.bp-stat-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;
  padding: 14px 22px; background: var(--bg); border-bottom: 1px solid var(--line);
}
.bp-stat-pill {
  display: flex; align-items: center; gap: 10px; min-width: 0;
  padding: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
}
.bp-stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.bp-stat-pill .bp-stat-value {
  margin: 0; font-family: var(--display); font-size: 17px; line-height: 1; font-weight: 800;
  color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;
}
.bp-stat-pill .bp-stat-label { display: block; margin-top: 4px; font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--subtle); }

/* Section label */
.bp-section-label {
  display: flex; align-items: center; gap: 7px;
  font-family: var(--mono); font-size: 11px; font-weight: 600;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--subtle); margin-bottom: 14px;
}
.bp-section-label svg { color: var(--subtle); }

/* Player */
.bp-player { display: flex; align-items: center; gap: 14px; background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 16px; }
.bp-player-row { display: flex; align-items: center; gap: 14px; width: 100%; }
.bp-play-btn {
  width: 42px; height: 42px; border-radius: 12px; border: none; background: var(--red); color: #fff;
  display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
  transition: background 0.2s, transform 0.15s; box-shadow: 0 8px 18px rgba(217,45,32,0.26);
}
.bp-play-btn:hover { background: var(--red-deep); transform: scale(1.06); }
.bp-play-btn:active { transform: scale(0.97); }
.bp-play-btn svg { margin-left: 1px; }
.bp-time { font-family: var(--mono); font-size: 12px; color: var(--subtle); min-width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
.bp-time-total { text-align: left; }
.bp-time-combined { display: none; }
.bp-track { flex: 1; height: 36px; cursor: pointer; position: relative; }
.bp-waveform { display: flex; align-items: center; gap: 2px; height: 100%; }
.bp-bar { flex: 1; border-radius: 1px; transition: background-color 0.08s; }
.bp-track-fallback { width: 100%; height: 4px; background: #e7e4dd; border-radius: 2px; position: absolute; top: 50%; transform: translateY(-50%); }
.bp-track-fill { height: 100%; background: var(--red); border-radius: 2px; transition: width 0.1s linear; }

/* Participant avatar */
.bp-participant-avatar {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, #ffe0de 0%, #fef3f2 100%); border: 1px solid #fecdca;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--display); font-weight: 700; font-size: 14px; color: var(--red); flex-shrink: 0;
}
.bp-avatar-broadcaster { background: linear-gradient(135deg, #d92d20 0%, #b42318 100%); border-color: #d92d20; color: #fff; }

/* Transcript */
.bp-transcript-text {
  font-family: var(--body); font-size: 14px; line-height: 1.7; color: var(--ink);
  background: var(--bg); border: 1px solid var(--line); border-radius: 12px;
  padding: 18px 22px; white-space: pre-wrap; word-wrap: break-word;
}

/* CTA Section */
.bp-cta-section {
  padding: 22px; border-radius: 18px;
  background: radial-gradient(circle at top right, rgba(217,45,32,0.08), transparent 36%), linear-gradient(180deg, #fff8f7 0%, #ffffff 100%);
  border: 1px solid #f6d4cf; box-shadow: 0 12px 30px -20px rgba(217,45,32,0.35);
}
.bp-cta-title { margin: 0; font-family: var(--display); font-size: clamp(24px, 4vw, 32px); line-height: 1.08; letter-spacing: -0.02em; color: var(--ink); }
.bp-cta-text { margin: 10px 0 0; max-width: 560px; font-size: 15px; line-height: 1.6; color: var(--muted); }
.bp-cta-trust-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
.bp-cta-trust { padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.84); border: 1px solid #f3ddd9; }
.bp-cta-trust-value { display: block; font-family: var(--display); font-size: 17px; font-weight: 800; line-height: 1.1; color: var(--ink); }
.bp-cta-trust-label { display: block; margin-top: 5px; font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.bp-cta-actions { display: flex; gap: 12px; margin-top: 18px; }
.bp-cta-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 48px; padding: 0 18px; border-radius: 12px; font-size: 15px; font-weight: 800;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, border-color 0.16s ease;
}
.bp-cta-btn:hover { transform: translateY(-1px); }
.bp-cta-btn-primary { color: #fff !important; background: var(--red); border: 1px solid var(--red); box-shadow: 0 10px 24px rgba(217,45,32,0.24); }
.bp-cta-btn-primary:hover { background: var(--red-deep); }
.bp-cta-btn-secondary { color: var(--ink) !important; background: #fff; border: 1px solid var(--line); }
.bp-cta-footnote { margin: 12px 0 0; font-size: 13px; line-height: 1.55; color: var(--muted); }

/* Error */
.bp-card-error { text-align: center; padding: 56px 38px; }
.bp-error-icon { margin-bottom: 20px; opacity: 0.7; }
.bp-error-title { font-family: var(--display); font-weight: 700; font-size: 26px; letter-spacing: -0.02em; margin: 0 0 10px; }
.bp-error-msg { font-size: 15px; color: var(--muted); line-height: 1.6; margin: 0 0 28px; max-width: 360px; margin-left: auto; margin-right: auto; }
.bp-error-link { font-family: var(--mono); font-size: 13px; font-weight: 500; color: var(--red) !important; letter-spacing: 0.02em; transition: opacity 0.2s; }
.bp-error-link:hover { opacity: 0.7; }

/* Footer */
.bp-footer {
  display: flex; align-items: center; justify-content: center; gap: 10px; padding: 20px;
  font-family: var(--mono); font-size: 12px; color: var(--subtle);
  border-top: 1px solid var(--line); margin-top: auto; background: var(--surface);
}

/* Shimmer */
.bp-shimmer { background: linear-gradient(90deg, #f0ede8 25%, #f7f5f1 50%, #f0ede8 75%); background-size: 200% 100%; animation: bp-shimmer 1.6s ease infinite; }
@keyframes bp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ─── Live-Listen-specific (ll-) ─── */

/* Live banner — full-bleed padded section (like bp-player-section) */
.ll-live-section {
  padding: 18px 22px;
  background: linear-gradient(135deg, var(--red-soft) 0%, #fff 60%);
  border-bottom: 1px solid var(--line);
}
.ll-live-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.ll-live-speaker { font-family: var(--display); font-size: clamp(18px, 3vw, 24px); font-weight: 700; color: var(--ink); margin: 0 0 4px; letter-spacing: -0.02em; }
.ll-live-meta { font-size: 13px; color: var(--muted); margin: 0; }
.ll-live-timer { font-family: var(--mono); font-size: 18px; font-weight: 600; color: var(--red); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.ll-live-audio-indicator { display: flex; align-items: flex-end; gap: 3px; margin-top: 14px; height: 18px; }
.ll-eq-bar { width: 4px; border-radius: 2px; background: var(--red); animation: ll-eq 0.8s ease-in-out infinite alternate; }
@keyframes ll-eq { 0% { height: 4px; } 100% { height: 16px; } }
@keyframes ll-pulse {
  0% { box-shadow: 0 0 0 0 rgba(217,45,32,0.4); }
  70% { box-shadow: 0 0 0 8px rgba(217,45,32,0); }
  100% { box-shadow: 0 0 0 0 rgba(217,45,32,0); }
}

/* Chart section — full-bleed padded section (like bp-player-section) */
.ll-chart-section {
  padding: 22px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.ll-chart { display: flex; align-items: flex-end; gap: 3px; height: 72px; }
.ll-chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.ll-chart-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.ll-chart-bar { width: 100%; max-width: 24px; background: linear-gradient(180deg, var(--red), rgba(217,45,32,0.3)); border-radius: 3px 3px 0 0; transition: height 0.3s ease; }
.ll-chart-label { font-family: var(--mono); font-size: 8px; color: var(--subtle); }

/* Broadcasts wrapper — inset with margin (like bp-participants-section) */
.ll-broadcasts-wrap {
  margin: 22px 22px 0;
  padding-top: 0;
  border-top: none;
}

/* Broadcast list */
.ll-broadcast-list { display: flex; flex-direction: column; gap: 8px; }
.ll-broadcast-item {
  background: var(--bg); border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.ll-broadcast-item:hover { border-color: rgba(217,45,32,0.2); }
.ll-broadcast-expanded { border-color: rgba(217,45,32,0.3); box-shadow: 0 4px 16px -6px rgba(22,24,29,0.1); }
.ll-broadcast-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; gap: 12px; }
.ll-broadcast-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ll-broadcast-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ll-broadcast-name { font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ll-broadcast-meta { font-family: var(--mono); font-size: 11px; color: var(--subtle); }
.ll-broadcast-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.ll-expand-hint { font-size: 10px; color: var(--subtle); }
.ll-broadcast-preview { margin: 0; padding: 0 16px 12px; font-size: 13px; line-height: 1.5; color: var(--muted); font-style: italic; }
.ll-broadcast-player { padding: 0 16px 16px; }

/* Pagination */
.ll-pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 16px; }
.ll-page-btn {
  font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--ink);
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 6px 16px;
  cursor: pointer; transition: background 0.15s, transform 0.15s;
}
.ll-page-btn:hover:not(:disabled) { background: #f7f5f1; transform: translateY(-1px); }
.ll-page-btn:disabled { opacity: 0.3; cursor: default; }

/* CTA — inset with margin (matches bp-cta-section in broadcast page) */
.ll-cta { margin: 22px; }

/* Mobile */
@media (max-width: 640px) {
  .bp-main { padding: 28px 12px 48px; }
  .bp-header { padding: 14px 16px; }
  .bp-header-side { gap: 8px; }
  .bp-header-actions { gap: 8px; }
  .bp-header-link, .bp-header-btn { min-height: 34px; padding: 0 11px; font-size: 12px; }
  .bp-expires-badge { font-size: 10px; padding: 4px 8px; }
  .bp-dashboard-head { flex-direction: column; padding: 18px; gap: 14px; }
  .bp-badge { margin-top: 0; }
  .bp-stat-grid { grid-template-columns: 1fr 1fr; padding: 12px; gap: 8px; }
  .bp-stat-pill { padding: 10px; }
  .bp-stat-pill .bp-stat-value { max-width: 110px; font-size: 15px; }
  .ll-live-section { padding: 16px; }
  .ll-live-speaker { font-size: 18px; }
  .ll-chart-section { padding: 16px; }
  .ll-chart { height: 56px; }
  .ll-chart-label { font-size: 7px; }
  .ll-broadcasts-wrap { margin: 16px; }
  .ll-broadcast-row { padding: 10px 12px; flex-wrap: wrap; }
  .ll-broadcast-preview { padding: 0 12px 10px; }
  .ll-broadcast-player { padding: 0 12px 12px; }
  .bp-player { padding: 10px; flex-direction: column; gap: 6px; align-items: stretch; }
  .bp-player-row { display: flex !important; align-items: center; gap: 10px; }
  .bp-play-btn { width: 38px; height: 38px; flex-shrink: 0; }
  .bp-time-combined { display: block; font-family: var(--mono); font-size: 11px; color: var(--subtle); font-variant-numeric: tabular-nums; white-space: nowrap; padding-left: 48px; }
  .bp-time-current { display: none; }
  .bp-time-total { display: none; }
  .bp-track { flex: 1; min-width: 0; height: 38px; }
  .bp-waveform { gap: 1px; height: 38px; }
  .ll-cta { margin: 16px; }
  .bp-cta-section { padding: 18px; border-radius: 16px; }
  .bp-cta-trust-grid { grid-template-columns: 1fr; }
  .bp-cta-actions { flex-direction: column; }
  .bp-cta-btn { width: 100%; }
}
`;
