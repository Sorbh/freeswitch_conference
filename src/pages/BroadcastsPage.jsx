import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { useSSE } from "@/hooks/useSSE";
import { useRooms } from "@/hooks/useRooms";
import { apiFetch } from "@/lib/api";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";
import {
  RadioIcon, PhoneCallIcon, PhoneOffIcon, PercentIcon,
  TrendingUpIcon, PlayIcon, PauseIcon, ClockIcon, UserIcon,
  ChevronLeftIcon, ChevronRightIcon, XIcon,
  ChevronsLeftIcon, ChevronsRightIcon, ListIcon,
  Share2Icon, Unlink2Icon,
} from "lucide-react";

// ── Helpers ──
function formatDuration(ms) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function parseGmtOffset(gmtOffset) {
  if (!gmtOffset) return null;
  const m = gmtOffset.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!m) return null;
  const sign = m[1] === "+" ? 1 : -1;
  return sign * (parseInt(m[2]) * 60 + parseInt(m[3]));
}

function toTzDate(ts, offsetMin) {
  const d = new Date(ts * 1000);
  if (offsetMin == null) return d;
  return new Date(d.getTime() + (offsetMin + d.getTimezoneOffset()) * 60000);
}

function gmtLabel(offsetMin) {
  if (offsetMin == null) return "";
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m ? `GMT${sign}${h}:${String(m).padStart(2, "0")}` : `GMT${sign}${h}`;
}

