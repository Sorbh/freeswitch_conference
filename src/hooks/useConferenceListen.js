import { useState, useRef, useCallback, useEffect } from "react";
import JsSIP from "jssip";

const SIP_HOST = "50.28.84.57";
const SIP_DOMAIN = "50.28.84.57";
const WS_PORT = 5072;
const SIP_PASSWORD = "12345678";
const LISTEN_USER = "admin-listen";

function createSilentStream() {
  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  return { stream: dest.stream, ctx };
}

export function useConferenceListen() {
  const [listenRoom, setListenRoom] = useState(null);
  const [listenState, setListenState] = useState("idle");
  const uaRef = useRef(null);
  const sessionRef = useRef(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);

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
    console.log("[LISTEN] stopListen called");
    if (sessionRef.current) {
      try { sessionRef.current.terminate(); } catch (e) {}
      sessionRef.current = null;
    }
    if (uaRef.current) {
      try { uaRef.current.stop(); } catch (e) {}
      uaRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.pause();
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (e) {}
      audioCtxRef.current = null;
    }
    setListenRoom(null);
    setListenState("idle");
  }, []);

  const startListen = useCallback(async (roomId) => {
    stopListen();
    setListenRoom(roomId);
    setListenState("registering");
    console.log("[LISTEN] Starting listen for room:", roomId);

    try {
      const { stream: silentStream, ctx } = createSilentStream();
      audioCtxRef.current = ctx;
      console.log("[LISTEN] Silent stream created, tracks:", silentStream.getTracks().length);

      const socket = new JsSIP.WebSocketInterface(`wss://${SIP_HOST}:${WS_PORT}`);

      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: `sip:${LISTEN_USER}@${SIP_DOMAIN}`,
        password: SIP_PASSWORD,
        display_name: "Admin-Listen",
        register: false,
        session_timers: false,
        user_agent: "Redline-WebClient/AdminListen",
      });

      uaRef.current = ua;

      ua.on("connected", () => {
        console.log("[LISTEN] WebSocket connected, placing call to room", roomId);
        setListenState("ringing");
        const confUri = `sip:${roomId}@${SIP_DOMAIN}`;

        const session = ua.call(confUri, {
          mediaStream: silentStream,
          pcConfig: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
          rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
        });

        sessionRef.current = session;

        session.on("peerconnection", (pcData) => {
          const pc = pcData.peerconnection;
          console.log("[LISTEN] peerconnection created");

          pc.ontrack = (ev) => {
            console.log("[LISTEN] ontrack — kind:", ev.track.kind, "streams:", ev.streams.length);
            if (audioRef.current && ev.streams && ev.streams[0]) {
              audioRef.current.srcObject = ev.streams[0];
              audioRef.current.play().then(() => {
                console.log("[LISTEN] audio playing from ontrack stream");
              }).catch(err => {
                console.warn("[LISTEN] autoplay blocked:", err.message);
              });
            }
          };

          pc.oniceconnectionstatechange = () => {
            console.log("[LISTEN] ICE state:", pc.iceConnectionState);
            if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
              console.error("[LISTEN] ICE failed/disconnected");
            }
          };

          pc.onconnectionstatechange = () => {
            console.log("[LISTEN] Connection state:", pc.connectionState);
          };
        });

        session.on("accepted", () => {
          console.log("[LISTEN] Call accepted (200 OK)");
          setListenState("connected");

          const pc = session.connection;
          if (pc && audioRef.current) {
            const receivers = pc.getReceivers();
            const audioReceivers = receivers.filter(r => r.track && r.track.kind === "audio");
            console.log("[LISTEN] receivers:", receivers.length, "audio:", audioReceivers.length);

            if (audioReceivers.length > 0 && !audioRef.current.srcObject) {
              const stream = new MediaStream(audioReceivers.map(r => r.track));
              audioRef.current.srcObject = stream;
              audioRef.current.play().then(() => {
                console.log("[LISTEN] audio playing from accepted fallback");
              }).catch(err => {
                console.warn("[LISTEN] fallback play blocked:", err.message);
              });
            }
          }
        });

        session.on("failed", (e) => {
          console.error("[LISTEN] Call failed:", e?.cause, e?.message?.reason_phrase);
          setListenState("error");
          sessionRef.current = null;
        });

        session.on("ended", (e) => {
          console.log("[LISTEN] Call ended:", e?.cause);
          stopListen();
        });

        session.on("sdp", (data) => {
          console.log("[LISTEN] SDP", data.originator, data.type);
        });
      });

      ua.on("disconnected", (e) => {
        console.warn("[LISTEN] WebSocket disconnected", e?.code, e?.reason);
        setListenState("error");
      });

      ua.on("connecting", () => {
        console.log("[LISTEN] WebSocket connecting to", `wss://${SIP_HOST}:${WS_PORT}`);
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
