import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useRooms } from "@/hooks/useRooms";
import { apiFetch } from "@/lib/api";
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  SendIcon,
  BellIcon,
  Loader2Icon,
  CheckIcon,
  XIcon,
  SmartphoneIcon,
  QrCodeIcon,
  WifiOffIcon,
  MailCheckIcon,
  MessageSquareIcon,
  ImagePlusIcon,
} from "lucide-react";

const EMPTY_FORM = {
  type: "telegram",
  label: "",
  bot_token: "",
  chat_id: "",
  room: "",
  message_template: "",
  send_answered: true,
  send_unanswered: true,
  skip_no_parts: false,
  enabled: true,
};

export default function NotificationsPage() {
  const { names: ROOM_NAMES } = useRooms();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [templateInfo, setTemplateInfo] = useState(null);
  const templateRef = useRef(null);

  // Send message state
  const [sendOpen, setSendOpen] = useState(null);
  const [sendText, setSendText] = useState("");
  const [sendImage, setSendImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const sendFileRef = useRef(null);

  // WhatsApp per-channel state
  const [waStatuses, setWaStatuses] = useState({});
  const [waGroups, setWaGroups] = useState({});
  const [connectingId, setConnectingId] = useState(null);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/admin/notifications");
      const json = await res.json();
      if (json.status) setChannels(json.data);
    } catch (e) {
      console.error("Failed to fetch channels:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplateInfo = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/admin/notifications/template-info");
      const json = await res.json();
      if (json.status) setTemplateInfo(json.data);
    } catch (e) {
      console.error("Failed to fetch template info:", e);
    }
  }, []);

  useEffect(() => { fetchChannels(); fetchTemplateInfo(); }, [fetchChannels, fetchTemplateInfo]);

  // WhatsApp statuses — manual refresh only (no polling)
  const waChannelIds = channels.filter(c => c.type === "whatsapp").map(c => c.id);
  const groupsFetchedRef = useRef(new Set());

  // Fetch statuses once on load
  const waChannelKey = waChannelIds.join(",");
  useEffect(() => {
    if (!waChannelKey) return;
    _refreshAllWaStatuses();
  }, [waChannelKey]);

  async function _refreshAllWaStatuses() {
    try {
      const res = await apiFetch("/api/v1/admin/whatsapp/statuses");
      const json = await res.json();
      if (!json.status) return;
      setWaStatuses(json.data);
      for (const id of waChannelIds) {
        if (json.data[id]?.state === "ready" && !groupsFetchedRef.current.has(id)) {
          groupsFetchedRef.current.add(id);
          apiFetch(`/api/v1/admin/whatsapp/groups/${id}`)
            .then(r => r.json())
            .then(gj => { if (gj.status) setWaGroups(prev => ({ ...prev, [id]: gj.data || [] })); })
            .catch(() => {});
        }
      }
    } catch {}
  }

  async function handleWaCheckStatus(channelId) {
    setConnectingId(channelId);
    try {
      const res = await apiFetch(`/api/v1/admin/whatsapp/status/${channelId}`);
      const json = await res.json();
      if (json.status) {
        setWaStatuses(prev => ({ ...prev, [channelId]: json.data }));
        if (json.data.state === "ready" && !groupsFetchedRef.current.has(channelId)) {
          groupsFetchedRef.current.add(channelId);
          const gRes = await apiFetch(`/api/v1/admin/whatsapp/groups/${channelId}`);
          const gJson = await gRes.json();
          if (gJson.status) setWaGroups(prev => ({ ...prev, [channelId]: gJson.data || [] }));
        }
      }
    } finally {
      setConnectingId(null);
    }
  }

  async function handleWaConnect(channelId) {
    setConnectingId(channelId);
    try {
      await apiFetch(`/api/v1/admin/whatsapp/connect/${channelId}`, { method: "POST" });
      // Wait a moment for QR to generate, then fetch
      await new Promise(r => setTimeout(r, 2000));
      const res = await apiFetch(`/api/v1/admin/whatsapp/status/${channelId}`);
      const json = await res.json();
      if (json.status) setWaStatuses(prev => ({ ...prev, [channelId]: json.data }));
    } finally {
      setConnectingId(null);
    }
  }

  async function handleWaDisconnect(channelId) {
    setConnectingId(channelId);
    try {
      await apiFetch(`/api/v1/admin/whatsapp/disconnect/${channelId}`, { method: "POST" });
      setWaStatuses(prev => ({ ...prev, [channelId]: { state: "disconnected" } }));
      setWaGroups(prev => { const n = { ...prev }; delete n[channelId]; return n; });
      groupsFetchedRef.current.delete(channelId);
    } finally {
      setConnectingId(null);
    }
  }

  function insertVariable(varName) {
    const el = templateRef.current;
    if (!el) return;
    const tag = `{{${varName}}}`;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = form.message_template || templateInfo?.defaultTemplate || "";
    const newVal = val.substring(0, start) + tag + val.substring(end);
    setForm(f => ({ ...f, message_template: newVal }));
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + tag.length;
    }, 0);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, message_template: templateInfo?.defaultTemplate || "" });
    setFormOpen(true);
  }

  function openEdit(ch) {
    setEditing(ch);
    setForm({
      type: ch.type || "telegram",
      label: ch.label || "",
      bot_token: ch.bot_token || "",
      chat_id: ch.chat_id || "",
      room: ch.room ? String(ch.room) : "",
      message_template: ch.message_template || templateInfo?.defaultTemplate || "",
      send_answered: !!ch.send_answered,
      send_unanswered: !!ch.send_unanswered,
      skip_no_parts: !!ch.skip_no_parts,
      enabled: !!ch.enabled,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        ...form,
        room: form.room ? parseInt(form.room) : null,
        message_template: form.message_template || null,
        send_answered: form.send_answered ? 1 : 0,
        send_unanswered: form.send_unanswered ? 1 : 0,
        skip_no_parts: form.skip_no_parts ? 1 : 0,
        enabled: form.enabled ? 1 : 0,
      };

      const url = editing
        ? `/api/v1/admin/notifications/${editing.id}`
        : "/api/v1/admin/notifications";

      await apiFetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setFormOpen(false);
      fetchChannels();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const ch = channels.find(c => c.id === deleteId);
    try {
      if (ch?.type === "whatsapp") {
        await apiFetch(`/api/v1/admin/whatsapp/disconnect/${deleteId}`, { method: "POST" }).catch(() => {});
      }
      await apiFetch(`/api/v1/admin/notifications/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      fetchChannels();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }

  async function handleTest(id) {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await apiFetch(`/api/v1/admin/notifications/${id}/test`, { method: "POST" });
      const json = await res.json();
      setTestResult({ id, success: json.status, error: json.error });
    } catch (e) {
      setTestResult({ id, success: false, error: e.message });
    } finally {
      setTesting(null);
    }
  }

  async function toggleEnabled(ch) {
    try {
      await apiFetch(`/api/v1/admin/notifications/${ch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: ch.enabled ? 0 : 1 }),
      });
      fetchChannels();
    } catch (e) {
      console.error("Toggle failed:", e);
    }
  }

  function openSend(ch) {
    setSendOpen(ch);
    setSendText("");
    setSendImage(null);
    setSendResult(null);
  }

  async function handleSend() {
    if (!sendOpen) return;
    setSending(true);
    setSendResult(null);
    try {
      const formData = new FormData();
      if (sendText) formData.append("text", sendText);
      if (sendImage) formData.append("image", sendImage);
      const res = await apiFetch(`/api/v1/admin/notifications/${sendOpen.id}/send`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.status) {
        setSendResult({ success: true });
        fetchChannels();
      } else {
        setSendResult({ success: false, error: json.error });
      }
    } catch (e) {
      setSendResult({ success: false, error: e.message });
    } finally {
      setSending(false);
    }
  }

  const canSave = form.chat_id && (form.type === "whatsapp" || form.bot_token);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Send broadcast recordings to Telegram and WhatsApp
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4 mr-2" />
          Add Channel
        </Button>
      </div>

      {channels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BellIcon className="size-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No notification channels configured</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Add a channel to receive broadcast alerts</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => {
            const isWhatsApp = ch.type === "whatsapp";
            const waSt = isWhatsApp ? (waStatuses[ch.id] || { state: "disconnected" }) : null;
            const chGroups = isWhatsApp ? (waGroups[ch.id] || []) : [];
            const groupName = isWhatsApp ? chGroups.find(g => g.id === ch.chat_id)?.name : null;
            const waMissingGroup = isWhatsApp && !ch.chat_id;
            const waNotReady = isWhatsApp && (waMissingGroup || waSt?.state !== "ready");

            return (
              <Card key={ch.id} className={!ch.enabled || waNotReady ? "opacity-60" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isWhatsApp
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-blue-500/10 border border-blue-500/20"
                      }`}>
                        {isWhatsApp
                          ? <SmartphoneIcon className="size-4 text-emerald-400" />
                          : <SendIcon className="size-4 text-blue-400" />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{ch.label || "Unnamed Channel"}</p>
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ${
                            isWhatsApp ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : ""
                          }`}>
                            {ch.type}
                          </Badge>
                          {isWhatsApp && waSt && (
                            <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${
                              waSt.state === "ready"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : waSt.state === "qr_pending"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                            }`}>
                              {waSt.state === "ready" ? (waSt.phone || "Connected") : waSt.state === "qr_pending" ? "Scan QR" : "Disconnected"}
                            </Badge>
                          )}
                          {ch.room ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                              {ROOM_NAMES[ch.room] || `Room ${ch.room}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">All Rooms</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="font-mono truncate max-w-[200px]">{groupName || ch.chat_id || (isWhatsApp ? "No group selected" : "")}</span>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="flex items-center gap-1">
                            {ch.send_answered ? <CheckIcon className="size-3 text-emerald-400" /> : <XIcon className="size-3 text-zinc-500" />}
                            Answered
                          </span>
                          <span className="flex items-center gap-1">
                            {ch.send_unanswered ? <CheckIcon className="size-3 text-emerald-400" /> : <XIcon className="size-3 text-zinc-500" />}
                            Unanswered
                          </span>
                          {(ch.delivered_count > 0) && (
                            <>
                              <span className="text-muted-foreground/40">•</span>
                              <span className="flex items-center gap-1 text-emerald-400">
                                <MailCheckIcon className="size-3" />
                                {ch.delivered_count} delivered
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* WhatsApp connect/disconnect */}
                      {isWhatsApp && waSt?.state === "disconnected" && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => handleWaConnect(ch.id)} disabled={connectingId === ch.id}>
                          {connectingId === ch.id ? <Loader2Icon className="size-3 animate-spin mr-1.5" /> : <QrCodeIcon className="size-3 mr-1.5" />}
                          Connect
                        </Button>
                      )}
                      {isWhatsApp && waSt?.state === "ready" && (
                        <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => handleWaDisconnect(ch.id)} disabled={connectingId === ch.id}>
                          <WifiOffIcon className="size-3 mr-1.5" />
                          Disconnect
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        disabled={!ch.enabled || waNotReady}
                        onClick={() => {
                          if (waMissingGroup) { openEdit(ch); return; }
                          openSend(ch);
                        }}
                      >
                        <SendIcon className="size-3.5" />
                      </Button>
                      <Switch
                        checked={!!ch.enabled}
                        onCheckedChange={() => {
                          if (waMissingGroup) { openEdit(ch); return; }
                          toggleEnabled(ch);
                        }}
                        disabled={waMissingGroup}
                        className="data-checked:bg-emerald-500"
                      />
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(ch)}>
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => setDeleteId(ch.id)}>
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  {/* Warning: no group selected */}
                  {waMissingGroup && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
                      <XIcon className="size-3.5 shrink-0" />
                      No group selected — click <button className="underline underline-offset-2 font-medium cursor-pointer" onClick={() => openEdit(ch)}>Edit</button> to choose a WhatsApp group
                    </div>
                  )}
                  {/* Inline QR code when scanning */}
                  {isWhatsApp && waSt?.state === "qr_pending" && waSt.qr && (
                    <div className="mt-3 flex flex-col items-center gap-3 py-3 border-t border-border/30">
                      <img src={waSt.qr} alt="WhatsApp QR" className="w-44 h-44 rounded-lg border border-border/40" />
                      <p className="text-[11px] text-muted-foreground/60">Open WhatsApp → Linked Devices → Scan this QR code</p>
                      <Button size="sm" variant="outline" onClick={() => handleWaCheckStatus(ch.id)} disabled={connectingId === ch.id}>
                        {connectingId === ch.id ? <Loader2Icon className="size-3 animate-spin mr-1.5" /> : <CheckIcon className="size-3 mr-1.5" />}
                        I've Scanned — Check Status
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Channel" : "Add Notification Channel"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update notification channel settings." : "Configure a channel to receive broadcast alerts."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            {/* Channel Type */}
            <div className="space-y-2">
              <Label>Channel Type</Label>
              <Select
                value={form.type}
                onValueChange={(val) => setForm(f => ({ ...f, type: val, bot_token: "", chat_id: "" }))}
              >
                <SelectTrigger className="!w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                placeholder="e.g. Main Alerts"
                value={form.label}
                onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>

            {/* Telegram fields */}
            {form.type === "telegram" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bot Token *</Label>
                  <Input
                    placeholder="123456:ABC-DEF..."
                    value={form.bot_token}
                    onChange={(e) => setForm(f => ({ ...f, bot_token: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                    Message <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary/70 hover:text-primary underline underline-offset-2">@BotFather</a> on Telegram → /newbot → copy the token
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Chat ID *</Label>
                  <Input
                    placeholder="-1001234567890"
                    value={form.chat_id}
                    onChange={(e) => setForm(f => ({ ...f, chat_id: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                    Add the bot to your group → send a message → open <span className="font-mono text-[10px]">api.telegram.org/bot<wbr/>&lt;TOKEN&gt;/getUpdates</span> → find the <span className="font-mono text-[10px]">chat.id</span>
                  </p>
                </div>
              </div>
            )}

            {/* WhatsApp fields */}
            {form.type === "whatsapp" && !editing && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm text-blue-400">
                <SmartphoneIcon className="size-3.5 shrink-0" />
                Save first, then connect WhatsApp and select a group from the channel card
              </div>
            )}

            {form.type === "whatsapp" && editing && (() => {
              const st = waStatuses[editing.id] || { state: "disconnected" };
              const groups = waGroups[editing.id] || [];
              return (
                <div className="space-y-2">
                  <Label>WhatsApp Group *</Label>
                  {st.state !== "ready" ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm text-amber-400">
                      <WifiOffIcon className="size-3.5 shrink-0" />
                      Connect WhatsApp first using the channel card's Connect button
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40 text-sm text-muted-foreground">
                      <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
                      Loading groups...
                    </div>
                  ) : (
                    <Select
                      value={form.chat_id || ""}
                      onValueChange={(val) => setForm(f => ({ ...f, chat_id: val }))}
                    >
                      <SelectTrigger className="!w-full">
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })()}

            <div className="space-y-2">
              <Label>Room Filter</Label>
              <Select
                value={form.room || "all"}
                onValueChange={(val) => setForm(f => ({ ...f, room: val === "all" ? "" : val }))}
                items={{ all: "All Rooms", ...ROOM_NAMES }}
              >
                <SelectTrigger className="!w-full">
                  <SelectValue placeholder="All Rooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {Object.entries(ROOM_NAMES).map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message Template */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Message Template</Label>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  onClick={() => setForm(f => ({ ...f, message_template: templateInfo?.defaultTemplate || "" }))}
                >
                  Reset to default
                </button>
              </div>
              <textarea
                ref={templateRef}
                className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-y"
                value={form.message_template}
                onChange={(e) => setForm(f => ({ ...f, message_template: e.target.value }))}
                placeholder="Enter message template..."
              />
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium">Available Variables — click to insert</p>
                <div className="flex flex-wrap gap-1">
                  {templateInfo?.variables && Object.entries(templateInfo.variables).map(([key, desc]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => insertVariable(key)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-muted/50 border border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border/60 transition-all cursor-pointer"
                      title={desc}
                    >
                      {`{{${key}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40">
                <Label className="text-sm">Send Answered</Label>
                <Switch
                  checked={form.send_answered}
                  onCheckedChange={(v) => setForm(f => ({ ...f, send_answered: v }))}
                  className="data-checked:bg-emerald-500"
                />
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40">
                <Label className="text-sm">Send Unanswered</Label>
                <Switch
                  checked={form.send_unanswered}
                  onCheckedChange={(v) => setForm(f => ({ ...f, send_unanswered: v }))}
                  className="data-checked:bg-emerald-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40">
              <div>
                <Label className="text-sm">Skip if no parts request</Label>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">Only notify when year/part number is detected</p>
              </div>
              <Switch
                checked={form.skip_no_parts}
                onCheckedChange={(v) => setForm(f => ({ ...f, skip_no_parts: v }))}
                className="data-checked:bg-amber-500"
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40">
              <Label className="text-sm">Enabled</Label>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm(f => ({ ...f, enabled: v }))}
                className="data-checked:bg-emerald-500"
              />
            </div>
            <Button
              className="w-full mt-2"
              onClick={handleSave}
              disabled={saving || (form.type === "telegram" && !canSave)}
            >
              {saving ? "Saving..." : editing ? "Update Channel" : "Add Channel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Channel</DialogTitle>
            <DialogDescription>
              Are you sure? This channel will stop receiving broadcast notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={!!sendOpen} onOpenChange={(open) => { if (!open) setSendOpen(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>
              Send to {sendOpen?.label || "channel"} via {sendOpen?.type}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="space-y-2">
              <Label>Message</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                placeholder="Type your message..."
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Image (optional)</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => sendFileRef.current?.click()}
                >
                  <ImagePlusIcon className="size-3.5 mr-1.5" />
                  {sendImage ? "Change" : "Attach"}
                </Button>
                {sendImage && (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">{sendImage.name}</span>
                    <button className="text-muted-foreground/50 hover:text-foreground cursor-pointer" onClick={() => { setSendImage(null); if (sendFileRef.current) sendFileRef.current.value = ""; }}>
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                )}
                <input
                  ref={sendFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setSendImage(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            {sendResult && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                sendResult.success
                  ? "bg-emerald-500/[0.06] border border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/[0.06] border border-red-500/20 text-red-400"
              }`}>
                {sendResult.success ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
                {sendResult.success ? "Message sent!" : sendResult.error || "Failed"}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleSend}
              disabled={sending || (!sendText.trim() && !sendImage)}
            >
              {sending ? <Loader2Icon className="size-3.5 animate-spin mr-1.5" /> : <SendIcon className="size-3.5 mr-1.5" />}
              {sending ? "Sending..." : "Send"}
            </Button>
            {sendOpen && (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleTest(sendOpen.id)}
                  disabled={testing === sendOpen.id}
                >
                  {testing === sendOpen.id ? <Loader2Icon className="size-3.5 animate-spin mr-1.5" /> : <SendIcon className="size-3.5 mr-1.5" />}
                  Send Test Message
                </Button>
                {testResult?.id === sendOpen.id && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                    testResult.success
                      ? "bg-emerald-500/[0.06] border border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/[0.06] border border-red-500/20 text-red-400"
                  }`}>
                    {testResult.success ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
                    {testResult.success ? "Test message sent!" : testResult.error || "Failed"}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
