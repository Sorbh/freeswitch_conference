import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRooms } from "@/hooks/useRooms";
import { apiFetch } from "@/lib/api";
import {
  MegaphoneIcon,
  PlayIcon,
  PercentIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  StopCircleIcon,
  Loader2Icon,
  CheckIcon,
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  FileAudioIcon,
  ClockIcon,
  PlusCircleIcon,
} from "lucide-react";

function formatDuration(ms) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function formatAudioDuration(secs) {
  if (!secs || isNaN(secs)) return "";
  const m = Math.floor(secs / 60);
  const rem = Math.floor(secs % 60);
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function parseRooms(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

function StatCard({ label, value, icon, color }) {
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
            <p className="text-2xl font-bold leading-none tracking-tight font-mono tabular-nums">
              {value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">{label}</p>
          </div>
        </div>
      </CardContent>
      <div className="absolute inset-x-0 bottom-0 h-[2px]" style={{ backgroundColor: `${color}25` }} />
    </Card>
  );
}

const TIMEZONES = [
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Chicago", label: "Central (CST/CDT)" },
  { value: "America/New_York", label: "Eastern (EST/EDT)" },
  { value: "America/Denver", label: "Mountain (MST/MDT)" },
  { value: "America/Los_Angeles", label: "Pacific (PST/PDT)" },
  { value: "America/Mexico_City", label: "Mexico City (CST)" },
  { value: "Europe/Madrid", label: "Spain (CET/CEST)" },
  { value: "Africa/Accra", label: "Ghana (GMT)" },
  { value: "Africa/Cairo", label: "Egypt (EET)" },
];

const ROOM_TIMEZONE = {
  California: "America/Los_Angeles",
  Bakersfield: "America/Los_Angeles",
  SanDiego: "America/Los_Angeles",
  Texas: "America/Chicago",
  NewJersey: "America/New_York",
  Florida: "America/New_York",
  Mexico: "America/Mexico_City",
  Egypt: "Africa/Cairo",
  Spain: "Europe/Madrid",
  Ghana: "Africa/Accra",
  Arizona: "America/Phoenix",
};

function getLocalTimeStr(tz) {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return ""; }
}

const EMPTY_FORM = {
  label: "",
  rooms: [],
  enabled: true,
  schedule_type: "none",
  schedule_times: [],
  timezone: "America/Phoenix",
  interval_minutes: 30,
  window_start: "08:00",
  window_end: "18:00",
};

export default function AnnouncementsPage() {
  const { names: ROOM_NAMES } = useRooms();

  const [ads, setAds] = useState([]);
  const [active, setActive] = useState({});
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [audioFile, setAudioFile] = useState(null);
  const [audioDuration, setAudioDuration] = useState(null);
  const [saving, setSaving] = useState(false);

  const [playingId, setPlayingId] = useState(null);
  const [playResults, setPlayResults] = useState({});
  const [stoppingId, setStoppingId] = useState(null);

  const [deleteId, setDeleteId] = useState(null);

  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize] = useState(25);
  const [logLoading, setLogLoading] = useState(false);

  const pollRef = useRef(null);
  const audioElRef = useRef(null);

  const fetchAds = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/admin/audio-ads");
      const json = await res.json();
      if (json.status) {
        setAds(json.data || []);
        setActive(json.active || {});
      }
    } catch (e) {
      console.error("Failed to fetch ads:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const pollActive = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/admin/audio-ads");
      const json = await res.json();
      if (json.status) {
        setActive(json.active || {});
        if (Object.keys(json.active || {}).length === 0 && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch {}
  }, []);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(pollActive, 3000);
  }

  useEffect(() => {
    fetchAds();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAds]);

  const fetchLog = useCallback(async (page) => {
    setLogLoading(true);
    try {
      const res = await apiFetch(`/api/v1/admin/audio-ads/play-log?page=${page}&pageSize=${logPageSize}`);
      const json = await res.json();
      if (json.status) {
        setLog(json.data || []);
        setLogTotal(json.total || 0);
      }
    } catch (e) {
      console.error("Failed to fetch log:", e);
    } finally {
      setLogLoading(false);
    }
  }, [logPageSize]);

  useEffect(() => {
    if (logOpen) fetchLog(logPage);
  }, [logOpen, logPage, fetchLog]);

  const totalAds = ads.length;
  const totalPlays = ads.reduce((s, a) => s + (a.total_plays || 0), 0);
  const completionNumerator = ads.reduce((s, a) => s + (a.completed || 0), 0);
  const avgCompletion = totalPlays > 0 ? Math.round((completionNumerator / totalPlays) * 100) : 0;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setAudioFile(null);
    setAudioDuration(null);
    setFormOpen(true);
  }

  function openEdit(ad) {
    setEditing(ad);
    let scheduleTimes = [];
    try { scheduleTimes = JSON.parse(ad.schedule_times || '[]'); } catch {}
    const hasInterval = ad.schedule_type === 'interval' && ad.interval_minutes > 0;
    const hasTimes = scheduleTimes.length > 0;
    setForm({
      label: ad.label || "",
      rooms: parseRooms(ad.rooms),
      enabled: !!ad.enabled,
      schedule_type: hasInterval ? "interval" : hasTimes ? "times" : "none",
      schedule_times: scheduleTimes,
      timezone: ad.timezone || "America/Phoenix",
      interval_minutes: ad.interval_minutes || 30,
      window_start: ad.window_start || "08:00",
      window_end: ad.window_end || "18:00",
    });
    setAudioFile(null);
    setAudioDuration(null);
    setFormOpen(true);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setAudioDuration(null);
    const url = URL.createObjectURL(file);
    const el = audioElRef.current || new Audio();
    audioElRef.current = el;
    el.src = url;
    el.onloadedmetadata = () => {
      setAudioDuration(el.duration);
      URL.revokeObjectURL(url);
    };
    el.onerror = () => { URL.revokeObjectURL(url); };
    el.load();
  }

  function toggleRoom(roomId) {
    const id = parseInt(roomId);
    setForm(f => {
      const newRooms = f.rooms.includes(id)
        ? f.rooms.filter(r => r !== id)
        : [...f.rooms, id];
      // Auto-set timezone from first selected room
      let tz = f.timezone;
      if (newRooms.length > 0 && !f.rooms.includes(id)) {
        const roomName = ROOM_NAMES[id];
        if (roomName && ROOM_TIMEZONE[roomName]) tz = ROOM_TIMEZONE[roomName];
      }
      return { ...f, rooms: newRooms, timezone: tz };
    });
  }

  async function handleSave() {
    setSaving(true);
    const schedPayload = {
      schedule_type: form.schedule_type === "none" ? "times" : form.schedule_type,
      schedule_times: form.schedule_type === "times" ? form.schedule_times : [],
      timezone: form.timezone,
      interval_minutes: form.schedule_type === "interval" ? form.interval_minutes : 0,
      window_start: form.schedule_type === "interval" ? form.window_start : null,
      window_end: form.schedule_type === "interval" ? form.window_end : null,
    };
    try {
      if (editing) {
        if (audioFile) {
          const fd = new FormData();
          fd.append("audio", audioFile);
          fd.append("label", form.label);
          fd.append("rooms", JSON.stringify(form.rooms));
          fd.append("enabled", form.enabled ? "1" : "0");
          fd.append("schedule_times", JSON.stringify(schedPayload.schedule_times));
          fd.append("timezone", schedPayload.timezone);
          fd.append("schedule_type", schedPayload.schedule_type);
          fd.append("interval_minutes", String(schedPayload.interval_minutes));
          fd.append("window_start", schedPayload.window_start || "");
          fd.append("window_end", schedPayload.window_end || "");
          await apiFetch(`/api/v1/admin/audio-ads/${editing.id}/replace`, { method: "POST", body: fd });
        } else {
          await apiFetch(`/api/v1/admin/audio-ads/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: form.label,
              rooms: form.rooms,
              enabled: form.enabled ? 1 : 0,
              ...schedPayload,
            }),
          });
        }
      } else {
        const fd = new FormData();
        if (audioFile) fd.append("audio", audioFile);
        fd.append("label", form.label);
        fd.append("rooms", JSON.stringify(form.rooms));
        fd.append("schedule_times", JSON.stringify(schedPayload.schedule_times));
        fd.append("timezone", schedPayload.timezone);
        fd.append("schedule_type", schedPayload.schedule_type);
        fd.append("interval_minutes", String(schedPayload.interval_minutes));
        fd.append("window_start", schedPayload.window_start || "");
        fd.append("window_end", schedPayload.window_end || "");
        await apiFetch("/api/v1/admin/audio-ads", { method: "POST", body: fd });
      }
      setFormOpen(false);
      fetchAds();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiFetch(`/api/v1/admin/audio-ads/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      fetchAds();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }

  async function handlePlay(id) {
    setPlayingId(id);
    setPlayResults(r => ({ ...r, [id]: null }));
    try {
      const res = await apiFetch(`/api/v1/admin/audio-ads/${id}/play`, { method: "POST" });
      const json = await res.json();
      setPlayResults(r => ({ ...r, [id]: json.data || [] }));
      pollActive();
      startPolling();
    } catch (e) {
      console.error("Play failed:", e);
    } finally {
      setPlayingId(null);
    }
  }

  async function handleStop(id) {
    setStoppingId(id);
    try {
      await apiFetch(`/api/v1/admin/audio-ads/${id}/stop`, { method: "POST" });
      pollActive();
    } catch (e) {
      console.error("Stop failed:", e);
    } finally {
      setStoppingId(null);
    }
  }

  async function toggleEnabled(ad) {
    try {
      await apiFetch(`/api/v1/admin/audio-ads/${ad.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: ad.enabled ? 0 : 1 }),
      });
      fetchAds();
    } catch (e) {
      console.error("Toggle failed:", e);
    }
  }

  const isAdActive = (ad) => {
    return Object.values(active).some(a => a.adId === ad.id);
  };

  const logTotalPages = Math.max(1, Math.ceil(logTotal / logPageSize));

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight leading-tight">Network Announcements</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Play audio announcements in conference rooms
          </p>
        </div>
        <Button onClick={openCreate} className="h-10 w-full justify-center sm:w-auto">
          <PlusIcon className="size-4 mr-2" />
          Upload
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Total Announcements"
          value={totalAds}
          icon={<MegaphoneIcon className="size-4" />}
          color="#a855f7"
        />
        <StatCard
          label="Total Plays"
          value={totalPlays}
          icon={<PlayIcon className="size-4" />}
          color="#06b6d4"
        />
        <StatCard
          label="Avg Completion Rate"
          value={`${avgCompletion}%`}
          icon={<PercentIcon className="size-4" />}
          color="#22c55e"
        />
      </div>

      {ads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MegaphoneIcon className="size-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No announcements uploaded</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Upload an audio file to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => {
            const adRooms = parseRooms(ad.rooms);
            let adSchedule = [];
            try { adSchedule = JSON.parse(ad.schedule_times || '[]'); } catch {}
            const adActive = isAdActive(ad);
            const playResult = playResults[ad.id];
            const isPlaying = playingId === ad.id;
            const isStopping = stoppingId === ad.id;

            return (
              <Card key={ad.id} className={`border-border/40 ${!ad.enabled ? "opacity-60" : ""}`}>
                <CardContent className="py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="relative size-10 rounded-lg flex items-center justify-center shrink-0 bg-purple-500/10 border border-purple-500/20">
                        <MegaphoneIcon className="size-4 text-purple-400" />
                        {adActive && (
                          <span className="absolute -top-1 -right-1 flex size-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{ad.label || "Unnamed"}</p>
                          {ad.duration_ms ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                              {formatDuration(ad.duration_ms)}
                            </Badge>
                          ) : null}
                          {adRooms.map((rid) => (
                            <Badge key={rid} variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                              {ROOM_NAMES[rid] || `Room ${rid}`}
                            </Badge>
                          ))}
                          {adRooms.length === 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">All Rooms</Badge>
                          )}
                          {ad.schedule_type === 'interval' && ad.interval_minutes > 0 ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-mono">
                              <ClockIcon className="size-2.5 mr-0.5" />
                              Every {ad.interval_minutes}min
                              {ad.window_start && ad.window_end && ` (${ad.window_start}–${ad.window_end})`}
                            </Badge>
                          ) : adSchedule.length > 0 ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-mono">
                              <ClockIcon className="size-2.5 mr-0.5" />
                              {adSchedule.join(", ")}
                            </Badge>
                          ) : null}
                          {adActive && (
                            <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                              Playing
                            </Badge>
                          )}
                          {!ad.enabled && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 text-muted-foreground">
                              Disabled
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-mono truncate max-w-full sm:max-w-[240px]">{ad.original_filename || "—"}</span>
                          {(ad.total_plays != null) && (
                            <>
                              <span className="text-muted-foreground/40">•</span>
                              <span className="font-mono tabular-nums">{ad.total_plays || 0} plays</span>
                            </>
                          )}
                          {(ad.completed != null && ad.total_plays > 0) && (
                            <>
                              <span className="text-muted-foreground/40">•</span>
                              <span className="font-mono tabular-nums">
                                {Math.round(((ad.completed || 0) / ad.total_plays) * 100)}% completed
                              </span>
                            </>
                          )}
                        </div>
                        {playResult && playResult.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {playResult.map((r) => (
                              <span
                                key={r.room}
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border font-mono ${
                                  r.status === "playing"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : r.status === "room_busy"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                                }`}
                              >
                                {r.status === "playing"
                                  ? <CheckIcon className="size-2.5" />
                                  : <XIcon className="size-2.5" />}
                                {ROOM_NAMES[r.room] || r.room}
                                {r.status === "playing" && r.listenerCount != null && ` · ${r.listenerCount}`}
                                {r.status !== "playing" && ` · ${r.status.replace(/_/g, " ")}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="h-9 sm:h-8 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                        disabled={isPlaying || !ad.enabled}
                        onClick={() => handlePlay(ad.id)}
                      >
                        {isPlaying
                          ? <Loader2Icon className="size-3 animate-spin mr-1.5" />
                          : <PlayIcon className="size-3 mr-1.5" />}
                        Play
                      </Button>
                      {adActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 sm:h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                          disabled={isStopping}
                          onClick={() => handleStop(ad.id)}
                        >
                          {isStopping
                            ? <Loader2Icon className="size-3 animate-spin mr-1.5" />
                            : <StopCircleIcon className="size-3 mr-1.5" />}
                          Stop
                        </Button>
                      )}
                      <Switch
                        checked={!!ad.enabled}
                        onCheckedChange={() => toggleEnabled(ad)}
                        className="data-checked:bg-emerald-500"
                      />
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(ad)}>
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive"
                        onClick={() => setDeleteId(ad.id)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-border/40">
        <CardHeader className="pb-0">
          <button
            className="flex items-center justify-between w-full cursor-pointer"
            onClick={() => setLogOpen(o => !o)}
          >
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <PlayIcon className="size-3.5 text-purple-400" />
              Play History
              {logTotal > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground/40 font-normal ml-1">
                  {logTotal.toLocaleString()} entries
                </span>
              )}
            </CardTitle>
            {logOpen
              ? <ChevronUpIcon className="size-4 text-muted-foreground" />
              : <ChevronDownIcon className="size-4 text-muted-foreground" />}
          </button>
        </CardHeader>

        {logOpen && (
          <CardContent className="pt-3 px-0">
            {logLoading ? (
              <div className="space-y-2 px-6 py-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : log.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No play history yet</p>
            ) : (
              <>
                <div className="space-y-2 px-3 pb-3 md:hidden">
                  {log.map((entry) => {
                    const ad = ads.find(a => a.id === entry.ad_id);
                    const completed = !!entry.completed;
                    return (
                      <div key={entry.id} className="rounded-xl border border-border/60 bg-card/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{ad?.label || entry.ad_label || `Ad #${entry.ad_id}`}</p>
                            <p className="mt-1 text-xs font-mono tabular-nums text-muted-foreground">{formatTimestamp(entry.started_at || entry.created_at)}</p>
                          </div>
                          {completed ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400">
                              <CheckIcon className="size-3" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] text-red-400">
                              <XIcon className="size-3" />
                              Interrupted
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-md border border-border/60 px-2 py-1">{ROOM_NAMES[entry.room] || entry.room_name || `Room ${entry.room}`}</span>
                          <span className="rounded-md border border-border/60 px-2 py-1 font-mono tabular-nums">{formatDuration(entry.duration_played_ms)}</span>
                          <span className="rounded-md border border-border/60 px-2 py-1 font-mono tabular-nums">{entry.listener_count ?? "—"} listeners</span>
                        </div>
                        {entry.interrupted_by && (
                          <p className="mt-2 text-xs text-muted-foreground/70">Interrupted by {entry.interrupted_by}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Date</TableHead>
                      <TableHead>Announcement</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Interrupted By</TableHead>
                      <TableHead className="pr-6 text-right">Listeners</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {log.map((entry) => {
                      const ad = ads.find(a => a.id === entry.ad_id);
                      const completed = !!entry.completed;
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="pl-6">
                            <span className="text-sm font-mono tabular-nums text-muted-foreground">
                              {formatTimestamp(entry.started_at || entry.created_at)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">
                              {ad?.label || entry.ad_label || `Ad #${entry.ad_id}`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {ROOM_NAMES[entry.room] || entry.room_name || `Room ${entry.room}`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-mono tabular-nums text-muted-foreground">
                              {formatDuration(entry.duration_played_ms)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {completed ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                                <CheckIcon className="size-3" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-red-400">
                                <XIcon className="size-3" />
                                Interrupted
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {entry.interrupted_by || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <span className="text-sm font-mono tabular-nums text-muted-foreground">
                              {entry.listener_count ?? "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>

                {logTotalPages > 1 && (
                  <div className="flex flex-col gap-3 px-4 py-3 border-t border-border/30 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <span className="text-xs text-muted-foreground">
                      Showing{" "}
                      <span className="font-mono tabular-nums">{((logPage - 1) * logPageSize) + 1}</span>
                      –
                      <span className="font-mono tabular-nums">{Math.min(logPage * logPageSize, logTotal)}</span>
                      {" "}of{" "}
                      <span className="font-mono tabular-nums">{logTotal.toLocaleString()}</span>
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7" disabled={logPage <= 1} onClick={() => setLogPage(1)}>
                        <ChevronsLeftIcon className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>
                        <ChevronLeftIcon className="size-3.5" />
                      </Button>
                      <span className="px-2 text-xs font-mono tabular-nums text-muted-foreground">
                        {logPage} / {logTotalPages}
                      </span>
                      <Button variant="ghost" size="icon" className="size-7" disabled={logPage >= logTotalPages} onClick={() => setLogPage(p => p + 1)}>
                        <ChevronRightIcon className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" disabled={logPage >= logTotalPages} onClick={() => setLogPage(logTotalPages)}>
                        <ChevronsRightIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Announcement" : "Upload Announcement"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update label, room assignment, and enabled state."
                : "Upload an audio file and assign it to conference rooms."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                placeholder="e.g. Summer Promo"
                value={form.label}
                onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Audio File{editing && " (upload to replace)"}</Label>
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40 cursor-pointer hover:bg-muted/50 transition-colors">
                <FileAudioIcon className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground break-all">
                  {audioFile ? audioFile.name : editing?.original_filename || "Choose audio file..."}
                </span>
                {audioDuration != null ? (
                  <span className="ml-auto text-xs font-mono text-muted-foreground/60 shrink-0">
                    {formatAudioDuration(audioDuration)}
                  </span>
                ) : editing?.duration_ms ? (
                  <span className="ml-auto text-xs font-mono text-muted-foreground/60 shrink-0">
                    {formatDuration(editing.duration_ms)}
                  </span>
                ) : null}
                <input
                  type="file"
                  accept=".wav,.mp3,.ogg,.m4a"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            <div className="space-y-2">
              <Label>Rooms</Label>
              <div className="rounded-lg bg-muted/30 border border-border/40 divide-y divide-border/30">
                {Object.entries(ROOM_NAMES).length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">No rooms configured</p>
                ) : (
                  Object.entries(ROOM_NAMES).map(([id, name]) => {
                    const checked = form.rooms.includes(parseInt(id));
                    return (
                      <label
                        key={id}
                        className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                      >
                        <span className="text-sm">{name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRoom(id)}
                          className="size-4 rounded border-border accent-purple-500"
                        />
                      </label>
                    );
                  })
                )}
              </div>
              {form.rooms.length === 0 && (
                <p className="text-[11px] text-muted-foreground/60">No rooms selected — announcement will play in all rooms</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <ClockIcon className="size-3.5" />
                Schedule
              </Label>
              <div className="flex gap-1 rounded-lg bg-muted/30 border border-border/40 p-1">
                {[
                  { value: "none", label: "Manual" },
                  { value: "times", label: "Specific Times" },
                  { value: "interval", label: "Interval" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${
                      form.schedule_type === opt.value
                        ? "bg-background text-foreground shadow-sm border border-border/40"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setForm(f => ({ ...f, schedule_type: opt.value }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.schedule_type === "times" && (
              <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-2">
                {form.schedule_times.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.schedule_times.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono"
                      >
                        {t}
                        <button
                          type="button"
                          className="hover:text-red-400 transition-colors"
                          onClick={() => setForm(f => ({ ...f, schedule_times: f.schedule_times.filter(x => x !== t) }))}
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    className="w-32 h-8 text-sm font-mono"
                    id="schedule-time-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.target.value;
                        if (val && !form.schedule_times.includes(val)) {
                          setForm(f => ({ ...f, schedule_times: [...f.schedule_times, val].sort() }));
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const input = document.getElementById('schedule-time-input');
                      const val = input?.value;
                      if (val && !form.schedule_times.includes(val)) {
                        setForm(f => ({ ...f, schedule_times: [...f.schedule_times, val].sort() }));
                        input.value = '';
                      }
                    }}
                  >
                    <PlusCircleIcon className="size-3 mr-1" />
                    Add
                  </Button>
                </div>
                {form.schedule_times.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/60">Add times when this announcement should play</p>
                )}
              </div>
            )}

            {form.schedule_type === "interval" && (
              <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Play every</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="5"
                      max="480"
                      className="w-20 h-8 text-sm font-mono"
                      value={form.interval_minutes}
                      onChange={(e) => setForm(f => ({ ...f, interval_minutes: parseInt(e.target.value) || 30 }))}
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Active window</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      className="w-28 h-8 text-sm font-mono"
                      value={form.window_start}
                      onChange={(e) => setForm(f => ({ ...f, window_start: e.target.value }))}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      className="w-28 h-8 text-sm font-mono"
                      value={form.window_end}
                      onChange={(e) => setForm(f => ({ ...f, window_end: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {form.schedule_type !== "none" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Timezone</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    Local time: {getLocalTimeStr(form.timezone)}
                  </span>
                </div>
                <select
                  className="w-full h-9 px-3 rounded-md bg-muted/30 border border-border/40 text-sm"
                  value={form.timezone}
                  onChange={(e) => setForm(f => ({ ...f, timezone: e.target.value }))}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40">
              <Label className="text-sm">Enabled</Label>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm(f => ({ ...f, enabled: v }))}
                className="data-checked:bg-emerald-500"
              />
            </div>

            <Button
              className="w-full mt-2"
              onClick={handleSave}
              disabled={saving || (!editing && !audioFile)}
            >
              {saving ? "Saving..." : editing ? "Update Announcement" : "Upload Announcement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
            <DialogDescription>
              Are you sure? This announcement and its play history will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
