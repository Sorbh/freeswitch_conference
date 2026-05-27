import { useState, useCallback, useMemo } from "react";
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
import { useFetch } from "@/hooks/useFetch";
import { useSSERefresh } from "@/hooks/useSSERefresh";
import { ROOM_NAMES, timeAgo } from "@/lib/constants";
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
} from "lucide-react";

const EMPTY_FORM = {
  email: "", password: "", display_name: "", company_name: "",
  company_address: "", city: "", state: "", zip: "", room: "",
};

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
  const { data, loading, refetch } = useFetch("/api/v1/admin/users");
  useSSERefresh(refetch, ["users"]);
  const [search, setSearch] = useState("");
  const [selectedUserName, setSelectedUserName] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [actionUser, setActionUser] = useState(null);

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const users = Array.isArray(data) ? data : [];
  const selectedUser = useMemo(
    () => users.find((u) => u.userName === selectedUserName) || null,
    [users, selectedUserName]
  );
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.userName || "").toLowerCase().includes(q) ||
      (u.callerIdName || "").toLowerCase().includes(q) ||
      (u.mac || "").toLowerCase().includes(q) ||
      (u.account?.email || "").toLowerCase().includes(q) ||
      (u.account?.company_name || "").toLowerCase().includes(q) ||
      (u.account?.display_name || "").toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    const score = (u) =>
      (u.reachable ? 4 : 0) +
      (u.connectionState === "connected" ? 3 : 0) +
      (u.online ? 2 : 0) +
      (u.registrationState === "registered" ? 1 : 0);
    return score(b) - score(a);
  });

  const onlineCount = users.filter((u) => u.connectionState === "connected" || u.online).length;

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

  async function doAction(userName, action, body = null) {
    try {
      await fetch(`/api/v1/admin/users/${userName}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : null,
      });
      refetch();
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-mono tabular-nums">{users.length}</span> total,{" "}
          <span className="font-mono tabular-nums">{onlineCount}</span> online
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, company, or MAC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4 mr-2" />
          Add User
        </Button>
        <Button
          variant="destructive"
          onClick={async () => {
            if (!confirm("Kick out ALL users and disconnect all calls?")) return;
            try {
              await fetch("/api/v1/admin/users/kickout-all", { method: "POST" });
              refetch();
            } catch (e) {
              console.error("Kickout all failed:", e);
            }
          }}
        >
          <BanIcon className="size-4 mr-2" />
          Kickout All
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">
                  <div className="flex items-center gap-3 text-muted-foreground/60">
                    <WifiIcon className="size-3.5" title="Online" />
                    <ShieldIcon className="size-3.5" title="Registration" />
                    <PhoneIcon className="size-3.5" title="Call" />
                    <MicIcon className="size-3.5" title="Mute" />
                    <BanIcon className="size-3.5" title="Kickout" />
                  </div>
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Company</TableHead>
                <TableHead className="hidden md:table-cell">Room</TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow
                    key={user.userName}
                    className={`cursor-pointer group transition-colors ${user.account && !user.account.active ? "opacity-50" : ""}`}
                    onClick={() => {
                      setSelectedUserName(user.userName);
                      setSheetOpen(true);
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {user.online ? (
                          <WifiIcon className="size-4 text-emerald-500" title="Online" />
                        ) : (
                          <WifiOffIcon className="size-4 text-zinc-500" title="Offline" />
                        )}
                        {user.registrationState === "registered" ? (
                          <ShieldCheckIcon className="size-4 text-emerald-500" title="Registered" />
                        ) : user.registrationState === "expired" ? (
                          <ShieldXIcon className="size-4 text-amber-500" title="Expired" />
                        ) : (
                          <ShieldXIcon className="size-4 text-zinc-500" title="Unregistered" />
                        )}
                        {user.connectionState === "connected" ? (
                          <PhoneCallIcon className="size-4 text-emerald-500" title="In Call" />
                        ) : user.connectionState === "connecting" ? (
                          <PhoneIncomingIcon className="size-4 text-amber-500 animate-pulse" title="Connecting" />
                        ) : user.connectionState === "hangup" ? (
                          <PhoneOffIcon className="size-4 text-red-500" title="Hangup" />
                        ) : (
                          <PhoneIcon className="size-4 text-zinc-500" title="Idle" />
                        )}
                        {user.mute ? (
                          <MicOffIcon className="size-4 text-red-500" title="Muted" />
                        ) : (
                          <MicIcon className="size-4 text-emerald-500" title="Unmuted" />
                        )}
                        {user.account?.kickout ? (
                          <BanIcon className="size-4 text-red-500" title="Kicked Out" />
                        ) : (
                          <BanIcon className="size-4 text-zinc-500/30" title="Not Kicked" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <CopyableCell text={user.account?.display_name || user.callerIdName || user.userName}>
                          {user.account?.display_name || user.callerIdName || user.userName}
                        </CopyableCell>
                        {user.account && !user.account.active && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>
                        )}
                        {user.account?.kickout ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                            <BanIcon className="size-2.5" />Kicked
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      <CopyableCell text={user.account?.email || user.userName} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {user.account?.company_name || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {ROOM_NAMES[user.room] || user.room || "-"}
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
                      {timeAgo(user.updatedAt)}
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
                          <p className="text-[11px] text-muted-foreground/60">Block from joining conferences</p>
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
                        { icon: <AudioLinesIcon className="size-3.5" />, label: "Room", value: ROOM_NAMES[acc.room] || acc.room },
                      ].filter(f => f.value).map((field) => (
                        <div key={field.label} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors group">
                          <span className="text-muted-foreground/60 mt-0.5 group-hover:text-muted-foreground transition-colors">{field.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">{field.label}</p>
                            <p className="text-sm truncate">{field.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
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

                {/* Delete zone */}
                {acc?.id && (
                  <>
                    <div className="h-px bg-border/60" />
                    <div className="px-6 py-5">
                      <button
                        onClick={() => { setDeleteTarget(selectedUser); setDeleteDialogOpen(true); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-destructive/80 border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all cursor-pointer"
                      >
                        <Trash2Icon className="size-3.5" />
                        Delete User
                      </button>
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
            <div className="space-y-2">
              <Label>Company Address</Label>
              <Input
                placeholder="123 Main St"
                value={form.company_address}
                onChange={(e) => updateField("company_address", e.target.value)}
              />
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
              <Label>Conference Room</Label>
              <Select
                value={form.room}
                onValueChange={(val) => updateField("room", val)}
              >
                <SelectTrigger>
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
              Move {actionUser?.userName} to a different conference room
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Select Room</Label>
              <Select value={newRoom} onValueChange={setNewRoom}>
                <SelectTrigger>
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
              Move User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
