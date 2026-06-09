import { useState, useCallback, useMemo, useEffect, useRef, memo, useDeferredValue } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useFetch } from "@/hooks/useFetch";
import { timeAgo } from "@/lib/constants";
import { useRooms } from "@/hooks/useRooms";
import {
  MicIcon,
  MicOffIcon,
  RefreshCwIcon,
  ArrowRightLeftIcon,
  SearchIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  MailIcon,
  BuildingIcon,
  MapPinIcon,
  AudioLinesIcon,
  WifiIcon,
  WifiOffIcon,
  ShieldIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  NetworkIcon,
  ClockIcon,
  CopyIcon,
  CheckIcon,
  PhoneIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  PhoneIncomingIcon,
  BanIcon,
  Volume2Icon,
  BugIcon,
  HashIcon,
  Loader2Icon,
  RotateCwIcon,
  LinkIcon,
  ServerIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  LayoutGridIcon,
  ListIcon,
  GlobeIcon,
} from "lucide-react";

function useUsersLive(initialData) {
  const [users, setUsers] = useState([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initialData && !initializedRef.current) {
      setUsers(initialData);
      initializedRef.current = true;
    } else if (initialData) {
      setUsers(prev => {
        const prevMap = new Map(prev.map(u => [u.userName, u]));
        return initialData.map(u => {
          const existing = prevMap.get(u.userName);
          return existing ? { ...u, account: u.account || existing.account } : u;
        });
      });
    }
  }, [initialData]);

  useEffect(() => {
    const es = new EventSource("/api/v1/admin/events/stream");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "user_update" && data.userName) {
          setUsers(prev => {
            const idx = prev.findIndex(u => u.userName === data.userName);
            if (idx === -1) return prev;
            const existing = prev[idx];
            const updated = { ...existing };
            for (const key of Object.keys(data)) {
              if (key === "type" || key === "_kickout" || key === "_active") continue;
              updated[key] = data[key];
            }
            if (existing.account && (data._kickout !== undefined || data._active !== undefined)) {
              updated.account = { ...existing.account };
              if (data._kickout !== null && data._kickout !== undefined) updated.account.kickout = data._kickout;
              if (data._active !== null && data._active !== undefined) updated.account.active = data._active;
            }
            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  return users;
}

function CallDuration({ since }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.floor(Date.now() / 1000) - since;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const display = h > 0
    ? `${h}h ${m}m ${s}s`
    : m > 0 ? `${m}m ${s}s` : `${s}s`;
  return <p className="text-sm font-mono text-emerald-400">{display}</p>;
}

function Tip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const EMPTY_FORM = {
  email: "", password: "", display_name: "", company_name: "",
  company_phone: "", company_address: "", city: "", state: "", zip: "", room: "",
};

function ClientTypeIcon({ clientType }) {
  if (clientType === "web") return <Tip label="Web Client"><GlobeIcon className="size-3 text-purple-500 shrink-0" /></Tip>;
  return null;
}

function getStatusDot(user) {
  if (user.connectionState === "connected") return "bg-green-500";
  if (user.online) return "bg-yellow-500";
  return "bg-zinc-500";
}

function getStatusLabel(user) {
  if (user.connectionState === "connected") return "Connected";
  if (user.online) return "Online";
  return "Offline";
}

function formatDate(d) {
  if (!d) return "Never";
  return new Date(d).toLocaleString();
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return Promise.resolve();
}

function CopyableCell({ text, children, className = "" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!text) return;
    copyToClipboard(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  if (!text) return <span className={className}>{children || "-"}</span>;

  return (
    <span className={`inline-flex items-center gap-1.5 max-w-full ${className}`}>
      <span className="truncate">{children || text}</span>
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleCopy}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-150 p-0.5 rounded hover:bg-muted-foreground/10 cursor-pointer"
        title={copied ? "Copied!" : `Copy ${text}`}
      >
        {copied ? (
          <CheckIcon className="size-3 text-emerald-400 animate-in zoom-in-50 duration-150" />
        ) : (
          <CopyIcon className="size-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
        )}
      </button>
    </span>
  );
}

export default function UsersPage() {
  const { names: ROOM_NAMES, codes: ROOM_CODES } = useRooms();
  const { data, loading, refetch } = useFetch("/api/v1/admin/users");
  const liveUsers = useUsersLive(data);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedUserName, setSelectedUserName] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [actionUser, setActionUser] = useState(null);

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ online: false, offline: false, muted: false, inCall: false, notInCall: false, talking: false, error: false, crossRoom: false });
  const [roomFilter, setRoomFilter] = useState("all");
  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [refreshingAccountId, setRefreshingAccountId] = useState(false);
  const [refreshingDeviceId, setRefreshingDeviceId] = useState(false);
  const [ymcsAction, setYmcsAction] = useState(null);
  const [sipEditHost, setSipEditHost] = useState("");
  const [sipEditPort, setSipEditPort] = useState("");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("bjs-view-mode") || "list");

  function toggleSort(col) {
    if (sortCol === col) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortCol(null); setSortDir("asc"); }
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }
  function SortIcon({ col }) {
    if (sortCol !== col) return <ArrowUpDownIcon className="size-3 text-muted-foreground/30" />;
    return sortDir === "asc" ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />;
  }

  const users = liveUsers;
  const selectedUser = useMemo(
    () => users.find((u) => u.userName === selectedUserName) || null,
    [users, selectedUserName]
  );
  const anyFilterActive = Object.values(filters).some(Boolean) || roomFilter !== "all";
  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = deferredSearch.toLowerCase();
      if (q && !(
        (u.userName || "").toLowerCase().includes(q) ||
        (u.callerIdName || "").toLowerCase().includes(q) ||
        (u.mac || "").toLowerCase().includes(q) ||
        (u.account?.email || "").toLowerCase().includes(q) ||
        (u.account?.company_name || "").toLowerCase().includes(q) ||
        (u.account?.display_name || "").toLowerCase().includes(q)
      )) return false;

      if (roomFilter !== "all" && String(u.room || u.account?.room) !== roomFilter) return false;

      if (filters.online && !u.online) return false;
      if (filters.offline && u.online) return false;
      if (filters.muted && u.mute) return false;
      if (filters.inCall && u.connectionState !== "connected") return false;
      if (filters.notInCall && u.connectionState === "connected") return false;
      if (filters.talking && !u.talking) return false;
      if (filters.error && u.connectionState !== "error") return false;
      if (filters.crossRoom) {
        const defaultRoom = u.account?.room ?? u.room;
        const currentRoom = u.currentRoom ?? u.room;
        if (defaultRoom == null || String(currentRoom) === String(defaultRoom)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortCol) {
        const getVal = (u) => {
          if (sortCol === "name") return (u.account?.display_name || u.callerIdName || u.userName || "").toLowerCase();
          if (sortCol === "email") return (u.account?.email || u.userName || "").toLowerCase();
          if (sortCol === "company") return (u.account?.company_name || "").toLowerCase();
          if (sortCol === "room") return (ROOM_NAMES[u.currentRoom || u.room] || "").toLowerCase();
          return "";
        };
        const va = getVal(a), vb = getVal(b);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
      }
      const score = (u) =>
        (u.reachable ? 4 : 0) +
        (u.connectionState === "connected" ? 3 : 0) +
        (u.online ? 2 : 0) +
        (u.registrationState === "registered" ? 1 : 0);
      return score(b) - score(a);
    });
  }, [users, deferredSearch, roomFilter, filters, sortCol, sortDir]);

  const onlineCount = users.filter((u) => u.connectionState === "connected" || u.online).length;
  const inCallCount = users.filter((u) => u.connectionState === "connected").length;
  const errorCount = users.filter((u) => u.connectionState === "error").length;
  const offlineCount = users.filter((u) => !u.online && u.connectionState !== "error").length;

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormDialogOpen(true);
  }

  function openEdit(user) {
    const acc = user.account;
    setEditing(acc || user);
    setForm({
      email: acc?.email || user.userName || "",
      password: "",
      display_name: acc?.display_name || user.callerIdName || "",
      company_name: acc?.company_name || "",
      company_phone: acc?.company_phone || "",
      company_address: acc?.company_address || "",
      city: acc?.city || "",
      state: acc?.state || "",
      zip: acc?.zip || "",
      room: acc?.room ? String(acc.room) : user.room ? String(user.room) : "",
    });
    setFormDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = { ...form };
      if (editing && !body.password) delete body.password;

      const url = editing?.id
        ? `/api/v1/admin/accounts/${editing.id}`
        : "/api/v1/admin/accounts";

      await fetch(url, {
        method: editing?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setFormDialogOpen(false);
      refetch();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.account?.id) return;
    try {
      await fetch(`/api/v1/admin/accounts/${deleteTarget.account.id}`, {
        method: "DELETE",
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setSheetOpen(false);
      refetch();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }

  async function toggleActive(user) {
    if (!user.account?.id) return;
    try {
      await fetch(`/api/v1/admin/accounts/${user.account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: user.account.active ? 0 : 1 }),
      });
      refetch();
    } catch (e) {
      console.error("Toggle failed:", e);
    }
  }

  async function refreshAccountId(accountId) {
    setRefreshingAccountId(true);
    try {
      const res = await fetch(`/api/v1/admin/accounts/${accountId}/refresh-account-id`, { method: "POST" });
      const json = await res.json();
      if (!json.status) console.error("Refresh failed:", json.error);
      refetch();
    } catch (e) {
      console.error("Refresh account ID failed:", e);
    } finally {
      setRefreshingAccountId(false);
    }
  }

  async function refreshDeviceId(accountId) {
    setRefreshingDeviceId(true);
    try {
      const res = await fetch(`/api/v1/admin/accounts/${accountId}/refresh-device-id`, { method: "POST" });
      const json = await res.json();
      if (!json.status) console.error("Refresh failed:", json.error);
      refetch();
    } catch (e) {
      console.error("Refresh device ID failed:", e);
    } finally {
      setRefreshingDeviceId(false);
    }
  }

  async function ymcsReboot(accountId) {
    setYmcsAction("reboot");
    try {
      const res = await fetch(`/api/v1/admin/accounts/${accountId}/ymcs/reboot`, { method: "POST" });
      const json = await res.json();
      if (!json.status) console.error("Reboot failed:", json.error);
    } catch (e) {
      console.error("YMCS reboot failed:", e);
    } finally {
      setYmcsAction(null);
    }
  }

  async function ymcsRebind(accountId) {
    setYmcsAction("rebind");
    try {
      const res = await fetch(`/api/v1/admin/accounts/${accountId}/ymcs/rebind`, { method: "POST" });
      const json = await res.json();
      if (!json.status) console.error("Rebind failed:", json.error);
      refetch();
    } catch (e) {
      console.error("YMCS rebind failed:", e);
    } finally {
      setYmcsAction(null);
    }
  }

  async function ymcsUpdateSipServer(accountId, host, port) {
    setYmcsAction("sip");
    try {
      const res = await fetch(`/api/v1/admin/accounts/${accountId}/ymcs/update-sip-server`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port: parseInt(port) }),
      });
      const json = await res.json();
      if (!json.status) console.error("SIP update failed:", json.error);
      refetch();
    } catch (e) {
      console.error("YMCS SIP update failed:", e);
    } finally {
      setYmcsAction(null);
    }
  }

  async function doAction(userName, action, body = null) {
    try {
      await fetch(`/api/v1/admin/users/${userName}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : null,
      });
    } catch (e) {
      console.error("Action failed:", e);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Connected Yards</h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
            <span><span className="font-mono font-bold tabular-nums">{users.length}</span> Total</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-green-600 dark:text-green-400"><span className="font-mono font-bold tabular-nums">{onlineCount}</span> Online</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-blue-600 dark:text-blue-400"><span className="font-mono font-bold tabular-nums">{inCallCount}</span> In Call</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-red-600 dark:text-red-400"><span className="font-mono font-bold tabular-nums">{errorCount}</span> Error</span>
            <span className="text-muted-foreground/40">·</span>
            <span><span className="font-mono font-bold tabular-nums">{offlineCount}</span> Offline</span>
            {anyFilterActive && <><span className="text-muted-foreground/40">·</span><span className="text-primary font-bold">{filtered.length} shown</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate}>
            <PlusIcon className="size-4 mr-2" />
            Add Yard
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const scope = roomFilter !== "all" ? ROOM_NAMES[roomFilter] || roomFilter : "all";
              if (!confirm(`Restore ${scope === "all" ? "all" : `"${scope}"`} kicked out users? This will allow them to rejoin.`)) return;
              try {
                await fetch("/api/v1/admin/users/kickin-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(roomFilter !== "all" ? { room: roomFilter } : {}) });
                refetch();
              } catch (e) {
                console.error("Kickin all failed:", e);
              }
            }}
          >
            <CheckIcon className="size-4 mr-2" />
            {roomFilter !== "all" ? `Kickin ${ROOM_NAMES[roomFilter]}` : "Kickin All"}
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              const scope = roomFilter !== "all" ? ROOM_NAMES[roomFilter] || roomFilter : "all";
              if (!confirm(`Kickout ${scope === "all" ? "all active calls across the hotline network" : `all "${scope}" users`}?`)) return;
              try {
                await fetch("/api/v1/admin/users/kickout-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(roomFilter !== "all" ? { room: roomFilter } : {}) });
                refetch();
              } catch (e) {
                console.error("Kickout all failed:", e);
              }
            }}
          >
            <BanIcon className="size-4 mr-2" />
            {roomFilter !== "all" ? `Kickout ${ROOM_NAMES[roomFilter]}` : "Kickout All"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, company, or MAC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roomFilter} onValueChange={setRoomFilter} items={{ all: "All Rooms", ...ROOM_NAMES }}>
          <SelectTrigger className="!w-[160px]">
            <SelectValue placeholder="All Rooms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rooms</SelectItem>
            {Object.entries(ROOM_NAMES).map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Separator orientation="vertical" className="h-6 hidden sm:block" />
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "online", label: "Online", active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
            { key: "offline", label: "Offline", active: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", dot: "bg-zinc-400" },
            { key: "inCall", label: "In Call", active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
            { key: "notInCall", label: "Not In Call", active: "bg-rose-500/15 text-rose-400 border-rose-500/30", dot: "bg-rose-400" },
            { key: "muted", label: "Unmuted", active: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-400" },
            { key: "talking", label: "Talking", active: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30", dot: "bg-cyan-400" },
            { key: "error", label: "Error", active: "bg-orange-500/15 text-orange-400 border-orange-500/30", dot: "bg-orange-400" },
            { key: "crossRoom", label: "Cross Room", active: "bg-violet-500/15 text-violet-400 border-violet-500/30", dot: "bg-violet-400" },
          ].map(({ key, label, active, dot }) => (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                filters[key]
                  ? active
                  : "bg-muted/30 text-muted-foreground/60 border-border/40 hover:bg-muted/50"
              }`}
            >
              <span className={`size-1.5 rounded-full ${filters[key] ? dot : "bg-muted-foreground/30"}`} />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center border rounded-md overflow-hidden ml-auto shrink-0">
          <button
            onClick={() => { setViewMode("list"); localStorage.setItem("bjs-view-mode", "list"); }}
            className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <ListIcon className="size-4" />
          </button>
          <button
            onClick={() => { setViewMode("grid"); localStorage.setItem("bjs-view-mode", "grid"); }}
            className={`p-1.5 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <LayoutGridIcon className="size-4" />
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="flex flex-wrap gap-1.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 w-full text-center">No yards found</p>
          ) : filtered.map((user) => {
            const name = user.account?.display_name || user.callerIdName || user.userName;
            const company = user.account?.company_name;
            const email = user.account?.email || user.userName;
            const room = ROOM_CODES[user.currentRoom || user.room] || ROOM_NAMES[user.currentRoom || user.room] || user.currentRoom || user.room || "-";
            const isError = user.connectionState === "error";
            const isInCall = user.connectionState === "connected";
            const isConnecting = user.connectionState === "connecting";
            const isOnline = user.online;
            const bg = isError
              ? "bg-red-500 text-white dark:bg-red-600"
              : isInCall
              ? "bg-green-600 text-white dark:bg-green-700"
              : isConnecting
              ? "bg-amber-500 text-white dark:bg-amber-600"
              : isOnline
              ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800/40"
              : "bg-muted text-muted-foreground border border-border/50";
            const statusLabel = isError ? "Error" : isInCall ? "In Call" : isConnecting ? "Connecting" : isOnline ? "Online" : "Offline";
            const tooltipLines = [
              name,
              email !== name ? email : null,
              company ? `Company: ${company}` : null,
              `Room: ${room}`,
              `Status: ${statusLabel}`,
              user.clientType && user.clientType !== "unknown" ? `Client: ${user.clientType}` : null,
              user.registrationState ? `Registration: ${user.registrationState}` : null,
              user.mute ? "Muted" : "Unmuted",
              user.talking ? "Talking" : null,
              isError && user.error ? `Error: ${user.error}` : null,
              `Last seen: ${timeAgo(user.last_seen || user.updatedAt)}`,
              user.account ? (user.account.active ? "Account: Active" : "Account: Inactive") : null,
              user.account?.kickout ? "Kicked out" : null,
            ].filter(Boolean).join("\n");
            return (
              <Tooltip key={user.userName}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setSelectedUserName(user.userName); setSheetOpen(true); const a = user.account; if (a) { setSipEditHost(a.sip_server_host || "50.28.84.57"); setSipEditPort(String(a.sip_server_port || 5070)); } }}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight cursor-pointer hover:opacity-80 transition-opacity ${bg}`}
                  >
                    {isError && <PhoneOffIcon className="size-2.5 shrink-0" />}
                    {isInCall && <PhoneCallIcon className="size-2.5 shrink-0" />}
                    {user.clientType === "web" && <GlobeIcon className="size-2.5 shrink-0" />}
                    <span className="truncate max-w-[80px]">{company || name}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[250px]">
                  <div className="text-xs space-y-0.5 whitespace-pre-line">{tooltipLines}</div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ) : (
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px] pr-0">
                  <div className="flex items-center gap-2 text-muted-foreground/60">
                    <Tip label="Online Status"><WifiIcon className="size-3" /></Tip>
                    <Tip label="Registration"><ShieldIcon className="size-3" /></Tip>
                    <Tip label="Call Status"><PhoneIcon className="size-3" /></Tip>
                    <Tip label="Mute"><MicIcon className="size-3" /></Tip>
                  </div>
                </TableHead>
                <TableHead className="max-w-[120px] cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  <span className="inline-flex items-center gap-1">Name <SortIcon col="name" /></span>
                </TableHead>
                <TableHead className="hidden md:table-cell max-w-[160px] cursor-pointer select-none" onClick={() => toggleSort("email")}>
                  <span className="inline-flex items-center gap-1">Email <SortIcon col="email" /></span>
                </TableHead>
                <TableHead className="hidden lg:table-cell max-w-[120px] cursor-pointer select-none" onClick={() => toggleSort("company")}>
                  <span className="inline-flex items-center gap-1">Company <SortIcon col="company" /></span>
                </TableHead>
                <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort("room")}>
                  <span className="inline-flex items-center gap-1">Room <SortIcon col="room" /></span>
                </TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    No yards found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow
                    key={user.userName}
                    className={`cursor-pointer group transition-colors ${user.connectionState === "error" ? "bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-950/80 border-l-2 border-l-red-500" : ""} ${user.account && !user.account.active ? "opacity-50" : ""}`}
                    onClick={() => {
                      setSelectedUserName(user.userName);
                      setSheetOpen(true);
                      const a = user.account;
                      if (a) { setSipEditHost(a.sip_server_host || "50.28.84.57"); setSipEditPort(String(a.sip_server_port || 5070)); }
                    }}
                  >
                    <TableCell className="pr-0">
                      <div className="flex items-center gap-2">
                        <Tip label={user.online ? "Online" : "Offline"}>
                          {user.online ? (
                            <WifiIcon className="size-3 text-emerald-500" />
                          ) : (
                            <WifiOffIcon className="size-3 text-zinc-500" />
                          )}
                        </Tip>
                        <Tip label={user.registrationState === "registered" ? "Registered" : user.registrationState === "expired" ? "Expired" : "Unregistered"}>
                          {user.registrationState === "registered" ? (
                            <ShieldCheckIcon className="size-3 text-emerald-500" />
                          ) : user.registrationState === "expired" ? (
                            <ShieldXIcon className="size-3 text-amber-500" />
                          ) : (
                            <ShieldXIcon className="size-3 text-zinc-500" />
                          )}
                        </Tip>
                        <Tip label={user.connectionState === "connected" ? "In Call" : user.connectionState === "connecting" ? "Connecting" : user.connectionState === "hangup" ? "Hangup" : user.connectionState === "error" ? `Error: ${user.error || "unknown"}` : "Idle"}>
                          {user.connectionState === "connected" ? (
                            <PhoneCallIcon className="size-3 text-emerald-500" />
                          ) : user.connectionState === "connecting" ? (
                            <PhoneIncomingIcon className="size-3 text-amber-500 animate-pulse" />
                          ) : user.connectionState === "hangup" ? (
                            <PhoneOffIcon className="size-3 text-red-500" />
                          ) : user.connectionState === "error" ? (
                            <PhoneOffIcon className="size-3 text-orange-500" />
                          ) : (
                            <PhoneIcon className="size-3 text-zinc-500" />
                          )}
                        </Tip>
                        <Tip label={user.mute ? "Muted" : "Unmuted"}>
                          {user.mute ? (
                            <MicOffIcon className="size-3 text-red-500" />
                          ) : (
                            <MicIcon className="size-3 text-emerald-500" />
                          )}
                        </Tip>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-[120px] pl-2">
                      <div className="flex items-center gap-1.5">
                        <CopyableCell text={user.account?.display_name || user.callerIdName || user.userName} className="text-sm" />
                        {user.talking && (
                          <Volume2Icon className="size-3 text-cyan-400 animate-pulse shrink-0" />
                        )}
                        {user.account && !user.account.active && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">Off</Badge>
                        )}
                        {user.account?.kickout ? (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0 gap-0.5"><BanIcon className="size-2.5" />Kicked</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <CopyableCell text={user.account?.email || user.userName} />
                        <ClientTypeIcon clientType={user.clientType} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-[120px]">
                      <CopyableCell text={user.account?.company_name} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm" onClick={(e) => { e.stopPropagation(); setActionUser(user); setNewRoom(String(user.currentRoom || user.room || user.account?.room || "")); setRoomDialogOpen(true); }}>
                      {(() => {
                        const currentRoom = user.currentRoom || user.room;
                        const defaultRoom = user.account?.room;
                        const isNotDefault = currentRoom && defaultRoom && String(currentRoom) !== String(defaultRoom);
                        const code = ROOM_CODES[currentRoom] || ROOM_NAMES[currentRoom] || currentRoom || "-";
                        return isNotDefault ? (
                          <span className="inline-flex items-center gap-1 text-red-400 cursor-pointer hover:text-red-300">
                            <span className="line-through text-muted-foreground/50">{ROOM_CODES[defaultRoom]}</span>
                            {code}
                            <ArrowRightLeftIcon className="size-3" />
                          </span>
                        ) : (
                          <span className="text-muted-foreground cursor-pointer hover:text-foreground">{code}</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.account ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          user.account.active
                            ? "text-emerald-500"
                            : "text-muted-foreground/50"
                        }`}>
                          <span className={`size-1.5 rounded-full ${user.account.active ? "bg-emerald-500" : "bg-zinc-500"}`} />
                          {user.account.active ? "Active" : "Inactive"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                      {timeAgo(user.last_seen || user.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Edit"
                          onClick={() => openEdit(user)}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        {!user.accountOnly && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              title={user.mute ? "Unmute" : "Mute"}
                              onClick={() =>
                                doAction(user.userName, user.mute ? "unmute" : "mute")
                              }
                            >
                              {user.mute ? (
                                <MicOffIcon className="size-3.5 text-destructive" />
                              ) : (
                                <MicIcon className="size-3.5" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              title="Change Room"
                              onClick={() => {
                                setActionUser(user);
                                setNewRoom(user.room || "");
                                setRoomDialogOpen(true);
                              }}
                            >
                              <ArrowRightLeftIcon className="size-3.5" />
                            </Button>
                          </>
                        )}
                        {user.account?.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-destructive"
                            title="Delete"
                            onClick={() => {
                              setDeleteTarget(user);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent showCloseButton={false} className="sm:max-w-[420px] p-0 overflow-y-auto border-l border-border/50 bg-background/95 backdrop-blur-xl">
          <SheetHeader className="sr-only">
            <SheetTitle>User Details</SheetTitle>
            <SheetDescription>User details and account info</SheetDescription>
          </SheetHeader>
          {selectedUser && (() => {
            const acc = selectedUser.account;
            const displayName = acc?.display_name || selectedUser.callerIdName || selectedUser.userName;
            const initials = displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
            const statusColor = selectedUser.connectionState === "connected" ? "emerald" : selectedUser.online ? "amber" : "zinc";

            return (
              <div className="flex flex-col">
                {/* Hero header */}
                <div className="relative px-6 pt-14 pb-6">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent" />
                  <div className="absolute top-4 left-6 right-6 flex items-center justify-between">
                    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      statusColor === "emerald"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : statusColor === "amber"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                    }`}>
                      <span className={`size-1.5 rounded-full ${
                        statusColor === "emerald" ? "bg-emerald-400 animate-pulse" :
                        statusColor === "amber" ? "bg-amber-400" : "bg-zinc-500"
                      }`} />
                      {getStatusLabel(selectedUser)}
                    </div>
                  </div>

                  <div className="relative flex items-center gap-4">
                    <div className="size-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold tracking-tight text-primary/80">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold tracking-tight truncate">{displayName}</h3>
                      {acc?.email && (
                        <p className="text-sm text-muted-foreground truncate">{acc.email}</p>
                      )}
                    </div>
                  </div>

                  {selectedUser.connectionState === "connected" && selectedUser.lastConnectionStateUpdate && (
                    <div className="relative mt-4 flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <PhoneCallIcon className="size-4 text-emerald-500 shrink-0" />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-xs text-emerald-500/70 uppercase tracking-wider font-medium">In Call</span>
                        <CallDuration since={selectedUser.lastConnectionStateUpdate} />
                      </div>
                    </div>
                  )}
                  {selectedUser.connectionState === "error" && selectedUser.error && (
                    <div className="relative mt-4 flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20">
                      <PhoneOffIcon className="size-4 text-orange-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-orange-400 font-mono truncate">{selectedUser.error}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="px-6 pb-5">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => { openEdit(selectedUser); setSheetOpen(false); }}
                    >
                      <PencilIcon className="size-3.5 mr-1.5" />
                      Edit
                    </Button>
                    {!selectedUser.accountOnly && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9"
                          onClick={() => doAction(selectedUser.userName, "reconnect")}
                        >
                          <RefreshCwIcon className="size-3.5 mr-1.5" />
                          Reconnect
                        </Button>
                        <Button
                          variant={selectedUser.mute ? "outline" : "default"}
                          size="sm"
                          className={`flex-1 h-9 ${selectedUser.mute ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
                          onClick={() => doAction(selectedUser.userName, selectedUser.mute ? "unmute" : "mute")}
                        >
                          {selectedUser.mute
                            ? <><MicOffIcon className="size-3.5 mr-1.5" />Unmute</>
                            : <><MicIcon className="size-3.5 mr-1.5" />Mute</>
                          }
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border/60" />

                {/* Account section */}
                {acc && (
                  <div className="px-6 py-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold">Account</p>
                      <div className="flex items-center gap-2.5">
                        <span className={`text-xs font-medium ${acc.active ? "text-emerald-400" : "text-muted-foreground/50"}`}>
                          {acc.active ? "Active" : "Inactive"}
                        </span>
                        <Switch
                          checked={!!acc.active}
                          onCheckedChange={() => toggleActive(selectedUser)}
                          className="data-checked:bg-emerald-500"
                        />
                      </div>
                    </div>
                    <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${acc.kickout ? "bg-destructive/5 border-destructive/20" : "bg-muted/30 border-border/40"}`}>
                      <div className="flex items-center gap-2">
                        <BanIcon className={`size-4 ${acc.kickout ? "text-red-500" : "text-muted-foreground/50"}`} />
                        <div>
                          <p className="text-sm font-medium">Kicked Out</p>
                          <p className="text-[11px] text-muted-foreground/60">Block from joining rooms</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {acc.kickout ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Kicked</Badge>
                        ) : null}
                        <Switch
                          checked={!!acc.kickout}
                          onCheckedChange={() => doAction(selectedUser.userName, "kickout")}
                          className="data-checked:bg-red-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      {[
                        { icon: <MailIcon className="size-3.5" />, label: "Email", value: acc.email },
                        { icon: <BuildingIcon className="size-3.5" />, label: "Company", value: acc.company_name },
                        { icon: <MapPinIcon className="size-3.5" />, label: "Address", value: [acc.company_address, [acc.city, acc.state, acc.zip].filter(Boolean).join(", ")].filter(Boolean).join(", ") },
                        { icon: <AudioLinesIcon className="size-3.5" />, label: "Default Room", value: ROOM_NAMES[acc.room] || acc.room },
                        (() => {
                          const currentRoom = selectedUser.currentRoom || selectedUser.room || acc.room;
                          const defaultRoom = acc.room;
                          const isNotDefault = currentRoom && defaultRoom && String(currentRoom) !== String(defaultRoom);
                          return { icon: <ArrowRightLeftIcon className={`size-3.5 ${isNotDefault ? "text-red-400" : ""}`} />, label: "Current Room", value: ROOM_NAMES[currentRoom] || currentRoom, hasRoomChange: true, isNotDefault };
                        })(),
                        { icon: <HashIcon className="size-3.5" />, label: "YMCS Account ID", value: acc.ymcs_account_id || "—", refreshKey: "account" },
                        { icon: <HashIcon className="size-3.5" />, label: "YMCS Device ID", value: acc.ymcs_device_id || "—", refreshKey: "device" },
                      ].filter(f => f.value).map((field) => (
                        <div key={field.label} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors group">
                          <span className="text-muted-foreground/60 mt-0.5 group-hover:text-muted-foreground transition-colors">{field.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">{field.label}</p>
                            <p className={`text-sm truncate ${field.isNotDefault ? "text-red-400" : ""}`}>{field.value}</p>
                          </div>
                          {field.refreshKey && (
                            <button
                              onClick={() => field.refreshKey === "account" ? refreshAccountId(acc.id) : refreshDeviceId(acc.id)}
                              disabled={field.refreshKey === "account" ? refreshingAccountId : refreshingDeviceId}
                              className="mt-1 text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
                            >
                              {(field.refreshKey === "account" ? refreshingAccountId : refreshingDeviceId)
                                ? <Loader2Icon className="size-3.5 animate-spin" />
                                : <RefreshCwIcon className="size-3.5" />}
                            </button>
                          )}
                          {field.hasRoomChange && (
                            <button
                              onClick={() => { setActionUser(selectedUser); setNewRoom(String(selectedUser.currentRoom || selectedUser.room || acc.room)); setRoomDialogOpen(true); }}
                              className={`mt-1 transition-colors ${field.isNotDefault ? "text-red-400 hover:text-red-300" : "text-muted-foreground/50 hover:text-foreground"}`}
                            >
                              <ArrowRightLeftIcon className="size-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* YMCS Controls */}
                    {(acc.ymcs_account_id || acc.ymcs_device_id) && (() => {
                      const inCall = selectedUser.connectionState === "connected" || selectedUser.connectionState === "connecting";
                      return (
                      <>
                        <div className="h-px bg-border/40 my-2" />
                        <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold px-3 pt-1">YMCS Controls</p>
                        {inCall && (
                          <div className="mx-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
                            <PhoneCallIcon className="size-3.5 text-orange-400 shrink-0" />
                            <p className="text-[11px] text-orange-400">User is in an active call. YMCS actions are disabled.</p>
                          </div>
                        )}
                        <div className="px-3 space-y-2 pb-1">
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider mb-1">SIP Server</p>
                              <Input value={sipEditHost} onChange={(e) => setSipEditHost(e.target.value)} placeholder="50.28.84.57" disabled={inCall || !!ymcsAction} className="h-8 text-xs" />
                            </div>
                            <div className="w-20">
                              <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider mb-1">Port</p>
                              <Input value={sipEditPort} onChange={(e) => setSipEditPort(e.target.value)} placeholder="5070" disabled={inCall || !!ymcsAction} className="h-8 text-xs" />
                            </div>
                            <button
                              onClick={() => ymcsUpdateSipServer(acc.id, sipEditHost, sipEditPort)}
                              disabled={inCall || !!ymcsAction || !acc.ymcs_account_id || !sipEditHost || !sipEditPort}
                              className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium border border-border/40 bg-muted/30 hover:bg-muted/50 hover:border-border/60 transition-all disabled:opacity-40 shrink-0"
                            >
                              {ymcsAction === "sip" ? <Loader2Icon className="size-3 animate-spin" /> : <ServerIcon className="size-3" />}
                              Update
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => ymcsRebind(acc.id)}
                              disabled={inCall || !!ymcsAction || !acc.ymcs_account_id || !acc.ymcs_device_id}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border/40 bg-muted/30 hover:bg-muted/50 hover:border-border/60 transition-all disabled:opacity-40"
                            >
                              {ymcsAction === "rebind" ? <Loader2Icon className="size-3 animate-spin" /> : <LinkIcon className="size-3" />}
                              Rebind
                            </button>
                            <button
                              onClick={() => ymcsReboot(acc.id)}
                              disabled={inCall || !!ymcsAction || !acc.ymcs_device_id}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-destructive/80 border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/30 transition-all disabled:opacity-40"
                            >
                              {ymcsAction === "reboot" ? <Loader2Icon className="size-3 animate-spin" /> : <RotateCwIcon className="size-3" />}
                              Reboot
                            </button>
                          </div>
                        </div>
                      </>
                      );
                    })()}
                  </div>
                )}

                {/* Connection section */}
                {!selectedUser.accountOnly && (
                  <>
                    <div className="h-px bg-border/60" />
                    <div className="px-6 py-5 space-y-3">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-semibold">Connection</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: <NetworkIcon className="size-3.5" />, label: "MAC", value: selectedUser.mac, mono: true },
                          { icon: <WifiIcon className="size-3.5" />, label: "IP", value: selectedUser.ip, mono: true },
                          { icon: <ShieldIcon className="size-3.5" />, label: "Auth", value: selectedUser.authState, mono: true },
                          { icon: <MicIcon className="size-3.5" />, label: "Muted", value: selectedUser.mute ? "Yes" : "No" },
                        ].map((field) => (
                          <div key={field.label} className="px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-muted-foreground/50">{field.icon}</span>
                              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{field.label}</p>
                            </div>
                            <p className={`text-sm truncate ${field.mono ? "font-mono text-xs" : ""}`}>
                              {field.value || "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
                        <ClockIcon className="size-3.5 text-muted-foreground/50 shrink-0" />
                        <div className="flex-1 flex justify-between items-center text-xs text-muted-foreground">
                          <span>Created {formatDate(selectedUser.createdAt)}</span>
                          <span className="text-muted-foreground/40">|</span>
                          <span>Updated {timeAgo(selectedUser.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Debug + Delete zone */}
                {(selectedUser.mac || acc?.id) && (
                  <>
                    <div className="h-px bg-border/60" />
                    <div className="px-6 py-5 space-y-2">
                      {selectedUser.mac && (
                        <a
                          href={`/dev/phone-logs?mac=${encodeURIComponent(selectedUser.mac)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground border border-border/40 bg-muted/30 hover:bg-muted/50 hover:text-foreground hover:border-border/60 transition-all cursor-pointer"
                        >
                          <BugIcon className="size-3.5" />
                          Phone Debug
                        </a>
                      )}
                      {acc?.id && (
                        <button
                          onClick={() => { setDeleteTarget(selectedUser); setDeleteDialogOpen(true); }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-destructive/80 border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all cursor-pointer"
                        >
                          <Trash2Icon className="size-3.5" />
                          Delete User
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Create / Edit Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit User" : "Add User"}</DialogTitle>
            <DialogDescription>
              {editing?.id ? "Update account details." : "Create a new user account."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password {editing?.id ? "(leave blank to keep)" : "*"}</Label>
                <Input
                  type="password"
                  placeholder={editing?.id ? "••••••••" : "Enter password"}
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  placeholder="John Doe"
                  value={form.display_name}
                  onChange={(e) => updateField("display_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  placeholder="ACME Auto Parts"
                  value={form.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Company Phone</Label>
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={form.company_phone}
                  onChange={(e) => updateField("company_phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Company Address</Label>
                <Input
                  placeholder="123 Main St"
                  value={form.company_address}
                  onChange={(e) => updateField("company_address", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  placeholder="Los Angeles"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  placeholder="CA"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Zip</Label>
                <Input
                  placeholder="90001"
                  value={form.zip}
                  onChange={(e) => updateField("zip", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Room</Label>
              <Select
                value={form.room}
                onValueChange={(val) => updateField("room", val)}
                items={ROOM_NAMES}
              >
                <SelectTrigger className="!w-full">
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROOM_NAMES).map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full mt-2"
              onClick={handleSave}
              disabled={saving || !form.email || (!editing?.id && !form.password)}
            >
              {saving ? "Saving..." : editing?.id ? "Update User" : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.account?.email || deleteTarget?.userName}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Room Dialog */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Room</DialogTitle>
            <DialogDescription>
              Move {actionUser?.callerIdName || actionUser?.userName} to a different room. If in a call, it will reconnect in the new room.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Select Room</Label>
              <Select value={newRoom} onValueChange={setNewRoom} items={ROOM_NAMES}>
                <SelectTrigger className="!w-full">
                  <SelectValue placeholder="Choose a room" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROOM_NAMES).map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (actionUser && newRoom) {
                  doAction(actionUser.userName, "room", { room: newRoom });
                  setRoomDialogOpen(false);
                }
              }}
            >
              Move Yard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
