import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { ROOM_NAMES, EVENT_COLORS, timeAgo } from "@/lib/constants";
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
} from "lucide-react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const ROOM_SHORT = {
  123456701: "CA", 123456702: "TX", 123456703: "FL", 123456704: "MX",
  123456705: "ENS", 123456706: "AZ", 123456707: "OH", 123456708: "NY",
  123456709: "GA", 123456710: "IN", 123456711: "MI", 123456712: "CR",
};

function StatCard({ title, value, icon, color, subtitle }) {
  return (
    <Card className="relative overflow-hidden border-0">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}15` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular-nums leading-none">
              {value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {title}
            </p>
          </div>
        </div>
      </CardContent>
      <div
        className="absolute bottom-0 left-0 h-[2px] w-full"
        style={{ background: `linear-gradient(90deg, ${color}60, transparent)` }}
      />
    </Card>
  );
}

function RoomCard({ room }) {
  const name = ROOM_NAMES[room.room] || `Room ${room.room}`;
  const shortCode = ROOM_SHORT[room.room] || "??";
  const total = room.total || 0;
  const online = room.online || 0;
  const inCall = room.in_call || 0;
  const unmuted = room.unmuted || 0;
  const isEmpty = total === 0;

  const statusColor = inCall > 0
    ? "text-emerald-400"
    : online > 0
      ? "text-blue-400"
      : "text-muted-foreground/40";

  return (
    <Card className={`border-0 transition-all ${isEmpty ? "opacity-30" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted font-bold text-sm tabular-nums ${inCall > 0 ? "ring-1 ring-emerald-500/30" : ""}`}>
            {shortCode}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold truncate">{name}</span>
              {inCall > 0 && (
                <Badge variant="secondary" className="h-4 text-[10px] px-1.5 gap-1 shrink-0 ml-2">
                  <Volume2Icon className="size-2.5" />
                  Live
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <UsersIcon className="size-3" />
                {total}
              </span>
              <span className={`flex items-center gap-1 text-xs ${online > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                <CircleIcon className="size-1.5 fill-current" />
                {online} online
              </span>
              {inCall > 0 && (
                <span className="flex items-center gap-1 text-xs text-blue-400">
                  <PhoneCallIcon className="size-3" />
                  {inCall}
                </span>
              )}
              {unmuted > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <MicIcon className="size-3" />
                  {unmuted}
                </span>
              )}
            </div>
          </div>
        </div>
        {total > 0 && (
          <div className="mt-3 flex gap-[2px] h-1 rounded-full overflow-hidden">
            {inCall > 0 && (
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(inCall / total) * 100}%` }}
              />
            )}
            {(online - inCall) > 0 && (
              <div
                className="h-full bg-emerald-500/60 rounded-full"
                style={{ width: `${((online - inCall) / total) * 100}%` }}
              />
            )}
            {(total - online) > 0 && (
              <div
                className="h-full bg-muted rounded-full"
                style={{ width: `${((total - online) / total) * 100}%` }}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoomBarChart({ roomStats }) {
  const chartData = roomStats
    .map((r) => ({
      room: ROOM_SHORT[r.room] || r.room,
      online: r.online || 0,
      inCall: r.in_call || 0,
      offline: Math.max(0, (r.total || 0) - (r.online || 0)),
    }))
    .sort((a, b) => b.online - a.online);

  const chartConfig = {
    inCall: { label: "In Call", color: "oklch(0.592 0.212 262.1)" },
    online: { label: "Online", color: "oklch(0.723 0.219 149.58)" },
    offline: { label: "Offline", color: "oklch(0.4 0 0)" },
  };

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 0, left: -24, bottom: 0 }}
        barCategoryGap="25%"
      >
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
        />
        <XAxis
          dataKey="room"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={10}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          allowDecimals={false}
        />
        <ChartTooltip
          content={<ChartTooltipContent />}
          cursor={{ fill: "hsl(var(--muted))", radius: 4 }}
        />
        <Bar dataKey="inCall" stackId="a" fill="var(--color-inCall)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="online" stackId="a" fill="var(--color-online)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="offline" stackId="a" fill="var(--color-offline)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function TopBroadcasters({ broadcasters }) {
  if (!broadcasters || broadcasters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No broadcasts yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {broadcasters.slice(0, 5).map((b, i) => {
        const name = b.display_name || b.user_name || "Unknown";
        const shortName = name.split("/")[0]?.trim() || name;
        return (
          <div key={b.user_name || i} className="flex items-center gap-3">
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums ${
              i === 0 ? "bg-amber-500/20 text-amber-400" :
              i === 1 ? "bg-zinc-400/20 text-zinc-400" :
              i === 2 ? "bg-orange-500/20 text-orange-400" :
              "bg-muted text-muted-foreground"
            }`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{shortName}</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {b.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EventFeed({ events }) {
  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <ActivityIcon className="size-6 mb-2 opacity-30" />
        <p className="text-xs">No recent events</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {events.slice(0, 8).map((event, i) => {
        const type = (event.event_type || event.type || "unknown").toLowerCase();
        const dotColor = EVENT_COLORS[type] || "#71717a";
        const roomId = event.room;
        const roomLabel = roomId ? (ROOM_SHORT[roomId] || ROOM_NAMES[roomId]) : null;
        const userName = event.user_name || event.userName || "System";
        const shortUser = userName.replace("sip:", "").split("@")[0];

        return (
          <div
            key={event.id || i}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-muted/40"
          >
            <span
              className="inline-flex size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: dotColor }}
            />
            <span className="text-sm font-medium truncate flex-1 min-w-0">
              {shortUser}
            </span>
            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 h-4">
              {type.replace("_", " ")}
            </Badge>
            {roomLabel && (
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                {roomLabel}
              </span>
            )}
            <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
              {timeAgo(event.created_at || event.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { data: dashRaw, loading, refetch: refetchDash } = useFetch("/api/v1/admin/dashboard");
  const { data: recentRaw, loading: eventsLoading, refetch: refetchEvents } = useFetch("/api/v1/admin/events?limit=10");
  const { data: broadcastRaw, refetch: refetchBroadcasts } = useFetch("/api/v1/admin/broadcasts");
  useSSERefresh(() => { refetchDash(); refetchEvents(); }, ["dashboard", "users", "events"]);
  useSSERefresh(refetchBroadcasts, ["broadcasts"]);

  const data = dashRaw?.data ?? dashRaw;
  const recentEvents = (() => {
    const raw = recentRaw;
    if (Array.isArray(raw)) return raw;
    return raw?.data || raw?.events || [];
  })();
  const broadcastData = broadcastRaw?.data ?? broadcastRaw;

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-7 w-36" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
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
  const existingRoomIds = new Set(roomStats.map((r) => r.room));
  const emptyRooms = allRoomIds
    .filter((id) => !existingRoomIds.has(id))
    .map((id) => ({ room: id, total: 0, online: 0, in_call: 0, unmuted: 0 }));
  const allRooms = [...sortedRooms, ...emptyRooms];

  const stats = [
    {
      title: "Total Users",
      value: totalUsers,
      icon: <UsersIcon className="size-4" />,
      color: "#8b8b8b",
      subtitle: `across ${allRoomIds.length} rooms`,
    },
    {
      title: "Online Now",
      value: onlineUsers,
      icon: <WifiIcon className="size-4" />,
      color: "#22c55e",
      subtitle: `${activeRooms} active rooms`,
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
        <Badge variant="outline" className="gap-1.5 text-[11px]">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Room Cards */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Conference Rooms
        </h3>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {allRooms.map((room) => (
            <RoomCard key={room.room} room={room} />
          ))}
        </div>
      </div>

      {/* Bottom Row: Chart + Broadcasters + Activity */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Stacked Bar Chart */}
        <Card className="border-0 lg:col-span-5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Room Activity</CardTitle>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="size-2 rounded-sm bg-blue-500 inline-block" /> In Call
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="size-2 rounded-sm bg-emerald-500 inline-block" /> Online
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="size-2 rounded-sm bg-zinc-700 inline-block" /> Offline
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <RoomBarChart roomStats={roomStats} />
          </CardContent>
        </Card>

        {/* Top Broadcasters */}
        <Card className="border-0 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrophyIcon className="size-3.5 text-amber-400" />
              Top Broadcasters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <TopBroadcasters broadcasters={broadcastData?.topBroadcasters} />
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ActivityIcon className="size-3.5 text-muted-foreground" />
                Recent Activity
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {eventsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <EventFeed events={recentEvents} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
