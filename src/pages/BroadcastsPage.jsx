import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { ROOM_NAMES } from "@/lib/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  RadioIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  PercentIcon,
  TrendingUpIcon,
  PlayIcon,
  ClockIcon,
  UserIcon,
} from "lucide-react";

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

const barChartConfig = {
  answered: { label: "Answered", color: "#065f46" },
  unanswered: { label: "Unanswered", color: "#991b1b" },
};

export default function BroadcastsPage() {
  const ranges = [
    { key: "today", label: "Today", days: 1 },
    { key: "week", label: "7 Days", days: 7 },
    { key: "month", label: "30 Days", days: 30 },
  ];
  const [activeRange, setActiveRange] = useState("today");
  const days = ranges.find(r => r.key === activeRange)?.days || 1;

  const { data: statsRaw, loading, refetch } = useFetch(`/api/v1/admin/broadcasts?days=${days}`);
  const { data: recentRaw, loading: recentLoading, refetch: refetchRecent } = useFetch("/api/v1/admin/broadcasts/recent?limit=20");
  const { data: hourlyRaw, refetch: refetchHourly } = useFetch(`/api/v1/admin/broadcasts/hourly?hours=${days * 24}`);

  useSSERefresh(() => { refetch(); refetchRecent(); refetchHourly(); }, ["broadcasts"]);

  const stats = statsRaw?.data ?? statsRaw ?? {};
  const recent = Array.isArray(recentRaw) ? recentRaw : recentRaw?.data || [];
  const rawHourly = hourlyRaw?.data ?? hourlyRaw ?? [];

  const hourly = stats.hourly || [];
  const daily = stats.daily || [];
  const topBroadcasters = stats.topBroadcasters || [];
  const byRoom = stats.byRoom || [];

  const totalBroadcasts = daily.reduce((s, d) => s + (d.total || d.count || 0), 0) || hourly.reduce((s, h) => s + (h.count || 0), 0);
  const totalAnswered = daily.reduce((s, d) => s + (d.answered || 0), 0);
  const totalUnanswered = totalBroadcasts - totalAnswered;
  const responseRate = totalBroadcasts > 0 ? ((totalAnswered / totalBroadcasts) * 100).toFixed(1) : "0.0";

  // Build hourly chart data from raw timestamps (local timezone)
  const chartData = (() => {
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
      const result = [];
      for (let i = 23; i >= 0; i--) {
        const h = (now.getHours() - i + 24) % 24;
        const entry = hourMap[h];
        const label = h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`;
        result.push({ label, answered: entry?.answered || 0, unanswered: entry?.unanswered || 0 });
      }
      return result;
    }

    // Week/month: group by day
    const dayMap = {};
    for (const row of rawHourly) {
      const d = new Date(row.created_at * 1000);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (!dayMap[key]) dayMap[key] = { answered: 0, unanswered: 0 };
      if (row.answered) dayMap[key].answered++;
      else dayMap[key].unanswered++;
    }
    const now = new Date();
    const numDays = days;
    const result = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      const entry = dayMap[key];
      result.push({ label: key, answered: entry?.answered || 0, unanswered: entry?.unanswered || 0 });
    }
    return result;
  })();

  const maxRoomCount = Math.max(1, ...byRoom.map(r => r.count));

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[300px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Broadcasts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Hotline broadcast analytics and performance
          </p>
        </div>
        <div className="flex gap-1">
          {ranges.map(r => (
            <button
              key={r.key}
              onClick={() => setActiveRange(r.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeRange === r.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Broadcasts"
          value={totalBroadcasts}
          icon={<RadioIcon className="size-4" />}
          color="#06b6d4"
        />
        <StatCard
          label="Answered"
          value={totalAnswered}
          icon={<PhoneCallIcon className="size-4" />}
          color="#22c55e"
        />
        <StatCard
          label="Unanswered"
          value={totalUnanswered}
          icon={<PhoneOffIcon className="size-4" />}
          color="#ef4444"
        />
        <StatCard
          label="Response Rate"
          value={`${responseRate}%`}
          icon={<PercentIcon className="size-4" />}
          color="#f59e0b"
          mono={false}
        />
      </div>

      {/* Hourly/Daily Chart */}
      <Card className="border-0">
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
          <ChartContainer config={barChartConfig} className="h-[240px] w-full [&_.recharts-cartesian-axis-line]:stroke-border [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground">
            <BarChart data={chartData} barGap={1}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.1)" />
              <XAxis dataKey="label" tickLine={false} axisLine={true} fontSize={10} interval={activeRange === "month" ? 4 : activeRange === "week" ? 0 : 2} />
              <YAxis tickLine={false} axisLine={true} fontSize={10} width={35} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="answered" stackId="a" fill="#065f46" radius={0} />
              <Bar dataKey="unanswered" stackId="a" fill="#991b1b" radius={[1, 1, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Two Column: Broadcasters + Room Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Broadcasters */}
        <Card className="border-0">
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
                  <TableHead className="text-right pr-6">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBroadcasters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No broadcast data
                    </TableCell>
                  </TableRow>
                ) : (
                  topBroadcasters.slice(0, 15).map((b, i) => {
                    const medals = ["text-amber-400", "text-zinc-400", "text-orange-400"];
                    return (
                      <TableRow key={b.user_name || i}>
                        <TableCell className={`font-mono text-xs tabular-nums pl-6 ${medals[i] || "text-muted-foreground/50"}`}>
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{b.display_name || b.user_name}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm pr-6">
                          {b.count}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Room Activity */}
        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <RadioIcon className="size-3.5 text-cyan-400" />
              Room Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            {byRoom.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              byRoom.map((r) => {
                const pct = (r.count / maxRoomCount) * 100;
                const name = ROOM_NAMES[r.room] || r.room;
                return (
                  <div key={r.room} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{name}</span>
                      <span className="text-xs font-mono tabular-nums text-muted-foreground">{r.count}</span>
                    </div>
                    <div className="h-2 bg-muted/30 overflow-hidden">
                      <div
                        className="h-full bg-cyan-800 transition-all duration-500 group-hover:bg-cyan-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Broadcasts */}
      <Card className="border-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ClockIcon className="size-3.5 text-emerald-400" />
            Recent Broadcasts
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

function StatCard({ label, value, icon, color, mono = true }) {
  return (
    <Card className="border-0 relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className={`text-2xl font-bold leading-none tracking-tight ${mono ? "font-mono tabular-nums" : ""}`}>
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">{label}</p>
          </div>
        </div>
      </CardContent>
      <div className="absolute inset-x-0 bottom-0 h-[2px]" style={{ backgroundColor: `${color}30` }} />
    </Card>
  );
}

function RecentTable({ broadcasts }) {
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
      <p className="text-sm text-muted-foreground text-center py-8">No recent broadcasts</p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Time</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Participants</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12 pr-6"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {broadcasts.map((b) => {
            const url = b.recording_path ? `/recordings/${b.recording_path.split("/").pop()}` : null;
            const playing = playingId === b.id;
            return (
              <TableRow key={b.id}>
                <TableCell className="pl-6">
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
                <TableCell className="pr-6">
                  {url && (
                    <button
                      onClick={() => toggle(b.id, url)}
                      className={`flex size-7 items-center justify-center rounded-full border transition-all cursor-pointer ${
                        playing
                          ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                          : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                      }`}
                    >
                      {playing ? (
                        <div className="flex items-end gap-[2px] h-3">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="w-[2px] bg-cyan-400 rounded-full"
                              style={{
                                animation: `eqBar ${0.3 + i * 0.1}s ease-in-out infinite alternate`,
                                animationDelay: `${i * 80}ms`,
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <PlayIcon className="size-3 ml-0.5" />
                      )}
                    </button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <audio ref={audioRef} preload="none" />
      <style>{`
        @keyframes eqBar {
          from { height: 3px; }
          to { height: 10px; }
        }
      `}</style>
    </>
  );
}
