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

  const fsRunning = data?.freeswitchStatus === "running";
  const eslOk = data?.eslConnected;

  const cards = [
    {
      title: "FreeSWITCH",
      value: data?.freeswitchStatus || "Unknown",
      icon: <ServerIcon className="size-4" />,
      status: fsRunning ? "healthy" : "down",
    },
    {
      title: "Uptime",
      value: formatUptimeSeconds(data?.uptime),
      icon: <ClockIcon className="size-4" />,
      status: data?.uptime > 0 ? "healthy" : "down",
    },
    {
      title: "Database",
      value: formatBytes(data?.dbSize),
      icon: <DatabaseIcon className="size-4" />,
      status: "healthy",
    },
    {
      title: "ESL Connection",
      value: eslOk ? "Connected" : "Disconnected",
      icon: <CableIcon className="size-4" />,
      status: eslOk ? "healthy" : "down",
    },
    {
      title: "Registrations",
      value: data?.registrationCount ?? 0,
      icon: <UsersIcon className="size-4" />,
      status: "healthy",
    },
    {
      title: "Memory",
      value: data?.memoryUsage ? formatBytes(data.memoryUsage.rss || data.memoryUsage) : "-",
      icon: <CpuIcon className="size-4" />,
      status: "healthy",
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
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                {card.icon}
                <span className="text-xs uppercase tracking-wider font-medium">
                  {card.title}
                </span>
              </div>
              <p className="text-2xl font-mono font-bold tabular-nums mb-2">
                {card.value}
              </p>
              <StatusDot status={card.status} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
