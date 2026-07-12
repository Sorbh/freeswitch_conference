import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "hq_gesture_control";
const DETECT_INTERVAL = 350;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const VISION_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

export function isGestureEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

export function setGestureEnabled(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch {}
}

function isOpenPalm(landmarks) {
  const fingerTips = [8, 12, 16, 20];
  const fingerPips = [6, 10, 14, 18];
  let extended = 0;
  for (let i = 0; i < fingerTips.length; i++) {
    if (landmarks[fingerTips[i]].y < landmarks[fingerPips[i]].y) extended++;
  }
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  if (Math.abs(thumbTip.x - thumbIp.x) > 0.04) extended++;
  return extended >= 4;
}

const PALM_HOLD_MS = 1000;

export function useGestureControl(toggleMute, connected, currentMuted) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const lastGestureRef = useRef(null);
  const cooldownRef = useRef(0);
  const palmSinceRef = useRef(0);
  const mountedRef = useRef(true);

  const stop = useCallback(() => {
    mountedRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) { videoRef.current = null; }
    detectorRef.current = null;
    setActive(false);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (active) return;
    mountedRef.current = true;
    setStatus("loading");
    setErrorMsg("");

    try {
      const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");

      const vision = await FilesetResolver.forVisionTasks(VISION_WASM);
      if (!mountedRef.current) return;

      const detector = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      if (!mountedRef.current) return;
      detectorRef.current = detector;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 10 } },
        audio: false,
      });
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      video.muted = true;
      video.width = 320;
      video.height = 240;
      await video.play();
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      videoRef.current = video;

      setActive(true);
      setStatus("active");

      let lastTs = -1;
      timerRef.current = setInterval(() => {
        if (!mountedRef.current || !detectorRef.current || !videoRef.current) return;
        const now = performance.now();
        if (now - lastTs < DETECT_INTERVAL) return;
        lastTs = now;

        let results;
        try {
          results = detectorRef.current.detectForVideo(videoRef.current, now);
        } catch { return; }

        if (cooldownRef.current > 0) { cooldownRef.current--; return; }

        const lm = results.landmarks?.[0];
        const palm = lm ? isOpenPalm(lm) : false;
        const handVisible = !!lm;
        const isMuted = window.hotlineClient?.isMuted?.() ?? true;

        if (palm && isMuted) {
          if (!palmSinceRef.current) palmSinceRef.current = now;
          if (now - palmSinceRef.current >= PALM_HOLD_MS) {
            palmSinceRef.current = 0;
            lastGestureRef.current = true;
            cooldownRef.current = 5;
            toggleMute();
          }
        } else {
          palmSinceRef.current = 0;
        }

        if (!handVisible && !isMuted && lastGestureRef.current) {
          lastGestureRef.current = false;
          cooldownRef.current = 3;
          toggleMute();
        } else if (handVisible) {
          lastGestureRef.current = true;
        }
      }, 100);

    } catch (err) {
      console.error("[Gesture] Init failed:", err);
      if (mountedRef.current) {
        setStatus("error");
        setErrorMsg(err.message || "Failed to initialize gesture control");
      }
    }
  }, [active, toggleMute]);

  useEffect(() => {
    return () => { mountedRef.current = false; stop(); };
  }, [stop]);

  useEffect(() => {
    if (!connected && active) stop();
  }, [connected, active, stop]);

  return { active, status, errorMsg, start, stop, videoRef, streamRef };
}
