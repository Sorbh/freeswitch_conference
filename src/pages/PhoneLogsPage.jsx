import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Input } from "@/components/ui/input";
import { useSSE } from "@/hooks/useSSE";
import { apiFetch } from "@/lib/api";
import {
  PlayIcon,
  PauseIcon,
  Trash2Icon,
  SearchIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  ChevronDownIcon,
} from "lucide-react";

const MAX_LINES = 2000;
const ROW_HEIGHT = 28;
const EXPANDED_HEIGHT = 320;

function localTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, hour12: false });
}

const LEVEL_BADGE = {
  ERROR:   { bg: "#ef4444", fg: "#fff" },
  WARN:    { bg: "#f97316", fg: "#fff" },
  NOTICE:  { bg: "#22c55e", fg: "#052e16" },
  INFO:    { bg: "#3b82f6", fg: "#fff" },
  DEBUG:   { bg: "#6b7280", fg: "#fff" },
};

const METHOD_BADGE = {
  INVITE:    { bg: "#22c55e", fg: "#052e16" },
  ACK:       { bg: "#34d399", fg: "#052e16" },
  BYE:       { bg: "#ef4444", fg: "#fff" },
  CANCEL:    { bg: "#f97316", fg: "#fff" },
  REGISTER:  { bg: "#ec4899", fg: "#fff" },
  OPTIONS:   { bg: "#6b7280", fg: "#fff" },
  NOTIFY:    { bg: "#a78bfa", fg: "#1e1b4b" },
  SUBSCRIBE: { bg: "#818cf8", fg: "#1e1b4b" },
  MESSAGE:   { bg: "#06b6d4", fg: "#042f2e" },
  INFO:      { bg: "#8b5cf6", fg: "#fff" },
  UPDATE:    { bg: "#eab308", fg: "#1a1a00" },
  REFER:     { bg: "#f472b6", fg: "#1a1a1a" },
  PRACK:     { bg: "#a3a3a3", fg: "#1a1a1a" },
  PUBLISH:   { bg: "#2dd4bf", fg: "#042f2e" },
};

const CALL_ID_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f43f5e", "#84cc16", "#14b8a6", "#6366f1",
  "#d946ef", "#f59e0b", "#10b981", "#0ea5e9",
];

const callIdColorCache = new Map();
let callIdColorIdx = 0;

function getCallIdColor(callId) {
  if (!callId) return "#3f3f46";
  if (callIdColorCache.has(callId)) return callIdColorCache.get(callId);
  const color = CALL_ID_PALETTE[callIdColorIdx % CALL_ID_PALETTE.length];
  callIdColorIdx++;
  callIdColorCache.set(callId, color);
  return color;
}

function parseMethod(method) {
  if (!method) return { label: "???", badge: { bg: "#6b7280", fg: "#fff" }, code: null, methodName: null };
  const codeParts = method.match(/^(\d+)\s*(.*)/);
  if (codeParts) {
    const code = parseInt(codeParts[1]);
    return { label: codeParts[1], badge: getResponseBadge(code), code, methodName: null, statusText: codeParts[2] };
  }
  const name = method.split(" ")[0];
  return { label: name, badge: METHOD_BADGE[name] || { bg: "#6b7280", fg: "#fff" }, code: null, methodName: name };
}

function getResponseBadge(code) {
  if (code >= 100 && code < 200) return { bg: "#60a5fa", fg: "#1e1b4b" };
  if (code >= 200 && code < 300) return { bg: "#22c55e", fg: "#052e16" };
  if (code >= 300 && code < 400) return { bg: "#eab308", fg: "#1a1a00" };
  if (code >= 400 && code < 500) return { bg: "#ef4444", fg: "#fff" };
  if (code >= 500) return { bg: "#dc2626", fg: "#fff" };
  return { bg: "#6b7280", fg: "#fff" };
}

