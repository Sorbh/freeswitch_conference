import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Radio, Users, X } from "lucide-react";

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor((milliseconds || 0) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "Just now";
  return new Date(timestamp * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getResponderNames(broadcast) {
  const broadcaster = broadcast?.display_name;
  const names = (broadcast?.participants || [])
    .map((participant) => participant?.displayName || participant?.display_name)
    .filter((name) => name && name !== broadcaster);
  if (names.length) return [...new Set(names)];
  return (broadcast?.responded_by || "")
    .split(",")
    .map((name) => name.trim())
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

    [880, 1175].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start + index * 0.1);
      oscillator.connect(gain);
      oscillator.start(start + index * 0.1);
      oscillator.stop(start + 0.45);
    });
  } catch {}
}

export default function PublicBroadcastActivity() {
  const [latest, setLatest] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [notices, setNotices] = useState([]);
  const audioContextRef = useRef(null);
  const noticeTimersRef = useRef(new Set());

  const unlockSound = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.resume?.().catch(() => {});
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      audioContextRef.current = new AudioContext();
      audioContextRef.current.resume?.().catch(() => {});
    } catch {}
  }, []);

  const dismissNotice = useCallback((id) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const showNotice = useCallback((notice) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotices((current) => [...current, { ...notice, id }].slice(-3));
    playChime(audioContextRef.current);
    const timer = window.setTimeout(() => {
      noticeTimersRef.current.delete(timer);
      dismissNotice(id);
    }, 6500);
    noticeTimersRef.current.add(timer);
  }, [dismissNotice]);

  useEffect(() => {
    fetch("/api/v1/public/broadcasts/latest")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.status) setLatest(payload.data || null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));

    const soundEvents = ["pointerdown", "keydown"];
    soundEvents.forEach((eventName) => document.addEventListener(eventName, unlockSound, { once: true }));

    const stream = new EventSource("/api/v1/public/broadcasts/events");
    stream.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data);
        if (event.type === "connected") {
          if (event.latest) setLatest(event.latest);
          return;
        }
        if (event.type === "broadcast_started") {
          showNotice({
            kind: "live",
            title: "Live broadcast started",
            detail: `${event.broadcaster?.displayName || "A network member"} is broadcasting${event.room_name ? ` in ${event.room_name}` : ""}.`,
            href: "#listen-live",
            action: "Listen live",
          });
          return;
        }
        if (event.type === "broadcast_replied") {
          showNotice({
            kind: "reply",
            title: "A yard replied",
            detail: `${event.responder?.displayName || "A network member"} joined ${event.broadcaster?.displayName || "the broadcast"}.`,
            href: "#listen-live",
            action: "Hear it live",
          });
          return;
        }
        if (event.type === "broadcast_finished" && event.data) {
          setLatest(event.data);
        }
      } catch {}
    };

    return () => {
      stream.close();
      soundEvents.forEach((eventName) => document.removeEventListener(eventName, unlockSound));
      noticeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      noticeTimersRef.current.clear();
      audioContextRef.current?.close?.().catch(() => {});
    };
  }, [showNotice, unlockSound]);

  const responders = getResponderNames(latest);

  return (
    <div className="l2-broadcast-notices" aria-live="polite" aria-atomic="false">
      {notices.map((notice) => (
          <div className="l2-broadcast-notice" key={notice.id}>
            <span className={`l2-broadcast-notice-icon ${notice.kind}`}><Radio size={17} aria-hidden="true" /></span>
            <div className="l2-broadcast-notice-copy">
              <strong>{notice.title}</strong>
              <span>{notice.detail}</span>
              <a href={notice.href}>{notice.action}</a>
            </div>
            <button type="button" onClick={() => dismissNotice(notice.id)} aria-label="Dismiss notification">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
      ))}

      {loaded && latest && (
        <aside className="l2-broadcast-latest" aria-label="Latest broadcast">
          <div className="l2-broadcast-latest-head">
            <span>Latest broadcast</span>
            <time>{formatTimestamp(latest.created_at)}</time>
          </div>
          <div className="l2-broadcast-origin">
            <span className="l2-broadcast-icon"><Radio size={17} aria-hidden="true" /></span>
            <div>
              <strong>{latest.display_name}</strong>
              <span className="l2-broadcast-room">{latest.room_name || "Network room"}</span>
            </div>
          </div>
          <div className="l2-broadcast-responders">
            {responders.length ? (
              <div className="l2-broadcast-name-list" title={responders.join(", ")}>
                <Users size={14} aria-hidden="true" />
                <span>{responders.join(", ")}</span>
              </div>
            ) : (
              <span className="l2-broadcast-no-replies">No response recorded</span>
            )}
          </div>
          <div className="l2-broadcast-actions">
            <span>{formatDuration(latest.duration_ms)}</span>
            {latest.url ? (
              <Link className="l2-broadcast-play" to={latest.url} aria-label="Play latest broadcast" title="Play latest broadcast">
                <Play size={16} fill="currentColor" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </aside>
      )}
    </div>
  );
}
