import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useSSE } from "@/hooks/useSSE";
import {
  PlayIcon,
  PauseIcon,
  Trash2Icon,
  SearchIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  DownloadIcon,
} from "lucide-react";

const MAX_LINES = 5000;

function localTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, hour12: false });
}

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

// 16 distinct hues for Call-ID grouping
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

function getResponseBadge(code) {
  if (code >= 100 && code < 200) return { bg: "#60a5fa", fg: "#1e1b4b" };
  if (code >= 200 && code < 300) return { bg: "#22c55e", fg: "#052e16" };
  if (code >= 300 && code < 400) return { bg: "#eab308", fg: "#1a1a00" };
  if (code >= 400 && code < 500) return { bg: "#ef4444", fg: "#fff" };
  if (code >= 500) return { bg: "#dc2626", fg: "#fff" };
  return { bg: "#6b7280", fg: "#fff" };
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

function extractEmail(sipUri) {
  if (!sipUri) return "";
  const nameMatch = sipUri.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) {
    const n = nameMatch[1].trim();
    if (n.includes("@") || n.includes(".")) return n;
  }
  const uriMatch = sipUri.match(/sip:([^@;>]+(?:@[^;>]+)?)/);
  if (uriMatch) return uriMatch[1].replace(/\.at\./g, "@");
  return "";
}

function extractIp(transport) {
  if (!transport) return "";
  const m = transport.match(/\[?(\d+\.\d+\.\d+\.\d+)\]?:(\d+)/);
  if (m) return `${m[1]}:${m[2]}`;
  return transport;
}

