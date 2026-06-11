import { useState, useRef, useCallback, useEffect } from "react";
import JsSIP from "jssip";

const SIP_HOST = "50.28.84.57";
const SIP_DOMAIN = "50.28.84.57";
const WS_PORT = 5072;
const SIP_PASSWORD = "12345678";
const LISTEN_USER = "admin-listen";

export function useConferenceListen() {
  const [listenRoom, setListenRoom] = useState(null);
  const [listenState, setListenState] = useState("idle");
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
      try { uaRef.current.stop(); } catch (e) {}
      uaRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.pause();
    }
    setListenRoom(null);
    setListenState("idle");
  }, []);

  const startListen = useCallback(async (roomId) => {
    stopListen();
    setListenRoom(roomId);
    setListenState("registering");

    try {
      const socket = new JsSIP.WebSocketInterface(`wss://${SIP_HOST}:${WS_PORT}`);

      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: `sip:${LISTEN_USER}@${SIP_DOMAIN}`,
        password: SIP_PASSWORD,
        display_name: "Admin-Listen",
        register: false,
        session_timers: false,
        user_agent: "Redline-AdminListen/1.0",
      });

      uaRef.current = ua;

      ua.on("connected", () => {
        setListenState("ringing");
        const confUri = `sip:${roomId}@${SIP_DOMAIN}`;
        const session = ua.call(confUri, {
          mediaConstraints: { audio: true, video: false },
          pcConfig: { iceServers: [] },
          rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
        });

        sessionRef.current = session;

        session.on("peerconnection", (pcData) => {
          const pc = pcData.peerconnection;
          pc.ontrack = (ev) => {
            console.log("[LISTEN] ontrack fired, streams:", ev.streams.length);
            if (audioRef.current && ev.streams[0]) {
              audioRef.current.srcObject = ev.streams[0];
              audioRef.current.play().catch(err => {
                console.warn("[LISTEN] autoplay blocked:", err);
              });
            }
          };
          pc.oniceconnectionstatechange = () => {
            console.log("[LISTEN] ICE state:", pc.iceConnectionState);
          };
        });

        session.on("accepted", () => {
          setListenState("connected");
          // Fallback: check remote streams on the connection directly
          const pc = session.connection;
          if (pc && audioRef.current) {
            const receivers = pc.getReceivers();
            console.log("[LISTEN] receivers:", receivers.length);
            if (receivers.length > 0 && receivers[0].track) {
              const stream = new MediaStream([receivers[0].track]);
              audioRef.current.srcObject = stream;
              audioRef.current.play().catch(err => {
                console.warn("[LISTEN] fallback play blocked:", err);
              });
            }
          }
        });

        session.on("failed", (e) => {
          console.error("[LISTEN] Call failed:", e?.cause);
          setListenState("error");
          sessionRef.current = null;
        });

        session.on("ended", () => {
          stopListen();
        });
      });

      ua.on("disconnected", () => {
        if (listenRoom) setListenState("error");
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
