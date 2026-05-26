import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 500;

export function useSSERefresh(refetch, scopes = []) {
  const timerRef = useRef(null);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const es = new EventSource("/api/v1/admin/events/stream");

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        let shouldRefetch = false;

        if (data.type === "state_change" && scopes.includes(data.scope)) {
          shouldRefetch = true;
        } else if (data.type === "user_update" && scopes.includes("users")) {
          shouldRefetch = true;
        } else if (data.type === "event_log" && scopes.includes("events")) {
          shouldRefetch = true;
        }

        if (shouldRefetch) {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => refetchRef.current(), DEBOUNCE_MS);
        }
      } catch {
        // ignore
      }
    };

    return () => {
      clearTimeout(timerRef.current);
      es.close();
    };
  }, [scopes.join(",")]);
}
