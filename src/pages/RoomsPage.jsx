import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { useSSE } from "@/hooks/useSSE";
import { useRooms } from "@/hooks/useRooms";
import {
  Volume2Icon, MicIcon, MicOffIcon, PhoneOffIcon, RefreshCwIcon,
  UsersIcon, WifiIcon, PhoneCallIcon, ActivityIcon, VolumeXIcon,
  RadioIcon, ChevronRightIcon, BanIcon, PlusIcon, PencilIcon, Trash2Icon,
} from "lucide-react";

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

function Tip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function StatCard({ title, value, icon, color, subtitle }) {
  const animated = useAnimatedNumber(typeof value === "number" ? value : 0);
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none tracking-tight font-mono tabular-nums">
              {typeof value === "number" ? animated.toLocaleString() : value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">{title}</p>
          </div>
        </div>
      </CardContent>
      <div className="absolute inset-x-0 bottom-0 h-[2px]" style={{ backgroundColor: `${color}25` }} />
    </Card>
  );
}

// ── Speaker Timeline ──
function SpeakerTimeline({ events, roomCodes = {} }) {
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
      <p className="text-center py-8 text-sm text-muted-foreground">
        No broadcast activity in the last 30 minutes
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative h-5 mb-1 ml-10">
        {timeMarkers.map((m, i) => (
          <span
            key={i}
            className="absolute text-[9px] font-mono text-muted-foreground/50 -translate-x-1/2"
            style={{ left: `${m.left}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>
      {Object.entries(roomGroups).map(([roomId, segs]) => (
        <div key={roomId} className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground w-9 shrink-0 text-right">
            {roomCodes[roomId] || roomId}
          </span>
          <div className="relative flex-1 h-6 rounded bg-muted/20">
            {segs.map((seg, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    className={`absolute top-1 bottom-1 rounded-sm transition-all cursor-default ${
                      seg.answered ? "bg-emerald-500/60 hover:bg-emerald-500/80" : "bg-red-500/50 hover:bg-red-500/70"
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
      <div className="flex items-center justify-end gap-4 pt-1 text-[10px] text-muted-foreground/50">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-500/60" /> Answered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-red-500/50" /> Unanswered
        </span>
      </div>
    </div>
  );
}

const EMPTY_ROOM_FORM = { id: "", name: "", short_code: "" };

// ── Main Page ──
export default function RoomsPage() {
  const { names: ROOM_NAMES, codes: ROOM_CODES, refetch: refetchRoomConfig } = useRooms();
  const { data: roomsRaw, loading, refetch } = useFetch("/api/v1/admin/rooms");
  const { data: timelineRaw, refetch: refetchTimeline } = useFetch("/api/v1/admin/broadcasts/activity?minutes=30");
  useSSERefresh(() => { refetch(); refetchTimeline(); }, ["rooms", "users", "broadcasts"]);
  const { events: sseEvents } = useSSE("/api/v1/admin/events/stream");

  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function openCreateRoom() {
    setEditingRoom(null);
    setRoomForm(EMPTY_ROOM_FORM);
    setRoomDialogOpen(true);
  }

  function openEditRoom(room) {
    setEditingRoom(room);
    setRoomForm({ id: String(room.room), name: ROOM_NAMES[room.room] || "", short_code: ROOM_CODES[room.room] || "" });
    setRoomDialogOpen(true);
  }

  async function handleSaveRoom() {
    setSaving(true);
    try {
      if (editingRoom) {
        await fetch(`/api/v1/admin/rooms/${editingRoom.room}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: roomForm.name, short_code: roomForm.short_code }),
        });
      } else {
        await fetch("/api/v1/admin/rooms/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: parseInt(roomForm.id), name: roomForm.name, short_code: roomForm.short_code }),
        });
      }
      setRoomDialogOpen(false);
      refetch();
      refetchRoomConfig();
    } catch (e) {
      console.error("Save room failed:", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRoom() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/v1/admin/rooms/${deleteTarget.room}/delete`, { method: "DELETE" });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      refetch();
      refetchRoomConfig();
    } catch (e) {
      console.error("Delete room failed:", e);
    }
  }

  const rooms = useMemo(() => {
    if (!Array.isArray(roomsRaw)) return [];
    return [...roomsRaw].sort((a, b) => (b.online || 0) - (a.online || 0));
  }, [roomsRaw]);

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
  const totalOnline = rooms.reduce((s, r) => s + (r.online || 0), 0);
  const totalInCall = rooms.reduce((s, r) => s + (r.inCall || 0), 0);
  const totalUnmuted = rooms.reduce((s, r) => s + (r.unmuted || 0), 0);
  const totalMembers = rooms.reduce((s, r) => s + (r.total || 0), 0);

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
    try { await fetch(`/api/v1/admin/rooms/${roomId}/honk`, { method: "POST" }); } catch {}
  }, []);

  function openRoom(room) {
    setSelectedRoomId(room.room);
    setSheetOpen(true);
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6 animate-in fade-in duration-300">
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
        <Button onClick={openCreateRoom}>
          <PlusIcon className="size-4 mr-2" />
          Add Room
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Members" value={totalMembers} icon={<UsersIcon className="size-4" />} color="#06b6d4" />
        <StatCard title="Online" value={totalOnline} icon={<WifiIcon className="size-4" />} color="#22c55e" />
        <StatCard title="In Call" value={totalInCall} icon={<PhoneCallIcon className="size-4" />} color="#3b82f6" />
        <StatCard title="Unmuted" value={totalUnmuted} icon={<ActivityIcon className="size-4" />} color="#f59e0b" />
      </div>

      {/* Rooms Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="hidden md:table-cell">Online</TableHead>
                <TableHead className="hidden md:table-cell">In Call</TableHead>
                <TableHead className="hidden md:table-cell">Unmuted</TableHead>
                <TableHead className="hidden lg:table-cell">Capacity</TableHead>
                <TableHead className="hidden lg:table-cell">Active Speakers</TableHead>
                <TableHead className="text-right w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    No rooms configured
                  </TableCell>
                </TableRow>
              ) : (
                rooms.map(room => {
                  const total = room.total ?? 0;
                  const online = room.online ?? 0;
                  const inCall = room.inCall ?? 0;
                  const unmuted = room.unmuted ?? 0;
                  const isEmpty = online === 0 && inCall === 0;
                  const onlineMembers = (room.members || []).filter(m => m.online);
                  const speakingMembers = onlineMembers.filter(m => !m.mute || talkingUsers.has(m.userName));

                  return (
                    <TableRow
                      key={room.room}
                      className={`cursor-pointer group transition-colors ${isEmpty ? "opacity-50" : ""}`}
                      onClick={() => openRoom(room)}
                    >
                      <TableCell>
                        {unmuted > 0 ? (
                          <span className="relative flex size-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                            <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
                          </span>
                        ) : online > 0 ? (
                          <span className="inline-flex rounded-full size-2.5 bg-sky-500" />
                        ) : (
                          <span className="inline-flex rounded-full size-2.5 bg-zinc-500/30" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {ROOM_NAMES[room.room] || room.room}
                          <span className="text-[10px] font-mono text-muted-foreground/40">{ROOM_CODES[room.room]}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums text-sm">
                        {total}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-mono tabular-nums ${online > 0 ? "text-emerald-400" : "text-muted-foreground/40"}`}>
                          {online > 0 && <span className="size-1.5 rounded-full bg-emerald-500" />}
                          {online}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-mono tabular-nums ${inCall > 0 ? "text-sky-400" : "text-muted-foreground/40"}`}>
                          {inCall > 0 && <span className="size-1.5 rounded-full bg-sky-500" />}
                          {inCall}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-mono tabular-nums ${unmuted > 0 ? "text-amber-400" : "text-muted-foreground/40"}`}>
                          {unmuted > 0 && <span className="size-1.5 rounded-full bg-amber-500" />}
                          {unmuted}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2 w-24">
                          <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                            <div className="h-full flex">
                              {inCall > 0 && (
                                <div className="h-full bg-sky-500/70" style={{ width: `${(inCall / Math.max(total, 1)) * 100}%` }} />
                              )}
                              {online - inCall > 0 && (
                                <div className="h-full bg-emerald-500/40" style={{ width: `${((online - inCall) / Math.max(total, 1)) * 100}%` }} />
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">{Math.round((online / Math.max(total, 1)) * 100)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {speakingMembers.length > 0 ? (
                          <div className="flex -space-x-1.5">
                            {speakingMembers.slice(0, 4).map(m => (
                              <div
                                key={m.userName}
                                className={`size-6 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-card ${getAvatarColor(m.userName)}`}
                                title={m.callerIdName || m.userName}
                              >
                                {getInitials(m.callerIdName || m.userName)}
                              </div>
                            ))}
                            {speakingMembers.length > 4 && (
                              <div className="size-6 rounded-full flex items-center justify-center text-[8px] font-mono bg-muted/50 text-muted-foreground border-2 border-card">
                                +{speakingMembers.length - 4}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/30">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <Tip label="Edit Room">
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => openEditRoom(room)}>
                              <PencilIcon className="size-3.5" />
                            </Button>
                          </Tip>
                          <Tip label="Honk">
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => honk(room.room)}>
                              <Volume2Icon className="size-3.5" />
                            </Button>
                          </Tip>
                          <Tip label="Delete Room">
                            <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => { setDeleteTarget(room); setDeleteDialogOpen(true); }}>
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </Tip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Broadcast Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <RadioIcon className="size-3.5 text-cyan-400" />
            Broadcast Timeline
            <span className="text-[10px] font-mono text-muted-foreground/40 font-normal ml-1">last 30 min</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <SpeakerTimeline events={timeline} roomCodes={ROOM_CODES} />
        </CardContent>
      </Card>

      {/* Room Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent showCloseButton={false} className="sm:max-w-[480px] p-0 overflow-y-auto border-l border-border/50 bg-background/95 backdrop-blur-xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Room Details</SheetTitle>
            <SheetDescription>Conference room members and controls</SheetDescription>
          </SheetHeader>
          {selectedRoom && (() => {
            const sorted = [...selectedRoom.members].sort((a, b) => {
              const order = { connected: 0, error: 1 };
              const aScore = a.talking ? -1 : (order[a.connectionState] ?? (a.online ? 2 : 3));
              const bScore = b.talking ? -1 : (order[b.connectionState] ?? (b.online ? 2 : 3));
              return aScore - bScore;
            });
            const connectedCount = sorted.filter(m => m.connectionState === "connected").length;
            const onlineCount = sorted.filter(m => m.online).length;

            return (
              <div className="flex flex-col">
                {/* Header */}
                <div className="relative px-6 pt-8 pb-5">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                        {ROOM_NAMES[selectedRoom.room] || selectedRoom.room}
                        {selectedRoom.unmuted > 0 && (
                          <span className="relative flex size-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                            <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                          </span>
                        )}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono tabular-nums">
                      {selectedRoom.total} members · {onlineCount} online · {connectedCount} in call
                    </p>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="px-6 pb-5">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => muteAll(selectedRoom)}
                    >
                      <VolumeXIcon className="size-3.5 mr-1.5" />
                      Mute All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => honk(selectedRoom.room)}
                    >
                      <Volume2Icon className="size-3.5 mr-1.5" />
                      Honk
                    </Button>
                  </div>
                </div>

                <div className="h-px bg-border/60" />

                {/* Members */}
                <div className="px-6 py-5 space-y-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
                    Members ({selectedRoom.members.length})
                  </p>
                  <div className="space-y-1">
                    {sorted.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">No members in this room</p>
                    ) : (
                      sorted.map(m => {
                        const isTalking = m.talking;
                        const isConnected = m.connectionState === "connected";
                        const isOnline = m.online;
                        const isMuted = m.mute;
                        const hasError = m.connectionState === "error";
                        const displayName = m.callerIdName || m.userName?.replace("sip:", "") || "Unknown";

                        return (
                          <div
                            key={m.userName}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-muted/40 ${
                              hasError ? "bg-red-950/30" : isTalking ? "bg-emerald-500/[0.04]" : ""
                            }`}
                          >
                            {/* Avatar */}
                            <div className={`relative size-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(m.userName)}`}>
                              {getInitials(displayName)}
                              <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background ${
                                hasError ? "bg-red-500" : isConnected ? "bg-emerald-500" : isOnline ? "bg-sky-500" : "bg-zinc-500"
                              }`} />
                            </div>

                            {/* Name + status */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium truncate">{displayName}</span>
                                {isTalking && (
                                  <div className="flex items-end gap-[2px] h-3 ml-0.5">
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

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isConnected && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  title={isMuted ? "Unmute" : "Mute"}
                                  onClick={() => apiAction(m.userName, isMuted ? "unmute" : "mute")}
                                >
                                  {isMuted ? <MicOffIcon className="size-3.5 text-amber-400" /> : <MicIcon className="size-3.5 text-emerald-400" />}
                                </Button>
                              )}
                              {(hasError || isConnected) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  title="Reconnect"
                                  onClick={() => apiAction(m.userName, "reconnect")}
                                >
                                  <RefreshCwIcon className="size-3.5" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-destructive"
                                title="Kick"
                                onClick={() => apiAction(m.userName, "kickout")}
                              >
                                <PhoneOffIcon className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Create / Edit Room Dialog */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Edit Room" : "Add Room"}</DialogTitle>
            <DialogDescription>
              {editingRoom ? "Update the room name and short code." : "Create a new conference room."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            {!editingRoom && (
              <div className="space-y-2">
                <Label>Room ID *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 123456713"
                  value={roomForm.id}
                  onChange={e => setRoomForm(f => ({ ...f, id: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">Numeric ID used as FreeSWitch conference name</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Room Name *</Label>
                <Input
                  placeholder="e.g. Pennsylvania"
                  value={roomForm.name}
                  onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Short Code *</Label>
                <Input
                  placeholder="e.g. PA"
                  maxLength={4}
                  value={roomForm.short_code}
                  onChange={e => setRoomForm(f => ({ ...f, short_code: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
            <Button
              className="w-full mt-2"
              onClick={handleSaveRoom}
              disabled={saving || !roomForm.name || !roomForm.short_code || (!editingRoom && !roomForm.id)}
            >
              {saving ? "Saving..." : editingRoom ? "Update Room" : "Create Room"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Room Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {ROOM_NAMES[deleteTarget?.room] || deleteTarget?.room}
              </span>
              ? Users assigned to this room will need to be reassigned.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDeleteRoom}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes eqBar {
          from { height: 3px; }
          to { height: 10px; }
        }
      `}</style>
    </div>
    </TooltipProvider>
  );
}
