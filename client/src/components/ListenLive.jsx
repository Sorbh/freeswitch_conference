import { useEffect, useRef, useState, useCallback } from "react";
import { useListenLive } from "../hooks/useListenLive";

/* ------------------------------------------------------------------ */
/*  ListenLive — live broadcast monitor for the landing page.          */
/*  Left: player (listen-only audio). Right: live activity feed of     */
/*  caller IDs via public SSE — visible before pressing play, so the   */
/*  section reads as a living network monitor, not a dead widget.      */
/* ------------------------------------------------------------------ */

// Signup CTA: shows right after the first broadcast the visitor hears,
// but never sooner than CTA_MIN_LISTEN_MS of listening. If the room stays
// quiet, CTA_FALLBACK_MS is the backstop so the ask still appears.
const CTA_MIN_LISTEN_MS = 20 * 1000;
const CTA_FALLBACK_MS = 3 * 60 * 1000;
const VU_BARS = 14;
// Featured room: California carries most of the broadcast traffic.
// Falls back to the busiest live room if CA is offline.
const FEATURED_SHORT_CODE = "CA";

const STEPS = [
  {
    n: "1",
    title: "Broadcast the request",
    copy: (<>A customer asks for a part you don&rsquo;t have. Pick up the handset and <strong>say it once</strong> — every yard in your region hears it instantly.</>),
  },
  {
    n: "2",
    title: "A yard answers",
    copy: (<>Members monitor the room hands-free. The yard sitting on your part unmutes and replies. Typical answer time is <strong>about two seconds</strong>.</>),
  },
  {
    n: "3",
    title: "Close the sale",
    copy: (<>Talk it through live or take it private. Your customer gets the part, both yards get paid — and the call is <strong>logged and recorded</strong>.</>),
  },
];

/* VU meter driven by the real audio stream; idle bars when not playing. */
function VuMeter({ stream, active }) {
  const barsRef = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active || !stream) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let ctx, analyser, source;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch {
      return;
    }
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.floor(data.length / VU_BARS) || 1;
      for (let i = 0; i < VU_BARS; i++) {
        const el = barsRef.current[i];
        if (el) el.style.transform = `scaleY(${Math.max(0.1, data[i * step] / 255)})`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      try { source.disconnect(); ctx.close(); } catch {}
      barsRef.current.forEach((el) => { if (el) el.style.transform = "scaleY(0.1)"; });
    };
  }, [stream, active]);

  return (
    <span className={`llv-vu ${active ? "on" : ""}`} aria-hidden="true">
      {Array.from({ length: VU_BARS }, (_, i) => (
        <span key={i} ref={(el) => (barsRef.current[i] = el)} />
      ))}
    </span>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <rect x="6.5" y="5.5" width="4" height="13" rx="1" />
      <rect x="13.5" y="5.5" width="4" height="13" rx="1" />
    </svg>
  );
}

