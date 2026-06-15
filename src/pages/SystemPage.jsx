import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { apiFetch } from "@/lib/api";
import { formatUptimeSeconds, formatBytes } from "@/lib/constants";
import {
  ServerIcon,
  DatabaseIcon,
  CableIcon,
  ClockIcon,
  UsersIcon,
  CpuIcon,
  HardDriveIcon,
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  XCircleIcon,
  RefreshCwIcon,
  Loader2Icon,
  RadioIcon,
  WifiIcon,
} from "lucide-react";

function StatusDot({ status }) {
  const color = status === "healthy" ? "bg-green-500" : status === "degraded" ? "bg-yellow-500" : "bg-red-500";
  const label = status === "healthy" ? "Healthy" : status === "degraded" ? "Degraded" : "Down";
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`inline-block size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default function SystemPage() {
  const { data, loading, refetch } = useFetch("/api/v1/admin/system");
  useSSERefresh(refetch, ["users", "dashboard"]);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const fsStatus = data?.freeswitchStatus;
  const fsRunning = fsStatus === "running" || fsStatus === "connected";
  const eslOk = data?.eslConnected;
  const mem = data?.memoryUsage || {};

  const cards = [
    {
      title: "FreeSWITCH",
      value: fsRunning ? "Running" : data?.freeswitchStatus || "Unknown",
      icon: <ServerIcon className="size-4" />,
      status: fsRunning ? "healthy" : "down",
    },
    {
      title: "ESL Connection",
      value: eslOk ? "Connected" : "Disconnected",
      icon: <CableIcon className="size-4" />,
      status: eslOk ? "healthy" : "down",
    },
    {
      title: "Server Uptime",
      value: formatUptimeSeconds(data?.uptime),
      icon: <ClockIcon className="size-4" />,
      status: data?.uptime > 0 ? "healthy" : "down",
    },
    {
      title: "Database Size",
      value: formatBytes(data?.dbSize),
      icon: <DatabaseIcon className="size-4" />,
      status: "healthy",
    },
    {
      title: "Online Users",
      value: `${data?.registrationCount ?? 0} / ${data?.totalUsers ?? 0}`,
      icon: <UsersIcon className="size-4" />,
      status: "healthy",
    },
    {
      title: "Memory (RSS)",
      value: formatBytes(mem.rss),
      icon: <CpuIcon className="size-4" />,
      status: mem.rss > 500 * 1024 * 1024 ? "degraded" : "healthy",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Health</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Infrastructure status and monitoring
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  {card.icon}
                  <span className="text-xs uppercase tracking-wider font-medium">
                    {card.title}
                  </span>
                </div>
                <StatusDot status={card.status} />
              </div>
              <p className="text-2xl font-mono font-bold tabular-nums">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <CpuIcon className="size-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Memory Breakdown</span>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: "RSS", value: formatBytes(mem.rss) },
                { label: "Heap Total", value: formatBytes(mem.heapTotal) },
                { label: "Heap Used", value: formatBytes(mem.heapUsed) },
                { label: "External", value: formatBytes(mem.external) },
                { label: "Array Buffers", value: formatBytes(mem.arrayBuffers) },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-xs">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <HardDriveIcon className="size-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Environment</span>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: "Node.js", value: data?.nodeVersion },
                { label: "Platform", value: data?.platform },
                { label: "In-Call Users", value: data?.connectedCount ?? 0 },
                { label: "Total Users", value: data?.totalUsers ?? 0 },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-xs">{String(item.value || "-")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AudioHealthSection />

    </div>
  );
}

function AudioHealthSection() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/admin/system/audio-health");
      const json = await res.json();
      if (json.status) setHealth(json.data);
      else setError(json.error || "Check failed");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const StatusIcon = ({ status }) => {
    if (status === "healthy") return <CheckCircle2Icon className="size-3.5 text-emerald-400" />;
    if (status === "warning") return <AlertTriangleIcon className="size-3.5 text-amber-400" />;
    return <XCircleIcon className="size-3.5 text-red-400" />;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ActivityIcon className="size-4 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Audio Health Check</span>
          {health && (
            <span className="text-[10px] text-muted-foreground/40 font-mono">
              {new Date(health.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={runCheck} disabled={loading}>
          {loading ? <Loader2Icon className="size-3 animate-spin mr-1.5" /> : <RefreshCwIcon className="size-3 mr-1.5" />}
          {health ? "Re-check" : "Run Check"}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/20">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {!health && !loading && !error && (
        <Card className="border-dashed border-border/40">
          <CardContent className="py-12 text-center">
            <ActivityIcon className="size-8 text-muted-foreground/15 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/50">Click "Run Check" to scan all connected users for audio issues</p>
            <p className="text-[11px] text-muted-foreground/30 mt-1">Checks FS channels, conference members, and media connectivity</p>
          </CardContent>
        </Card>
      )}

      {loading && !health && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/50">Checking audio paths…</p>
          </CardContent>
        </Card>
      )}

      {health && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: "In Conference", value: health.totalInConference, icon: <RadioIcon className="size-3.5" />, color: "#3b82f6" },
              { label: "FS Channels", value: health.totalInCall, icon: <CableIcon className="size-3.5" />, color: "#8b5cf6" },
              { label: "Healthy", value: health.healthy, icon: <CheckCircle2Icon className="size-3.5" />, color: "#10b981" },
              { label: "Warnings", value: health.warnings, icon: <AlertTriangleIcon className="size-3.5" />, color: health.warnings > 0 ? "#f59e0b" : "#6b7280" },
            ].map(c => (
              <Card key={c.label} className="border-border/40">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <span style={{ color: c.color }}>{c.icon}</span>
                    <span className="text-[10px] uppercase tracking-wider font-medium">{c.label}</span>
                  </div>
                  <p className="text-xl font-mono font-bold tabular-nums">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stuck users */}
          {health.stuckUsers.length > 0 && (
            <Card className="border-amber-500/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangleIcon className="size-4 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Stuck Users — connected in DB but no FS channel</span>
                </div>
                <div className="space-y-1.5">
                  {health.stuckUsers.map((u, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/10 text-sm">
                      <span className="font-mono text-xs">{u.userName}</span>
                      <span className="text-[11px] text-muted-foreground">{u.roomName}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Zombie channels */}
          {health.zombieChannels.length > 0 && (
            <Card className="border-red-500/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <XCircleIcon className="size-4 text-red-400" />
                  <span className="text-xs font-medium text-red-400">Zombie Channels — active in FS but not in any conference</span>
                </div>
                <div className="space-y-1.5">
                  {health.zombieChannels.map((z, i) => (
                    <div key={i} className="py-1.5 px-3 rounded-lg bg-red-500/[0.04] border border-red-500/10 text-xs font-mono text-muted-foreground">
                      {z.uuid}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-room member health */}
          {health.rooms.map(room => (
            <Card key={room.roomName} className="border-border/40">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <RadioIcon className="size-3.5 text-muted-foreground/50" />
                    <span className="text-sm font-medium">{room.roomDisplayName}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{room.memberCount} members</Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground/40 font-mono">up {Math.floor(room.runTime / 60)}m</span>
                </div>
                <div className="rounded-lg border border-border/30 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/20">
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground/60 w-8"></th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground/60">User</th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground/60">Media IP</th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground/60">Port</th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground/60">Joined</th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground/60">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {room.members.map(m => (
                        <tr key={m.uuid} className={m.status !== 'healthy' ? 'bg-amber-500/[0.03]' : 'hover:bg-muted/20'}>
                          <td className="py-1.5 px-3">
                            <StatusIcon status={m.status} />
                          </td>
                          <td className="py-1.5 px-3">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block max-w-[160px] cursor-default">{m.displayName}</span>
                              </TooltipTrigger>
                              <TooltipContent><span className="font-mono text-xs">{m.callerIdNumber}</span></TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="py-1.5 px-3 font-mono text-muted-foreground/70">{m.remoteIp || "—"}</td>
                          <td className="py-1.5 px-3 font-mono text-muted-foreground/70">{m.remotePort || "—"}</td>
                          <td className="py-1.5 px-3 font-mono text-muted-foreground/50 tabular-nums">
                            {m.joinTimeSec >= 60 ? `${Math.floor(m.joinTimeSec / 60)}m` : `${m.joinTimeSec}s`}
                          </td>
                          <td className="py-1.5 px-3">
                            {m.issues.length > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20 cursor-default">
                                    {m.issues.length} issue{m.issues.length > 1 ? 's' : ''}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>{m.issues.join(', ')}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-emerald-400/70 text-[10px]">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
