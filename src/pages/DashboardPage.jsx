import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { useSSE } from "@/hooks/useSSE";
import { EVENT_COLORS, timeAgo } from "@/lib/constants";
import { useRooms } from "@/hooks/useRooms";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  UsersIcon,
  WifiIcon,
  PhoneCallIcon,
  RadioIcon,
  ActivityIcon,
  MicIcon,
  MicOffIcon,
  CircleIcon,
  Volume2Icon,
  TrophyIcon,
  ZapIcon,
  PlayIcon,
} from "lucide-react";


// ─── Animated Counter Hook ───
function useAnimatedNumber(target, duration = 600) {
  const [display, setDisplay] = useState(target);
  const frameRef = useRef(null);
  const startRef = useRef(display);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (target === display && !startTimeRef.current) return;
    startRef.current = display;
    startTimeRef.current = performance.now();

    const animate = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startRef.current + (target - startRef.current) * eased);
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        startTimeRef.current = null;
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

// ─── Timeline Tracker Hook ───
function useTimeline() {
  const [segments, setSegments] = useState({});

  const fetchTimeline = useCallback(() => {
    fetch("/api/v1/admin/broadcasts/activity?minutes=30")
      .then(r => r.json())
      .then(res => {
        const rows = res?.data || [];
        const grouped = {};
        for (const row of rows) {
          if (!grouped[row.room]) grouped[row.room] = [];
          const startMs = row.created_at * 1000;
          const endMs = startMs + (row.duration_ms || 5000);
          grouped[row.room].push({ start: startMs, end: endMs, answered: !!row.answered });
        }
        setSegments(grouped);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTimeline();
    const id = setInterval(fetchTimeline, 30000);
    return () => clearInterval(id);
  }, [fetchTimeline]);

  return { segments, refetch: fetchTimeline };
}

// ─── Stat Card with Animated Number ───
function StatCard({ title, value, icon, color, subtitle, pulse }) {
  const animatedValue = useAnimatedNumber(value);

  return (
    <Card className="relative overflow-hidden border-0 group">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="relative flex size-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}15` }}
          >
            {pulse && (
              <span className="absolute inset-0 rounded-lg animate-ping opacity-20" style={{ backgroundColor: color }} />
            )}
            <div style={{ color }}>{icon}</div>
          </div>
          <div className="min-w-0">
            <p className="text-3xl font-bold tabular-nums leading-none font-mono tracking-tight">
              {animatedValue}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {title}
            </p>
          </div>
        </div>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">{subtitle}</p>
        )}
      </CardContent>
      <div
        className="absolute bottom-0 left-0 h-[2px] w-full transition-all duration-1000"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}40, transparent)` }}
      />
    </Card>
  );
}

// ─── Open Mics ───
function OpenMics({ speakers }) {
  const { names: ROOM_NAMES, codes: ROOM_SHORT } = useRooms();
  return (
    <Card className="border-0 relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <MicIcon className="size-3.5 text-amber-400" />
          Open Mics
          {speakers.length > 0 && (
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px] px-1.5 h-4 gap-1">
              {speakers.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {speakers.length === 0 ? (
          <div className="flex items-center justify-center h-16">
            <MicOffIcon className="size-4 text-muted-foreground/20 mr-2" />
            <span className="text-[11px] text-muted-foreground/40 font-mono">ALL MUTED</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {speakers.slice(0, 8).map((s, i) => {
              const callerName = s.callerIdName || s.userName || "";
              const cleanName = callerName.replace("sip:", "");
              const room = ROOM_NAMES[s.room] || "";
              const shortRoom = ROOM_SHORT[s.room] || "";
              const initials = cleanName.split(/[\s/@]/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

              return (
                <div
                  key={s.userName || i}
                  className="flex items-center gap-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/15 px-3 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold ring-1 ring-amber-500/25">
                    {initials || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{cleanName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{room}</p>
                  </div>
                  <MicIcon className="size-3 text-amber-400 shrink-0 animate-pulse" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Room Card with Heatmap Glow + Active Speakers ───
function RoomCard({ room, speakers }) {
  const { names: ROOM_NAMES, codes: ROOM_SHORT } = useRooms();
  const name = ROOM_NAMES[room.room] || `Room ${room.room}`;
  const shortCode = ROOM_SHORT[room.room] || "??";
  const total = room.total || 0;
  const online = room.online || 0;
  const inCall = room.in_call || 0;
  const unmuted = room.unmuted || 0;
  const isEmpty = total === 0;

  const intensity = inCall > 0 ? Math.min(unmuted / 4, 1) : 0;
  const glowColor = inCall > 0 ? `rgba(34,197,94,${0.08 + intensity * 0.15})` : "transparent";
  const borderColor = inCall > 0 ? `rgba(34,197,94,${0.15 + intensity * 0.3})` : "transparent";

  const activeSpeakers = speakers || [];
  const visibleSpeakers = activeSpeakers.slice(0, 4);
  const overflow = activeSpeakers.length - 4;

  return (
    <Card
      className={`border transition-all duration-500 ${isEmpty ? "opacity-25 border-transparent" : ""}`}
      style={{
        borderColor,
        boxShadow: inCall > 0 ? `0 0 ${12 + intensity * 20}px ${glowColor}, inset 0 0 ${8 + intensity * 12}px ${glowColor}` : "none",
        background: inCall > 0 ? `linear-gradient(135deg, ${glowColor}, transparent 60%)` : undefined,
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg font-bold text-sm tabular-nums font-mono ${
            inCall > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
          }`}>
            {shortCode}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold truncate">{name}</span>
              {inCall > 0 && (
                <Badge variant="secondary" className="h-4 text-[10px] px-1.5 gap-1 shrink-0 ml-2 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                  <Volume2Icon className="size-2.5" />
                  Live
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <UsersIcon className="size-3" />
                {total}
              </span>
              <span className={`flex items-center gap-1 text-xs font-mono ${online > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                <CircleIcon className="size-1.5 fill-current" />
                {online}
              </span>
              {inCall > 0 && (
                <span className="flex items-center gap-1 text-xs text-blue-400 font-mono">
                  <PhoneCallIcon className="size-3" />
                  {inCall}
                </span>
              )}
              {unmuted > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-400 font-mono">
                  <MicIcon className="size-3" />
                  {unmuted}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Active speakers */}
        {visibleSpeakers.length > 0 && (
          <div className="flex items-center gap-1 mt-3">
            {visibleSpeakers.map((s) => {
              const initials = (s.callerIdName || s.userName || "?")
                .replace("sip:", "").split(/[\s/@]/)[0].slice(0, 2).toUpperCase();
              return (
                <span key={s.userName} className="flex size-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold ring-1 ring-amber-500/30" title={s.callerIdName || s.userName}>
                  {initials}
                </span>
              );
            })}
            {overflow > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono ml-1">+{overflow}</span>
            )}
            <span className="text-[9px] text-amber-400/50 ml-auto font-mono">speaking</span>
          </div>
        )}

        {/* Capacity bar */}
        {total > 0 && (
          <div className="mt-3 flex gap-[2px] h-1 rounded-full overflow-hidden">
            {inCall > 0 && (
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(inCall / total) * 100}%` }} />
            )}
            {(online - inCall) > 0 && (
              <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${((online - inCall) / total) * 100}%` }} />
            )}
            {(total - online) > 0 && (
              <div className="h-full bg-muted rounded-full" style={{ width: `${((total - online) / total) * 100}%` }} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Conference Timeline ───
function ConferenceTimeline({ roomId, segments }) {
  const { codes: ROOM_SHORT } = useRooms();
  const now = Date.now();
  const windowMs = 30 * 60 * 1000;
  const start = now - windowMs;
  const roomSegs = segments[roomId] || [];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-muted-foreground w-[32px] shrink-0">{ROOM_SHORT[roomId]}</span>
      <div className="flex-1 h-[6px] bg-muted/30 overflow-hidden relative">
        {roomSegs.filter((s) => s.end > start).map((seg, i) => {
          const l = Math.max(0, ((seg.start - start) / windowMs) * 100);
          const r = Math.min(100, ((seg.end - start) / windowMs) * 100);
          return (
            <div
              key={i}
              className={`absolute top-0 h-full ${seg.answered ? "bg-emerald-500" : "bg-red-500"}`}
              style={{ left: `${l}%`, width: `${Math.max(0.5, r - l)}%`, opacity: 0.7 }}
            />
          );
        })}
        <div className="absolute top-0 right-0 w-[2px] h-full bg-foreground/30" />
      </div>
    </div>
  );
}

const broadcastChartConfig = {
  answered: { label: "Answered", color: "var(--color-emerald-800)" },
  unanswered: { label: "Unanswered", color: "var(--color-red-800)" },
};

function BroadcastChart() {
  const { codes: ROOM_SHORT } = useRooms();
  const views = [
    { key: "12h", label: "12h", hours: 12 },
    { key: "24h", label: "24h", hours: 24 },
    { key: "week", label: "7d", hours: 168 },
  ];
  const [active, setActive] = useState("12h");
  const [cache, setCache] = useState({});

  useEffect(() => {
    const h = views.find(v => v.key === active)?.hours || 12;
    fetch(`/api/v1/admin/broadcasts/hourly?hours=${h}`)
      .then(r => r.json())
      .then(res => setCache(prev => ({ ...prev, [active]: res?.data || [] })))
      .catch(() => {});
  }, [active]);

  const rawData = cache[active] || [];
  const now = new Date();

  const chartData = useMemo(() => {
    if (active === "week") {
      const dayMap = {};
      for (const row of rawData) {
        const d = new Date(row.created_at * 1000);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!dayMap[key]) dayMap[key] = { answered: 0, unanswered: 0 };
        if (row.answered) dayMap[key].answered++;
        else dayMap[key].unanswered++;
      }
      const result = [];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const entry = dayMap[key];
        result.push({
          label: `${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`,
          answered: entry?.answered || 0,
          unanswered: entry?.unanswered || 0,
        });
      }
      return result;
    }

    const numHours = active === "24h" ? 24 : 12;
    const hourMap = {};
    for (const row of rawData) {
      const d = new Date(row.created_at * 1000);
      const hourKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      if (!hourMap[hourKey]) hourMap[hourKey] = { answered: 0, unanswered: 0 };
      if (row.answered) hourMap[hourKey].answered++;
      else hourMap[hourKey].unanswered++;
    }

    const result = [];
    for (let i = numHours - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000);
      const hourKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      const entry = hourMap[hourKey];
      const h = d.getHours();
      const label = h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`;
      result.push({ label, answered: entry?.answered || 0, unanswered: entry?.unanswered || 0 });
    }
    return result;
  }, [rawData, active]);

  const totalAnswered = chartData.reduce((s, b) => s + b.answered, 0);
  const totalUnanswered = chartData.reduce((s, b) => s + b.unanswered, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {views.map(v => (
            <button
              key={v.key}
              onClick={() => setActive(v.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                active === v.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-800 rounded-sm" />
            <span className="text-muted-foreground/60">{totalAnswered}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-red-800 rounded-sm" />
            <span className="text-muted-foreground/60">{totalUnanswered}</span>
          </span>
        </div>
      </div>

      <ChartContainer config={broadcastChartConfig} className="h-[160px] w-full [&_.recharts-cartesian-axis-line]:stroke-border [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground">
        <BarChart data={chartData} barGap={1}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.1)" />
          <XAxis dataKey="label" tickLine={false} axisLine={true} fontSize={10} interval={active === "24h" ? 2 : 0} />
          <YAxis tickLine={false} axisLine={true} fontSize={10} width={30} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="answered" stackId="a" fill="#065f46" radius={0} />
          <Bar dataKey="unanswered" stackId="a" fill="#991b1b" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ─── Room Availability Chart ───
const ROOM_COLORS = {
  123456701: "#22c55e", 123456702: "#3b82f6", 123456703: "#f59e0b",
  123456704: "#ef4444", 123456705: "#8b5cf6", 123456706: "#06b6d4",
  123456707: "#ec4899", 123456708: "#f97316", 123456709: "#14b8a6",
  123456710: "#a855f7", 123456711: "#6366f1", 123456712: "#84cc16",
};

function RoomAvailabilityChart() {
  const { codes: ROOM_SHORT } = useRooms();
  const views = [
    { key: "12h", label: "12h", hours: 12 },
    { key: "24h", label: "24h", hours: 24 },
    { key: "week", label: "7d", hours: 168 },
  ];
  const [active, setActive] = useState("12h");
  const [cache, setCache] = useState({});

  useEffect(() => {
    const h = views.find(v => v.key === active)?.hours || 12;
    fetch(`/api/v1/admin/broadcasts/availability?hours=${h}`)
      .then(r => r.json())
      .then(res => setCache(prev => ({ ...prev, [active]: res?.data || [] })))
      .catch(() => {});
  }, [active]);

  const rawData = cache[active] || [];

  const { chartData, roomIds } = useMemo(() => {
    if (!rawData.length) return { chartData: [], roomIds: [] };

    const isWeek = active === "week";
    const numBuckets = isWeek ? 7 : (active === "24h" ? 24 : 12);
    const now = new Date();

    const getBucket = (ts) => {
      const d = new Date(ts * 1000);
      if (isWeek) return Math.max(0, numBuckets - 1 - Math.floor((now.getTime() - d.getTime()) / 86400000));
      return Math.max(0, numBuckets - 1 - Math.floor((now.getTime() - d.getTime()) / 3600000));
    };

    const roomBuckets = {};
    const allRooms = new Set();
    for (const row of rawData) {
      const b = getBucket(row.created_at);
      if (b < 0 || b >= numBuckets) continue;
      const room = row.room;
      allRooms.add(room);
      if (!roomBuckets[room]) roomBuckets[room] = Array(numBuckets).fill(null).map(() => ({ sum: 0, count: 0 }));
      roomBuckets[room][b].sum += row.online_count;
      roomBuckets[room][b].count++;
    }

    const data = [];
    for (let i = 0; i < numBuckets; i++) {
      let label;
      if (isWeek) {
        const d = new Date(now.getTime() - (numBuckets - 1 - i) * 86400000);
        label = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
      } else {
        const d = new Date(now.getTime() - (numBuckets - 1 - i) * 3600000);
        const h = d.getHours();
        label = h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`;
      }
      const point = { label };
      for (const room of allRooms) {
        const b = roomBuckets[room]?.[i];
        point[room] = b && b.count > 0 ? Math.round(b.sum / b.count) : 0;
      }
      data.push(point);
    }

    return { chartData: data, roomIds: [...allRooms].sort((a, b) => a - b) };
  }, [rawData, active]);

  const lineChartConfig = Object.fromEntries(
    roomIds.map(id => [id, { label: ROOM_SHORT[id] || id, color: ROOM_COLORS[id] || "#71717a" }])
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {views.map(v => (
            <button
              key={v.key}
              onClick={() => setActive(v.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                active === v.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/40 font-mono text-center py-8">No data available</p>
      ) : (
        <>
          <ChartContainer config={lineChartConfig} className="h-[160px] w-full [&_.recharts-cartesian-axis-line]:stroke-border [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground">
            <LineChart data={chartData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.1)" />
              <XAxis dataKey="label" tickLine={false} axisLine={true} fontSize={10} interval={active === "24h" ? 2 : 0} />
              <YAxis tickLine={false} axisLine={true} fontSize={10} width={30} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {roomIds.map(roomId => (
                <Line
                  key={roomId}
                  type="monotone"
                  dataKey={String(roomId)}
                  name={ROOM_SHORT[roomId] || String(roomId)}
                  stroke={ROOM_COLORS[roomId] || "#71717a"}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {roomIds.map(roomId => (
              <span key={roomId} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                <span className="w-3 h-[2px] rounded-full" style={{ backgroundColor: ROOM_COLORS[roomId] || "#71717a" }} />
                {ROOM_SHORT[roomId] || roomId}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Live Ticker ───
function LiveTicker({ events }) {
  const { names: ROOM_NAMES } = useRooms();
  const recent = events.slice(-12).reverse();

  if (recent.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-hidden h-6">
      <ZapIcon className="size-3 text-amber-400 shrink-0" />
      <div className="flex-1 overflow-hidden relative">
        <div className="flex gap-6 animate-ticker whitespace-nowrap">
          {recent.map((ev) => {
            const type = (ev.event_type || ev.type || "").toLowerCase();
            const user = (ev.user_name || ev.userName || "").replace("sip:", "").split("@")[0];
            const roomId = ev.room || ev.roomId;
            const room = roomId ? ROOM_NAMES[roomId] || "" : "";
            const color = EVENT_COLORS[type] || "#71717a";
            const action = type.replace(/_/g, " ");

            return (
              <span key={ev._id || ev.id} className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-foreground/80 font-medium">{user}</span>
                <span className="text-muted-foreground/60">{action}</span>
                {room && <span className="text-muted-foreground/40">{room}</span>}
              </span>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

// ─── Top Broadcasters ───
function TopBroadcasters() {
  const tabs = [
    { key: "today", label: "Today", days: 1 },
    { key: "week", label: "This Week", days: 7 },
    { key: "month", label: "This Month", days: 30 },
  ];
  const [active, setActive] = useState("today");
  const [data, setData] = useState({});

  useEffect(() => {
    const days = tabs.find(t => t.key === active)?.days || 1;
    fetch(`/api/v1/admin/broadcasts?days=${days}`)
      .then(r => r.json())
      .then(res => {
        const d = res?.data ?? res;
        setData(prev => ({ ...prev, [active]: d?.topBroadcasters || [] }));
      })
      .catch(() => {});
  }, [active]);

  const broadcasters = data[active] || [];
  const medals = ["text-amber-400", "text-zinc-400", "text-orange-400"];

  function fmtDur(ms) {
    if (!ms) return "—";
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                active === t.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-foreground/80 font-medium tabular-nums underline underline-offset-2 decoration-foreground/30">
          {(() => {
            const now = new Date();
            const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const days = tabs.find(t => t.key === active)?.days || 1;
            if (days === 1) return fmt(now);
            const from = new Date(now.getTime() - (days - 1) * 86400000);
            return `${fmt(from)} – ${fmt(now)}`;
          })()}
        </span>
      </div>
      {broadcasters.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No broadcasts yet</p>
      ) : (
        <div className="space-y-1.5">
          {broadcasters.slice(0, 10).map((b, i) => {
            const rate = b.count > 0 ? Math.round(((b.answered || 0) / b.count) * 100) : 0;
            const name = b.display_name || b.user_name || "Unknown";
            return (
              <div key={b.user_name || i} className="rounded-lg bg-muted/15 border border-border/30 px-3 py-2.5 hover:bg-muted/25 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums ${medals[i] || "bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{name}</span>
                      <span className="text-xs font-mono tabular-nums text-foreground/60 shrink-0">{b.count} broadcasts</span>
                      {rate > 0 && (
                        <span className={`text-xs font-mono tabular-nums shrink-0 ${rate >= 70 ? "text-emerald-500" : rate >= 40 ? "text-amber-500" : "text-red-500"}`}>{rate}% answered</span>
                      )}
                      <span className="text-xs font-mono tabular-nums text-foreground/40 ml-auto shrink-0">{fmtDur(b.avg_duration_ms)} avg</span>
                    </div>
                    <span className="text-[10px] text-foreground/60">{b.room_name || "—"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Recent Broadcasts ───
function RecentBroadcasts({ broadcasts }) {
  const [filter, setFilter] = useState("all");
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);
  const playingIdRef = useRef(null);

  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlayingId(null);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  const toggle = useCallback((id, url) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingIdRef.current === id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.pause();
      audio.src = url;
      audio.load();
      audio.play().catch(() => {});
      setPlayingId(id);
    }
  }, []);

  if (!broadcasts || broadcasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <RadioIcon className="size-6 mb-2 opacity-30" />
        <p className="text-xs">No recent broadcasts</p>
      </div>
    );
  }

  const filtered = filter === "all" ? broadcasts
    : filter === "answered" ? broadcasts.filter(b => b.answered)
    : broadcasts.filter(b => !b.answered);

  if (filtered.length === 0) {
    return (
      <>
        <div className="flex bg-muted/20 p-0.5 gap-0.5 mb-2">
          {[
            { key: "all", label: "All" },
            { key: "answered", label: "Answered" },
            { key: "unanswered", label: "Unanswered" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`flex-1 px-2 py-1 text-[11px] font-mono font-medium tracking-wide transition-all cursor-pointer ${
                filter === t.key
                  ? "bg-foreground/10 text-foreground shadow-sm"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <p className="text-xs">No {filter} broadcasts</p>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 mb-2">
        {[
          { key: "all", label: "All" },
          { key: "answered", label: "Answered" },
          { key: "unanswered", label: "Unanswered" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              filter === t.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {filtered.slice(0, 8).map((b) => (
        <BroadcastRow key={b.id} broadcast={b} playing={playingId === b.id} onToggle={toggle} />
      ))}
      <audio ref={audioRef} preload="none" />
      <style>{`
        @keyframes eqBar {
          from { height: 3px; }
          to { height: 14px; }
        }
      `}</style>
    </div>
  );
}

function BroadcastRow({ broadcast: b, playing, onToggle }) {
  const { names: ROOM_NAMES } = useRooms();
  const name = b.display_name || b.user_name || "Unknown";
  const room = b.room_name || ROOM_NAMES[b.room] || "";
  const url = b.recording_path ? `/recordings/${b.recording_path.split("/").pop()}` : null;

  return (
    <div className="rounded-lg bg-muted/15 border border-border/30 px-3 py-2.5 hover:bg-muted/25 transition-colors">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{name}</span>
            <Badge
              variant="secondary"
              className={`text-[9px] px-1.5 h-4 shrink-0 ${
                b.answered
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/15 text-red-400 border-red-500/20"
              }`}
            >
              {b.answered ? "Answered" : "Unanswered"}
            </Badge>
            {b.duration_ms >= 1000 && (
              <span className="text-[10px] font-mono tabular-nums text-foreground/60 shrink-0">
                {b.duration_ms < 60000 ? `${Math.floor(b.duration_ms / 1000)}s` : `${Math.floor(b.duration_ms / 60000)}m ${Math.floor((b.duration_ms % 60000) / 1000)}s`}
              </span>
            )}
            <span className="text-[10px] tabular-nums text-foreground/40 ml-auto shrink-0">{timeAgo(b.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-foreground/60">{room}</span>
            {!!b.answered && b.responded_by && (
              <>
                <span className="text-[10px] text-foreground/30">·</span>
                <span className="text-[10px] text-foreground/80 truncate">Responded by : <strong>{b.responded_by}</strong></span>
              </>
            )}
          </div>
        </div>

        {url && (
          <button
            onClick={() => onToggle(b.id, url)}
            className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-all ${
              playing
                ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {playing ? (
              <div className="flex items-end gap-[2px] h-3.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-[3px] bg-cyan-400 rounded-full"
                    style={{
                      animation: `eqBar ${0.3 + i * 0.1}s ease-in-out infinite alternate`,
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <PlayIcon className="size-3.5 ml-0.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───
export default function DashboardPage() {
  const { names: ROOM_NAMES, codes: ROOM_SHORT } = useRooms();
  const { data: dashRaw, loading, refetch: refetchDash } = useFetch("/api/v1/admin/dashboard");
  const { data: broadcastRaw, refetch: refetchBroadcasts } = useFetch("/api/v1/admin/broadcasts");
  const { data: recentBcastRaw, loading: bcastLoading, refetch: refetchRecentBcast } = useFetch("/api/v1/admin/broadcasts/recent?limit=8");
  const { data: usersRaw, refetch: refetchUsers } = useFetch("/api/v1/admin/users");
  useSSERefresh(() => { refetchDash(); refetchUsers(); refetchBroadcasts(); refetchRecentBcast(); }, ["dashboard", "users", "events", "broadcasts"]);

  // Live SSE stream for ticker + broadcast detection
  const { events: liveEvents } = useSSE("/api/v1/admin/events/stream");
  const { segments } = useTimeline();

  // Ticker events (only meaningful ones)
  const tickerEvents = useMemo(() => {
    return liveEvents.filter((e) => {
      const t = (e.event_type || e.type || "").toLowerCase();
      return ["conference_join", "conference_leave", "mute", "unmute", "registration", "unregister", "broadcast", "honk", "reconnect", "kickout"].includes(t);
    });
  }, [liveEvents.length]);

  const data = dashRaw?.data ?? dashRaw;
  const broadcastData = broadcastRaw?.data ?? broadcastRaw;
  const recentBroadcasts = Array.isArray(recentBcastRaw) ? recentBcastRaw : recentBcastRaw?.data || [];

  // Users grouped by room for speaker indicators
  const speakersByRoom = useMemo(() => {
    const users = Array.isArray(usersRaw) ? usersRaw : usersRaw?.data || [];
    const map = {};
    for (const u of users) {
      if (u.connectionState === "connected" && !u.mute && u.room) {
        if (!map[u.room]) map[u.room] = [];
        map[u.room].push(u);
      }
    }
    return map;
  }, [usersRaw]);

  // All unmuted speakers flat list for waveform
  const allSpeakers = useMemo(() => {
    const users = Array.isArray(usersRaw) ? usersRaw : usersRaw?.data || [];
    return users.filter((u) => u.connectionState === "connected" && !u.mute);
  }, [usersRaw]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-7 w-36" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const totalUsers = data?.totalUsers ?? 0;
  const onlineUsers = data?.onlineUsers ?? 0;
  const inCallUsers = data?.inCallUsers ?? 0;
  const todayBroadcasts = data?.todayBroadcasts ?? 0;
  const roomStats = data?.roomStats || [];

  const activeRooms = roomStats.filter((r) => (r.online || 0) > 0).length;
  const totalUnmuted = roomStats.reduce((s, r) => s + (r.unmuted || 0), 0);

  const sortedRooms = [...roomStats].sort((a, b) => {
    const aScore = (a.in_call || 0) * 100 + (a.online || 0) * 10 + (a.total || 0);
    const bScore = (b.in_call || 0) * 100 + (b.online || 0) * 10 + (b.total || 0);
    return bScore - aScore;
  });

  const allRoomIds = Object.keys(ROOM_NAMES).map(Number);
  const activeRooms_list = sortedRooms.filter((r) => (r.online || 0) > 0);
  const activeRoomIds = activeRooms_list.map((r) => r.room);

  const stats = [
    {
      title: "Total Users",
      value: totalUsers,
      icon: <UsersIcon className="size-4" />,
      color: "#8b8b8b",
      subtitle: `${allRoomIds.length} rooms configured`,
    },
    {
      title: "Online Now",
      value: onlineUsers,
      icon: <WifiIcon className="size-4" />,
      color: "#22c55e",
      subtitle: `${activeRooms} active rooms`,
      pulse: false,
    },
    {
      title: "In Conference",
      value: inCallUsers,
      icon: <PhoneCallIcon className="size-4" />,
      color: "#6366f1",
      subtitle: `${totalUnmuted} unmuted`,
    },
    {
      title: "Broadcasts Today",
      value: todayBroadcasts,
      icon: <RadioIcon className="size-4" />,
      color: "#06b6d4",
      subtitle: `${data?.todayAnswered ?? 0} answered`,
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header + Live Badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 text-[11px] font-mono">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </Badge>
        </div>
      </div>

      {/* Live Ticker */}
      {tickerEvents.length > 0 && (
        <div className="rounded-lg bg-muted/20 border border-border/50 px-3 py-1.5">
          <LiveTicker events={tickerEvents} />
        </div>
      )}

      {/* Stats Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => <StatCard key={s.title} {...s} />)}
      </div>

      {/* Broadcast Waveform + Timeline */}
      <div className="grid gap-4 lg:grid-cols-2">
        <OpenMics speakers={allSpeakers} />

        {/* 30-min Timeline */}
        <Card className="border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ActivityIcon className="size-3.5 text-emerald-400" />
                Activity Timeline
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50"><span className="size-2 rounded-full bg-emerald-500 opacity-70" />Answered</span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50"><span className="size-2 rounded-full bg-red-500 opacity-70" />Unanswered</span>
                <span className="text-[10px] text-muted-foreground/30 font-mono">30 min</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {Object.keys(segments).length > 0 ? Object.keys(segments).map((rid) => (
              <ConferenceTimeline key={rid} roomId={parseInt(rid)} segments={segments} />
            )) : (
              <p className="text-[11px] text-muted-foreground/40 font-mono text-center py-4">No broadcasts in last 30 min</p>
            )}
          </CardContent>
        </Card>

        {/* Broadcast Activity Chart */}
        <Card className="border-0">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ActivityIcon className="size-3.5 text-emerald-400" />
              Broadcast Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BroadcastChart />
          </CardContent>
        </Card>

        {/* User Availability */}
        <Card className="border-0">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <UsersIcon className="size-3.5 text-blue-400" />
              User Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <RoomAvailabilityChart />
          </CardContent>
        </Card>
      </div>

      {/* Room Cards */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Conference Rooms
        </h3>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activeRooms_list.length > 0 ? activeRooms_list.map((room) => (
            <RoomCard key={room.room} room={room} speakers={speakersByRoom[room.room]} />
          )) : (
            <p className="text-[11px] text-muted-foreground/40 font-mono col-span-full text-center py-8">No active rooms</p>
          )}
        </div>
      </div>

      {/* Bottom Row: Broadcasters + Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrophyIcon className="size-3.5 text-amber-400" />
              Top Broadcasters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <TopBroadcasters />
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <RadioIcon className="size-3.5 text-cyan-400" />
              Recent Broadcasts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {bcastLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <RecentBroadcasts broadcasts={recentBroadcasts} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