export default function ListenLive({ signupUrl }) {
  const { room, state, error, stream, start, stop } = useListenLive();
  const [rooms, setRooms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [speakers, setSpeakers] = useState([]);
  const [recent, setRecent] = useState([]);
  const [online, setOnline] = useState(0);
  const [showCta, setShowCta] = useState(false);
  const ctaTimerRef = useRef(null);
  const ctaHeardTimerRef = useRef(null);
  const listenStartRef = useRef(null);
  const prevSpeakersRef = useRef(new Set());
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const refreshRooms = useCallback(() => {
    fetch("/api/v1/public/listen/rooms")
      .then((r) => r.json())
      .then((j) => {
        if (!j.status) return;
        setRooms(j.data);
        setSelected((cur) => {
          if (cur && j.data.some((r) => r.id === cur)) return cur;
          const featured = j.data.find((r) => r.shortCode === FEATURED_SHORT_CODE);
          return featured?.id ?? (j.data.slice().sort((a, b) => b.online - a.online)[0]?.id ?? null);
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshRooms();
    const t = setInterval(refreshRooms, 30 * 1000);
    return () => clearInterval(t);
  }, [refreshRooms]);

  // Live activity feed — open as soon as the section is on screen,
  // independent of audio playback. Seeing names is the hook.
  useEffect(() => {
    if (!selected) return;
    prevSpeakersRef.current = new Set();
    setSpeakers([]);
    setRecent([]);
    const es = new EventSource(`/api/v1/public/listen/events/${selected}`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (typeof data.online === "number") setOnline(data.online);
        if (Array.isArray(data.speakers)) {
          setSpeakers(data.speakers);
          // CTA trigger, armed here (not in an effect) so a short broadcast
          // burst can't slip between React renders: first speakers frame
          // heard while live → CTA at the 20s-listening floor.
          if (data.speakers.length > 0 && stateRef.current === "live" && !ctaHeardTimerRef.current) {
            const elapsed = Date.now() - (listenStartRef.current || Date.now());
            ctaHeardTimerRef.current = setTimeout(
              () => setShowCta(true),
              Math.max(0, CTA_MIN_LISTEN_MS - elapsed)
            );
          }
          const prev = prevSpeakersRef.current;
          const fresh = data.speakers.filter((s) => !prev.has(s.name));
          if (fresh.length) {
            const at = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            setRecent((old) =>
              [...fresh.map((s) => ({ ...s, at })), ...old]
                .filter((x, i, arr) => arr.findIndex((y) => y.name === x.name) === i)
                .slice(0, 5)
            );
          }
          prevSpeakersRef.current = new Set(data.speakers.map((s) => s.name));
        }
      } catch {}
    };
    return () => es.close();
  }, [selected]);

  // Signup CTA: fallback clock starts when listening starts
  useEffect(() => {
    if (state !== "live") {
      if (ctaTimerRef.current) { clearTimeout(ctaTimerRef.current); ctaTimerRef.current = null; }
      if (ctaHeardTimerRef.current) { clearTimeout(ctaHeardTimerRef.current); ctaHeardTimerRef.current = null; }
      setShowCta(false);
      listenStartRef.current = null;
      return;
    }
    listenStartRef.current = Date.now();
    ctaTimerRef.current = setTimeout(() => setShowCta(true), CTA_FALLBACK_MS);
    // someone is already on air as playback starts → that counts as heard
    if (prevSpeakersRef.current.size > 0 && !ctaHeardTimerRef.current) {
      ctaHeardTimerRef.current = setTimeout(() => setShowCta(true), CTA_MIN_LISTEN_MS);
    }
    return () => { if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current); };
  }, [state]);

  // (Primary trigger lives in the SSE onmessage handler above — armed the
  // instant a speakers frame arrives while live, immune to render timing.)

  if (rooms.length === 0 && state === "idle") return null;

  const selectedRoom = rooms.find((r) => r.id === selected) || rooms[0];
  const liveHere = state === "live" && room === selectedRoom?.id;
  const connecting = state === "connecting" && room === selectedRoom?.id;
  const yardCount = online || selectedRoom?.online || 0;

  const togglePlay = () => {
    if (!selectedRoom) return;
    if ((state === "live" || state === "connecting") && room === selectedRoom.id) stop();
    else start(selectedRoom.id);
  };

  const statusTitle =
    connecting ? "Connecting…"
    : liveHere ? `Listening to ${selectedRoom.name}`
    : `Hear the ${selectedRoom?.name ?? ""} room live`;

  const statusSub =
    state === "error" ? (error || "Something went wrong — press play to try again")
    : liveHere && speakers.length === 0 ? "You're live — the line can be quiet for a few minutes between calls"
    : liveHere ? "Live audio · listen-only"
    : "Free to listen — no signup, your mic stays off";

  return (
    <section className="l2-section llv" id="listen-live">
      <style>{CSS}</style>
      <div className="l2-section-head l2-center">
        <p className="l2-kicker">Live right now</p>
        <h2>This is what a saved sale sounds like.</h2>
        <p className="l2-lede" style={{ marginLeft: "auto", marginRight: "auto" }}>
          One sentence into a handset, a two-second answer, and a customer who
          didn&rsquo;t walk. Press play — the {""}
          {rooms.find((r) => r.shortCode === FEATURED_SHORT_CODE)?.name || "California"} room
          is on the air right now.
        </p>
      </div>

      <div className="llv-merge">
        <div className="llv-steps" id="how">
          <div className="llv-steps-head">
            <span className="llv-steps-title">How a sale happens</span>
            <span className="llv-steps-stat">avg answer · 2s</span>
          </div>
          {STEPS.map((s) => (
            <div className="llv-step" key={s.n}>
              <span className="llv-step-n">{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.copy}</p>
              </div>
            </div>
          ))}
          <div className="llv-footnote">
            <p className="llv-label">If no one answers</p>
            <p>
              The request is logged, escalated to neighboring rooms, and sent to
              the entire network as a message — a miss in your region
              isn&rsquo;t a miss on the network.
            </p>
          </div>
        </div>

        <div className="llv-live">
      <div className="llv-card">
        <div className="llv-head">
          <span className="llv-roomtag">
            <span className="llv-dot" /> {selectedRoom?.name} room
          </span>
          <span className="llv-count">{yardCount} yards on the line</span>
        </div>

        <div className="llv-body">
          <div className="llv-panel-player">
            <div className="llv-status">
              <p className="llv-status-title">{statusTitle}</p>
              <p className={`llv-status-sub ${state === "error" ? "err" : ""}`}>{statusSub}</p>
            </div>
            <button
              className={`llv-play ${liveHere ? "live" : ""}`}
              onClick={togglePlay}
            >
              {liveHere || connecting ? <PauseIcon /> : <PlayIcon />}
              <span>
                {connecting ? "Connecting…"
                  : liveHere ? "Click Here to Stop"
                  : "Click Here to Listen"}
              </span>
            </button>
            <VuMeter stream={stream} active={liveHere} />
            <p className="llv-note">Listen-only. Your microphone is never used.</p>
          </div>

          <div className="llv-panel-feed">
            <p className="llv-label">On the air now</p>
            {speakers.length > 0 ? (
              <div className="llv-chips" aria-live="polite">
                {speakers.map((s, i) => (
                  <span className="llv-chip" key={`${s.name}-${i}`}>
                    <span className="llv-chip-dot" />
                    <strong>{s.name}</strong>{s.state ? ` — ${s.state}` : ""}
                  </span>
                ))}
              </div>
            ) : (
              <p className="llv-quiet">
                Standing by — broadcasts come in bursts, and the line can sit quiet
                for a few minutes between calls. Stay tuned.
              </p>
            )}

            <p className="llv-label llv-label-recent">Earlier on the line</p>
            {recent.length > 0 ? (
              <div className="llv-recent">
                {recent.map((s, i) => (
                  <p className="llv-recent-row" key={`${s.name}-${i}`}>
                    <span className="llv-recent-time">{s.at}</span>
                    <strong>{s.name}</strong>{s.state ? ` — ${s.state}` : ""}
                  </p>
                ))}
              </div>
            ) : (
              <p className="llv-quiet">Activity shows up here as yards key their mics.</p>
            )}
          </div>
        </div>
      </div>

          {showCta && state === "live" && (
            <div className="llv-cta">
              <p>Like what you hear? Your yard can be on this line too.</p>
              <a className="l2-btn l2-btn-hot" href={signupUrl}>Click Here to Sign Up — It&rsquo;s Free</a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const CSS = `
.llv .l2-section-head { margin-bottom: 44px; }

/* merged layout: steps beside the live card, equal-height siblings */
.llv-merge {
  display: grid;
  grid-template-columns: 5fr 7fr;
  gap: 48px;
  align-items: stretch;
  max-width: 1216px;
  margin: 0 auto;
}
.llv-live { display: flex; flex-direction: column; }
.llv-live .llv-card { flex: 1 1 auto; display: flex; flex-direction: column; }
.llv-live .llv-body { flex: 1 1 auto; }
.llv-live .llv-panel-feed { flex: 1 1 auto; }

/* steps card — same construction as the live card beside it */
.llv-steps {
  display: flex; flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.llv-steps-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--line);
  background: var(--band);
}
.llv-steps-title {
  font-family: var(--mono);
  font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink);
}
.llv-steps-stat {
  font-family: var(--mono);
  font-size: 12px; letter-spacing: 0.06em;
  color: var(--muted);
}
.llv-step {
  flex: 1 1 auto;
  display: flex; gap: 16px; align-items: flex-start;
  padding: 22px 24px;
  transition: background .2s;
}
.llv-step:hover { background: var(--band); }
.llv-step + .llv-step { border-top: 1px solid var(--line); }
.llv-step-n {
  flex: 0 0 auto;
  width: 34px; height: 34px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--red-soft); color: var(--red);
  font-family: var(--mono); font-size: 15px; font-weight: 700;
  transition: background .2s, color .2s;
}
.llv-step:hover .llv-step-n { background: var(--red); color: #fff; }
.llv-step h3 {
  margin: 4px 0 6px;
  font-family: var(--display);
  font-size: 19px; font-weight: 700;
  letter-spacing: -0.01em;
}
.llv-step p { margin: 0; font-size: 15px; line-height: 1.6; color: var(--muted); }
.llv-step p strong { color: var(--ink); font-weight: 600; }
.llv-footnote {
  padding: 16px 24px 18px;
  border-top: 1px solid var(--line);
  background: var(--band);
}
.llv-footnote p:last-child {
  margin: 0;
  font-size: 13px; line-height: 1.55; color: var(--muted);
}

.llv-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
/* the live sibling wears the brand edge */
.llv-live .llv-card { border-top: 3px solid var(--red); }

/* header strip */
.llv-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--line);
  background: var(--band);
}
.llv-roomtag {
  display: inline-flex; align-items: center; gap: 9px;
  font-family: var(--mono);
  font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--red-deep);
}
.llv-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--red);
  animation: llvPulseRed 1.6s ease-out infinite;
}
@keyframes llvPulseRed {
  0% { box-shadow: 0 0 0 0 rgba(217,45,32,0.4); }
  100% { box-shadow: 0 0 0 6px rgba(217,45,32,0); }
}
.llv-count {
  font-family: var(--mono);
  font-size: 12px; letter-spacing: 0.06em;
  color: var(--muted);
}

/* stacked panels inside the card */
.llv-body { display: flex; flex-direction: column; }
.llv-panel-player {
  padding: 26px 28px 20px;
  display: flex; flex-direction: column; gap: 16px;
}
.llv-panel-feed {
  padding: 20px 28px 22px;
  border-top: 1px solid var(--line);
  min-width: 0;
}

/* player */
.llv-play {
  display: inline-flex; align-items: center; justify-content: center; gap: 12px;
  width: 100%; max-width: 380px;
  padding: 18px 28px;
  border-radius: 12px;
  background: var(--red); color: #fff;
  border: none; cursor: pointer;
  font-family: var(--body);
  font-size: 19px; font-weight: 700;
  box-shadow: 0 8px 22px -8px rgba(217,45,32,0.55);
  transition: transform .15s, box-shadow .2s, background .2s;
}
.llv-play:hover { transform: scale(1.03); background: var(--red-deep); }
.llv-play:focus-visible { outline: 3px solid rgba(217,45,32,0.4); outline-offset: 3px; }
.llv-play.live { box-shadow: 0 8px 22px -8px rgba(217,45,32,0.55), 0 0 0 8px var(--red-soft); }
.llv-status { min-width: 0; }
.llv-status-title {
  margin: 0;
  font-family: var(--display);
  font-size: clamp(19px, 2.2vw, 25px); font-weight: 700; color: var(--ink);
}
.llv-status-sub { margin: 5px 0 0; font-size: 14px; color: var(--muted); }
.llv-status-sub.err { color: var(--red-deep); }

/* VU meter */
.llv-vu {
  display: flex; gap: 5px; align-items: flex-end;
  height: 34px;
}
.llv-vu span {
  flex: 1 1 0; max-width: 14px; height: 100%;
  background: linear-gradient(180deg, var(--red) 0%, var(--red-deep) 100%);
  border-radius: 2px;
  transform: scaleY(0.1); transform-origin: bottom;
  opacity: 0.18;
  transition: opacity .3s;
  will-change: transform;
}
.llv-vu.on span { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .llv-vu.on span { transform: scaleY(0.5) !important; }
  .llv-dot, .llv-chip-dot, .llv-chip { animation: none !important; }
}

/* feed */
.llv-label {
  margin: 0 0 10px;
  font-family: var(--mono);
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--muted);
}
.llv-label-recent { margin-top: 20px; }
.llv-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.llv-chip {
  display: inline-flex; align-items: center; gap: 9px;
  font-family: var(--mono); font-size: 12.5px; color: var(--red-deep);
  background: var(--red-soft); border: 1px solid rgba(217,45,32,0.45);
  border-radius: 6px; padding: 8px 14px;
  animation: llvPop .3s ease;
}
.llv-chip strong { color: var(--red); font-weight: 700; }
.llv-chip-dot {
  width: 7px; height: 7px; border-radius: 2px;
  background: var(--red);
  animation: llvPulseRed 1.4s ease-out infinite;
}
@keyframes llvPop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.llv-quiet { margin: 0; font-size: 13.5px; color: var(--muted); }

.llv-recent { display: flex; flex-direction: column; gap: 7px; }
.llv-recent-row {
  margin: 0;
  font-family: var(--mono); font-size: 12.5px; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.llv-recent-row strong { font-weight: 700; }
.llv-recent-time { color: var(--muted); margin-right: 10px; }

/* footer bits */
.llv-note { margin: 0; font-size: 12px; color: var(--muted); }
.llv-cta {
  display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: center;
  margin-top: 16px;
  padding: 18px 24px;
  background: var(--red-soft);
  border: 1px solid #f2c6c2;
  border-radius: var(--radius);
}
.llv-cta p { margin: 0; font-size: 15.5px; font-weight: 600; color: var(--ink); }

@media (max-width: 900px) {
  .llv-merge { grid-template-columns: 1fr; gap: 36px; }
  .llv-live { order: -1; }
  .llv-panel-player { padding: 22px 20px 16px; }
  .llv-panel-feed { padding: 18px 20px 20px; }
  .llv-play { max-width: none; font-size: 17px; padding: 16px 20px; }
}
`;
