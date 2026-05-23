import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFetch } from "@/hooks/useFetch";
import { ROOM_NAMES, EVENT_COLORS, timeAgo } from "@/lib/constants";
import {
  UsersIcon,
  WifiIcon,
  PhoneCallIcon,
  RadioIcon,
} from "lucide-react";

function StatCard({ title, value, icon, accent }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {title}
            </p>
            <p className="text-3xl font-mono font-bold tabular-nums mt-1">
              {value}
            </p>
          </div>
          <div className="text-muted-foreground/40">{icon}</div>
        </div>
      </CardContent>
      <div className={`h-0.5 ${accent}`} />
    </Card>
  );
}

function RoomCard({ room }) {
  const memberCount = room.members ?? room.totalMembers ?? 0;
  const online = room.online ?? room.onlineMembers ?? 0;
  const inCall = room.unmuted ?? room.activeSpeakers ?? 0;
  const isEmpty = online === 0;
  const capacityPct = Math.min((memberCount / 500) * 100, 100);

  return (
    <Card className={isEmpty ? "opacity-40" : ""}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">
            {ROOM_NAMES[room.roomId || room.room] || room.roomId || room.room}
          </span>
          <span className="text-2xl font-mono font-bold tabular-nums">
            {memberCount}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-green-500" />
            {online}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-blue-500" />
            {inCall}
          </span>
        </div>
        {!isEmpty && (
          <div className="mt-3 h-0.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${capacityPct}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, loading } = useFetch("/api/v1/admin/dashboard", 10000);
  const { data: recentEvents, loading: eventsLoading } = useFetch(
    "/api/v1/admin/events?limit=8",
    15000
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(12)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "Total Users",
      value: data?.totalUsers ?? 0,
      icon: <UsersIcon className="size-5" />,
      accent: "bg-muted-foreground/20",
    },
    {
      title: "Online Now",
      value: data?.onlineUsers ?? 0,
      icon: <WifiIcon className="size-5" />,
      accent: "bg-green-500",
    },
    {
      title: "In Conference",
      value: data?.inCallUsers ?? 0,
      icon: <PhoneCallIcon className="size-5" />,
      accent: "bg-blue-500",
    },
    {
      title: "Today's Broadcasts",
      value: data?.todayBroadcasts ?? 0,
      icon: <RadioIcon className="size-5" />,
      accent: "bg-cyan-500",
    },
  ];

  const roomStats = data?.roomStats || Object.keys(ROOM_NAMES).map((id) => ({
    roomId: id,
    members: 0,
    online: 0,
    unmuted: 0,
  }));

  const events = Array.isArray(recentEvents) ? recentEvents : recentEvents?.events || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Conference system overview and real-time metrics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Room Overview
        </h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roomStats.map((room) => (
            <RoomCard key={room.roomId || room.room} room={room} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Recent Activity
        </h3>
        <Card>
          <CardContent className="p-0">
            {eventsLoading ? (
              <div className="space-y-2 p-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No recent events
              </p>
            ) : (
              <ScrollArea className="h-auto">
                <div className="divide-y divide-border">
                  {events.slice(0, 8).map((event, i) => {
                    const type = (event.event_type || event.type || "unknown").toLowerCase();
                    const dotColor = EVENT_COLORS[type] || "#71717a";
                    return (
                      <div
                        key={event.id || i}
                        className="flex items-center gap-3 px-4 py-3 text-sm"
                      >
                        <span className="font-mono text-xs text-muted-foreground tabular-nums w-16 shrink-0">
                          {timeAgo(event.created_at || event.timestamp)}
                        </span>
                        <span
                          className="inline-block size-2 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="text-muted-foreground truncate">
                          <span className="font-medium text-foreground">
                            {event.user_name || event.userName || "-"}
                          </span>
                          {" "}
                          {type.replace("_", " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
