import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Input } from "@/components/ui/input";
import {
  PlayIcon, PauseIcon, Trash2Icon, SearchIcon, DownloadIcon,
} from "lucide-react";

const MAX_LINES = 2000;
const ROW_HEIGHT = 28;

const TAG_COLORS = {
  REG:    { bg: "#ec4899", fg: "#fff" },
  CALL:   { bg: "#22c55e", fg: "#052e16" },
  ACTION: { bg: "#3b82f6", fg: "#fff" },
  BCAST:  { bg: "#f97316", fg: "#fff" },
  ALIVE:  { bg: "#6b7280", fg: "#fff" },
  POLL:   { bg: "#6b7280", fg: "#fff" },
  API:    { bg: "#06b6d4", fg: "#042f2e" },
  HOOK:   { bg: "#eab308", fg: "#1a1a00" },
  PHONE:  { bg: "#a78bfa", fg: "#1e1b4b" },
};

const EMAIL_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f43f5e", "#84cc16", "#14b8a6", "#6366f1",
];
const emailColorCache = new Map();
let emailColorIdx = 0;
function getEmailColor(email) {
  if (!email) return "#3f3f46";
  if (emailColorCache.has(email)) return emailColorCache.get(email);
  const color = EMAIL_PALETTE[emailColorIdx % EMAIL_PALETTE.length];
  emailColorIdx++;
  emailColorCache.set(email, color);
  return color;
}

function formatTs(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, hour12: false });
}

function parseTag(line) {
  const match = line.match(/^(\S+)\s+(.*)/);
  if (match) return { tag: match[1], message: match[2] };
  return { tag: "", message: line };
}

