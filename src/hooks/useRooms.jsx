import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { apiFetch } from "@/lib/api";

const RoomsContext = createContext(null);

const FALLBACK = {
  rooms: [],
  names: {},
  codes: {},
  loading: true,
  refetch: () => {},
};

export function RoomsProvider({ children }) {
  const [data, setData] = useState({ rooms: [], names: {}, codes: {} });
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/admin/rooms/config");
      if (!res.ok) throw new Error("Failed to fetch rooms");
      const json = await res.json();
      const d = json.data || json;
      setData({ rooms: d.rooms || [], names: d.names || {}, codes: d.codes || {} });
    } catch {
      setData({ rooms: [], names: {}, codes: {} });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  return (
    <RoomsContext.Provider value={{ ...data, loading, refetch: fetchRooms }}>
      {children}
    </RoomsContext.Provider>
  );
}

export function useRooms() {
  return useContext(RoomsContext) || FALLBACK;
}
