import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { useSSE } from "@/hooks/useSSE";
import { useRooms } from "@/hooks/useRooms";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  RadioIcon, PhoneCallIcon, PhoneOffIcon, PercentIcon,
  TrendingUpIcon, PlayIcon, PauseIcon, ClockIcon, UserIcon,
  ZapIcon,
} from "lucide-react";

// ── Helpers ──
function formatDuration(ms) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
function PeakHoursHeatmap({ hourlyData }) {
  const grid = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const cells = [];
    const counts = {};
    let maxCount = 1;

    for (const row of hourlyData) {
      const d = new Date(row.created_at * 1000);
      const day = d.getDay();
      const hour = d.getHours();
      const key = `${day}-${hour}`;
      counts[key] = (counts[key] || 0) + 1;
      if (counts[key] > maxCount) maxCount = counts[key];
    }

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        const count = counts[key] || 0;
        const intensity = count / maxCount;
        cells.push({ day, hour, count, intensity, dayName: days[day] });
      }
    }
    return { cells, maxCount };
  }, [hourlyData]);

  return (
    <div className="space-y-1">
      {/* Hour labels */}
      <div className="flex ml-8 gap-[1px]">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="flex-1 text-center text-[8px] font-mono text-muted-foreground/30">
            {h % 3 === 0 ? (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`) : ""}
          </div>
        ))}
      </div>

      {/* Grid */}
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName, displayIdx) => {
        const dayIdx = displayIdx === 6 ? 0 : displayIdx + 1;
        return (
          <div key={dayName} className="flex items-center gap-[1px]">
            <span className="text-[9px] font-mono text-muted-foreground/40 w-7 text-right pr-1">{dayName}</span>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = grid.cells.find(c => c.day === dayIdx && c.hour === hour);
              const count = cell?.count || 0;
              const intensity = cell?.intensity || 0;
              return (
                <Tooltip key={hour}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex-1 h-4 rounded-[2px] transition-colors cursor-default"
                      style={{
                        backgroundColor: count === 0
                          ? "oklch(0.2 0.01 270 / 0.3)"
                          : `oklch(${0.45 + intensity * 0.25} ${0.05 + intensity * 0.15} 165 / ${0.3 + intensity * 0.6})`,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {dayName} {hour === 0 ? "12AM" : hour < 12 ? `${hour}AM` : hour === 12 ? "12PM" : `${hour - 12}PM`}: {count} broadcast{count !== 1 ? "s" : ""}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Waveform Audio Player ──
function WaveformPlayer({ url, isActive, onToggle }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const animRef = useRef(null);
  const [waveform, setWaveform] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Decode audio and generate waveform data
  useEffect(() => {
    if (!url || !isActive) return;
    let cancelled = false;

    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx.decodeAudioData(buf);
      })
      .then(audioBuffer => {
        if (cancelled) return;
        const raw = audioBuffer.getChannelData(0);
        const samples = 80;
        const blockSize = Math.floor(raw.length / samples);
        const peaks = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(raw[i * blockSize + j]);
          }
          peaks.push(sum / blockSize);
        }
        const max = Math.max(...peaks, 0.01);
        setWaveform(peaks.map(p => p / max));
      })
      .catch(() => {
        if (!cancelled) setWaveform(Array.from({ length: 80 }, () => Math.random() * 0.5 + 0.1));
      });

    return () => { cancelled = true; };
  }, [url, isActive]);

  // Track progress
  useEffect(() => {
    if (!isActive) {
      cancelAnimationFrame(animRef.current);
      return;
    }
    const tick = () => {
      const audio = audioRef.current;
      if (audio && audio.duration) {
        setProgress(audio.currentTime / audio.duration);
        setDuration(audio.duration);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isActive]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);
    const barW = w / waveform.length;
    const gap = 1;

    for (let i = 0; i < waveform.length; i++) {
      const x = i * barW;
      const barH = Math.max(2, waveform[i] * h * 0.85);
      const y = (h - barH) / 2;
      const played = i / waveform.length < progress;

      ctx.fillStyle = played ? "oklch(0.7 0.18 165 / 0.8)" : "oklch(0.5 0.02 270 / 0.3)";
      ctx.beginPath();
      ctx.roundRect(x + gap / 2, y, barW - gap, barH, 1);
      ctx.fill();
    }
  }, [waveform, progress]);

  const seekTo = useCallback((e) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  }, []);

  if (!isActive || !waveform) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/50 border border-border/30 animate-in fade-in slide-in-from-top-1 duration-200">
      <button
        onClick={onToggle}
        className="size-8 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer shrink-0"
      >
        <PauseIcon className="size-3.5" />
      </button>
      <canvas
        ref={canvasRef}
        className="flex-1 h-8 cursor-pointer"
        onClick={seekTo}
      />
      <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
        {duration > 0 ? `${Math.floor(progress * duration)}s / ${Math.floor(duration)}s` : "—"}
      </span>
      <audio ref={audioRef} src={url} preload="auto" />
    </div>
  );
}

// ── Recent Broadcasts Table ──
function RecentTable({ broadcasts }) {
  const [playingId, setPlayingId] = useState(null);
  const [playingUrl, setPlayingUrl] = useState(null);
  const audioRef = useRef(null);
  const playingIdRef = useRef(null);

  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => { setPlayingId(null); setPlayingUrl(null); };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  const toggle = useCallback((id, url) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingIdRef.current === id) {
      audio.pause();
      setPlayingId(null);
      setPlayingUrl(null);
    } else {
      audio.pause();
      audio.src = url;
      audio.load();
      audio.play().catch(() => {});
      setPlayingId(id);
      setPlayingUrl(url);
    }
  }, []);

  if (!broadcasts || broadcasts.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No recent broadcasts</p>;
  }

  return (
    <>
      {/* Waveform player */}
      {playingId && playingUrl && (
        <div className="px-4 pb-2">
          <WaveformPlayer
            url={playingUrl}
            isActive={!!playingId}
            onToggle={() => toggle(playingId, playingUrl)}
          />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6 w-12"></TableHead>
            <TableHead>Time</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Participants</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {broadcasts.map((b) => {
            const url = b.recording_path ? `/recordings/${b.recording_path.split("/").pop()}` : null;
            const playing = playingId === b.id;
            return (
              <TableRow
                key={b.id}
                className={playing ? "bg-emerald-500/[0.03]" : ""}
              >
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
                            <div
                              key={i}
                              className="w-[2px] bg-emerald-400 rounded-full"
                              style={{ animation: `eqBar ${0.3 + i * 0.1}s ease-in-out infinite alternate`, animationDelay: `${i * 80}ms` }}
                            />
                          ))}
                        </div>
                      ) : (
                        <PlayIcon className="size-3 ml-0.5" />
                      )}
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-mono tabular-nums">{formatTime(b.created_at)}</div>
                  <div className="text-[10px] text-muted-foreground/50">{formatDate(b.created_at)}</div>
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
                  {b.answered ? (
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] px-1.5 py-0">
                      Answered
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] px-1.5 py-0">
                      Unanswered
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <audio ref={audioRef} preload="none" className="hidden" />
      <style>{`
        @keyframes eqBar {
          from { height: 3px; }
          to { height: 10px; }
        }
      `}</style>
    </>
  );
}

// ── Chart Config ──
const barChartConfig = {
  answered: { label: "Answered", color: "#065f46" },
  unanswered: { label: "Unanswered", color: "#991b1b" },
};

// ── Main Page ──
export default function BroadcastsPage() {
  const { names: ROOM_NAMES } = useRooms();
  const ranges = [
    { key: "today", label: "Today", days: 1 },
    { key: "week", label: "7 Days", days: 7 },
    { key: "month", label: "30 Days", days: 30 },
  ];
  const [activeRange, setActiveRange] = useState("today");
  const days = ranges.find(r => r.key === activeRange)?.days || 1;

  const { data: statsRaw, loading, refetch } = useFetch(`/api/v1/admin/broadcasts?days=${days}`);
  const { data: recentRaw, loading: recentLoading, refetch: refetchRecent } = useFetch("/api/v1/admin/broadcasts/recent?limit=30");
  const { data: hourlyRaw, refetch: refetchHourly } = useFetch(`/api/v1/admin/broadcasts/hourly?hours=${Math.max(days * 24, 168)}`);

  useSSERefresh(() => { refetch(); refetchRecent(); refetchHourly(); }, ["broadcasts"]);
  const { events: sseEvents } = useSSE("/api/v1/admin/events/stream");

  const stats = statsRaw ?? {};
  const recent = Array.isArray(recentRaw) ? recentRaw : recentRaw?.data || [];
  const rawHourly = Array.isArray(hourlyRaw) ? hourlyRaw : hourlyRaw?.data || [];

  const hourly = stats.hourly || [];
  const daily = stats.daily || [];
  const topBroadcasters = stats.topBroadcasters || [];
  const byRoom = stats.byRoom || [];

  const totalBroadcasts = daily.reduce((s, d) => s + (d.total || d.count || 0), 0) || hourly.reduce((s, h) => s + (h.count || 0), 0);
  const totalAnswered = daily.reduce((s, d) => s + (d.answered || 0), 0);
  const totalUnanswered = totalBroadcasts - totalAnswered;
  const responseRate = totalBroadcasts > 0 ? ((totalAnswered / totalBroadcasts) * 100).toFixed(1) : "0.0";

  // Avg response time for answered broadcasts
  const avgResponseTime = useMemo(() => {
    const answered = recent.filter(b => b.answered && b.duration_ms);
    if (answered.length === 0) return "—";
    const avg = answered.reduce((s, b) => s + b.duration_ms, 0) / answered.length;
    return formatDuration(avg);
  }, [recent]);

  // Chart data
  const chartData = useMemo(() => {
    if (!Array.isArray(rawHourly) || rawHourly.length === 0) return [];

    if (activeRange === "today") {
      const hourMap = {};
      for (const row of rawHourly) {
        const h = new Date(row.created_at * 1000).getHours();
        if (!hourMap[h]) hourMap[h] = { answered: 0, unanswered: 0 };
        if (row.answered) hourMap[h].answered++;
        else hourMap[h].unanswered++;
      }
      const now = new Date();
      return Array.from({ length: 24 }, (_, i) => {
        const h = (now.getHours() - 23 + i + 24) % 24;
        const entry = hourMap[h];
        const label = h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`;
        return { label, answered: entry?.answered || 0, unanswered: entry?.unanswered || 0 };
      });
    }

    const dayMap = {};
    for (const row of rawHourly) {
      const d = new Date(row.created_at * 1000);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (!dayMap[key]) dayMap[key] = { answered: 0, unanswered: 0 };
      if (row.answered) dayMap[key].answered++;
      else dayMap[key].unanswered++;
    }
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now.getTime() - (days - 1 - i) * 86400000);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      const entry = dayMap[key];
      return { label: key, answered: entry?.answered || 0, unanswered: entry?.unanswered || 0 };
    });
  }, [rawHourly, activeRange, days]);

  const maxRoomCount = Math.max(1, ...byRoom.map(r => r.count));

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Broadcasts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono tabular-nums">{totalBroadcasts}</span> total,{" "}
            <span className="font-mono tabular-nums">{totalAnswered}</span> answered,{" "}
            <span className="font-mono tabular-nums">{responseRate}%</span> response rate
          </p>
        </div>
        <div className="flex gap-1.5">
          {ranges.map(r => (
            <button
              key={r.key}
              onClick={() => setActiveRange(r.key)}
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
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

      {/* Live Broadcast Banner */}
      <LiveBroadcastBanner events={sseEvents} ROOM_NAMES={ROOM_NAMES} />

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Broadcasts" value={totalBroadcasts} icon={<RadioIcon className="size-4" />} color="#06b6d4" />
        <StatCard label="Answered" value={totalAnswered} icon={<PhoneCallIcon className="size-4" />} color="#22c55e" />
        <StatCard label="Unanswered" value={totalUnanswered} icon={<PhoneOffIcon className="size-4" />} color="#ef4444" />
        <StatCard label="Response Rate" value={`${responseRate}%`} icon={<PercentIcon className="size-4" />} color="#f59e0b" mono={false} />
        <StatCard label="Avg Duration" value={avgResponseTime} icon={<ClockIcon className="size-4" />} color="#8b5cf6" mono={false} />
      </div>

      {/* Chart + Heatmap Row */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Activity Chart */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUpIcon className="size-3.5 text-cyan-400" />
                {activeRange === "today" ? "Hourly Activity" : "Daily Activity"}
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

        {/* Peak Hours Heatmap */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ZapIcon className="size-3.5 text-amber-400" />
              Peak Hours
              <span className="text-[10px] font-mono text-muted-foreground/40 font-normal ml-1">7-day pattern</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <PeakHoursHeatmap hourlyData={rawHourly} />
          </CardContent>
        </Card>
      </div>

      {/* Two Column: Broadcasters + Channel Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Broadcasters */}
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
                  <TableHead className="text-right pr-6">Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBroadcasters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No data</TableCell>
                  </TableRow>
                ) : (
                  topBroadcasters.slice(0, 10).map((b, i) => {
                    const medals = ["text-amber-400", "text-zinc-400", "text-orange-400"];
                    return (
                      <TableRow key={b.user_name || i}>
                        <TableCell className={`font-mono text-xs tabular-nums pl-6 ${medals[i] || "text-muted-foreground/40"}`}>
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{b.display_name || b.user_name}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">
                          {b.count}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs text-muted-foreground pr-6">
                          {b.avg_duration ? formatDuration(b.avg_duration) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Channel Activity */}
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
                        <div
                          className="h-full bg-emerald-700 group-hover:bg-emerald-600"
                          style={{ width: `${(answered / maxRoomCount) * 100}%` }}
                        />
                        <div
                          className="h-full bg-red-800 group-hover:bg-red-700"
                          style={{ width: `${((r.count - answered) / maxRoomCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Broadcasts */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ClockIcon className="size-3.5 text-emerald-400" />
            Recent Broadcasts
            <span className="text-[10px] font-mono text-muted-foreground/40 font-normal ml-1">last 30</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-0">
          {recentLoading ? (
            <div className="space-y-2 px-6">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <RecentTable broadcasts={recent} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