export default function ServerLogsPage() {
  const [active, setActive] = useState(true);
  const [search, setSearch] = useState("");
  const [emailFilter, setEmailFilter] = useState("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef(null);
  const activeRef = useRef(true);
  const logsRef = useRef([]);
  const idCounter = useRef(0);
  const [logs, setLogs] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const es = new EventSource("/api/v1/admin/events/debug-log");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "connected" || !activeRef.current) return;
        const entries = (data.lines || []).map(line => ({
          _id: ++idCounter.current,
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

  const emails = useMemo(() => {
    const set = new Set();
    for (const l of logs) if (l.userName) set.add(l.userName);
    return [...set].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (emailFilter !== "all") result = result.filter(l => l.userName === emailFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.userName.toLowerCase().includes(q) || l.line.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, emailFilter, search]);

  const stats = useMemo(() => {
    return { total: logs.length, showing: filtered.length, users: emails.length };
  }, [logs, filtered, emails]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => filtered[index]?._id === expandedId ? 80 : ROW_HEIGHT,
    getItemKey: (index) => filtered[index]?._id || index,
    overscan: 20,
    measureElement: (el) => el?.getBoundingClientRect().height || ROW_HEIGHT,
  });

  const prevCountRef = useRef(0);
  useEffect(() => {
    if (!autoScroll || filtered.length <= prevCountRef.current) {
      prevCountRef.current = filtered.length;
      return;
    }
    prevCountRef.current = filtered.length;
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [filtered.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }, []);

  const handleClear = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
    emailColorCache.clear();
    emailColorIdx = 0;
  }, []);

  const exportCsv = useCallback(() => {
    const header = "timestamp,account,tag,message\n";
    const rows = filtered.map(l => {
      const { tag, message } = parseTag(l.line);
      return [formatTs(l.timestamp), l.userName, tag, `"${(message || "").replace(/"/g, '""')}"`].join(",");
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `server-logs-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] font-mono animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-baseline justify-between px-1 pb-2 shrink-0">
        <h2 className="text-base font-bold tracking-tight font-sans">Server Logs</h2>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          Total: <span className="text-foreground font-bold">{stats.total}</span>
          <span className="mx-1.5 text-border">|</span>
          Showing: <span className="text-foreground font-bold">{stats.showing}</span>
          <span className="mx-1.5 text-border">|</span>
          <span className="text-cyan-400">Users: <b>{stats.users}</b></span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-1 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
          <span>Account:</span>
          <select value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)}
            className="bg-muted/30 border border-border rounded px-2 py-1 text-[11px] text-foreground font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring max-w-[240px]">
            <option value="all">ALL</option>
            {emails.map(em => <option key={em} value={em}>{em}</option>)}
          </select>
        </div>

        <div className="relative flex-1 min-w-[120px]">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input placeholder="Search / highlight" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-[26px] w-full pl-7 text-[11px] font-mono bg-muted/30 border-border" />
        </div>

        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none shrink-0">
          <input type="checkbox" checked={autoScroll}
            onChange={(e) => { setAutoScroll(e.target.checked); if (e.target.checked && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }}
            className="rounded size-3.5 accent-primary" />
          Auto-scroll
        </label>

        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setActive(!active)}
            className={`flex items-center gap-1 px-3 py-1 rounded text-[11px] font-bold transition-colors ${active ? "bg-red-500/90 text-white hover:bg-red-500" : "bg-green-500/90 text-white hover:bg-green-500"}`}>
            {active ? <><PauseIcon className="size-3" />Pause</> : <><PlayIcon className="size-3" />Resume</>}
          </button>
          <button onClick={handleClear}
            className="flex items-center gap-1 px-3 py-1 rounded text-[11px] font-bold bg-muted/40 text-foreground hover:bg-muted/70 transition-colors border border-border">
            <Trash2Icon className="size-3" />Clear
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-1 px-3 py-1 rounded text-[11px] font-bold bg-muted/40 text-foreground hover:bg-muted/70 transition-colors border border-border">
            <DownloadIcon className="size-3" />CSV
          </button>
        </div>
      </div>

      {/* Column header */}
      <div className="flex items-center text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold py-1 border-b border-border shrink-0 select-none" style={{ paddingLeft: "7px" }}>
        <span className="w-[110px] shrink-0">Time</span>
        <span className="w-[240px] shrink-0">Account</span>
        <span className="w-[70px] shrink-0">Tag</span>
        <span className="flex-1 min-w-0">Message</span>
      </div>

      {/* Log stream — virtualized */}
      <div className="flex-1 overflow-auto min-h-0 px-1 pt-1" ref={scrollRef} onScroll={handleScroll}>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            {active ? "Waiting for debug logs…" : "Stream paused."}
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const entry = filtered[vRow.index];
              const isExpanded = entry._id === expandedId;
              return (
                <div key={vRow.key} data-index={vRow.index}
                  ref={virtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}>
                  <LogRow entry={entry} search={search} expanded={isExpanded}
                    onToggle={() => setExpandedId(isExpanded ? null : entry._id)} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({ entry, search, expanded, onToggle }) {
  const { tag, message } = parseTag(entry.line);
  const tagStyle = TAG_COLORS[tag] || { bg: "#3f3f46", fg: "#e4e4e7" };
  const emailColor = getEmailColor(entry.userName);

  return (
    <div className="text-[11.5px] leading-none select-none pl-1 hover:bg-white/[0.04] cursor-pointer"
      onClick={onToggle}
      style={{ minHeight: ROW_HEIGHT, borderLeft: `3px solid ${emailColor}`, backgroundColor: `${emailColor}08` }}>
      <div className="flex items-center" style={{ height: ROW_HEIGHT }}>
        <span className="text-muted-foreground tabular-nums w-[110px] shrink-0">{formatTs(entry.timestamp)}</span>
        <span className="w-[240px] shrink-0 truncate pr-2" style={{ color: emailColor }}>{entry.userName}</span>
        <span className="w-[70px] shrink-0 pr-2">
          {tag && (
            <span className="inline-flex items-center px-1.5 py-[2px] rounded text-[10px] font-black leading-none"
              style={{ backgroundColor: tagStyle.bg, color: tagStyle.fg }}>
              {tag}
            </span>
          )}
        </span>
        <span className={`flex-1 min-w-0 pr-2 text-foreground/80 ${expanded ? "" : "truncate"}`}>
          {search ? highlightText(message, search) : message}
        </span>
      </div>
      {expanded && (
        <div className="py-1.5 px-2 ml-[110px] mr-4 mb-1.5 text-[11px] text-foreground/70 bg-white/[0.03] rounded border border-border/40 whitespace-pre-wrap break-all">
          {message}
        </div>
      )}
    </div>
  );
}

function highlightText(text, search) {
  if (!search || !text) return text;
  const q = search.toLowerCase();
  const parts = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const idx = remaining.toLowerCase().indexOf(q);
    if (idx === -1) { parts.push(remaining); break; }
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push(
      <mark key={key++} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">{remaining.slice(idx, idx + search.length)}</mark>
    );
    remaining = remaining.slice(idx + search.length);
  }
  return parts;
}
