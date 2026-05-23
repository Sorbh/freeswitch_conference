import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSSE } from "@/hooks/useSSE";
import { ROOM_NAMES, EVENT_COLORS } from "@/lib/constants";
import { PlayIcon, PauseIcon, Trash2Icon } from "lucide-react";

function formatTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString();
}

export default function EventsPage() {
  const [active, setActive] = useState(true);
  const [filter, setFilter] = useState("all");
  const { events, clear } = useSSE("/api/v1/admin/events/stream", active);
  const scrollRef = useRef(null);

  const filteredEvents =
    filter === "all"
      ? events
      : events.filter(
          (e) => (e.event_type || e.type || "").toLowerCase() === filter
        );

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [filteredEvents.length]);

  const eventTypes = [
    "all",
    ...new Set(events.map((e) => (e.event_type || e.type || "unknown").toLowerCase())),
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Live Events</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time event stream from the conference system
            </p>
          </div>
          {active && (
            <span className="relative flex size-2 mt-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-green-500" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "all" ? "All Events" : t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={active ? "default" : "outline"}
            className="h-8 text-xs gap-1.5"
            onClick={() => setActive(!active)}
          >
            {active ? (
              <>
                <PauseIcon className="size-3" />
                Pause
              </>
            ) : (
              <>
                <PlayIcon className="size-3" />
                Resume
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={clear}
          >
            <Trash2Icon className="size-3" />
            Clear
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider font-medium text-muted-foreground flex items-center justify-between">
            <span>Event Feed</span>
            <span className="font-mono tabular-nums">{filteredEvents.length} events</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className="h-[calc(100vh-300px)] min-h-[400px] overflow-auto"
            ref={scrollRef}
          >
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <p className="text-muted-foreground text-sm">
                  {active
                    ? "Waiting for events..."
                    : "Stream paused. Click Resume to continue."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredEvents.map((event) => {
                  const type = (
                    event.event_type || event.type || "unknown"
                  ).toLowerCase();
                  const dotColor = EVENT_COLORS[type] || "#71717a";
                  const roomId = event.room || event.roomId;

                  return (
                    <div
                      key={event._id || event.id}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/30 transition-colors"
                    >
                      <span className="font-mono text-xs text-muted-foreground tabular-nums w-[72px] shrink-0">
                        {formatTime(event.created_at || event.timestamp)}
                      </span>
                      <span
                        className="inline-block size-2 rounded-full shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span className="font-medium whitespace-nowrap shrink-0">
                        {event.user_name || event.userName || "-"}
                      </span>
                      {roomId && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {ROOM_NAMES[roomId] || roomId}
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs truncate">
                        {typeof event.details === "string"
                          ? event.details
                          : event.details
                          ? JSON.stringify(event.details)
                          : type.replace("_", " ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
