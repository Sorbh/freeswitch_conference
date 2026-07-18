import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Play, Radio, Users, X } from "lucide-react";

function AnimatedHQMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className="l2-ba-mark">
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#d92d20" />
      <path
        d="M33.8 30.7v2.6a2.3 2.3 0 0 1-2.5 2.3 23 23 0 0 1-10-3.6 22.7 22.7 0 0 1-7-7 23 23 0 0 1-3.5-10.1 2.3 2.3 0 0 1 2.3-2.5h2.6a2.3 2.3 0 0 1 2.3 2c.1 1 .4 2.1.7 3.1a2.3 2.3 0 0 1-.5 2.4l-1.1 1.1a18.4 18.4 0 0 0 6.7 6.7l1.1-1.1a2.3 2.3 0 0 1 2.4-.5c1 .3 2 .6 3.1.7a2.3 2.3 0 0 1 2 2.3z"
        fill="#ffffff"
      />
      <path className="l2-ba-wave1" d="M30.5 13.6a8.6 8.6 0 0 1 5 5" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
      <path className="l2-ba-wave2" d="M32.8 8.4a14.3 14.3 0 0 1 8 8" stroke="#ffb4ad" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor((milliseconds || 0) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function timeAgo(timestamp) {
  if (!timestamp) return "Just now";
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getResponderNames(broadcast) {
  const broadcaster = broadcast?.display_name;
  const names = (broadcast?.participants || [])
    .map((p) => p?.displayName || p?.display_name)
    .filter((name) => name && name !== broadcaster);
  if (names.length) return [...new Set(names)];
  return (broadcast?.responded_by || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

function playChime(context) {
  if (!context || context.state !== "running") return;
  try {
    const start = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
    gain.connect(context.destination);
    [880, 1175].forEach((freq, i) => {
      const osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start + i * 0.1);
      osc.connect(gain);
      osc.start(start + i * 0.1);
      osc.stop(start + 0.45);
    });
  } catch {}
}

const CSS = `
.l2-ba-stack {
  position: fixed; right: 22px; bottom: 22px; z-index: 80;
  display: flex; flex-direction: column; align-items: stretch; gap: 10px;
  width: min(340px, calc(100vw - 32px));
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* ── animated brand mark loader ── */
.l2-ba-loader {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  border-radius: 12px; background: #fff;
  border: 1px solid #e7e4dd;
  box-shadow: 0 4px 24px -6px rgba(22,24,29,0.12);
  animation: l2-ba-fade-in .3s ease-out;
}
.l2-ba-loader-text { color: #5d6370; font-size: 13px; font-weight: 500; }
.l2-ba-mark { flex-shrink: 0; }
@keyframes l2-ba-pulse1 {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes l2-ba-pulse2 {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 0.15; }
}
.l2-ba-wave1 { animation: l2-ba-pulse1 1.4s ease-in-out infinite; }
.l2-ba-wave2 { animation: l2-ba-pulse2 1.4s ease-in-out infinite 0.2s; }

/* ── latest broadcast card ── */
.l2-ba-card {
  padding: 0; overflow: hidden;
  border-radius: 12px; background: #fff;
  border: 1px solid #e7e4dd;
  box-shadow: 0 8px 32px -8px rgba(22,24,29,0.18);
  animation: l2-ba-slide-up .28s ease-out;
}
@keyframes l2-ba-slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.l2-ba-card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px 9px;
  background: linear-gradient(135deg, #fef3f2 0%, #fff 100%);
  border-bottom: 1px solid #f3f0eb;
}
.l2-ba-card-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: "IBM Plex Mono", monospace; font-size: 10px; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase; color: #d92d20;
}
.l2-ba-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #d92d20;
  animation: l2-ba-blink 2s ease-in-out infinite;
}
@keyframes l2-ba-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.l2-ba-card-time {
  font-family: "IBM Plex Mono", monospace; font-size: 10.5px; color: #8c908f;
}
.l2-ba-card-head-right { display: inline-flex; align-items: center; gap: 8px; }
.l2-ba-card-body { padding: 12px 14px 14px; }
.l2-ba-who {
  display: flex; align-items: center; gap: 11px; min-width: 0;
}
.l2-ba-avatar {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 36px; height: 36px; border-radius: 9px;
  background: #fef3f2; color: #d92d20;
}
.l2-ba-who-info { min-width: 0; display: grid; gap: 1px; flex: 1; }
.l2-ba-name-line {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0;
}
.l2-ba-who-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 14px; font-weight: 600; color: #16181d; line-height: 1.3;
}
.l2-ba-who-room {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; color: #5d6370; line-height: 1.3;
}

.l2-ba-meta {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin-top: 10px; padding-top: 10px; border-top: 1px solid #f3f0eb;
}
.l2-ba-meta-item {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: "IBM Plex Mono", monospace; font-size: 11px; color: #5d6370;
}
.l2-ba-meta-item svg { color: #a3a094; }
.l2-ba-status-answered {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 600; color: #087443;
}
.l2-ba-status-unanswered {
  font-family: "IBM Plex Mono", monospace; font-size: 11px; color: #a3a094;
}
.l2-ba-play-row {
  display: flex; align-items: center;
  margin-top: 10px; padding-top: 10px; border-top: 1px solid #f3f0eb;
}
.l2-ba-responders {
  display: flex; align-items: center; gap: 5px; min-width: 0;
  font-size: 12px; color: #5d6370; line-height: 1.35;
}
.l2-ba-responders svg { flex-shrink: 0; color: #087443; }
.l2-ba-responders span {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.l2-ba-play-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; padding: 0; flex-shrink: 0;
  border-radius: 999px; border: none; cursor: pointer;
  background: #d92d20; color: #fff;
  box-shadow: 0 4px 12px -4px rgba(217,45,32,0.5);
  transition: background .15s, transform .12s;
}
.l2-ba-play-btn svg { color: #fff; fill: #fff; }
.l2-ba-play-btn:hover { background: #b42318; transform: scale(1.06); }

/* ── notification toasts ── */
.l2-ba-toast {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 10px;
  padding: 12px 14px;
  border-radius: 12px; background: #fff;
  border: 1px solid #e7e4dd;
  box-shadow: 0 8px 32px -8px rgba(22,24,29,0.18);
  animation: l2-ba-toast-in .24s ease-out;
}
@keyframes l2-ba-toast-in {
  from { opacity: 0; transform: translateX(20px) scale(0.96); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}
.l2-ba-toast-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
}
.l2-ba-toast-icon.live { background: #fef3f2; color: #d92d20; }
.l2-ba-toast-icon.reply { background: #edf9f1; color: #087443; }
.l2-ba-toast-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.l2-ba-toast-title { font-size: 13.5px; font-weight: 600; color: #16181d; }
.l2-ba-toast-detail { font-size: 12.5px; color: #5d6370; line-height: 1.4; }
.l2-ba-toast-action {
  display: inline-flex; align-items: center; gap: 4px; align-self: flex-start;
  margin-top: 4px; padding: 0; border: none; background: none; cursor: pointer;
  font-size: 12px; font-weight: 700; color: #d92d20; text-decoration: none;
}
.l2-ba-toast-action:hover { color: #b42318; }
.l2-ba-toast-dismiss {
  padding: 2px; border: none; background: none; cursor: pointer;
  color: #a3a094; transition: color .15s;
}
.l2-ba-toast-dismiss:hover { color: #16181d; }

@keyframes l2-ba-fade-in { from { opacity: 0; } to { opacity: 1; } }

@media (max-width: 760px) {
  .l2-ba-stack {
    right: 12px; bottom: calc(62px + env(safe-area-inset-bottom, 0px));
    width: calc(100vw - 24px);
  }
}
`;

function broadcastKey(broadcast) {
  if (!broadcast) return null;
  return `${broadcast.id ?? ""}|${broadcast.created_at ?? ""}|${broadcast.url ?? ""}`;
}

export default function PublicBroadcastActivity() {
  const [latest, setLatest] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [notices, setNotices] = useState([]);
  const [dismissedKey, setDismissedKey] = useState(null);
  const audioContextRef = useRef(null);
  const noticeTimersRef = useRef(new Set());
  const prefetchedRef = useRef(new Set());

  // Warm the browser cache for the latest recordings — the public audio
  // endpoint serves immutable+max-age, so the /b/<token> share page (waveform
  // fetch + player, same URL) starts instantly. Sequential + low priority.
  const prefetchAudio = useCallback((items) => {
    const targets = (items || [])
      .filter((b) => b && b.token && b.has_recording)
      .filter((b) => !prefetchedRef.current.has(b.token));
    if (targets.length === 0) return;
    targets.forEach((b) => prefetchedRef.current.add(b.token));
    (async () => {
      for (const b of targets) {
        try {
          const res = await fetch(`/api/v1/public/broadcast/${b.token}/audio`, { priority: "low" });
          if (res.ok) await res.blob(); // drain so the full file lands in cache
        } catch {}
      }
    })();
  }, []);

  const unlockSound = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.resume?.().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioContextRef.current = new AC();
      audioContextRef.current.resume?.().catch(() => {});
    } catch {}
  }, []);

  const dismissNotice = useCallback((id) => {
    setNotices((cur) => cur.filter((n) => n.id !== id));
  }, []);

  const showNotice = useCallback((notice) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotices((cur) => [...cur, { ...notice, id }].slice(-3));
    playChime(audioContextRef.current);
    const timer = window.setTimeout(() => {
      noticeTimersRef.current.delete(timer);
      dismissNotice(id);
    }, 6500);
    noticeTimersRef.current.add(timer);
  }, [dismissNotice]);

  useEffect(() => {
    fetch("/api/v1/public/broadcasts/latest")
      .then((r) => r.json())
      .then((p) => {
        if (!p.status) return;
        setLatest(p.data || null);
        prefetchAudio(Array.isArray(p.recent) && p.recent.length ? p.recent : [p.data]);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));

    const soundEvents = ["pointerdown", "keydown"];
    soundEvents.forEach((e) => document.addEventListener(e, unlockSound, { once: true }));

    const stream = new EventSource("/api/v1/public/broadcasts/events");
    stream.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        if (event.type === "connected") {
          if (event.latest) setLatest(event.latest);
          return;
        }
        if (event.type === "broadcast_started") {
          showNotice({
            kind: "live",
            title: "Live broadcast",
            detail: `${event.broadcaster?.displayName || "A network member"} is broadcasting${event.room_name ? ` in ${event.room_name}` : ""}.`,
            href: "#listen-live",
            action: "Listen live",
          });
          return;
        }
        if (event.type === "broadcast_replied") {
          showNotice({
            kind: "reply",
            title: "Yard responded",
            detail: `${event.responder?.displayName || "A member"} replied to ${event.broadcaster?.displayName || "the broadcast"}.`,
            href: "#listen-live",
            action: "Hear it live",
          });
          return;
        }
        if (event.type === "broadcast_finished" && event.data) {
          setLatest(event.data);
          prefetchAudio([event.data]);
        }
      } catch {}
    };

    return () => {
      stream.close();
      soundEvents.forEach((e) => document.removeEventListener(e, unlockSound));
      noticeTimersRef.current.forEach((t) => window.clearTimeout(t));
      noticeTimersRef.current.clear();
      audioContextRef.current?.close?.().catch(() => {});
    };
  }, [showNotice, unlockSound, prefetchAudio]);

  const responders = getResponderNames(latest);

  return (
    <>
      <style>{CSS}</style>
      <div className="l2-ba-stack" aria-live="polite" aria-atomic="false">
        {notices.map((n) => (
          <div className="l2-ba-toast" key={n.id}>
            <span className={`l2-ba-toast-icon ${n.kind}`}>
              <Radio size={16} aria-hidden="true" />
            </span>
            <div className="l2-ba-toast-body">
              <span className="l2-ba-toast-title">{n.title}</span>
              <span className="l2-ba-toast-detail">{n.detail}</span>
              <a className="l2-ba-toast-action" href={n.href}>
                {n.action} &rarr;
              </a>
            </div>
            <button className="l2-ba-toast-dismiss" type="button" onClick={() => dismissNotice(n.id)} aria-label="Dismiss">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ))}

        {!loaded && (
          <div className="l2-ba-loader">
            <AnimatedHQMark size={36} />
            <span className="l2-ba-loader-text">Connecting to network&hellip;</span>
          </div>
        )}

        {loaded && latest && broadcastKey(latest) !== dismissedKey && (
          <aside className="l2-ba-card" aria-label="Latest broadcast">
            <div className="l2-ba-card-head">
              <span className="l2-ba-card-badge">
                <span className="l2-ba-dot" />
                Latest broadcast
              </span>
              <span className="l2-ba-card-head-right">
                <time className="l2-ba-card-time">{timeAgo(latest.created_at)}</time>
                <button
                  className="l2-ba-toast-dismiss"
                  type="button"
                  onClick={() => setDismissedKey(broadcastKey(latest))}
                  aria-label="Dismiss latest broadcast"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            </div>
            <div className="l2-ba-card-body">
              <div className="l2-ba-who">
                <span className="l2-ba-avatar">
                  <Radio size={18} aria-hidden="true" />
                </span>
                <div className="l2-ba-who-info">
                  <div className="l2-ba-name-line">
                    <span className="l2-ba-who-name">{latest.display_name}</span>
                    {latest.url && (
                      <Link
                        className="l2-ba-play-btn"
                        to={latest.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Play broadcast"
                        title="Play broadcast"
                      >
                        <Play size={14} fill="currentColor" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                  <span className="l2-ba-who-room">{latest.room_name || "Network room"}</span>
                </div>
              </div>

              <div className="l2-ba-meta">
                <span className="l2-ba-meta-item">
                  <Clock size={13} aria-hidden="true" />
                  {formatDuration(latest.duration_ms)}
                </span>
                {latest.answered ? (
                  <span className="l2-ba-status-answered">
                    <CheckCircle2 size={13} aria-hidden="true" />
                    Answered
                  </span>
                ) : (
                  <span className="l2-ba-status-unanswered">Unanswered</span>
                )}
              </div>

              {responders.length > 0 && (
                <div className="l2-ba-play-row">
                  <div className="l2-ba-responders">
                    <Users size={13} aria-hidden="true" />
                    <span>{responders.join(", ")}</span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
