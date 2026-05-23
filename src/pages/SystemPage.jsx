import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/useFetch";
import { formatUptimeSeconds, formatBytes } from "@/lib/constants";
import {
  ServerIcon,
  DatabaseIcon,
  CableIcon,
  ClockIcon,
  UsersIcon,
  CpuIcon,
  HardDriveIcon,
  GlobeIcon,
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
  const { data, loading } = useFetch("/api/v1/admin/system", 15000);

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

      {data?.conferenceList && (
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <GlobeIcon className="size-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Active Conferences</span>
            </div>
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-md p-3 overflow-auto max-h-60">
              {data.conferenceList || "No active conferences"}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
