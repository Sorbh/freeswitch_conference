import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useFetch } from "@/hooks/useFetch";
import { formatDuration } from "@/lib/constants";
import {
  ClockIcon,
  WifiIcon,
  WifiOffIcon,
  ActivityIcon,
  SearchIcon,
} from "lucide-react";

function formatTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleTimeString();
}

export default function HistoryPage() {
  const [selectedUser, setSelectedUser] = useState("");
  const { data: users, loading: usersLoading } = useFetch("/api/v1/admin/users");
  const { data: userData, loading: userLoading } = useFetch(
    selectedUser ? `/api/v1/admin/users/${selectedUser}` : null,
    selectedUser ? 15000 : null
  );

  const userList = Array.isArray(users) ? users : [];
  const history = userData?.onlineHistory || [];

  const totalOnlineMs = history
    .filter((h) => h.event === "online" && h.duration)
    .reduce((sum, h) => sum + (h.duration || 0), 0);

  const totalTimeMs = 24 * 60 * 60 * 1000;
  const uptimePercent = totalTimeMs > 0 ? ((totalOnlineMs / totalTimeMs) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Online History</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Track user connectivity patterns and uptime
        </p>
      </div>

      <div className="max-w-sm space-y-2">
        <Label className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
          Select User
        </Label>
        {usersLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select value={selectedUser} onValueChange={setSelectedUser} items={Object.fromEntries(userList.map(u => [u.userName, `${u.userName}${u.callerIdName ? ` (${u.callerIdName})` : ""}`]))}>
            <SelectTrigger className="!w-full">
              <SelectValue placeholder="Choose a user to view history..." />
            </SelectTrigger>
            <SelectContent>
              {userList.map((u) => (
                <SelectItem key={u.userName} value={u.userName}>
                  {u.userName} {u.callerIdName ? `(${u.callerIdName})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedUser && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <SearchIcon className="size-10 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground text-sm">
              Select a user to view history
            </p>
          </CardContent>
        </Card>
      )}

      {selectedUser && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Online Time
                    </p>
                    <p className="text-3xl font-mono font-bold tabular-nums mt-1">
                      {formatDuration(totalOnlineMs)}
                    </p>
                  </div>
                  <div className="text-muted-foreground/40">
                    <ClockIcon className="size-5" />
                  </div>
                </div>
              </CardContent>
              <div className="h-0.5 bg-blue-500" />
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Uptime
                    </p>
                    <p className="text-3xl font-mono font-bold tabular-nums mt-1">
                      {uptimePercent}%
                    </p>
                  </div>
                  <div className="text-muted-foreground/40">
                    <WifiIcon className="size-5" />
                  </div>
                </div>
              </CardContent>
              <div className="h-0.5 bg-green-500" />
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Sessions
                    </p>
                    <p className="text-3xl font-mono font-bold tabular-nums mt-1">
                      {history.length}
                    </p>
                  </div>
                  <div className="text-muted-foreground/40">
                    <ActivityIcon className="size-5" />
                  </div>
                </div>
              </CardContent>
              <div className="h-0.5 bg-cyan-500" />
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Event Timeline</CardTitle>
              <CardDescription>Chronological record of connectivity events</CardDescription>
            </CardHeader>
            <CardContent>
              {userLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <WifiOffIcon className="size-8 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-sm">No history recorded for this user</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="relative pl-6">
                    <div className="absolute left-[3px] top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-0">
                      {history.map((h, i) => {
                        const isOnline = h.event === "online";
                        return (
                          <div key={i} className="relative flex items-center gap-4 py-3">
                            <div className="absolute -left-6 top-1/2 -translate-y-1/2">
                              <span
                                className={`inline-block size-2 rounded-full ${
                                  isOnline ? "bg-green-500" : "bg-red-500"
                                }`}
                              />
                            </div>
                            <div className="flex-1 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium ${isOnline ? "text-green-500" : "text-red-500"}`}>
                                  {isOnline ? "Online" : "Offline"}
                                </span>
                                {h.details && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {h.details}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                {h.duration && (
                                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                    {formatDuration(h.duration)}
                                  </span>
                                )}
                                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                  {formatTime(h.timestamp || h.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
