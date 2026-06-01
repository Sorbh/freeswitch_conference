import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { useSSE } from "@/hooks/useSSE";
import { ROOM_NAMES } from "@/lib/constants";
import {
  Volume2Icon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  RefreshCwIcon,
  UsersIcon,
  WifiIcon,
  PhoneCallIcon,
  ActivityIcon,
  ChevronLeftIcon,
  VolumeXIcon,
  ZapIcon,
  RadioIcon,
} from "lucide-react";

const ROOM_ABBREV = {
  123456701: "CA", 123456702: "TX", 123456703: "FL", 123456704: "MX",
  123456705: "ENS", 123456706: "AZ", 123456707: "OH", 123456708: "NY",
  123456709: "GA", 123456710: "IN", 123456711: "MI", 123456712: "CR",
};

function useAnimatedNumber(target, dur = 500) {
  const [val, setVal] = useState(target);
  const ref = useRef(null);
  useEffect(() => {
    const start = val;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(start + (target - start) * e));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target]);
  return val;
}

function getInitials(name) {
  if (!name) return "?";
  const clean = name.replace(/^sip:/, "").split("@")[0];
  const parts = clean.split(/[.\-_\s]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = [
    "bg-rose-500/20 text-rose-400", "bg-sky-500/20 text-sky-400",
    "bg-amber-500/20 text-amber-400", "bg-emerald-500/20 text-emerald-400",
    "bg-violet-500/20 text-violet-400", "bg-cyan-500/20 text-cyan-400",
    "bg-pink-500/20 text-pink-400", "bg-teal-500/20 text-teal-400",
  ];
  return colors[Math.abs(hash) % colors.length];
}

// ── Stat Mini Card ──
function MiniStat({ icon, label, value, color }) {
  const animated = useAnimatedNumber(value);
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-card/50 border border-border/40">
      <div className="size-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-mono font-bold tabular-nums leading-none">{animated}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Room Card (Grid View) ──
function RoomCard({ room, isSelected, onClick }) {
  const total = room.total ?? 0;
  const online = room.online ?? 0;
  const inCall = room.inCall ?? 0;
  const unmuted = room.unmuted ?? 0;
  const isEmpty = online === 0 && inCall === 0;
  const hasActivity = unmuted > 0;

  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden group ${
        isSelected
          ? "border-sky-500/50 bg-sky-500/[0.04] ring-1 ring-sky-500/20"
          : isEmpty
            ? "border-border/30 bg-card/30 opacity-50 hover:opacity-75 hover:border-border/60"
            : "border-border/50 bg-card/60 hover:border-sky-500/30 hover:bg-card/80"
      }`}
    >
      {hasActivity && (
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/80 to-emerald-500/0" />
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{ROOM_NAMES[room.room] || room.room}</span>
            <span className="text-[10px] font-mono text-muted-foreground/50">{ROOM_ABBREV[room.room]}</span>
          </div>
          {hasActivity && (
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
          )}
        </div>

        {isEmpty ? (
          <p className="text-xs text-muted-foreground/40 py-2">Empty</p>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-mono font-bold tabular-nums">{total}</span>
              <span className="text-[10px] text-muted-foreground">members</span>
            </div>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {online}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-sky-500" />
                {inCall}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {unmuted}
              </span>
            </div>

            {/* Capacity bar */}
            <div className="h-1 w-full rounded-full bg-muted/20 overflow-hidden">
              <div className="h-full flex">
                {inCall > 0 && (
                  <div
                    className="h-full bg-sky-500/70 transition-all duration-500"
                    style={{ width: `${(inCall / Math.max(total, 1)) * 100}%` }}
                  />
                )}
                {online - inCall > 0 && (
                  <div
                    className="h-full bg-emerald-500/40 transition-all duration-500"
                    style={{ width: `${((online - inCall) / Math.max(total, 1)) * 100}%` }}
                  />
                )}
              </div>
            </div>

            {/* Member avatars */}
            {room.members && room.members.filter(m => m.online).length > 0 && (
              <div className="flex -space-x-1.5 pt-0.5">
                {room.members.filter(m => m.online).slice(0, 6).map((m) => (
                  <div
                    key={m.userName}
                    className={`size-6 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-card/80 ${getAvatarColor(m.userName)} ${!m.mute ? "ring-1 ring-emerald-500/50" : ""}`}
                    title={m.callerIdName || m.userName}
                  >
                    {getInitials(m.callerIdName || m.userName)}
                  </div>
                ))}
                {room.members.filter(m => m.online).length > 6 && (
                  <div className="size-6 rounded-full flex items-center justify-center text-[8px] font-mono bg-muted/50 text-muted-foreground border-2 border-card/80">
                    +{room.members.filter(m => m.online).length - 6}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ── User Row in Mixer ──
function MixerUser({ member, onMute, onUnmute, onKick, onReconnect }) {
  const isTalking = member.talking;
  const isConnected = member.connectionState === "connected";
  const isOnline = member.online;
  const isMuted = member.mute;
  const hasError = member.connectionState === "error";
  const displayName = member.callerIdName || member.userName?.replace("sip:", "") || "Unknown";

  return (
    <div
      className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg border transition-all duration-200 ${
        hasError
          ? "border-red-500/30 bg-red-500/[0.04]"
          : isTalking
            ? "border-emerald-500/30 bg-emerald-500/[0.04]"
            : isConnected
              ? "border-border/40 bg-card/40 hover:bg-card/70"
              : "border-border/20 bg-card/20 opacity-60"
      }`}
    >
      {/* Talking indicator bar */}
      {isTalking && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-emerald-500 animate-pulse" />
      )}

      {/* Avatar */}
      <div className={`relative size-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(member.userName)}`}>
        {getInitials(displayName)}
        {/* Status dot */}
        <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card ${
          hasError ? "bg-red-500" : isConnected ? "bg-emerald-500" : isOnline ? "bg-sky-500" : "bg-zinc-500"
        }`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {isTalking && (
            <div className="flex items-end gap-[2px] h-3 ml-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-[2px] bg-emerald-400 rounded-full"
                  style={{ animation: `eqBar ${0.3 + i * 0.1}s ease-in-out infinite alternate`, animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-mono ${
            hasError ? "text-red-400" : isConnected ? "text-emerald-400/70" : isOnline ? "text-sky-400/70" : "text-muted-foreground/40"
          }`}>
            {hasError ? "error" : isConnected ? "in-call" : isOnline ? "online" : "offline"}
          </span>
          {isMuted && isConnected && (
            <Badge className="bg-amber-500/10 text-amber-400/80 border-amber-500/20 text-[9px] px-1 py-0 h-3.5">
              muted
            </Badge>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isConnected && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => isMuted ? onUnmute(member.userName) : onMute(member.userName)}
                className={`size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                  isMuted
                    ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                {isMuted ? <MicOffIcon className="size-3.5" /> : <MicIcon className="size-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{isMuted ? "Unmute" : "Mute"}</TooltipContent>
          </Tooltip>
        )}
        {(hasError || isConnected) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onReconnect(member.userName)}
                className="size-7 rounded-md flex items-center justify-center bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors cursor-pointer"
              >
                <RefreshCwIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Reconnect</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onKick(member.userName)}
              className="size-7 rounded-md flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <PhoneOffIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Kick</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Speaker Timeline ──
function SpeakerTimeline({ events }) {
  const windowMs = 30 * 60 * 1000;
  const now = Date.now();
  const start = now - windowMs;

  const segments = useMemo(() => {
    if (!events || events.length === 0) return [];
    return events.map(e => {
      const s = (e.created_at || 0) * 1000;
      const end = s + (e.duration_ms || 5000);
      const left = Math.max(0, ((s - start) / windowMs) * 100);
      const width = Math.max(0.5, ((Math.min(end, now) - Math.max(s, start)) / windowMs) * 100);
      return { ...e, left, width };
    }).filter(s => s.left + s.width > 0 && s.left < 100);
  }, [events, now]);

  const roomGroups = useMemo(() => {
    const groups = {};
    for (const seg of segments) {
      const key = seg.room || "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(seg);
    }
    return groups;
  }, [segments]);

  const timeMarkers = useMemo(() => {
    const markers = [];
    for (let i = 0; i <= 6; i++) {
      const t = start + (windowMs * i) / 6;
      const d = new Date(t);
      markers.push({
        label: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        left: (i / 6) * 100,
      });
    }
    return markers;
  }, [start]);

  if (segments.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground/40">
        No broadcast activity in the last 30 minutes
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Time axis */}
      <div className="relative h-5 mb-1">
        {timeMarkers.map((m, i) => (
          <span
            key={i}
            className="absolute text-[9px] font-mono text-muted-foreground/40 -translate-x-1/2"
            style={{ left: `${m.left}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* Room rows */}
      {Object.entries(roomGroups).map(([roomId, segs]) => (
        <div key={roomId} className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground/50 w-8 shrink-0 text-right">
            {ROOM_ABBREV[roomId] || roomId}
          </span>
          <div className="relative flex-1 h-5 rounded-sm bg-muted/10">
            {segs.map((seg, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    className={`absolute top-0.5 bottom-0.5 rounded-sm transition-all cursor-default ${
                      seg.answered ? "bg-emerald-500/50 hover:bg-emerald-500/70" : "bg-red-500/40 hover:bg-red-500/60"
                    }`}
                    style={{ left: `${seg.left}%`, width: `${Math.max(seg.width, 0.8)}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <span className="font-medium">{seg.display_name || seg.user_name}</span>
                  <span className="text-muted-foreground ml-1.5">
                    {seg.duration_ms ? `${Math.round(seg.duration_ms / 1000)}s` : ""}
                    {seg.answered ? " — answered" : " — unanswered"}
                  </span>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-end gap-3 pt-1 text-[9px] text-muted-foreground/40">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-emerald-500/50" /> Answered
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-red-500/40" /> Unanswered
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function RoomsPage() {
  const { data: roomsRaw, loading, refetch } = useFetch("/api/v1/admin/rooms");
  const { data: timelineRaw, refetch: refetchTimeline } = useFetch("/api/v1/admin/broadcasts/activity?minutes=30");
  useSSERefresh(() => { refetch(); refetchTimeline(); }, ["rooms", "users", "broadcasts"]);

  const { events: sseEvents } = useSSE("/api/v1/admin/events/stream");

  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const rooms = useMemo(() => {
    if (!Array.isArray(roomsRaw)) return [];
    return roomsRaw.sort((a, b) => (b.online || 0) - (a.online || 0));
  }, [roomsRaw]);

  // Enrich members with talking state from SSE
  const talkingUsers = useMemo(() => {
    const talking = new Set();
    for (const evt of sseEvents) {
      if (evt.scope === "talking") {
        if (evt.talking) talking.add(evt.userName);
        else talking.delete(evt.userName);
      }
    }
    return talking;
  }, [sseEvents]);

  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    const room = rooms.find(r => r.room === selectedRoomId);
    if (!room) return null;
    return {
      ...room,
      members: (room.members || []).map(m => ({
        ...m,
        talking: talkingUsers.has(m.userName),
      })),
    };
  }, [rooms, selectedRoomId, talkingUsers]);

  const timeline = timelineRaw || [];

  // Stats
  const totalOnline = rooms.reduce((s, r) => s + (r.online || 0), 0);
  const totalInCall = rooms.reduce((s, r) => s + (r.inCall || 0), 0);
  const totalUnmuted = rooms.reduce((s, r) => s + (r.unmuted || 0), 0);
  const totalMembers = rooms.reduce((s, r) => s + (r.total || 0), 0);

  // Actions
  const apiAction = useCallback(async (userName, action) => {
    try {
      await fetch(`/api/v1/admin/users/${encodeURIComponent(userName)}/${action}`, { method: "POST" });
    } catch {}
  }, []);

  const muteAll = useCallback(async (room) => {
    const members = room?.members?.filter(m => m.connectionState === "connected" && !m.mute) || [];
    for (const m of members) await apiAction(m.userName, "mute");
  }, [apiAction]);

  const honk = useCallback(async (roomId) => {
    try {
      await fetch(`/api/v1/admin/rooms/${roomId}/honk`, { method: "POST" });
    } catch {}
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Conference Rooms</h2>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono tabular-nums">{rooms.length}</span> rooms,{" "}
            <span className="font-mono tabular-nums">{totalOnline}</span> online,{" "}
            <span className="font-mono tabular-nums">{totalInCall}</span> in call
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniStat icon={<UsersIcon className="size-3.5" />} label="Total Members" value={totalMembers} color="#06b6d4" />
        <MiniStat icon={<WifiIcon className="size-3.5" />} label="Online" value={totalOnline} color="#22c55e" />
        <MiniStat icon={<PhoneCallIcon className="size-3.5" />} label="In Call" value={totalInCall} color="#3b82f6" />
        <MiniStat icon={<ActivityIcon className="size-3.5" />} label="Unmuted" value={totalUnmuted} color="#f59e0b" />
      </div>

      {/* Main Content: Room Grid + Mixer Panel */}
      <div className={`grid gap-4 transition-all duration-300 ${selectedRoom ? "lg:grid-cols-[260px_1fr]" : "lg:grid-cols-1"}`}>
        {/* Room Grid */}
        <div className={selectedRoom ? "" : ""}>
          <div className={`grid gap-2 ${selectedRoom ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"}`}>
            {rooms.map(room => (
              <RoomCard
                key={room.room}
                room={room}
                isSelected={selectedRoomId === room.room}
                onClick={() => setSelectedRoomId(selectedRoomId === room.room ? null : room.room)}
              />
            ))}
          </div>
        </div>

        {/* Mixer Panel */}
        {selectedRoom && (
          <Card className="border-border/40 animate-in slide-in-from-right-4 duration-300">
            <CardHeader className="pb-3 border-b border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedRoomId(null)}
                    className="size-7 rounded-md flex items-center justify-center hover:bg-muted/50 transition-colors cursor-pointer lg:hidden"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {ROOM_NAMES[selectedRoom.room] || selectedRoom.room}
                      {selectedRoom.unmuted > 0 && (
                        <span className="relative flex size-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                          <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono tabular-nums">
                      {selectedRoom.total} members · {selectedRoom.online} online · {selectedRoom.inCall} in call
                    </p>
                  </div>
                </div>

                {/* Room Controls */}
                <div className="flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1.5 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                        onClick={() => muteAll(selectedRoom)}
                      >
                        <VolumeXIcon className="size-3" />
                        Mute All
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mute all unmuted users</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1.5"
                        onClick={() => honk(selectedRoom.room)}
                      >
                        <Volume2Icon className="size-3" />
                        Honk
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sound alert in room</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-3 px-3">
              <ScrollArea className="h-[calc(100vh-380px)] pr-2">
                <div className="space-y-1.5">
                  {/* Connected users first, then online, then offline */}
                  {[...selectedRoom.members]
                    .sort((a, b) => {
                      const order = { connected: 0, error: 1 };
                      const aScore = a.talking ? -1 : (order[a.connectionState] ?? (a.online ? 2 : 3));
                      const bScore = b.talking ? -1 : (order[b.connectionState] ?? (b.online ? 2 : 3));
                      return aScore - bScore;
                    })
                    .map(m => (
                      <MixerUser
                        key={m.userName}
                        member={m}
                        onMute={(u) => apiAction(u, "mute")}
                        onUnmute={(u) => apiAction(u, "unmute")}
                        onKick={(u) => apiAction(u, "kickout")}
                        onReconnect={(u) => apiAction(u, "reconnect")}
                      />
                    ))
                  }
                  {selectedRoom.members.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground/40 py-8">No members in this room</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Speaker Timeline */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <RadioIcon className="size-3.5 text-cyan-400" />
            Broadcast Timeline
            <span className="text-[10px] font-mono text-muted-foreground/40 font-normal ml-1">last 30 min</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <SpeakerTimeline events={timeline} />
        </CardContent>
      </Card>

      <style>{`
        @keyframes eqBar {
          from { height: 3px; }
          to { height: 10px; }
        }
      `}</style>
    </div>
  );
}