export default function FsLogsPage() {
  const [active, setActive] = useState(true);
  const [dirFilter, setDirFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [codeFilter, setCodeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const { events: rawEvents, clear: rawClear } = useSSE("/api/v1/admin/events/fs-log", active);
  const scrollRef = useRef(null);

  const packets = useMemo(() => {
    const all = rawEvents.filter((e) => e.subtype === "sip_packet");
    return all.length > MAX_LINES ? all.slice(-MAX_LINES) : all;
  }, [rawEvents]);

  const filtered = useMemo(() => {
    let result = packets;
    if (dirFilter !== "all") result = result.filter((p) => p.direction === (dirFilter === "in" ? "recv" : "send"));
    if (methodFilter !== "all") result = result.filter((p) => {
      const parsed = parseMethod(p.method);
      return parsed.methodName === methodFilter;
    });
    if (codeFilter !== "all") {
      result = result.filter((p) => {
        const parsed = parseMethod(p.method);
        if (!parsed.code) return false;
        if (codeFilter.length <= 2) return String(parsed.code)[0] === codeFilter[0];
        return String(parsed.code) === codeFilter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        extractEmail(p.from).toLowerCase().includes(q) ||
        extractEmail(p.to).toLowerCase().includes(q) ||
        (p.from || "").toLowerCase().includes(q) ||
        (p.to || "").toLowerCase().includes(q) ||
        (p.method || "").toLowerCase().includes(q) ||
        (p.transport || "").toLowerCase().includes(q) ||
        (p.callId || "").toLowerCase().includes(q) ||
        (p.message || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [packets, dirFilter, methodFilter, codeFilter, search]);

  const stats = useMemo(() => {
    let inCount = 0, outCount = 0;
    for (const p of packets) {
      if (p.direction === "recv") inCount++;
      else outCount++;
    }
    return { total: packets.length, showing: filtered.length, inCount, outCount };
  }, [packets, filtered]);

  const methods = useMemo(() => {
    const set = new Set();
    for (const p of packets) {
      const parsed = parseMethod(p.method);
      if (parsed.methodName) set.add(parsed.methodName);
    }
    return [...set].sort();
  }, [packets]);

  const statusCodes = useMemo(() => {
    const set = new Set();
    for (const p of packets) {
      const parsed = parseMethod(p.method);
      if (parsed.code) set.add(String(parsed.code));
    }
    return [...set].sort();
  }, [packets]);

  const programmaticScroll = useRef(false);

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    programmaticScroll.current = true;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      setTimeout(() => { programmaticScroll.current = false; }, 50);
    });
  }, [filtered.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (programmaticScroll.current) return;
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }, []);

  const exportCsv = useCallback(() => {
    const header = "timestamp,direction,method,from,to,transport,bytes,callId\n";
    const rows = filtered.map((p) =>
      [localTime(p.timestamp), p.direction, `"${p.method}"`, `"${extractEmail(p.from)}"`, `"${extractEmail(p.to)}"`, `"${p.transport}"`, p.bytes, p.callId].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sip-packets-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const handleClear = useCallback(() => {
    rawClear();
    setExpanded(null);
    callIdColorCache.clear();
    callIdColorIdx = 0;
  }, [rawClear]);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] font-mono animate-in fade-in duration-300">
      {/* Header: title + stats */}
      <div className="flex items-baseline justify-between px-1 pb-2 shrink-0">
        <h2 className="text-base font-bold tracking-tight font-sans">FS Logs</h2>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          Total: <span className="text-foreground font-bold">{stats.total}</span>
          <span className="mx-1.5 text-border">|</span>
          Showing: <span className="text-foreground font-bold">{stats.showing}</span>
          <span className="mx-1.5 text-border">|</span>
          <span className="text-green-400">IN: <b>{stats.inCount}</b></span>
          <span className="mx-1.5 text-border">|</span>
          <span className="text-blue-400">OUT: <b>{stats.outCount}</b></span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-1 pb-2 shrink-0">
        {/* Direction toggles */}
        <div className="flex rounded overflow-hidden border border-border text-[11px] shrink-0">
          {[["all", "ALL"], ["in", "↓ IN"], ["out", "↑ OUT"]].map(([val, label]) => (
            <button key={val} onClick={() => setDirFilter(val)}
              className={`px-3 py-1 font-bold transition-colors ${dirFilter === val ? "bg-foreground text-background" : "bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}
            >{label}</button>
          ))}
        </div>

        {/* Method dropdown */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
          <span>Method:</span>
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-muted/30 border border-border rounded px-2 py-1 text-[11px] text-foreground font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">ALL</option>
            {methods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Status code dropdown */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
          <span>Status:</span>
          <select value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)}
            className="bg-muted/30 border border-border rounded px-2 py-1 text-[11px] text-foreground font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">ALL</option>
            <option value="1x">1xx Provisional</option>
            <option value="2x">2xx Success</option>
            <option value="3x">3xx Redirect</option>
            <option value="4x">4xx Client Error</option>
            <option value="5x">5xx Server Error</option>
            {statusCodes.length > 0 && <option disabled>───────</option>}
            {statusCodes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Search — fills remaining space */}
        <div className="relative flex-1 min-w-[120px]">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input placeholder="Search / highlight" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-[26px] w-full pl-7 text-[11px] font-mono bg-muted/30 border-border" />
        </div>

        {/* Auto-scroll */}
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none shrink-0">
          <input type="checkbox" checked={autoScroll}
            onChange={(e) => { setAutoScroll(e.target.checked); if (e.target.checked && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }}
            className="rounded size-3.5 accent-primary" />
          Auto-scroll
        </label>

        {/* Action buttons */}
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
        <span className="w-[56px] shrink-0">Dir</span>
        <span className="w-[220px] shrink-0">From</span>
        <span className="w-[160px] shrink-0">IP Address</span>
        <span className="w-[90px] shrink-0">Method</span>
        <span className="w-[80px] shrink-0">Code</span>
        <span className="flex-1 min-w-0">Details</span>
        <span className="w-[60px] shrink-0 text-right pr-3">Size</span>
      </div>

      {/* Packet stream */}
      <div className="flex-1 overflow-auto min-h-0 px-1 pt-1" ref={scrollRef} onScroll={handleScroll}>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            {active ? "Waiting for SIP packets..." : "Stream paused."}
          </div>
        ) : (
          <GroupedPackets filtered={filtered} expanded={expanded} setExpanded={setExpanded} search={search} />
        )}
      </div>
    </div>
  );
}

function GroupedPackets({ filtered, expanded, setExpanded, search }) {
  // Build groups of consecutive packets with the same Call-ID
  const groups = useMemo(() => {
    const result = [];
    let current = null;
    for (const pkt of filtered) {
      const cid = pkt.callId || pkt._id;
      if (current && current.callId === cid) {
        current.packets.push(pkt);
      } else {
        current = { callId: cid, packets: [pkt] };
        result.push(current);
      }
    }
    return result;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-[6px]">
      {groups.map((group, gi) => {
        const color = getCallIdColor(group.callId);
        return (
          <div key={group.callId + "-" + gi} className="rounded-sm overflow-hidden"
            style={{ borderLeft: `3px solid ${color}`, backgroundColor: `${color}15` }}>
            {group.packets.map((pkt, pi) => (
              <PacketRow key={pkt._id} pkt={pkt} color={color}
                isExpanded={expanded === pkt._id}
                onToggle={() => setExpanded(expanded === pkt._id ? null : pkt._id)}
                search={search}
                isLast={pi === group.packets.length - 1} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PacketRow({ pkt, color, isExpanded, onToggle, search, isLast }) {
  const isRecv = pkt.direction === "recv";
  const parsed = parseMethod(pkt.method);
  const fromEmail = extractEmail(pkt.from);
  const ip = extractIp(pkt.transport);

  return (
    <>
      <div
        className={`flex items-center text-[11.5px] leading-none cursor-pointer select-none group pl-1 transition-colors ${isExpanded ? "bg-white/[0.03]" : "hover:bg-white/[0.04]"}`}
        onClick={onToggle}
      >
        {/* Timestamp */}
        <span className="text-muted-foreground tabular-nums w-[110px] shrink-0 py-[6px]">{localTime(pkt.timestamp)}</span>

        {/* Direction */}
        <span className="w-[56px] shrink-0 flex items-center gap-1">
          {isRecv
            ? <><ArrowDownIcon className="size-3 text-green-400" /><span className="text-[10px] font-black text-green-400">IN</span></>
            : <><ArrowUpIcon className="size-3 text-blue-400" /><span className="text-[10px] font-black text-blue-400">OUT</span></>
          }
        </span>

        {/* From */}
        <span className="w-[220px] shrink-0 truncate text-foreground/90 pr-2">
          {fromEmail || "—"}
        </span>

        {/* IP */}
        <span className="w-[160px] shrink-0 truncate text-muted-foreground pr-2">
          {ip}
        </span>

        {/* Method badge */}
        <span className="w-[90px] shrink-0 pr-2">
          {parsed.methodName && (
            <span className="inline-flex items-center px-1.5 py-[2px] rounded text-[10px] font-black leading-none"
              style={{ backgroundColor: parsed.badge.bg, color: parsed.badge.fg }}>
              {parsed.label}
            </span>
          )}
        </span>

        {/* Response code */}
        <span className="w-[80px] shrink-0 pr-2">
          {parsed.code && (
            <span className="inline-flex items-center px-1.5 py-[2px] rounded text-[10px] font-black leading-none"
              style={{ backgroundColor: parsed.badge.bg, color: parsed.badge.fg }}>
              {parsed.label}
            </span>
          )}
        </span>

        {/* Details: status text + callId */}
        <span className="flex-1 min-w-0 truncate text-muted-foreground/70 pr-2">
          {parsed.statusText && <span className="mr-2">{parsed.statusText}</span>}
          {pkt.callId && (
            <span className="opacity-50" style={{ color }}>{pkt.callId.slice(0, 12)}</span>
          )}
        </span>

        {/* Size */}
        <span className="w-[60px] shrink-0 text-right pr-3 tabular-nums text-muted-foreground/50">{pkt.bytes}B</span>
      </div>

      {/* Row divider within group */}
      {!isLast && !isExpanded && <div className="border-b border-border/10 ml-2 mr-2" />}

      {/* Expanded raw SIP */}
      {isExpanded && (
        <div className="py-3 px-5 border-t border-border/15 bg-black/10">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-2 pb-2 border-b border-border/15">
            <span>Call-ID: <span className="text-foreground font-bold" style={{ color }}>{pkt.callId}</span></span>
            <span>Transport: <span className="text-foreground">{pkt.transport}</span></span>
            <span>Size: <span className="text-foreground">{pkt.bytes} bytes</span></span>
          </div>
          <pre className="text-[11px] leading-[1.65] text-foreground/85 whitespace-pre-wrap break-all max-h-[400px] overflow-y-auto">
            {highlightSip(pkt.message, search)}
          </pre>
        </div>
      )}
    </>
  );
}

function highlightSip(text, search) {
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
