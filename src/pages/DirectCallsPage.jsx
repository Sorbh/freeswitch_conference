import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { useFetch } from "@/hooks/useFetch";
import {
  PhoneCallIcon, PhoneOffIcon, PhoneMissedIcon, PhoneIncomingIcon,
  PlayIcon, ClockIcon, UserIcon, ArrowRightIcon,
  BuildingIcon, XCircleIcon, CheckCircle2Icon,
  ListIcon,
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

function formatFullDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

const STATUS_MAP = {
  completed:  { label: "Completed",  cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  answered:   { label: "Answered",   cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  ringing:    { label: "Ringing",    cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  no_answer:  { label: "No Answer",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  declined:   { label: "Declined",   cls: "bg-red-500/10 text-red-500 border-red-500/20" },
  failed:     { label: "Failed",     cls: "bg-red-500/10 text-red-500 border-red-500/20" },
  cancelled:  { label: "Cancelled",  cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
};

const END_REASON_LABELS = {
  caller_hangup: "Caller hung up",
  callee_hangup: "Callee hung up",
  timeout: "No answer (timeout)",
  declined: "Callee declined",
  bridge_failed: "Bridge failed",
  hangup: "Hung up",
};

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

export default function DirectCallsPage() {
  const { data: calls, loading, refetch } = useFetch("/api/v1/admin/direct-calls?limit=200");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);
  const playingIdRef = useRef(null);
  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);

  const filtered = useMemo(() => {
    if (!calls) return [];
    if (!filterStatus) return calls;
    if (filterStatus === "answered") return calls.filter(c => c.status === "completed" || c.status === "answered");
    if (filterStatus === "missed") return calls.filter(c => c.status === "no_answer" || c.status === "declined" || c.status === "cancelled");
    return calls;
  }, [calls, filterStatus]);

  const stats = useMemo(() => {
    if (!calls || !calls.length) return { total: 0, answered: 0, missed: 0, avgDuration: "—" };
    const answered = calls.filter(c => c.status === "completed" || c.status === "answered").length;
    const missed = calls.filter(c => c.status === "no_answer" || c.status === "declined" || c.status === "cancelled").length;
    const completedCalls = calls.filter(c => c.duration_ms > 0);
    const avgDuration = completedCalls.length > 0
      ? formatDuration(Math.round(completedCalls.reduce((s, c) => s + c.duration_ms, 0) / completedCalls.length))
      : "—";
    return { total: calls.length, answered, missed, avgDuration };
  }, [calls]);

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnd = () => setPlayingId(null);
    audio.addEventListener("ended", onEnd);
    return () => audio.removeEventListener("ended", onEnd);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight leading-tight">Extension Calls</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          <span className="font-mono tabular-nums">{stats.total}</span> total{" • "}
          <span className="font-mono tabular-nums">{stats.answered}</span> answered{" • "}
          <span className="font-mono tabular-nums">{stats.missed}</span> missed
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Calls" value={stats.total} icon={<PhoneCallIcon className="size-4" />} color="#8b5cf6" />
        <StatCard label="Answered" value={stats.answered} icon={<CheckCircle2Icon className="size-4" />} color="#22c55e" />
        <StatCard label="Missed" value={stats.missed} icon={<PhoneMissedIcon className="size-4" />} color="#f59e0b" />
        <StatCard label="Avg Duration" value={stats.avgDuration} icon={<ClockIcon className="size-4" />} color="#06b6d4" mono={false} />
      </div>

      {/* Call Log */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ListIcon className="size-3.5 text-violet-400" />
              Call Log
              <span className="text-[10px] font-mono text-muted-foreground/40 font-normal ml-1">{filtered.length} calls</span>
            </CardTitle>
            <div className="grid grid-cols-3 gap-0.5 p-0.5 rounded-lg bg-muted/20 border border-border/30 sm:flex">
              {[
                { key: "", label: "All", active: "bg-background text-foreground shadow-sm" },
                { key: "answered", label: "Answered", active: "bg-emerald-500/15 text-emerald-400 shadow-sm" },
                { key: "missed", label: "Missed", active: "bg-amber-500/15 text-amber-400 shadow-sm" },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setFilterStatus(s.key)}
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
          </div>
        </CardHeader>

        <CardContent className="pt-0 px-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No calls found</p>
          ) : (
            <>
            <div className="space-y-2 px-3 pb-3 md:hidden">
              {filtered.map((c) => {
                const url = c.recording_path ? `/recordings/direct/${c.recording_path.split("/").pop()}` : null;
                const playing = playingId === c.id;
                const st = STATUS_MAP[c.status] || STATUS_MAP.cancelled;
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl border bg-card/70 p-3 transition-colors ${playing ? "border-violet-500/25 bg-violet-500/[0.04]" : "border-border/60"}`}
                    onClick={() => { setSelectedCall(c); setSheetOpen(true); }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        {url ? (
                          <button
                            onClick={() => toggle(c.id, url)}
                            className={`flex size-9 items-center justify-center rounded-full border transition-all cursor-pointer ${
                              playing
                                ? "bg-violet-500/15 border-violet-500/30 text-violet-400"
                                : "bg-muted/40 border-border/50 text-muted-foreground"
                            }`}
                            aria-label={playing ? "Pause recording" : "Play recording"}
                          >
                            {playing ? (
                              <div className="flex items-end gap-[2px] h-3">
                                {[0, 1, 2].map(i => (
                                  <div key={i} className="w-[2px] bg-violet-400 rounded-full" style={{ animation: `eqBar ${0.3 + i * 0.1}s ease-in-out infinite alternate`, animationDelay: `${i * 80}ms` }} />
                                ))}
                              </div>
                            ) : (
                              <PlayIcon className="size-3.5 ml-0.5" />
                            )}
                          </button>
                        ) : (
                          <span className="flex size-9 items-center justify-center rounded-full border border-border/50 bg-muted/20 text-muted-foreground/40">
                            <PhoneCallIcon className="size-4" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold leading-tight">{c.caller_display_name || c.caller_email}</p>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {c.caller_extension && <code className="font-mono text-violet-400/70 bg-violet-500/10 px-1.5 py-px rounded">*{c.caller_extension}</code>}
                              {c.caller_company && <span className="truncate">{c.caller_company}</span>}
                            </div>
                          </div>
                          <Badge className={`${st.cls} shrink-0 text-[10px] px-1.5 py-0`}>{st.label}</Badge>
                        </div>
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/15 px-2.5 py-2">
                          <ArrowRightIcon className="size-3.5 text-muted-foreground/40 shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{c.callee_display_name || c.callee_email}</p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {c.callee_extension && <code className="font-mono text-cyan-400/70 bg-cyan-500/10 px-1.5 py-px rounded">*{c.callee_extension}</code>}
                              {c.callee_company && <span className="truncate">{c.callee_company}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 font-mono tabular-nums">
                            <ClockIcon className="size-3" />
                            {formatTime(c.created_at)}
                          </span>
                          <span className="rounded-md border border-border/60 px-2 py-1">{c.caller_room_name || "—"}</span>
                          <span className="rounded-md border border-border/60 px-2 py-1 font-mono tabular-nums">{c.duration_ms > 0 ? formatDuration(c.duration_ms) : "—"}</span>
                        </div>
                        {(END_REASON_LABELS[c.end_reason] || c.end_reason) && (
                          <p className="mt-2 text-xs text-muted-foreground/60">{END_REASON_LABELS[c.end_reason] || c.end_reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 w-12"></TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Callee</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6">End Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const url = c.recording_path ? `/recordings/direct/${c.recording_path.split("/").pop()}` : null;
                  const playing = playingId === c.id;
                  const st = STATUS_MAP[c.status] || STATUS_MAP.cancelled;
                  return (
                    <TableRow
                      key={c.id}
                      className={`cursor-pointer ${playing ? "bg-violet-500/[0.03]" : ""}`}
                      onClick={() => { setSelectedCall(c); setSheetOpen(true); }}
                    >
                      <TableCell className="pl-6">
                        {url && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggle(c.id, url); }}
                            className={`flex size-7 items-center justify-center rounded-full border transition-all cursor-pointer ${
                              playing
                                ? "bg-violet-500/15 border-violet-500/30 text-violet-400"
                                : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                            }`}
                          >
                            {playing ? (
                              <div className="flex items-end gap-[2px] h-3">
                                {[0, 1, 2].map(i => (
                                  <div key={i} className="w-[2px] bg-violet-400 rounded-full" style={{ animation: `eqBar ${0.3 + i * 0.1}s ease-in-out infinite alternate`, animationDelay: `${i * 80}ms` }} />
                                ))}
                              </div>
                            ) : (
                              <PlayIcon className="size-3 ml-0.5" />
                            )}
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-mono tabular-nums">{formatTime(c.created_at)}</div>
                        <div className="text-[10px] text-muted-foreground/50">{formatFullDate(c.created_at)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate max-w-[140px]">{c.caller_display_name || c.caller_email}</span>
                          {c.caller_extension && <code className="text-[10px] font-mono text-muted-foreground/50 bg-muted/30 px-1 py-px rounded">*{c.caller_extension}</code>}
                        </div>
                        {c.caller_company && <div className="text-[10px] text-muted-foreground/40 truncate max-w-[160px]">{c.caller_company}</div>}
                      </TableCell>
                      <TableCell className="px-0">
                        <ArrowRightIcon className="size-3 text-muted-foreground/25 mx-auto" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate max-w-[140px]">{c.callee_display_name || c.callee_email}</span>
                          {c.callee_extension && <code className="text-[10px] font-mono text-muted-foreground/50 bg-muted/30 px-1 py-px rounded">*{c.callee_extension}</code>}
                        </div>
                        {c.callee_company && <div className="text-[10px] text-muted-foreground/40 truncate max-w-[160px]">{c.callee_company}</div>}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{c.caller_room_name || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono tabular-nums text-muted-foreground">{c.duration_ms > 0 ? formatDuration(c.duration_ms) : "—"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${st.cls} text-[10px] px-1.5 py-0`}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="pr-6">
                        <span className="text-xs text-muted-foreground/50">{END_REASON_LABELS[c.end_reason] || c.end_reason || "—"}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[420px] sm:w-[460px] p-0 flex flex-col gap-0 overflow-y-auto border-border/40">
          <SheetHeader className="sr-only">
            <SheetTitle>Call Detail</SheetTitle>
            <SheetDescription>Extension call detail view</SheetDescription>
          </SheetHeader>

          {selectedCall && (() => {
            const st = STATUS_MAP[selectedCall.status] || STATUS_MAP.cancelled;
            const isAnswered = selectedCall.status === "completed" || selectedCall.status === "answered";
            const url = selectedCall.recording_path ? `/recordings/direct/${selectedCall.recording_path.split("/").pop()}` : null;
            return (
              <>
                {/* Hero header */}
                <div className={`relative px-5 pt-12 pb-5 ${isAnswered ? "bg-emerald-500/[0.04]" : "bg-red-500/[0.04]"}`}>
                  <div className={`absolute top-0 left-0 right-0 h-px ${isAnswered ? "bg-emerald-500/30" : "bg-red-500/30"}`} />
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={`size-2 rounded-full ${isAnswered ? "bg-emerald-500" : "bg-red-500"}`} />
                        <Badge className={`${st.cls} text-[10px] px-1.5 py-0`}>{st.label}</Badge>
                        {selectedCall.end_reason && (
                          <span className="text-[11px] text-muted-foreground/40">{END_REASON_LABELS[selectedCall.end_reason] || selectedCall.end_reason}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground/50 font-mono tabular-nums">
                        {formatFullDateTime(selectedCall.created_at)}
                      </p>
                    </div>
                    {selectedCall.duration_ms > 0 && (
                      <div className="text-right">
                        <p className="text-xl font-bold font-mono tabular-nums tracking-tight">{formatDuration(selectedCall.duration_ms)}</p>
                        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">duration</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 space-y-4">
                  {/* Caller → Callee flow */}
                  <div className="space-y-0">
                    {/* Caller */}
                    <div className="flex items-center gap-3 py-3">
                      <div className="size-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                        <PhoneCallIcon className="size-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{selectedCall.caller_display_name || selectedCall.caller_email}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {selectedCall.caller_extension && (
                            <code className="text-[10px] font-mono text-violet-400/70 bg-violet-500/10 px-1.5 py-px rounded">*{selectedCall.caller_extension}</code>
                          )}
                          {selectedCall.caller_company && (
                            <span className="text-[11px] text-muted-foreground/40 truncate">{selectedCall.caller_company}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/30 font-medium shrink-0">Caller</span>
                    </div>

                    {/* Connection line */}
                    <div className="flex items-center gap-3 py-0.5">
                      <div className="w-9 flex justify-center">
                        <div className="w-px h-5 bg-border/50" />
                      </div>
                      <ArrowRightIcon className="size-3 text-muted-foreground/20 rotate-90" />
                    </div>

                    {/* Callee */}
                    <div className="flex items-center gap-3 py-3">
                      <div className="size-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                        <PhoneIncomingIcon className="size-4 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{selectedCall.callee_display_name || selectedCall.callee_email}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {selectedCall.callee_extension && (
                            <code className="text-[10px] font-mono text-cyan-400/70 bg-cyan-500/10 px-1.5 py-px rounded">*{selectedCall.callee_extension}</code>
                          )}
                          {selectedCall.callee_company && (
                            <span className="text-[11px] text-muted-foreground/40 truncate">{selectedCall.callee_company}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/30 font-medium shrink-0">Callee</span>
                    </div>
                  </div>

                  {/* Metadata grid */}
                  <div className="rounded-lg border border-border/40 overflow-hidden divide-y divide-border/30">
                    {selectedCall.caller_room_name && (
                      <div className="flex items-center justify-between px-3.5 py-2.5">
                        <span className="text-[12px] text-muted-foreground/50">Room</span>
                        <span className="text-[12px] font-medium">{selectedCall.caller_room_name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="text-[12px] text-muted-foreground/50">Started</span>
                      <span className="text-[12px] font-mono tabular-nums">{formatFullDateTime(selectedCall.started_at || selectedCall.created_at)}</span>
                    </div>
                    {selectedCall.answered_at && (
                      <div className="flex items-center justify-between px-3.5 py-2.5">
                        <span className="text-[12px] text-muted-foreground/50">Answered</span>
                        <span className="text-[12px] font-mono tabular-nums">{formatTime(selectedCall.answered_at)}</span>
                      </div>
                    )}
                    {selectedCall.ended_at && (
                      <div className="flex items-center justify-between px-3.5 py-2.5">
                        <span className="text-[12px] text-muted-foreground/50">Ended</span>
                        <span className="text-[12px] font-mono tabular-nums">{formatTime(selectedCall.ended_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* Recording */}
                  {url && (
                    <div className="rounded-lg border border-border/40 px-3.5 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggle(selectedCall.id, url)}
                          className={`flex size-9 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                            playingId === selectedCall.id
                              ? "bg-violet-500/15 border-violet-500/30 text-violet-400"
                              : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                          }`}
                        >
                          {playingId === selectedCall.id ? (
                            <div className="flex items-end gap-[2px] h-3">
                              {[0, 1, 2].map(i => (
                                <div key={i} className="w-[2px] bg-violet-400 rounded-full" style={{ animation: `eqBar ${0.3 + i * 0.1}s ease-in-out infinite alternate`, animationDelay: `${i * 80}ms` }} />
                              ))}
                            </div>
                          ) : (
                            <PlayIcon className="size-3.5 ml-0.5" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium">Recording</p>
                          <p className="text-[10px] text-muted-foreground/40 font-mono truncate">{selectedCall.recording_path.split("/").pop()}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Transcription */}
                  {selectedCall.transcription && (
                    <div className="rounded-lg border border-border/40 px-3.5 py-3">
                      <p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-widest mb-2">Transcription</p>
                      <p className="text-[12px] text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">{selectedCall.transcription}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <audio ref={audioRef} hidden />
      <style>{`
        @keyframes eqBar {
          from { height: 3px; }
          to { height: 10px; }
        }
      `}</style>
    </div>
  );
}
