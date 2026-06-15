import { useState, useEffect, useRef, useCallback } from "react";

const MAX_BUFFER = 2000;
const FLUSH_INTERVAL = 250;

let _sseIdCounter = 0;

export function useSSE(url, active = true) {
  const [events, setEvents] = useState([]);
  const bufferRef = useRef([]);
  const timerRef = useRef(null);

  const flush = useCallback(() => {
    if (bufferRef.current.length === 0) return;
    const batch = bufferRef.current;
    bufferRef.current = [];
    setEvents((prev) => {
      const merged = prev.concat(batch);
      return merged.length > MAX_BUFFER ? merged.slice(-MAX_BUFFER) : merged;
    });
  }, []);

  useEffect(() => {
    if (!active) return;

    const es = new EventSource(url, { withCredentials: true });

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        bufferRef.current.push({ ...parsed, _id: ++_sseIdCounter });
      } catch {
        // ignore non-JSON
      }
    };

    timerRef.current = setInterval(flush, FLUSH_INTERVAL);

    return () => {
      es.close();
      clearInterval(timerRef.current);
      timerRef.current = null;
      flush();
    };
  }, [url, active, flush]);

  const clear = useCallback(() => {
    bufferRef.current = [];
    setEvents([]);
  }, []);

  return { events, clear };
}
