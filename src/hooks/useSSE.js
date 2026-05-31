import { useState, useEffect, useRef } from "react";

let _sseIdCounter = 0;

export function useSSE(url, active = true) {
  const [events, setEvents] = useState([]);
  const esRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        setEvents((prev) => [...prev, { ...parsed, _id: ++_sseIdCounter }]);
      } catch {
        // ignore non-JSON messages
      }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [url, active]);

  const clear = () => setEvents([]);

  return { events, clear };
}
