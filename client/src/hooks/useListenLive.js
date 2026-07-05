import { useState, useRef, useCallback, useEffect } from "react";

// Live listen-only conference audio for the public landing page.
//
// Credentials are ephemeral: POST /api/v1/public/listen/session mints a
// one-time SIP user valid for 60s of auth time. The dialplan side joins
// listen-<room> force-muted in an isolated context, so this client can
// only ever receive audio. jsSIP is loaded on demand from the shared
// /jssip.bundle.js so the landing bundle stays lean.

let _jssipPromise = null;
function loadJsSIP() {
  if (window.JsSIP) return Promise.resolve(window.JsSIP);
  if (_jssipPromise) return _jssipPromise;
  _jssipPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/jssip.bundle.js";
    script.onload = () => (window.JsSIP ? resolve(window.JsSIP) : reject(new Error("JsSIP missing")));
    script.onerror = () => {
      _jssipPromise = null;
      reject(new Error("Failed to load audio engine"));
    };
    document.head.appendChild(script);
  });
  return _jssipPromise;
}

function createSilentStream() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const dest = ctx.createMediaStreamDestination();
  return { stream: dest.stream, ctx };
}

export function useListenLive() {
  const [room, setRoom] = useState(null);
  const [state, setState] = useState("idle"); // idle | connecting | live | error
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null); // live MediaStream, for VU metering
  const uaRef = useRef(null);
  const sessionRef = useRef(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.style.display = "none";
    document.body.appendChild(audio);
    audioRef.current = audio;
    return () => audio.remove();
  }, []);

  const stop = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.terminate(); } catch {}
      sessionRef.current = null;
    }
    if (uaRef.current) {
      try { uaRef.current.stop(); } catch {}
      uaRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.pause();
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    setRoom(null);
    setState("idle");
    setError(null);
    setStream(null);
  }, []);

  const start = useCallback(async (roomId) => {
    stop();
    setRoom(roomId);
    setState("connecting");
    setError(null);

    try {
      const res = await fetch("/api/v1/public/listen/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId }),
      });
      const json = await res.json();
      if (!json.status) throw new Error(json.error || "Unable to start listening");
      const creds = json.data;

      const JsSIP = await loadJsSIP();
      const { stream: silentStream, ctx } = createSilentStream();
      audioCtxRef.current = ctx;

      const socket = new JsSIP.WebSocketInterface(creds.wsUrl);
      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: `sip:${creds.user}@${creds.domain}`,
        password: creds.password,
        display_name: "Listener",
        register: false,
        session_timers: false,
        user_agent: "Redline-WebClient/PublicListen",
      });
      uaRef.current = ua;

      ua.on("connected", () => {
        const session = ua.call(`sip:${creds.target}@${creds.domain}`, {
          mediaStream: silentStream,
          rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
        });
        sessionRef.current = session;

        session.on("peerconnection", ({ peerconnection: pc }) => {
          pc.ontrack = (ev) => {
            if (audioRef.current && ev.streams?.[0]) {
              audioRef.current.srcObject = ev.streams[0];
              audioRef.current.play().catch(() => {});
              setStream(ev.streams[0]);
            }
          };
        });

        session.on("accepted", () => {
          setState("live");
          const pc = session.connection;
          if (pc && audioRef.current && !audioRef.current.srcObject) {
            const tracks = pc.getReceivers().filter(r => r.track?.kind === "audio").map(r => r.track);
            if (tracks.length) {
              const remote = new MediaStream(tracks);
              audioRef.current.srcObject = remote;
              audioRef.current.play().catch(() => {});
              setStream(remote);
            }
          }
        });

        session.on("failed", () => {
          setState("error");
          setError("Could not join the room — try again");
          sessionRef.current = null;
        });

        session.on("ended", () => stop());
      });

      ua.on("disconnected", () => {
        if (sessionRef.current) {
          setState("error");
          setError("Connection lost — tap to reconnect");
        }
      });

      ua.start();
    } catch (e) {
      setState("error");
      setError(e.message || "Unable to start listening");
    }
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return { room, state, error, stream, start, stop };
}
