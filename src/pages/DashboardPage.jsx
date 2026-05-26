import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { useSSE } from "@/hooks/useSSE";
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
  ZapIcon,
  PlayIcon,
} from "lucide-react";

const ROOM_SHORT = {
  123456701: "CA", 123456702: "TX", 123456703: "FL", 123456704: "MX",
  123456705: "ENS", 123456706: "AZ", 123456707: "OH", 123456708: "NY",
  123456709: "GA", 123456710: "IN", 123456711: "MI", 123456712: "CR",
};

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

  const record = useCallback((room) => {
    if (!room) return;
    const now = Date.now();
    setSegments((prev) => {
      const roomSegs = prev[room] || [];
      const last = roomSegs[roomSegs.length - 1];
      if (last && now - last.end < 60000) {
        return { ...prev, [room]: [...roomSegs.slice(0, -1), { ...last, end: now }] };
      }
      return { ...prev, [room]: [...roomSegs.slice(-30), { start: now, end: now }] };
    });
  }, []);

  return { segments, record };
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
function ConferenceTimeline({ roomId, segments, roomName }) {
  const now = Date.now();
  const windowMs = 30 * 60 * 1000;
  const start = now - windowMs;
  const roomSegs = segments[roomId] || [];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-muted-foreground w-[32px] shrink-0">{ROOM_SHORT[roomId]}</span>
      <div className="flex-1 h-[6px] bg-muted/30 rounded-full overflow-hidden relative">
        {roomSegs.filter((s) => s.end > start).map((seg, i) => {
          const l = Math.max(0, ((seg.start - start) / windowMs) * 100);
          const r = Math.min(100, ((seg.end - start) / windowMs) * 100);
          return (
            <div
              key={i}
              className="absolute top-0 h-full bg-emerald-500 rounded-full"
              style={{ left: `${l}%`, width: `${Math.max(1, r - l)}%`, opacity: 0.7 }}
            />
          );
        })}
        {/* Current time marker */}
        <div className="absolute top-0 right-0 w-[2px] h-full bg-foreground/30 rounded-full" />
      </div>
    </div>
  );
}

// ─── Live Ticker ───
function LiveTicker({ events }) {
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
function TopBroadcasters({ broadcasters }) {
  if (!broadcasters || broadcasters.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No broadcasts yet</p>;
  }

  const medals = ["bg-amber-500/20 text-amber-400", "bg-zinc-400/20 text-zinc-400", "bg-orange-500/20 text-orange-400"];

  return (
    <div className="space-y-2">
      {broadcasters.slice(0, 5).map((b, i) => {
        const name = b.display_name || b.user_name || "Unknown";
        const shortName = name.split("/")[0]?.trim() || name;
        return (
          <div key={b.user_name || i} className="flex items-center gap-3">
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums ${medals[i] || "bg-muted text-muted-foreground"}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{shortName}</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-muted-foreground">{b.count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Recent Broadcasts ───
function RecentBroadcasts({ broadcasts }) {
  if (!broadcasts || broadcasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <RadioIcon className="size-6 mb-2 opacity-30" />
        <p className="text-xs">No recent broadcasts</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {broadcasts.slice(0, 8).map((b) => (
        <BroadcastRow key={b.id} broadcast={b} />
      ))}
    </div>
  );
}

function BroadcastRow({ broadcast: b }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const name = b.display_name || b.user_name || "Unknown";
  const room = b.room_name || ROOM_NAMES[b.room] || "";
  const url = b.recording_path ? `/recordings/${b.recording_path.split("/").pop()}` : null;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <div className="rounded-lg bg-muted/15 border border-border/30 px-3 py-2.5 hover:bg-muted/25 transition-colors">
      <div className="flex items-center gap-2">
        {/* Name + status */}
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
            <span className="text-[10px] tabular-nums text-muted-foreground/50 ml-auto shrink-0">{timeAgo(b.created_at)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{room}</p>
        </div>

        {/* Play button */}
        {url && (
          <button
            onClick={toggle}
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

      {url && <audio ref={audioRef} preload="none" src={url} />}

      <style>{`
        @keyframes eqBar {
          from { height: 3px; }
          to { height: 14px; }
        }
      `}</style>
    </div>
  );
}

// ─── Main Dashboard ───
export default function DashboardPage() {
  const { data: dashRaw, loading, refetch: refetchDash } = useFetch("/api/v1/admin/dashboard");
  const { data: broadcastRaw, refetch: refetchBroadcasts } = useFetch("/api/v1/admin/broadcasts");
  const { data: recentBcastRaw, loading: bcastLoading, refetch: refetchRecentBcast } = useFetch("/api/v1/admin/broadcasts/recent?limit=8");
  const { data: usersRaw, refetch: refetchUsers } = useFetch("/api/v1/admin/users");
  useSSERefresh(() => { refetchDash(); refetchUsers(); }, ["dashboard", "users", "events"]);
  useSSERefresh(() => { refetchBroadcasts(); refetchRecentBcast(); }, ["broadcasts"]);

  // Live SSE stream for ticker + broadcast detection
  const { events: liveEvents } = useSSE("/api/v1/admin/events/stream");
  const { segments, record: recordTimeline } = useTimeline();

  // Record timeline activity from SSE events
  useEffect(() => {
    const last = liveEvents[liveEvents.length - 1];
    if (!last) return;
    if (last.room || last.roomId) recordTimeline(last.room || last.roomId);
  }, [liveEvents.length]);

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
      pulse: onlineUsers > 0,
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

        {/* Conference Timeline */}
        <Card className="border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ActivityIcon className="size-3.5 text-emerald-400" />
                Activity Timeline
              </CardTitle>
              <span className="text-[10px] text-muted-foreground/50 font-mono">30 min window</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {activeRoomIds.length > 0 ? activeRoomIds.map((rid) => (
              <ConferenceTimeline key={rid} roomId={rid} segments={segments} />
            )) : (
              <p className="text-[11px] text-muted-foreground/40 font-mono text-center py-4">No active rooms</p>
            )}
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
            <TopBroadcasters broadcasters={broadcastData?.topBroadcasters} />
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