function extractEmail(sipUri) {
  if (!sipUri) return "";
  const uriMatch = sipUri.match(/sip:([^@;>]+(?:@[^;>]+)?)/);
  if (uriMatch) return uriMatch[1];
  return "";
}

function PhoneDropdown({ value, onChange, users, seenMacs }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const allOptions = useMemo(() => {
    const opts = [{ mac: "all", label: "ALL PHONES" }];
    for (const u of users) {
      opts.push({ mac: u.mac.toLowerCase(), label: `${u.callerIdName || u.userName} (${u.mac})` });
    }
    for (const m of seenMacs) {
      if (!users.some(u => u.mac?.toLowerCase() === m)) {
        opts.push({ mac: m, label: `Unknown (${m})` });
      }
    }
    return opts;
  }, [users, seenMacs]);

  const filtered = useMemo(() => {
    if (!query) return allOptions;
    const q = query.toLowerCase();
    return allOptions.filter(o => o.label.toLowerCase().includes(q) || o.mac.includes(q));
  }, [allOptions, query]);

  const selectedLabel = allOptions.find(o => o.mac === value)?.label || value;

  return (
    <div className="relative shrink-0" ref={ref}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>Phone:</span>
        <button
          onClick={() => { setOpen(!open); setQuery(""); }}
          className="bg-muted/30 border border-border rounded px-2 py-1 text-[11px] text-foreground font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring max-w-[240px] truncate text-left flex items-center gap-1"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/50" />
        </button>
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-background border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-1.5 border-b border-border/50">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or MAC..."
              className="w-full bg-muted/30 border border-border/50 rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-4">No matches</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.mac}
                  onClick={() => { onChange(opt.mac); setOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/40 transition-colors truncate ${value === opt.mac ? "bg-primary/10 text-primary font-semibold" : "text-foreground"}`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PhoneLogsPage() {
  const [active, setActive] = useState(true);
  const [sipOnly, setSipOnly] = useState(false);
  const [levelFilter, setLevelFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [macFilter, setMacFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mac")?.toLowerCase() || "all";
  });
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [users, setUsers] = useState([]);
  const sseUrl = macFilter !== "all"
    ? `/api/v1/admin/events/phone-log?mac=${encodeURIComponent(macFilter)}`
    : "/api/v1/admin/events/phone-log";
  const { events: rawEvents, clear: rawClear } = useSSE(sseUrl, active);
  const scrollRef = useRef(null);

  useEffect(() => {
    apiFetch("/api/v1/admin/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.status && data.data) {
          const withMac = data.data.filter((u) => u.mac);
          setUsers(withMac);
        }
      })
      .catch(() => {});
  }, []);

  const macToUser = useMemo(() => {
    const map = {};
    for (const u of users) {
      if (u.mac) map[u.mac.toLowerCase()] = u.callerIdName || u.userName;
    }
    return map;
  }, [users]);

  const logs = useMemo(() => {
    return rawEvents.filter((e) => e.type === "phone_log");
  }, [rawEvents]);

  const filtered = useMemo(() => {
    let result = logs;
    if (sipOnly) result = result.filter((l) => l.isSip);
    if (macFilter !== "all") result = result.filter((l) => l.mac === macFilter);
    if (levelFilter !== "all") result = result.filter((l) => l.level === levelFilter);
    if (methodFilter !== "all") result = result.filter((l) => {
      if (!l.method) return false;
      const parsed = parseMethod(l.method);
      return parsed.methodName === methodFilter;
    });
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        (l.message || "").toLowerCase().includes(q) ||
        (l.mac || "").toLowerCase().includes(q) ||
        (l.raw || "").toLowerCase().includes(q) ||
        (l.callId || "").toLowerCase().includes(q)
      );
    }
    result = result.length > MAX_LINES ? result.slice(-MAX_LINES) : result;
    return result;
  }, [logs, sipOnly, macFilter, levelFilter, methodFilter, search]);

  const stats = useMemo(() => {
    let sipCount = 0;
    for (const l of logs) if (l.isSip) sipCount++;
    return { total: logs.length, showing: filtered.length, sipCount };
  }, [logs, filtered]);

  const seenLevels = useMemo(() => {
    const set = new Set();
    for (const l of logs) set.add(l.level);
    return [...set].sort();
  }, [logs]);

  const seenMethods = useMemo(() => {
    const set = new Set();
    for (const l of logs) {
      if (l.method) {
        const parsed = parseMethod(l.method);
        if (parsed.methodName) set.add(parsed.methodName);
      }
    }
    return [...set].sort();
  }, [logs]);

  const seenMacs = useMemo(() => {
    const set = new Set();
    for (const l of logs) if (l.mac) set.add(l.mac);
    return [...set].sort();
  }, [logs]);

  const getItemSize = useCallback((index) => {
    const item = filtered[index];
    if (!item) return ROW_HEIGHT;
    return expanded === (item._id || index) ? EXPANDED_HEIGHT : ROW_HEIGHT;
  }, [filtered, expanded]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: getItemSize,
    getItemKey: (index) => filtered[index]?._id || index,
    overscan: 20,
  });

  // Re-measure when expanded changes
  useEffect(() => {
    virtualizer.measure();
  }, [expanded, virtualizer]);

  // Auto-scroll to bottom
  const prevCountRef = useRef(filtered.length);
  useEffect(() => {
    if (!autoScroll || filtered.length <= prevCountRef.current) {
      prevCountRef.current = filtered.length;
      return;
    }
    prevCountRef.current = filtered.length;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [filtered.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }, []);

  const exportCsv = useCallback(() => {
    const header = "timestamp,mac,user,level,direction,method,callId,message\n";
    const rows = filtered.map((l) =>
      [localTime(l.timestamp), l.mac || "", `"${macToUser[l.mac] || ""}"`, l.level, l.direction || "", `"${l.method || ""}"`, l.callId || "", `"${(l.message || "").replace(/"/g, '""')}"`].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phone-logs-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, macToUser]);

  const handleClear = useCallback(() => {
    rawClear();
    setExpanded(null);
    callIdColorCache.clear();
    callIdColorIdx = 0;
  }, [rawClear]);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] font-mono animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-baseline justify-between px-1 pb-2 shrink-0">
        <h2 className="text-base font-bold tracking-tight font-sans">Phone Log</h2>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          Total: <span className="text-foreground font-bold">{stats.total}</span>
          <span className="mx-1.5 text-border">|</span>
          Showing: <span className="text-foreground font-bold">{stats.showing}</span>
          <span className="mx-1.5 text-border">|</span>
          <span className="text-purple-400">SIP: <b>{stats.sipCount}</b></span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-1 pb-2 shrink-0">
        <div className="flex rounded overflow-hidden border border-border text-[11px] shrink-0">
          {[["all", "ALL"], ["sip", "SIP ONLY"]].map(([val, label]) => (
            <button key={val} onClick={() => setSipOnly(val === "sip")}
              className={`px-3 py-1 font-bold transition-colors ${(sipOnly ? "sip" : "all") === val ? "bg-foreground text-background" : "bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}
            >{label}</button>
          ))}
        </div>

        <PhoneDropdown value={macFilter} onChange={setMacFilter} users={users} seenMacs={seenMacs} />

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
          <span>Level:</span>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-muted/30 border border-border rounded px-2 py-1 text-[11px] text-foreground font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">ALL</option>
            {seenLevels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {sipOnly && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
            <span>Method:</span>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-muted/30 border border-border rounded px-2 py-1 text-[11px] text-foreground font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="all">ALL</option>
              {seenMethods.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        <div className="relative flex-1 min-w-[120px]">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)}
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
      {sipOnly ? (
        <div className="flex items-center text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold py-1 border-b border-border shrink-0 select-none" style={{ paddingLeft: "7px" }}>
          <span className="w-[110px] shrink-0">Time</span>
          <span className="w-[56px] shrink-0">Dir</span>
          <span className="w-[220px] shrink-0">User</span>
          <span className="w-[160px] shrink-0">MAC</span>
          <span className="w-[90px] shrink-0">Method</span>
          <span className="w-[80px] shrink-0">Code</span>
          <span className="flex-1 min-w-0">Details</span>
        </div>
      ) : (
        <div className="flex items-center text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold py-1 border-b border-border shrink-0 select-none" style={{ paddingLeft: "7px" }}>
          <span className="w-[110px] shrink-0">Time</span>
          <span className="w-[70px] shrink-0">Level</span>
          <span className="w-[220px] shrink-0">User</span>
          <span className="w-[160px] shrink-0">MAC</span>
          <span className="flex-1 min-w-0">Message</span>
        </div>
      )}

      {/* Log stream — virtualized */}
      <div className="flex-1 overflow-auto min-h-0 px-1 pt-1" ref={scrollRef} onScroll={handleScroll}>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            {active ? "Waiting for phone syslog messages..." : "Stream paused."}
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const log = filtered[vRow.index];
              const id = log._id || vRow.index;
              const isExp = expanded === id;
              return (
                <div key={vRow.key} data-index={vRow.index}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: isExp ? EXPANDED_HEIGHT : ROW_HEIGHT, transform: `translateY(${vRow.start}px)` }}>
                  {sipOnly
                    ? <SipRow log={log} isExpanded={isExp} onToggle={() => setExpanded(isExp ? null : id)} search={search} macToUser={macToUser} />
                    : <PlainLogRow log={log} userName={macToUser[log.mac] || ""} isExpanded={isExp} onToggle={() => setExpanded(isExp ? null : id)} search={search} />
                  }
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SIP row ── */
function SipRow({ log, isExpanded, onToggle, search, macToUser }) {
  const parsed = parseMethod(log.method);
  const isRecv = log.direction === "recv";
  const color = getCallIdColor(log.callId);
  const userName = macToUser[log.mac] || "";

  return (
    <div style={{ borderLeft: `3px solid ${color}`, backgroundColor: `${color}15`, overflow: "hidden", height: "100%" }}>
      <div className="flex items-center text-[11.5px] leading-none cursor-pointer select-none pl-1 hover:bg-white/[0.04]" style={{ height: ROW_HEIGHT }} onClick={onToggle}>
        <span className="text-muted-foreground tabular-nums w-[110px] shrink-0">{localTime(log.timestamp)}</span>
        <span className="w-[56px] shrink-0 flex items-center gap-1">
          {log.direction ? (
            isRecv
              ? <><ArrowDownIcon className="size-3 text-green-400" /><span className="text-[10px] font-black text-green-400">IN</span></>
              : <><ArrowUpIcon className="size-3 text-blue-400" /><span className="text-[10px] font-black text-blue-400">OUT</span></>
          ) : <span className="text-[10px] text-muted-foreground/50">—</span>}
        </span>
        <span className="w-[220px] shrink-0 truncate text-foreground/90 pr-2">{userName || "—"}</span>
        <span className="w-[160px] shrink-0 truncate text-muted-foreground pr-2 tabular-nums">{log.mac || "—"}</span>
        <span className="w-[90px] shrink-0 pr-2">
          {parsed.methodName && <span className="inline-flex items-center px-1.5 py-[2px] rounded text-[10px] font-black leading-none" style={{ backgroundColor: parsed.badge.bg, color: parsed.badge.fg }}>{parsed.label}</span>}
        </span>
        <span className="w-[80px] shrink-0 pr-2">
          {parsed.code && <span className="inline-flex items-center px-1.5 py-[2px] rounded text-[10px] font-black leading-none" style={{ backgroundColor: parsed.badge.bg, color: parsed.badge.fg }}>{parsed.label}</span>}
        </span>
        <span className="flex-1 min-w-0 truncate text-muted-foreground/70 pr-2">
          {parsed.statusText && <span className="mr-2">{parsed.statusText}</span>}
          {log.callId && <span className="opacity-50" style={{ color }}>{log.callId.slice(0, 12)}</span>}
          {log.dest && <span className="ml-2 text-muted-foreground/40">{log.dest}</span>}
        </span>
      </div>
      {isExpanded && (
        <div className="py-3 px-5 border-t border-border/15 bg-black/10" style={{ height: EXPANDED_HEIGHT - ROW_HEIGHT, overflow: "auto" }}>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-2 pb-2 border-b border-border/15">
            <span>Call-ID: <span className="text-foreground font-bold" style={{ color }}>{log.callId || "—"}</span></span>
            <span>MAC: <span className="text-foreground font-bold">{log.mac || "—"}</span></span>
            <span>User: <span className="text-foreground font-bold">{userName || "—"}</span></span>
            {log.from && <span>From: <span className="text-foreground">{extractEmail(log.from) || log.from}</span></span>}
            {log.to && <span>To: <span className="text-foreground">{extractEmail(log.to) || log.to}</span></span>}
          </div>
          <pre className="text-[11px] leading-[1.65] text-foreground/85 whitespace-pre-wrap break-all">
            {highlightText(cleanSipText(log.message || ""), search)}
          </pre>
        </div>
      )}
    </div>
  );
}

function cleanSipText(text) {
  return text.replace(/\n{2,}/g, "\n").trim();
}

/* ── Plain log row ── */
function PlainLogRow({ log, userName, isExpanded, onToggle, search }) {
  const badge = LEVEL_BADGE[log.level] || LEVEL_BADGE.INFO;

  return (
    <div style={{ overflow: "hidden", height: "100%" }}>
      <div className="flex items-center text-[11.5px] leading-none cursor-pointer select-none pl-1 hover:bg-white/[0.04]" style={{ height: ROW_HEIGHT }} onClick={onToggle}>
        <span className="text-muted-foreground tabular-nums w-[110px] shrink-0">{localTime(log.timestamp)}</span>
        <span className="w-[70px] shrink-0 pr-2">
          <span className="inline-flex items-center px-1.5 py-[2px] rounded text-[10px] font-black leading-none" style={{ backgroundColor: badge.bg, color: badge.fg }}>{log.level}</span>
        </span>
        <span className="w-[220px] shrink-0 truncate text-foreground/90 pr-2">{userName || "—"}</span>
        <span className="w-[160px] shrink-0 truncate text-muted-foreground pr-2 tabular-nums">{log.mac || "—"}</span>
        <span className="flex-1 min-w-0 truncate text-foreground/80 pr-2">
          {log.isSip && <span className="inline-flex items-center px-1 py-[1px] rounded text-[9px] font-black leading-none bg-purple-500/30 text-purple-300 mr-1.5 align-middle">SIP</span>}
          {highlightText(log.message || "", search)}
        </span>
      </div>
      {isExpanded && (
        <div className="py-3 px-5 border-t border-border/15 bg-black/10" style={{ height: EXPANDED_HEIGHT - ROW_HEIGHT, overflow: "auto" }}>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-2 pb-2 border-b border-border/15">
            <span>MAC: <span className="text-foreground font-bold">{log.mac || "—"}</span></span>
            <span>Level: <span className="text-foreground font-bold">{log.level}</span></span>
            <span>User: <span className="text-foreground font-bold">{userName || "—"}</span></span>
            {log.isSip && log.callId && <span>Call-ID: <span className="text-foreground font-bold">{log.callId}</span></span>}
          </div>
          <pre className="text-[11px] leading-[1.65] text-foreground/85 whitespace-pre-wrap break-all">
            {highlightText(log.raw || log.message || "", search)}
          </pre>
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
