import { useState, useEffect, useCallback } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  KeyIcon,
  UserIcon,
  CopyIcon,
  CheckIcon,
  Loader2Icon,
  EyeIcon,
  EyeOffIcon,
  UsersIcon,
  ShieldIcon,
  SettingsIcon,
  XIcon,
  MicIcon,
  TimerIcon,
} from "lucide-react";

const ROLE_LABELS = { admin: "Admin", editor: "Editor", analytics: "Analytics" };
const ROLE_COLORS = {
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  editor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  analytics: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};
const EMPTY_ADMIN = { email: "", password: "", name: "", role: "editor" };

const NAV = [
  { key: "general", label: "General", icon: SettingsIcon },
  { key: "audio", label: "Audio / STT", icon: MicIcon },
  { key: "users", label: "Admin Users", icon: UsersIcon },
  { key: "api-keys", label: "API Keys", icon: KeyIcon },
  { key: "security", label: "Security", icon: ShieldIcon },
];

export function SettingsDialog({ open, onOpenChange, initialTab }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab || "general");

  const [admins, setAdmins] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingKeys, setLoadingKeys] = useState(true);

  const [adminFormOpen, setAdminFormOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [deleteAdminId, setDeleteAdminId] = useState(null);
  const [deletingAdmin, setDeletingAdmin] = useState(false);

  const [keyFormOpen, setKeyFormOpen] = useState(false);
  const [keyLabel, setKeyLabel] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState(null);
  const [deletingKey, setDeletingKey] = useState(false);

  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  const fetchAdmins = useCallback(async () => {
    try {
      const r = await apiFetch("/api/v1/auth/admins"); const j = await r.json();
      if (j.status) setAdmins(j.data);
    } catch {} finally { setLoadingAdmins(false); }
  }, []);
  const fetchApiKeys = useCallback(async () => {
    try {
      const r = await apiFetch("/api/v1/auth/api-keys"); const j = await r.json();
      if (j.status) setApiKeys(j.data);
    } catch {} finally { setLoadingKeys(false); }
  }, []);
  useEffect(() => { if (open) { fetchAdmins(); fetchApiKeys(); } }, [open, fetchAdmins, fetchApiKeys]);

  function openCreateAdmin() { setEditingAdmin(null); setAdminForm(EMPTY_ADMIN); setAdminError(""); setShowPw(false); setAdminFormOpen(true); }
  function openEditAdmin(a) { setEditingAdmin(a); setAdminForm({ email: a.email, password: "", name: a.name, role: a.role }); setAdminError(""); setShowPw(false); setAdminFormOpen(true); }
  async function handleSaveAdmin() {
    setSavingAdmin(true); setAdminError("");
    try {
      const body = { ...adminForm }; if (editingAdmin && !body.password) delete body.password;
      const url = editingAdmin ? `/api/v1/auth/admins/${editingAdmin.id}` : "/api/v1/auth/admins";
      const r = await apiFetch(url, { method: editingAdmin ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "Failed");
      setAdminFormOpen(false); fetchAdmins();
    } catch (e) { setAdminError(e.message); } finally { setSavingAdmin(false); }
  }
  async function handleDeleteAdmin() {
    if (!deleteAdminId) return; setDeletingAdmin(true);
    try { await apiFetch(`/api/v1/auth/admins/${deleteAdminId}`, { method: "DELETE" }); setDeleteAdminId(null); fetchAdmins(); }
    catch {} finally { setDeletingAdmin(false); }
  }
  function openCreateKey() { setKeyLabel(""); setNewKey(null); setCopiedKey(false); setKeyFormOpen(true); }
  async function handleCreateKey() {
    if (!keyLabel.trim()) return; setSavingKey(true);
    try {
      const r = await apiFetch("/api/v1/auth/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: keyLabel }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "Failed");
      setNewKey(j.data.key); fetchApiKeys();
    } catch {} finally { setSavingKey(false); }
  }
  async function handleDeleteKey() {
    if (!deleteKeyId) return; setDeletingKey(true);
    try { await apiFetch(`/api/v1/auth/api-keys/${deleteKeyId}`, { method: "DELETE" }); setDeleteKeyId(null); fetchApiKeys(); }
    catch {} finally { setDeletingKey(false); }
  }
  function copyKey() { if (!newKey) return; navigator.clipboard.writeText(newKey); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150"
          />
          <DialogPrimitive.Popup
            className={cn(
              "fixed z-50 outline-none duration-150",
              "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-[calc(100vw-1rem)] sm:w-[min(92vw,820px)]",
              "rounded-2xl bg-popover text-popover-foreground shadow-2xl",
              "border border-border/60",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97]",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97]",
            )}
          >
            <DialogPrimitive.Close className="absolute right-3 top-3 z-20 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>

            <div className="flex h-[min(92dvh,640px)] flex-col overflow-hidden rounded-2xl md:h-[min(80vh,580px)] md:flex-row">
              {/* ─── Sidebar ─── */}
              <div className="shrink-0 border-b border-border/50 bg-muted/20 md:w-[200px] md:border-b-0 md:border-r flex flex-col">
                <div className="px-4 pt-4 pb-2 md:px-5 md:pt-5 md:pb-3">
                  <h2 className="text-[13px] font-semibold tracking-tight">Settings</h2>
                </div>
                <nav className="flex gap-1 overflow-x-auto px-2.5 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-4 md:space-y-px">
                  {NAV.map(item => {
                    const Icon = item.icon;
                    const active = tab === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setTab(item.key)}
                        className={cn(
                          "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[12px] transition-all duration-100 md:w-full md:gap-2.5 md:px-2.5 md:py-[7px] md:text-[13px]",
                          active
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        )}
                      >
                        <Icon className="size-[15px] shrink-0 opacity-70" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* ─── Content ─── */}
              <div className="flex-1 overflow-y-auto min-w-0">
                <div className="p-4 md:p-7">
                  {tab === "general" && <GeneralPane user={user} />}
                  {tab === "audio" && <AudioPane />}
                  {tab === "users" && <UsersPane admins={admins} loading={loadingAdmins} uid={user?.id} onCreate={openCreateAdmin} onEdit={openEditAdmin} onDelete={setDeleteAdminId} />}
                  {tab === "api-keys" && <KeysPane keys={apiKeys} loading={loadingKeys} onCreate={openCreateKey} onDelete={setDeleteKeyId} />}
                  {tab === "security" && <SecurityPane />}
                </div>
              </div>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <AdminFormDialog open={adminFormOpen} onOpenChange={setAdminFormOpen} editing={editingAdmin} form={adminForm} setForm={setAdminForm} error={adminError} saving={savingAdmin} showPw={showPw} setShowPw={setShowPw} onSave={handleSaveAdmin} />
      <ConfirmDialog open={!!deleteAdminId} onOpenChange={() => setDeleteAdminId(null)} title="Delete Admin User" desc="This will permanently remove their access and revoke active sessions." action="Delete" loading={deletingAdmin} onConfirm={handleDeleteAdmin} />
      <KeyFormDialog open={keyFormOpen} onOpenChange={o => { if (!o) { setKeyFormOpen(false); setNewKey(null); } }} label={keyLabel} setLabel={setKeyLabel} saving={savingKey} newKey={newKey} copied={copiedKey} onGenerate={handleCreateKey} onCopy={copyKey} onDone={() => { setKeyFormOpen(false); setNewKey(null); }} />
      <ConfirmDialog open={!!deleteKeyId} onOpenChange={() => setDeleteKeyId(null)} title="Revoke API Key" desc="Any device or integration using this key will immediately lose access." action="Revoke" loading={deletingKey} onConfirm={handleDeleteKey} />
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Panes                                                     */
/* ────────────────────────────────────────────────────────── */

function Heading({ children, sub, right }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight">{children}</h3>
        {sub && <p className="text-[13px] text-muted-foreground/70 mt-1">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Row({ label, hint, children, noBorder }) {
  return (
    <div className={cn("flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4", !noBorder && "border-b border-border/40")}>
      <div className="min-w-0">
        <p className="text-[13px]">{label}</p>
        {hint && <p className="text-[12px] text-muted-foreground/60 mt-px">{hint}</p>}
      </div>
      <div className="min-w-0 sm:shrink-0 sm:text-right">{children}</div>
    </div>
  );
}

function GeneralPane({ user }) {
  const initials = (user?.name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [automuteEnabled, setAutomuteEnabled] = useState(false);
  const [automuteMinutes, setAutomuteMinutes] = useState(3);

  useEffect(() => {
    apiFetch('/api/v1/admin/settings/general').then(r => r.json()).then(j => {
      if (j.status && j.data) {
        setAutomuteEnabled(j.data.automute_enabled);
        setAutomuteMinutes(Math.round(j.data.automute_timeout_ms / 60000));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/admin/settings/general', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automute_enabled: automuteEnabled,
          automute_timeout_ms: automuteMinutes * 60000,
        }),
      });
      const json = await res.json();
      if (json.status) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {} finally { setSaving(false); }
  };

  return (
    <>
      <Heading sub="Your profile and conference preferences">General</Heading>

      <section className="mb-7">
        <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-3">Profile</p>
        <div className="rounded-xl border border-border/40 bg-card/50 px-4">
          <Row label="Avatar">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">{initials}</div>
          </Row>
          <Row label="Full name">
            <span className="block max-w-full break-words text-[13px] text-muted-foreground">{user?.name}</span>
          </Row>
          <Row label="Email">
            <span className="block max-w-full break-all text-[13px] text-muted-foreground">{user?.email}</span>
          </Row>
          <Row label="Role" noBorder>
            <Badge variant="outline" className={cn("text-[11px]", ROLE_COLORS[user?.role])}>{ROLE_LABELS[user?.role]}</Badge>
          </Row>
        </div>
      </section>

      {/* ─── Auto-Mute ─── */}
      <section className="mb-7">
        <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-3">Conference</p>

        <div className={cn(
          "relative rounded-xl border px-4 py-3.5 mb-4 overflow-hidden transition-all duration-300",
          automuteEnabled
            ? "border-amber-500/25 bg-amber-500/[0.04]"
            : "border-border/40 bg-card/50"
        )}>
          {automuteEnabled && (
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'repeating-linear-gradient(90deg, currentColor 0px, currentColor 1px, transparent 1px, transparent 6px)',
              color: '#f59e0b',
            }} />
          )}
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={cn(
                "flex size-9 items-center justify-center rounded-lg transition-all duration-300",
                automuteEnabled
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-muted/60 text-muted-foreground/40"
              )}>
                <TimerIcon className="size-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium">Auto-Mute</span>
                  {automuteEnabled && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-px">
                      <span className="size-1 rounded-full bg-amber-400 animate-pulse" />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  {automuteEnabled
                    ? `Unmuted users will be auto-muted after ${automuteMinutes} min`
                    : 'Automatically mute users who forget to mute'}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setAutomuteEnabled(!automuteEnabled); setSaved(false); }}
              className={cn(
                "relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer rounded-full border-2 transition-all duration-300",
                automuteEnabled
                  ? "bg-amber-500 border-amber-500/80"
                  : "bg-muted/80 border-border/60"
              )}
            >
              <span className={cn(
                "pointer-events-none block size-[18px] rounded-full bg-white shadow-md ring-0 transition-transform duration-300",
                automuteEnabled ? "translate-x-[18px]" : "translate-x-0"
              )} />
            </button>
          </div>
        </div>

        {automuteEnabled && (
        <div className="rounded-xl border border-border/40 bg-card/50 px-4">
            <div className="flex flex-col gap-2 py-3 border-b border-border/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-[13px]">Timeout</p>
                <p className="text-[11px] text-muted-foreground/50 mt-px">Max unmuted duration before auto-mute</p>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={automuteMinutes}
                  onChange={e => { setAutomuteMinutes(Math.max(1, Math.min(30, parseInt(e.target.value) || 1))); setSaved(false); }}
                  className="w-[90px] sm:w-[70px] h-8 sm:h-7 text-[12px] text-center"
                />
                <span className="text-[12px] text-muted-foreground/50">min</span>
              </div>
            </div>
            <Row label="Warning" hint="Tone + screen notification 30s before mute" noBorder>
              <span className="text-[12px] text-muted-foreground/50">
                at {Math.max(0, automuteMinutes * 60 - 30)}s
              </span>
            </Row>
          </div>
        )}
      </section>

      {/* ─── Save ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-muted-foreground/30">
          {automuteEnabled ? `Auto-mute after ${automuteMinutes} min` : ''}
        </p>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || loading}
          className={cn(
            "h-9 sm:h-8 w-full sm:w-auto text-xs px-5 transition-all duration-200",
            saved && "bg-emerald-600 hover:bg-emerald-600 text-white"
          )}
        >
          {saving
            ? <><Loader2Icon className="size-3.5 animate-spin mr-1.5" />Saving…</>
            : saved
              ? <><CheckIcon className="size-3.5 mr-1.5" />Saved</>
              : 'Save Settings'
          }
        </Button>
      </div>
    </>
  );
}

const DEEPGRAM_MODELS = [
  { id: 'nova-3', label: 'Nova 3 (Latest)' },
  { id: 'nova-3-medical', label: 'Nova 3 Medical' },
  { id: 'nova-3-finance', label: 'Nova 3 Finance' },
  { id: 'nova-2', label: 'Nova 2' },
  { id: 'nova-2-phonecall', label: 'Nova 2 Phone Call' },
  { id: 'nova-2-meeting', label: 'Nova 2 Meeting' },
  { id: 'whisper-large', label: 'Whisper Large' },
  { id: 'whisper-medium', label: 'Whisper Medium' },
];

const OPENROUTER_MODELS = [
  { id: 'openai/whisper-large-v3-turbo', label: 'Whisper Large V3 Turbo' },
  { id: 'openai/whisper-large-v3', label: 'Whisper Large V3' },
  { id: 'openai/whisper-1', label: 'Whisper 1' },
  { id: 'openai/gpt-4o-transcribe', label: 'GPT-4o Transcribe' },
  { id: 'openai/gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe' },
  { id: 'google/chirp-3', label: 'Google Chirp 3' },
  { id: 'microsoft/mai-transcribe-1.5', label: 'Microsoft MAI Transcribe' },
  { id: 'nvidia/parakeet-tdt-0.6b-v3', label: 'NVIDIA Parakeet V3' },
];

const STT_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'hi', label: 'Hindi' },
  { id: 'multi', label: 'Auto-detect (Multi)' },
];

function AudioPane() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    provider: 'deepgram',
    deepgram_api_key: '',
    deepgram_model: 'nova-3',
    openrouter_api_key: '',
    openrouter_model: 'openai/whisper-large-v3-turbo',
    language: 'en',
  });
  const [customModel, setCustomModel] = useState('');

  useEffect(() => {
    apiFetch('/api/v1/admin/settings/audio').then(r => r.json()).then(j => {
      if (j.status && j.data) {
        setSettings(j.data);
        const models = j.data.provider === 'deepgram' ? DEEPGRAM_MODELS : OPENROUTER_MODELS;
        const modelId = j.data.provider === 'deepgram' ? j.data.deepgram_model : j.data.openrouter_model;
        if (modelId && !models.some(m => m.id === modelId)) {
          setCustomModel(modelId);
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const update = (field, value) => {
    setSettings(s => ({ ...s, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...settings };
      if (body.deepgram_api_key?.startsWith('••••')) delete body.deepgram_api_key;
      if (body.openrouter_api_key?.startsWith('••••')) delete body.openrouter_api_key;
      const res = await apiFetch('/api/v1/admin/settings/audio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.status) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {} finally { setSaving(false); }
  };

  const models = settings.provider === 'deepgram' ? DEEPGRAM_MODELS : OPENROUTER_MODELS;
  const activeModelKey = settings.provider === 'deepgram' ? 'deepgram_model' : 'openrouter_model';
  const activeModelValue = settings[activeModelKey];
  const isCustom = activeModelValue && !models.some(m => m.id === activeModelValue);
  const activeApiKeyField = settings.provider === 'deepgram' ? 'deepgram_api_key' : 'openrouter_api_key';
  const hasKey = !!(settings[activeApiKeyField] && settings[activeApiKeyField] !== '');

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-3 w-72 opacity-50" />
      <Skeleton className="h-[72px] rounded-xl mt-4" />
      <Skeleton className="h-[180px] rounded-xl" />
    </div>
  );

  return (
    <>
      <Heading sub="Speech-to-text transcription for broadcast recordings">Audio / STT</Heading>

      {/* ─── Status Banner ─── */}
      <div className={cn(
        "relative rounded-xl border px-4 py-3.5 mb-6 overflow-hidden transition-all duration-300",
        settings.enabled
          ? "border-emerald-500/25 bg-emerald-500/[0.04]"
          : "border-border/40 bg-card/50"
      )}>
        {settings.enabled && (
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, currentColor 0px, currentColor 1px, transparent 1px, transparent 6px)',
            color: '#10b981',
          }} />
        )}
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-all duration-300",
              settings.enabled
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-muted/60 text-muted-foreground/40"
            )}>
              <MicIcon className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium">Transcription Engine</span>
                {settings.enabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-px">
                    <span className="size-1 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                {settings.enabled ? 'Broadcasts will be converted to text' : 'Enable to transcribe broadcast recordings'}
              </p>
            </div>
          </div>
          <button
            onClick={() => update('enabled', !settings.enabled)}
            className={cn(
              "relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer rounded-full border-2 transition-all duration-300",
              settings.enabled
                ? "bg-emerald-500 border-emerald-500/80"
                : "bg-muted/80 border-border/60"
            )}
          >
            <span className={cn(
              "pointer-events-none block size-[18px] rounded-full bg-white shadow-md ring-0 transition-transform duration-300",
              settings.enabled ? "translate-x-[18px]" : "translate-x-0"
            )} />
          </button>
        </div>
      </div>

      {/* ─── Provider Selection ─── */}
      <section className="mb-6">
        <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-3">Provider</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[
            { id: 'deepgram', name: 'Deepgram', desc: 'Nova 3 & Whisper models', accent: 'emerald' },
            { id: 'openrouter', name: 'OpenRouter', desc: 'Multi-provider STT gateway', accent: 'sky' },
          ].map(p => {
            const selected = settings.provider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { update('provider', p.id); setShowKey(false); }}
                className={cn(
                  "group relative rounded-xl border px-3.5 py-3 text-left transition-all duration-150",
                  selected
                    ? p.accent === 'emerald'
                      ? "border-emerald-500/30 bg-emerald-500/[0.06] ring-1 ring-emerald-500/10"
                      : "border-sky-500/30 bg-sky-500/[0.06] ring-1 ring-sky-500/10"
                    : "border-border/40 bg-card/30 hover:bg-card/60 hover:border-border/60"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "flex size-7 items-center justify-center rounded-md text-[11px] font-bold tracking-tight transition-colors",
                    selected
                      ? p.accent === 'emerald' ? "bg-emerald-500/20 text-emerald-400" : "bg-sky-500/20 text-sky-400"
                      : "bg-muted/50 text-muted-foreground/40"
                  )}>
                    {p.id === 'deepgram' ? 'DG' : 'OR'}
                  </div>
                  <div className="min-w-0 pr-5">
                    <p className={cn("text-[12px] font-medium", selected ? "text-foreground" : "text-muted-foreground")}>{p.name}</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-px">{p.desc}</p>
                  </div>
                </div>
                {selected && (
                  <div className={cn(
                    "absolute top-2 right-2 flex size-4 items-center justify-center rounded-full",
                    p.accent === 'emerald' ? "bg-emerald-500/20 text-emerald-400" : "bg-sky-500/20 text-sky-400"
                  )}>
                    <CheckIcon className="size-2.5" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Configuration ─── */}
      {settings.enabled && (
        <section className="mb-6">
          <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-3">
            Configuration
          </p>
          <div className="rounded-xl border border-border/40 bg-card/50 px-4">
            {/* API Key */}
            <div className="flex flex-col gap-2 py-3 border-b border-border/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px]">API Key</p>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-medium",
                    hasKey
                      ? "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400/80 border border-amber-500/20"
                  )}>
                    <span className={cn("size-1 rounded-full", hasKey ? "bg-emerald-400" : "bg-amber-400")} />
                    {hasKey ? 'Set' : 'Required'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/50 mt-px">
                  {settings.provider === 'deepgram' ? 'console.deepgram.com' : 'openrouter.ai/settings/keys'}
                </p>
              </div>
              <div className="relative w-full sm:w-auto sm:shrink-0">
                <Input
                  type={showKey ? "text" : "password"}
                  value={settings[activeApiKeyField]}
                  onChange={e => update(activeApiKeyField, e.target.value)}
                  placeholder="Paste key here"
                  className="w-full sm:w-[200px] h-8 sm:h-7 text-[11px] font-mono pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOffIcon className="size-3" /> : <EyeIcon className="size-3" />}
                </button>
              </div>
            </div>

            {/* Model */}
            <div className="flex flex-col gap-2 py-3 border-b border-border/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-[13px]">Model</p>
                <p className="text-[11px] text-muted-foreground/50 mt-px">
                  {isCustom ? 'Custom model ID' : models.find(m => m.id === activeModelValue)?.label || 'Select a model'}
                </p>
              </div>
              <Select
                value={isCustom ? '__custom__' : activeModelValue}
                onValueChange={v => {
                  if (v === '__custom__') {
                    update(activeModelKey, customModel || '');
                  } else {
                    update(activeModelKey, v);
                    setCustomModel('');
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-[200px] h-8 sm:h-7 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  <SelectItem value="__custom__">Custom model ID…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom model input */}
            {(isCustom || activeModelValue === '') && (
              <div className="flex flex-col gap-2 py-3 border-b border-border/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-[13px]">Custom ID</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-px">Exact provider model identifier</p>
                </div>
                <Input
                  value={isCustom ? activeModelValue : customModel}
                  onChange={e => {
                    setCustomModel(e.target.value);
                    update(activeModelKey, e.target.value);
                  }}
                  placeholder="e.g. nova-3-medical"
                  className="w-full sm:w-[200px] h-8 sm:h-7 text-[11px] font-mono"
                />
              </div>
            )}

            {/* Language */}
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-[13px]">Language</p>
                <p className="text-[11px] text-muted-foreground/50 mt-px">Audio content language</p>
              </div>
              <Select value={settings.language} onValueChange={v => update('language', v)}>
                <SelectTrigger className="w-full sm:w-[200px] h-8 sm:h-7 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STT_LANGUAGES.map(l => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      )}

      {/* ─── Save ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-muted-foreground/30">
          {settings.enabled && hasKey
            ? `${settings.provider === 'deepgram' ? 'Deepgram' : 'OpenRouter'} ready`
            : ''}
        </p>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "h-9 sm:h-8 w-full sm:w-auto text-xs px-5 transition-all duration-200",
            saved && "bg-emerald-600 hover:bg-emerald-600 text-white"
          )}
        >
          {saving
            ? <><Loader2Icon className="size-3.5 animate-spin mr-1.5" />Saving…</>
            : saved
              ? <><CheckIcon className="size-3.5 mr-1.5" />Saved</>
              : 'Save Settings'
          }
        </Button>
      </div>

      {/* ─── Info Footer ─── */}
      <div className="mt-5 rounded-xl bg-muted/[0.08] border border-border/25 px-4 py-3 flex items-start gap-3">
        <div className="shrink-0 mt-px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </div>
        <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
          Enable per-room auto-transcription in <strong className="text-muted-foreground/60 font-medium">Rooms</strong> settings.
          Broadcasts in enabled rooms will be transcribed automatically after recording completes.
        </p>
      </div>
    </>
  );
}

function UsersPane({ admins, loading, uid, onCreate, onEdit, onDelete }) {
  return (
    <>
      <Heading sub="Manage who can access the console" right={
        <Button size="sm" className="h-9 w-full text-xs sm:h-8 sm:w-auto" onClick={onCreate}><PlusIcon className="size-3.5 mr-1" />Add User</Button>
      }>Admin Users</Heading>
      {loading ? (
        <div className="space-y-2">{[0, 1].map(i => <Skeleton key={i} className="h-[60px] rounded-xl" />)}</div>
      ) : admins.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 py-14 text-center">
          <UsersIcon className="size-6 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-[13px] text-muted-foreground/60">No admin users yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card/50 divide-y divide-border/40">
          {admins.map(a => (
            <div key={a.id} className="group flex items-center gap-3 px-3 py-3 sm:px-4 hover:bg-muted/30 transition-colors duration-100">
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <UserIcon className="size-3.5 text-muted-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-medium truncate">{a.name}</span>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 leading-4", ROLE_COLORS[a.role])}>{ROLE_LABELS[a.role]}</Badge>
                  {a.id === uid && <span className="text-[10px] text-muted-foreground/40 ml-0.5">you</span>}
                </div>
                <p className="text-[12px] text-muted-foreground/50 truncate">{a.email}</p>
              </div>
              <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-100">
                <button onClick={() => onEdit(a)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"><PencilIcon className="size-3.5" /></button>
                {a.id !== uid && <button onClick={() => onDelete(a.id)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2Icon className="size-3.5" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function KeysPane({ keys, loading, onCreate, onDelete }) {
  return (
    <>
      <Heading sub="Keys for Yealink phones and external integrations" right={
        <Button size="sm" className="h-9 w-full text-xs sm:h-8 sm:w-auto" onClick={onCreate}><PlusIcon className="size-3.5 mr-1" />Generate Key</Button>
      }>API Keys</Heading>
      {loading ? (
        <Skeleton className="h-[60px] rounded-xl" />
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 py-14 text-center">
          <KeyIcon className="size-6 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-[13px] text-muted-foreground/60">No API keys yet</p>
          <p className="text-[12px] text-muted-foreground/40 mt-0.5">Generate a key for Yealink phones to access Yealink API endpoints</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card/50 divide-y divide-border/40">
          {keys.map(k => (
            <div key={k.id} className="group flex items-center gap-3 px-3 py-3 sm:px-4 hover:bg-muted/30 transition-colors duration-100">
              <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <KeyIcon className="size-3.5 text-amber-400/80" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium truncate">{k.label}</span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-px">
                  <code className="text-[11px] text-muted-foreground/50 font-mono">{k.key_prefix}••••••••</code>
                  <span className="text-[11px] text-muted-foreground/30">{new Date(k.created_at * 1000).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => onDelete(k.id)} className="rounded-md p-1.5 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all duration-100">
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 rounded-xl bg-muted/20 border border-border/30 px-4 py-3">
        <p className="text-[12px] text-muted-foreground/50 leading-relaxed break-words">
          Pass as <code className="text-[11px] bg-muted/80 px-1 py-px rounded font-mono text-muted-foreground/70">X-API-Key</code> header
          or <code className="text-[11px] bg-muted/80 px-1 py-px rounded font-mono text-muted-foreground/70">?api_key=</code> query param
          on <code className="text-[11px] bg-muted/80 px-1 py-px rounded font-mono text-muted-foreground/70">/api/v1/yealink/*</code> endpoints.
        </p>
      </div>
    </>
  );
}

function SecurityPane() {
  return (
    <>
      <Heading sub="Authentication and access control policies">Security</Heading>
      <div className="rounded-xl border border-border/40 bg-card/50 px-4">
        <Row label="Login rate limiting" hint="5 attempts per 15 min per IP">
          <StatusDot />
        </Row>
        <Row label="Account lockout" hint="15 min lock after 5 failed attempts">
          <StatusDot />
        </Row>
        <Row label="Access tokens" hint="Short-lived JWT for API requests">
          <code className="text-[12px] text-muted-foreground/60 font-mono">15 min</code>
        </Row>
        <Row label="Refresh tokens" hint="7 days default, 30 days with remember-me">
          <code className="text-[12px] text-muted-foreground/60 font-mono">7 / 30d</code>
        </Row>
        <Row label="Yealink auth" hint="All /api/v1/yealink/* require API key">
          <StatusDot />
        </Row>
        <Row label="FreeSWITCH directory" hint="Restricted to localhost" noBorder>
          <StatusDot />
        </Row>
      </div>
    </>
  );
}

function StatusDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400/80">
      <span className="size-1.5 rounded-full bg-emerald-400/80" />
      Active
    </span>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Sub-dialogs                                               */
/* ────────────────────────────────────────────────────────── */

function AdminFormDialog({ open, onOpenChange, editing, form, setForm, error, saving, showPw, setShowPw, onSave }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Admin User" : "Create Admin User"}</DialogTitle>
          <DialogDescription>{editing ? "Leave password blank to keep current." : "Add a new admin console user."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input placeholder="John Doe" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{editing ? "New Password (optional)" : "Password"}</Label>
            <div className="relative">
              <Input type={showPw ? "text" : "password"} placeholder={editing ? "Leave blank to keep" : "••••••••"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="pr-10" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                {showPw ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — Full access</SelectItem>
                <SelectItem value="editor">Editor — Users, rooms, notifications</SelectItem>
                <SelectItem value="analytics">Analytics — Read-only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" className="w-full sm:w-auto" onClick={onSave} disabled={saving || !form.name || !form.email || (!editing && !form.password)}>
              {saving && <Loader2Icon className="size-3.5 animate-spin mr-1" />}
              {editing ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({ open, onOpenChange, title, desc, action, loading, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[380px]">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{desc}</DialogDescription></DialogHeader>
        <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2Icon className="size-3.5 animate-spin mr-1" />}{action}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KeyFormDialog({ open, onOpenChange, label, setLabel, saving, newKey, copied, onGenerate, onCopy, onDone }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[460px]">
        <DialogHeader><DialogTitle>Generate API Key</DialogTitle><DialogDescription>For Yealink phones or external integrations.</DialogDescription></DialogHeader>
        {newKey ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
              <p className="text-[12px] text-amber-400 font-medium mb-2.5">Copy now — this key won't be shown again</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="flex-1 text-[13px] font-mono bg-black/20 rounded-lg px-3 py-2 text-foreground break-all select-all leading-relaxed">{newKey}</code>
                <Button variant="outline" size="icon" className="h-9 w-full shrink-0 sm:size-9" onClick={onCopy}>
                  {copied ? <CheckIcon className="size-4 text-emerald-400" /> : <CopyIcon className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end"><Button size="sm" className="w-full sm:w-auto" onClick={onDone}>Done</Button></div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input placeholder="e.g., yealink-phones, monitoring-script" value={label} onChange={e => setLabel(e.target.value)} />
            </div>
            <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" className="w-full sm:w-auto" onClick={onGenerate} disabled={saving || !label.trim()}>
                {saving ? <Loader2Icon className="size-3.5 animate-spin mr-1" /> : <KeyIcon className="size-3.5 mr-1" />}Generate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
