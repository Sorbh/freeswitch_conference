import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TerminalIcon, Trash2Icon, SearchIcon, XIcon, PauseIcon, PlayIcon,
  ArrowDownIcon,
} from "lucide-react";

const MAX_LINES = 2000;

export default function ServerLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef(null);
  const pausedRef = useRef(false);
  const logsRef = useRef([]);
  const idCounter = useRef(0);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const es = new EventSource("/api/v1/admin/events/debug-log");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "connected") return;
        if (pausedRef.current) return;
        const entries = (data.lines || []).map(line => ({
          id: ++idCounter.current,
          userName: data.userName,
          line,
          timestamp: data.timestamp,
        }));
        logsRef.current = [...logsRef.current, ...entries].slice(-MAX_LINES);
        setLogs([...logsRef.current]);
      } catch {}
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!autoScroll || paused) return;
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, autoScroll, paused]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(atBottom);
  }, []);

  const clear = () => { logsRef.current = []; setLogs([]); };

  const filtered = search
    ? logs.filter(l => l.userName.toLowerCase().includes(search.toLowerCase()) || l.line.toLowerCase().includes(search.toLowerCase()))
    : logs;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Server Logs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live debug logs from accounts with debug enabled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] tabular-nums">
            {logs.length} / {MAX_LINES}
          </Badge>
        </div>
      </div>

      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TerminalIcon className="size-3.5 text-cyan-400" />
              Debug Stream
              {paused && <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] px-1.5 py-0">Paused</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  placeholder="Filter logs..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-7 pl-7 pr-7 text-xs"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <XIcon className="size-3" />
                  </button>
                )}
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setPaused(p => !p)}>
                {paused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={clear}>
                <Trash2Icon className="size-3.5" />
              </Button>
              {!autoScroll && (
                <Button variant="ghost" size="icon" className="size-7" onClick={() => { setAutoScroll(true); const el = containerRef.current; if (el) el.scrollTop = el.scrollHeight; }}>
                  <ArrowDownIcon className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="h-[calc(100vh-280px)] overflow-y-auto font-mono text-[11px] leading-relaxed bg-black/20 border-t border-border/20"
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
                <TerminalIcon className="size-8 mb-2 opacity-30" />
                <p className="text-xs">{logs.length === 0 ? "Waiting for debug logs..." : "No matching logs"}</p>
                <p className="text-[10px] mt-1 text-muted-foreground/25">Enable debug on an account to see logs here</p>
              </div>
            ) : (
              <table className="w-full">
                <tbody>
                  {filtered.map(entry => (
                    <tr key={entry.id} className="hover:bg-white/[0.02] border-b border-border/5">
                      <td className="px-3 py-0.5 text-muted-foreground/30 whitespace-nowrap align-top w-16 tabular-nums">
                        {new Date(entry.timestamp * 1000).toLocaleTimeString("en-US", { hour12: false })}
                      </td>
                      <td className="px-2 py-0.5 text-cyan-400/70 whitespace-nowrap align-top w-48 truncate max-w-[200px]">
                        {entry.userName}
                      </td>
                      <td className="px-2 py-0.5 text-foreground/80 whitespace-pre-wrap break-all">
                        {entry.line}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