function formatTime(ts, offsetMin) {
  if (!ts) return "—";
  const d = toTzDate(ts, offsetMin);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(ts, offsetMin) {
  if (!ts) return "—";
  const d = toTzDate(ts, offsetMin);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(ts, offsetMin) {
  if (!ts) return "—";
  const d = toTzDate(ts, offsetMin);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Animated Number ──
function useAnimatedNumber(target, dur = 500) {
  const [val, setVal] = useState(target);
  const ref = useRef(null);
  useEffect(() => {
    const start = val;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      setVal(Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target]);
  return val;
}

// ── Stat Card ──
function StatCard({ label, value, icon, color, mono = true }) {
  const animated = useAnimatedNumber(typeof value === "number" ? value : 0);
  return (
    <Card className="border-border/40 relative overflow-hidden group">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className={`text-2xl font-bold leading-none tracking-tight ${mono ? "font-mono tabular-nums" : ""}`}>
              {typeof value === "number" ? animated.toLocaleString() : value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">{label}</p>
          </div>
        </div>
      </CardContent>
      <div className="absolute inset-x-0 bottom-0 h-[2px]" style={{ backgroundColor: `${color}25` }} />
    </Card>
  );
}

// ── Live Broadcast Banner ──
function LiveBroadcastBanner({ events, ROOM_NAMES = {} }) {
  const activeBroadcasts = useMemo(() => {
    const active = new Map();
    for (const evt of events) {
      if (evt.type === "broadcast" || evt.scope === "broadcast") {
        if (evt.event_type === "broadcast_start" || evt.action === "start") {
          active.set(evt.room || evt.userName, {
            userName: evt.user_name || evt.userName,
            displayName: evt.display_name || evt.user_name || evt.userName,
            room: evt.room,
            startTime: Date.now(),
          });
        } else if (evt.event_type === "broadcast_end" || evt.action === "end") {
          active.delete(evt.room || evt.userName);
        }
      }
    }
    return Array.from(active.values());
  }, [events]);

  if (activeBroadcasts.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] via-transparent to-emerald-500/[0.03]" />
      <div className="relative flex items-center gap-3">
        <span className="relative flex size-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full size-3 bg-emerald-500" />
        </span>
        <span className="text-sm font-medium text-emerald-300">
          {activeBroadcasts.length} Live Broadcast{activeBroadcasts.length > 1 ? "s" : ""}
        </span>
        <span className="text-xs text-muted-foreground">
          {activeBroadcasts.map(b => `${b.displayName} in ${ROOM_NAMES[b.room] || "Channel"}`).join(" · ")}
        </span>
      </div>
    </div>
  );
}

// ── Peak Hours Heatmap ──

// ── Waveform Audio Player ──
function WaveformPlayer({ url, isActive, onToggle, sharedAudioRef }) {
  const trackRef = useRef(null);
  const animRef = useRef(null);
  const [waveform, setWaveform] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [hoverX, setHoverX] = useState(0);

  useEffect(() => {
    if (!url || !isActive) return;
    let cancelled = false;
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => new (window.AudioContext || window.webkitAudioContext)().decodeAudioData(buf))
      .then(audioBuffer => {
        if (cancelled) return;
        const raw = audioBuffer.getChannelData(0);
        const n = 100;
        const blockSize = Math.floor(raw.length / n);
        const peaks = [];
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[i * blockSize + j]);
          peaks.push(sum / blockSize);
        }
        const max = Math.max(...peaks, 0.01);
        setWaveform(peaks.map(p => Math.max(0.06, p / max)));
      })
      .catch(() => { if (!cancelled) setWaveform(Array.from({ length: 100 }, () => Math.random() * 0.5 + 0.12)); });
    return () => { cancelled = true; };
  }, [url, isActive]);

  useEffect(() => {
    if (!isActive) { cancelAnimationFrame(animRef.current); return; }
    const tick = () => {
      const a = sharedAudioRef?.current;
      if (a && a.duration) { setProgress(a.currentTime / a.duration); setDuration(a.duration); setCurrentTime(a.currentTime); }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isActive, sharedAudioRef]);

  const seek = useCallback((e) => {
    const a = sharedAudioRef?.current, el = trackRef.current;
    if (!a || !a.duration || !el) return;
    const r = el.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration;
  }, [sharedAudioRef]);

  const onMove = useCallback((e) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHoverX(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  }, []);

  const ft = (s) => { if (!s || s < 0) return "0:00"; return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`; };

  if (!isActive || !waveform) return null;

  const playheadPct = `${progress * 100}%`;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 animate-in fade-in duration-200">
      <button onClick={onToggle} className="size-8 rounded-full flex items-center justify-center border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors cursor-pointer shrink-0">
        <PauseIcon className="size-3.5" />
      </button>

      <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0 w-8 text-right">{ft(currentTime)}</span>

      <div
        ref={trackRef}
        className="flex-1 relative h-8 cursor-pointer"
        onClick={seek}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseMove={onMove}
      >
        <div className="absolute inset-0 flex items-center gap-[1px]">
          {waveform.map((peak, i) => {
            const played = i / waveform.length < progress;
            return (
              <div key={i} className="flex-1 flex items-center justify-center" style={{ height: "100%" }}>
                <div
                  className="w-full"
                  style={{
                    height: `${Math.max(6, peak * 100)}%`,
                    backgroundColor: played ? "#374151" : "#d1d5db",
                    transition: "background-color 0.06s",
                    borderRadius: 1,
                  }}
                />
              </div>
            );
          })}
        </div>

        {hovering && (
          <div
            className="absolute top-0 bottom-0 w-px bg-muted-foreground/20 z-[5] pointer-events-none"
            style={{ left: `${hoverX * 100}%` }}
          />
        )}
      </div>

      <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums shrink-0 w-8">{ft(duration)}</span>
    </div>
  );
}

// ── Chart Config ──
const barChartConfig = {
  answered: { label: "Answered", color: "#065f46" },
  unanswered: { label: "Unanswered", color: "#991b1b" },
};

// ── Main Page ──
export default function BroadcastsPage() {
  const { names: ROOM_NAMES, rooms: roomsList } = useRooms();
  const ranges = [
    { key: "today", label: "Today", days: 1 },
    { key: "week", label: "7 Days", days: 7 },
    { key: "month", label: "30 Days", days: 30 },
  ];
  const [activeRange, setActiveRange] = useState("today");
  const [selectedRoom, setSelectedRoom] = useState("");
  const roomTimezones = useMemo(() => {
    const map = {};
    for (const r of roomsList || []) map[r.id] = parseGmtOffset(r.timezone);
    return map;
  }, [roomsList]);
  const activeOffsetMin = selectedRoom ? (roomTimezones[selectedRoom] ?? null) : null;
  const days = ranges.find(r => r.key === activeRange)?.days || 1;

  const roomParam = selectedRoom ? `&room=${selectedRoom}` : "";
  const { data: statsRaw, loading, refetch } = useFetch(`/api/v1/admin/broadcasts?days=${days}${roomParam}`);
  const { data: hourlyRaw, refetch: refetchHourly } = useFetch(`/api/v1/admin/broadcasts/hourly?hours=${days * 24}${roomParam}`);

  // Paginated broadcast list state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const listParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", page);
    p.set("pageSize", pageSize);
    if (selectedRoom) p.set("room", selectedRoom);
    if (filterStatus === "answered") p.set("answered", "1");
    else if (filterStatus === "unanswered") p.set("answered", "0");
    if (filterDateFrom) p.set("dateFrom", filterDateFrom);
    if (filterDateTo) p.set("dateTo", filterDateTo);
    return p.toString();
  }, [page, pageSize, selectedRoom, filterStatus, filterDateFrom, filterDateTo]);

  const [listRaw, setListRaw] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const refetchList = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/admin/broadcasts/list?${listParams}`);
      const json = await res.json();
      if (json.status) setListRaw(json);
    } catch (e) { console.error("Fetch broadcasts list:", e); }
    finally { setListLoading(false); }
  }, [listParams]);
  useEffect(() => { setListLoading(true); refetchList(); }, [refetchList]);

  useSSERefresh(() => { refetch(); refetchHourly(); refetchList(); }, ["broadcasts"]);
  const { events: sseEvents } = useSSE("/api/v1/admin/events/stream");

  const stats = statsRaw ?? {};
  const rawHourly = Array.isArray(hourlyRaw) ? hourlyRaw : hourlyRaw?.data || [];
  const broadcasts = listRaw?.data || [];
  const totalItems = listRaw?.total || 0;
  const totalPages = listRaw?.totalPages || 1;

  const hourly = stats.hourly || [];
  const daily = stats.daily || [];
  const topBroadcasters = stats.topBroadcasters || [];
  const byRoom = stats.byRoom || [];

  const totalBroadcasts = daily.reduce((s, d) => s + (d.total || d.count || 0), 0) || hourly.reduce((s, h) => s + (h.count || 0), 0);
  const totalAnswered = daily.reduce((s, d) => s + (d.answered || 0), 0);
  const totalUnanswered = totalBroadcasts - totalAnswered;
  const responseRate = totalBroadcasts > 0 ? ((totalAnswered / totalBroadcasts) * 100).toFixed(1) : "0.0";

  const avgResponseTime = useMemo(() => {
    const answered = broadcasts.filter(b => b.answered && b.duration_ms);
    if (answered.length === 0) return "—";
    const avg = answered.reduce((s, b) => s + b.duration_ms, 0) / answered.length;
    return formatDuration(avg);
  }, [broadcasts]);

  const getRowOffset = useCallback((row) => {
    return selectedRoom ? activeOffsetMin : (roomTimezones[row.room] ?? null);
  }, [selectedRoom, activeOffsetMin, roomTimezones]);

  const chartData = useMemo(() => {
    if (!Array.isArray(rawHourly) || rawHourly.length === 0) return [];
    if (activeRange === "today") {
      const hourMap = {};
      for (const row of rawHourly) {
        const d = toTzDate(row.created_at, getRowOffset(row));
        const h = d.getHours();
        if (!hourMap[h]) hourMap[h] = { answered: 0, unanswered: 0 };
        if (row.answered) hourMap[h].answered++; else hourMap[h].unanswered++;
      }
      return Array.from({ length: 24 }, (_, h) => {
        const entry = hourMap[h];
        const label = h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`;
        return { label, answered: entry?.answered || 0, unanswered: entry?.unanswered || 0 };
      });
    }
    const dayMap = {};
    for (const row of rawHourly) {
      const d = toTzDate(row.created_at, getRowOffset(row));
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (!dayMap[key]) dayMap[key] = { answered: 0, unanswered: 0 };
      if (row.answered) dayMap[key].answered++; else dayMap[key].unanswered++;
    }
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now.getTime() - (days - 1 - i) * 86400000);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      const entry = dayMap[key];
      return { label: key, answered: entry?.answered || 0, unanswered: entry?.unanswered || 0 };
    });
  }, [rawHourly, activeRange, days, getRowOffset]);

  const LINE_COLORS = [
    "#06b6d4", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6",
    "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
    "#d946ef", "#0ea5e9", "#e11d48", "#a3e635", "#6366f1",
    "#fb923c", "#2dd4bf", "#c084fc", "#fbbf24", "#4ade80",
    "#f43f5e", "#38bdf8", "#a78bfa", "#facc15", "#34d399",
    "#fb7185", "#7dd3fc", "#c4b5fd", "#fde047", "#6ee7b7",
  ];

  const { hourlyDistData, hourlyDistKeys } = useMemo(() => {
    if (!Array.isArray(rawHourly) || rawHourly.length === 0) return { hourlyDistData: [], hourlyDistKeys: [] };

    const dayBuckets = {};
    for (const row of rawHourly) {
      const d = toTzDate(row.created_at, getRowOffset(row));
      const dateKey = `${d.getMonth() + 1}/${d.getDate()}`;
      const h = d.getHours();
      if (!dayBuckets[dateKey]) dayBuckets[dateKey] = {};
      dayBuckets[dateKey][h] = (dayBuckets[dateKey][h] || 0) + 1;
    }

    const sortedDays = Object.keys(dayBuckets).sort((a, b) => {
      const [am, ad] = a.split("/").map(Number);
      const [bm, bd] = b.split("/").map(Number);
      return am !== bm ? am - bm : ad - bd;
    });

    const data = Array.from({ length: 24 }, (_, h) => {
      const point = { hour: h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM` };
      for (const day of sortedDays) {
        point[day] = dayBuckets[day]?.[h] || 0;
      }
      return point;
    });

    return { hourlyDistData: data, hourlyDistKeys: sortedDays };
  }, [rawHourly, days, getRowOffset]);

  const hourlyDistConfig = useMemo(() => {
    const cfg = {};
    for (let i = 0; i < hourlyDistKeys.length; i++) {
      cfg[hourlyDistKeys[i]] = { label: hourlyDistKeys[i], color: LINE_COLORS[i % LINE_COLORS.length] };
    }
    return cfg;
  }, [hourlyDistKeys]);

  const maxRoomCount = Math.max(1, ...byRoom.map(r => r.count));

  const shareBroadcast = useCallback(async (id) => {
    try {
      const res = await apiFetch(`/api/v1/admin/broadcasts/${id}/share`, { method: "POST" });
      const json = await res.json();
      if (json.status) {
        const url = `${window.location.origin}/b/${json.token}`;
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied to clipboard");
        refetchList();
      }
    } catch (e) { toast.error("Failed to generate share link"); }
  }, [refetchList]);

  const revokeBroadcast = useCallback(async (id) => {
    try {
      const res = await apiFetch(`/api/v1/admin/broadcasts/${id}/share`, { method: "DELETE" });
      const json = await res.json();
      if (json.status) {
        toast.success("Share link revoked");
        refetchList();
      }
    } catch (e) { toast.error("Failed to revoke share link"); }
  }, [refetchList]);

  const anyFilterActive = filterStatus || filterDateFrom || filterDateTo;
  const clearFilters = () => { setFilterStatus(""); setFilterDateFrom(""); setFilterDateTo(""); setPage(1); };

  // Audio player
  const [playingId, setPlayingId] = useState(null);
  const [playingUrl, setPlayingUrl] = useState(null);
  const audioRef = useRef(null);
  const playingIdRef = useRef(null);
  const broadcastsRef = useRef(broadcasts);
  useEffect(() => { broadcastsRef.current = broadcasts; }, [broadcasts]);
  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);
  const playNext = useCallback(() => {
    const audio = audioRef.current;
    const list = broadcastsRef.current;
    const curId = playingIdRef.current;
    if (!audio || !list || !curId) { setPlayingId(null); setPlayingUrl(null); return; }
    const idx = list.findIndex(b => b.id === curId);
    for (let i = idx - 1; i >= 0; i--) {
      if (list[i].recording_path) {
        const nextUrl = `/recordings/${list[i].recording_path.split("/").pop()}`;
        audio.src = nextUrl; audio.load(); audio.play().catch(() => {});
        setPlayingId(list[i].id); setPlayingUrl(nextUrl);
        return;
      }
    }
    setPlayingId(null); setPlayingUrl(null);
  }, []);
  const toggle = useCallback((id, url) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingIdRef.current === id) { audio.pause(); setPlayingId(null); setPlayingUrl(null); }
    else { audio.pause(); audio.src = url; audio.load(); audio.play().catch(() => {}); setPlayingId(id); setPlayingUrl(url); }
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Broadcasts</h2>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-mono tabular-nums">{totalBroadcasts}</span> total{" • "}
              <span className="font-mono tabular-nums">{totalAnswered}</span> answered{" • "}
              <span className="font-mono tabular-nums">{responseRate}%</span> response rate
            </p>
          </div>
          <select
            value={selectedRoom}
            onChange={e => { setSelectedRoom(e.target.value); setPage(1); }}
            className="h-9 px-3 pr-8 rounded-lg text-sm font-medium border border-border/40 bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-ring appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%23888%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M4.5%206l3.5%203.5L11.5%206%22%20stroke%3D%22%23888%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
          >
            <option value="">All Rooms</option>
            {Object.entries(ROOM_NAMES).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          {ranges.map(r => (
            <button
              key={r.key}
              onClick={() => setActiveRange(r.key)}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                activeRange === r.key
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/30 text-muted-foreground/60 border-border/40 hover:bg-muted/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <LiveBroadcastBanner events={sseEvents} ROOM_NAMES={ROOM_NAMES} />

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Broadcasts" value={totalBroadcasts} icon={<RadioIcon className="size-4" />} color="#06b6d4" />
        <StatCard label="Answered" value={totalAnswered} icon={<PhoneCallIcon className="size-4" />} color="#22c55e" />
        <StatCard label="Unanswered" value={totalUnanswered} icon={<PhoneOffIcon className="size-4" />} color="#ef4444" />
        <StatCard label="Response Rate" value={`${responseRate}%`} icon={<PercentIcon className="size-4" />} color="#f59e0b" mono={false} />
        <StatCard label="Avg Duration" value={avgResponseTime} icon={<ClockIcon className="size-4" />} color="#8b5cf6" mono={false} />
      </div>

      {/* Chart */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUpIcon className="size-3.5 text-cyan-400" />
              {activeRange === "today" ? "Hourly Activity" : activeRange === "week" ? "7 Days Activity" : "30 Days Activity"}
            </CardTitle>
            <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-800 rounded-sm" />
                <span className="text-muted-foreground/60">Answered</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-800 rounded-sm" />
                <span className="text-muted-foreground/60">Unanswered</span>
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ChartContainer config={barChartConfig} className="h-[220px] w-full [&_.recharts-cartesian-axis-line]:stroke-border [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground">
            <BarChart data={chartData} barGap={1}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.08)" />
              <XAxis dataKey="label" tickLine={false} axisLine={true} fontSize={10} interval={activeRange === "month" ? 4 : activeRange === "week" ? 0 : 2} />
              <YAxis tickLine={false} axisLine={true} fontSize={10} width={30} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="answered" stackId="a" fill="#065f46" radius={0} />
              <Bar dataKey="unanswered" stackId="a" fill="#991b1b" radius={[1, 1, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Hourly Distribution Line Chart */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUpIcon className="size-3.5 text-violet-400" />
              Hourly Distribution
              {hourlyDistKeys.length > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground/40 font-normal ml-1">
                  {hourlyDistKeys.length} {hourlyDistKeys.length === 1 ? "day" : "days"}
                </span>
              )}
            </CardTitle>
            {hourlyDistKeys.length > 1 && activeRange !== "month" && (
              <div className="flex items-center gap-2 flex-wrap justify-end max-w-[60%]">
                {hourlyDistKeys.map((day, i) => (
                  <span key={day} className="flex items-center gap-1 text-[10px] font-mono">
                    <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
                    <span className="text-foreground/70">{day}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {hourlyDistKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No data</p>
          ) : (
            <ChartContainer config={hourlyDistConfig} className="h-[260px] w-full [&_.recharts-cartesian-axis-line]:stroke-border [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground">
              <LineChart data={hourlyDistData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.08)" />
                <XAxis dataKey="hour" tickLine={false} axisLine={true} fontSize={10} interval={2} />
                <YAxis tickLine={false} axisLine={true} fontSize={10} width={30} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {hourlyDistKeys.map((day, i) => (
                  <Line
                    key={day}
                    type="monotone"
                    dataKey={day}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={activeRange === "month" ? 1 : 1.5}
                    dot={activeRange !== "month"}
                    activeDot={{ r: 3 }}
                    name={day}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Two Column: Broadcasters + Channel Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <UserIcon className="size-3.5 text-amber-400" />
              Top Broadcasters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-6">#</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Answered</TableHead>
                  <TableHead className="text-right">Avg Dur</TableHead>
                  <TableHead className="text-right pr-6">Room</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBroadcasters.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
                ) : (
                  topBroadcasters.slice(0, 10).map((b, i) => {
                    const medals = ["text-amber-400", "text-zinc-400", "text-orange-400"];
                    const rate = b.count > 0 ? Math.round(((b.answered || 0) / b.count) * 100) : 0;
                    return (
                      <TableRow key={b.user_name || i}>
                        <TableCell className={`font-mono text-xs tabular-nums pl-6 ${medals[i] || "text-muted-foreground/40"}`}>{i + 1}</TableCell>
                        <TableCell><span className="text-sm font-medium">{b.display_name || b.user_name}</span></TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{b.count}</TableCell>
                        <TableCell className="text-right">
                          {rate > 0 ? (
                            <span className={`text-xs font-mono tabular-nums ${rate >= 70 ? "text-emerald-400" : rate >= 40 ? "text-amber-400" : "text-red-400"}`}>{rate}%</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs text-muted-foreground">{b.avg_duration_ms ? formatDuration(b.avg_duration_ms) : "—"}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground pr-6">{b.room_name || "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <RadioIcon className="size-3.5 text-cyan-400" />
              Channel Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {byRoom.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              byRoom.map(r => {
                const pct = (r.count / maxRoomCount) * 100;
                const name = ROOM_NAMES[r.room] || r.room;
                const answered = r.answered || 0;
                const answeredPct = r.count > 0 ? (answered / r.count) * 100 : 0;
                return (
                  <div key={r.room} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-emerald-400/60">{Math.round(answeredPct)}%</span>
                        <span className="text-xs font-mono tabular-nums text-muted-foreground">{r.count}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted/20 rounded-sm overflow-hidden">
                      <div className="h-full flex transition-all duration-500">
                        <div className="h-full bg-emerald-700 group-hover:bg-emerald-600" style={{ width: `${(answered / maxRoomCount) * 100}%` }} />
                        <div className="h-full bg-red-800 group-hover:bg-red-700" style={{ width: `${((r.count - answered) / maxRoomCount) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Broadcast List ═══ */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ListIcon className="size-3.5 text-emerald-400" />
              Broadcast Log
              <span className="text-[10px] font-mono text-muted-foreground/40 font-normal ml-1">{totalItems.toLocaleString()} total</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Status pills */}
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted/20 border border-border/30">
                {[
                  { key: "", label: "All", active: "bg-background text-foreground shadow-sm" },
                  { key: "answered", label: "Answered", active: "bg-emerald-500/15 text-emerald-400 shadow-sm" },
                  { key: "unanswered", label: "Unanswered", active: "bg-red-500/15 text-red-400 shadow-sm" },
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => { setFilterStatus(s.key); setPage(1); }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      filterStatus === s.key
                        ? s.active
                        : "text-muted-foreground/60 hover:text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Date range */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }}
                  className="h-7 w-[130px] text-[11px] bg-muted/20 border-border/30"
                  placeholder="From"
                />
                <span className="text-muted-foreground/30 text-xs">–</span>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={e => { setFilterDateTo(e.target.value); setPage(1); }}
                  className="h-7 w-[130px] text-[11px] bg-muted/20 border-border/30"
                  placeholder="To"
                />
              </div>

              {anyFilterActive && (
                <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all">
                  <XIcon className="size-3" /> Clear
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 px-0">
          {/* Waveform player */}
          {playingId && playingUrl && (
            <div className="px-4 pb-2">
              <WaveformPlayer url={playingUrl} isActive={!!playingId} onToggle={() => toggle(playingId, playingUrl)} sharedAudioRef={audioRef} />
            </div>
          )}

          {listLoading ? (
            <div className="space-y-2 px-6 py-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : broadcasts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No broadcasts found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 w-12"></TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Speaker</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Listeners</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Responded By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 w-16">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((b) => {
                  const url = b.recording_path ? `/recordings/${b.recording_path.split("/").pop()}` : null;
                  const playing = playingId === b.id;
                  return (
                    <TableRow key={b.id} className={playing ? "bg-emerald-500/[0.03]" : ""}>
                      <TableCell className="pl-6">
                        {url && (
                          <button
                            onClick={() => toggle(b.id, url)}
                            className={`flex size-7 items-center justify-center rounded-full border transition-all cursor-pointer ${
                              playing
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                            }`}
                          >
                            {playing ? (
                              <div className="flex items-end gap-[2px] h-3">
                                {[0, 1, 2].map(i => (
                                  <div key={i} className="w-[2px] bg-emerald-400 rounded-full" style={{ animation: `eqBar ${0.3 + i * 0.1}s ease-in-out infinite alternate`, animationDelay: `${i * 80}ms` }} />
                                ))}
                              </div>
                            ) : (
                              <PlayIcon className="size-3 ml-0.5" />
                            )}
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-mono tabular-nums">
                          {formatTime(b.created_at, selectedRoom ? activeOffsetMin : roomTimezones[b.room] ?? null)}
                          {!selectedRoom && <span className="text-[9px] text-muted-foreground/40 ml-1">{gmtLabel(roomTimezones[b.room] ?? null)}</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground/50">{formatFullDate(b.created_at, selectedRoom ? activeOffsetMin : roomTimezones[b.room] ?? null)}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{b.display_name || b.user_name || "Unknown"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{b.room_name || ROOM_NAMES[b.room] || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono tabular-nums text-muted-foreground">{formatDuration(b.duration_ms)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono tabular-nums text-muted-foreground">{b.participant_count || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono tabular-nums text-muted-foreground">{b.listener_count || "—"}</span>
                      </TableCell>
                      <TableCell>
                        {b.answered ? (
                          <span className={`text-sm font-mono tabular-nums ${b.response_time_ms === 0 ? "text-emerald-400" : b.response_time_ms != null ? "text-amber-400" : "text-muted-foreground/40"}`}>
                            {b.response_time_ms === 0 ? "instant" : b.response_time_ms != null ? formatDuration(b.response_time_ms) : "—"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{b.responded_by || "—"}</span>
                      </TableCell>
                      <TableCell>
                        {b.answered ? (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] px-1.5 py-0">Answered</Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] px-1.5 py-0">Unanswered</Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-6">
                        {b.share_token ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => revokeBroadcast(b.id)}
                                className="flex size-7 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
                              >
                                <Unlink2Icon className="size-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Revoke share link</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => shareBroadcast(b.id)}
                                className="flex size-7 items-center justify-center rounded-full border border-border/50 bg-muted/40 text-muted-foreground hover:text-foreground hover:border-border transition-all cursor-pointer"
                              >
                                <Share2Icon className="size-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Generate share link</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 0 && broadcasts.length > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border/30">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Showing <span className="font-mono tabular-nums">{((page - 1) * pageSize) + 1}</span>–<span className="font-mono tabular-nums">{Math.min(page * pageSize, totalItems)}</span> of <span className="font-mono tabular-nums">{totalItems.toLocaleString()}</span>
                </span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(parseInt(e.target.value)); setPage(1); }}
                  className="h-7 px-1.5 rounded text-xs border border-border/30 bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {[10, 25, 50, 100].map(n => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-7" disabled={page <= 1} onClick={() => setPage(1)}>
                  <ChevronsLeftIcon className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeftIcon className="size-3.5" />
                </Button>
                <span className="px-2 text-xs font-mono tabular-nums text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button variant="ghost" size="icon" className="size-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRightIcon className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                  <ChevronsRightIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <audio ref={audioRef} preload="none" className="hidden" onEnded={playNext} onError={playNext} />
      <style>{`
        @keyframes eqBar {
          from { height: 3px; }
          to { height: 10px; }
        }
      `}</style>
    </div>
  );
}
