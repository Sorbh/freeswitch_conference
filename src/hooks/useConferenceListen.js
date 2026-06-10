import { useState, useRef, useCallback, useEffect } from "react";
import JsSIP from "jssip";

const SIP_HOST = "50.28.84.57";
const SIP_DOMAIN = "50.28.84.57";
const WS_PORT = 5072;
const SIP_PASSWORD = "12345678";
const ADMIN_EMAIL = "er.sorbh@gmail.com";

export function useConferenceListen() {
  const [listenRoom, setListenRoom] = useState(null);
  const [listenState, setListenState] = useState("idle"); // idle | registering | ringing | connected | error
  const uaRef = useRef(null);
  const sessionRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const el = document.getElementById("admin-listen-audio");
    if (el) { audioRef.current = el; return; }
    const audio = document.createElement("audio");
    audio.id = "admin-listen-audio";
    audio.autoplay = true;
    audio.style.display = "none";
    document.body.appendChild(audio);
    audioRef.current = audio;
    return () => { audio.remove(); };
  }, []);

  const stopListen = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.terminate(); } catch (e) {}
      sessionRef.current = null;
    }
    if (uaRef.current) {
      try { uaRef.current.unregister(); uaRef.current.stop(); } catch (e) {}
      uaRef.current = null;
    }
    if (audioRef.current) audioRef.current.srcObject = null;
    setListenRoom(null);
    setListenState("idle");
  }, []);

  const startListen = useCallback(async (roomId) => {
    stopListen();
    setListenRoom(roomId);
    setListenState("registering");

    try {
      const socket = new JsSIP.WebSocketInterface(`wss://${SIP_HOST}:${WS_PORT}`);
      const sipUser = ADMIN_EMAIL.replace("@", ".at.");

      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: `sip:${sipUser}@${SIP_DOMAIN}`,
        password: SIP_PASSWORD,
        display_name: "Admin-Listen",
        register: true,
        register_expires: 120,
        session_timers: false,
        user_agent: "Redline-WebClient/1.0 admin-listen",
      });

      uaRef.current = ua;

      ua.on("registered", async () => {
        setListenState("ringing");
        try {
          const res = await fetch(`/api/v1/admin/rooms/${roomId}/listen`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: ADMIN_EMAIL }),
          });
          const json = await res.json();
          if (!json.status) {
            console.error("[LISTEN] Dial failed:", json.error);
            setListenState("error");
          }
        } catch (e) {
          console.error("[LISTEN] API error:", e);
          setListenState("error");
        }
      });

      ua.on("registrationFailed", (e) => {
        console.error("[LISTEN] Registration failed:", e.cause);
        setListenState("error");
      });

      ua.on("newRTCSession", (data) => {
        if (data.originator !== "remote") return;
        const session = data.session;
        sessionRef.current = session;

        session.on("peerconnection", (pcData) => {
          pcData.peerconnection.ontrack = (ev) => {
            if (audioRef.current && ev.streams[0]) {
              audioRef.current.srcObject = ev.streams[0];
            }
          };
        });

        session.on("accepted", () => {
          setListenState("connected");
          const pc = session.connection;
          if (pc) {
            pc.getReceivers().forEach((r) => {
              if (r.track && r.track.kind === "audio" && audioRef.current) {
                audioRef.current.srcObject = new MediaStream([r.track]);
              }
            });
          }
        });

        session.on("failed", () => {
          setListenState("error");
          sessionRef.current = null;
        });

        session.on("ended", () => {
          stopListen();
        });

        session.answer({
          mediaConstraints: { audio: true, video: false },
          pcConfig: { iceServers: [] },
        });
      });

      ua.start();
    } catch (e) {
      console.error("[LISTEN] Error:", e);
      setListenState("error");
    }
  }, [stopListen]);

  useEffect(() => {
    return () => { stopListen(); };
  }, [stopListen]);

  return { listenRoom, listenState, startListen, stopListen };
}
