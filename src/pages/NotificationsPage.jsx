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
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  SendIcon,
  BellIcon,
  Loader2Icon,
  CheckIcon,
  XIcon,
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

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/notifications");
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
      const res = await fetch("/api/v1/admin/notifications/template-info");
      const json = await res.json();
      if (json.status) setTemplateInfo(json.data);
    } catch (e) {
      console.error("Failed to fetch template info:", e);
    }
  }, []);

  useEffect(() => { fetchChannels(); fetchTemplateInfo(); }, [fetchChannels, fetchTemplateInfo]);

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
        enabled: form.enabled ? 1 : 0,
      };

      const url = editing
        ? `/api/v1/admin/notifications/${editing.id}`
        : "/api/v1/admin/notifications";

      await fetch(url, {
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
    try {
      await fetch(`/api/v1/admin/notifications/${deleteId}`, { method: "DELETE" });
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
      const res = await fetch(`/api/v1/admin/notifications/${id}/test`, { method: "POST" });
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
      await fetch(`/api/v1/admin/notifications/${ch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: ch.enabled ? 0 : 1 }),
      });
      fetchChannels();
    } catch (e) {
      console.error("Toggle failed:", e);
    }
  }

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
            Send broadcast recordings to Telegram channels
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
            <p className="text-sm text-muted-foreground/60 mt-1">Add a Telegram channel to receive broadcast alerts</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => (
            <Card key={ch.id} className={!ch.enabled ? "opacity-50" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <SendIcon className="size-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{ch.label || "Unnamed Channel"}</p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          {ch.type}
                        </Badge>
                        {ch.room ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {ROOM_NAMES[ch.room] || `Room ${ch.room}`}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">All Rooms</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="font-mono truncate max-w-[200px]">{ch.chat_id}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="flex items-center gap-1">
                          {ch.send_answered ? <CheckIcon className="size-3 text-emerald-400" /> : <XIcon className="size-3 text-zinc-500" />}
                          Answered
                        </span>
                        <span className="flex items-center gap-1">
                          {ch.send_unanswered ? <CheckIcon className="size-3 text-emerald-400" /> : <XIcon className="size-3 text-zinc-500" />}
                          Unanswered
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {testResult?.id === ch.id && (
                      <span className={`text-xs ${testResult.success ? "text-emerald-400" : "text-red-400"}`}>
                        {testResult.success ? "Sent!" : testResult.error || "Failed"}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={testing === ch.id || !ch.enabled}
                      onClick={() => handleTest(ch.id)}
                    >
                      {testing === ch.id ? <Loader2Icon className="size-3 animate-spin mr-1.5" /> : <SendIcon className="size-3 mr-1.5" />}
                      Test
                    </Button>
                    <Switch
                      checked={!!ch.enabled}
                      onCheckedChange={() => toggleEnabled(ch)}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Channel" : "Add Notification Channel"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update notification channel settings." : "Configure a Telegram bot to receive broadcast alerts."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                placeholder="e.g. Main Alerts"
                value={form.label}
                onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bot Token *</Label>
                <Input
                  placeholder="123456:ABC-DEF..."
                  value={form.bot_token}
                  onChange={(e) => setForm(f => ({ ...f, bot_token: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Chat ID *</Label>
                <Input
                  placeholder="-1001234567890"
                  value={form.chat_id}
                  onChange={(e) => setForm(f => ({ ...f, chat_id: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Room Filter</Label>
              <Select
                value={form.room || "all"}
                onValueChange={(val) => setForm(f => ({ ...f, room: val === "all" ? "" : val }))}
              >
                <SelectTrigger>
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
              disabled={saving || !form.bot_token || !form.chat_id}
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
    </div>
  );
}
