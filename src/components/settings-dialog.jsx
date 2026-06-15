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
              "w-[min(92vw,820px)]",
              "rounded-2xl bg-popover text-popover-foreground shadow-2xl",
              "border border-border/60",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97]",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97]",
            )}
          >
            {/* Close — hidden, use backdrop click or Escape to close */}

            <div className="flex h-[min(80vh,580px)] overflow-hidden rounded-2xl">
              {/* ─── Sidebar ─── */}
              <div className="w-[200px] shrink-0 border-r border-border/50 bg-muted/20 flex flex-col">
                <div className="px-5 pt-5 pb-3">
                  <h2 className="text-[13px] font-semibold tracking-tight">Settings</h2>
                </div>
                <nav className="flex-1 px-2.5 pb-4 space-y-px">
                  {NAV.map(item => {
                    const Icon = item.icon;
                    const active = tab === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setTab(item.key)}
                        className={cn(
                          "flex items-center gap-2.5 w-full rounded-lg px-2.5 py-[7px] text-[13px] transition-all duration-100",
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
                <div className="p-7">
                  {tab === "general" && <GeneralPane user={user} />}
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
    <div className="flex items-start justify-between mb-6">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{children}</h3>
        {sub && <p className="text-[13px] text-muted-foreground/70 mt-1">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Row({ label, hint, children, noBorder }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", !noBorder && "border-b border-border/40")}>
      <div className="min-w-0">
        <p className="text-[13px]">{label}</p>
        {hint && <p className="text-[12px] text-muted-foreground/60 mt-px">{hint}</p>}
      </div>
      <div className="shrink-0 text-right">{children}</div>
    </div>
  );
}

function GeneralPane({ user }) {
  const initials = (user?.name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <>
      <Heading sub="Your profile and console preferences">General</Heading>

      <section className="mb-7">
        <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-3">Profile</p>
        <div className="rounded-xl border border-border/40 bg-card/50 px-4">
          <Row label="Avatar">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">{initials}</div>
          </Row>
          <Row label="Full name">
            <span className="text-[13px] text-muted-foreground">{user?.name}</span>
          </Row>
          <Row label="Email">
            <span className="text-[13px] text-muted-foreground">{user?.email}</span>
          </Row>
          <Row label="Role" noBorder>
            <Badge variant="outline" className={cn("text-[11px]", ROLE_COLORS[user?.role])}>{ROLE_LABELS[user?.role]}</Badge>
          </Row>
        </div>
      </section>
    </>
  );
}

function UsersPane({ admins, loading, uid, onCreate, onEdit, onDelete }) {
  return (
    <>
      <Heading sub="Manage who can access the console" right={
        <Button size="sm" className="h-8 text-xs" onClick={onCreate}><PlusIcon className="size-3.5 mr-1" />Add User</Button>
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
            <div key={a.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors duration-100">
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <UserIcon className="size-3.5 text-muted-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium truncate">{a.name}</span>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 leading-4", ROLE_COLORS[a.role])}>{ROLE_LABELS[a.role]}</Badge>
                  {a.id === uid && <span className="text-[10px] text-muted-foreground/40 ml-0.5">you</span>}
                </div>
                <p className="text-[12px] text-muted-foreground/50 truncate">{a.email}</p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
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
        <Button size="sm" className="h-8 text-xs" onClick={onCreate}><PlusIcon className="size-3.5 mr-1" />Generate Key</Button>
      }>API Keys</Heading>
      {loading ? (
        <Skeleton className="h-[60px] rounded-xl" />
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 py-14 text-center">
          <KeyIcon className="size-6 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-[13px] text-muted-foreground/60">No API keys yet</p>
          <p className="text-[12px] text-muted-foreground/40 mt-0.5">Generate a key for Yealink phones to access SIP-action endpoints</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card/50 divide-y divide-border/40">
          {keys.map(k => (
            <div key={k.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors duration-100">
              <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <KeyIcon className="size-3.5 text-amber-400/80" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-medium">{k.label}</span>
                <div className="flex items-center gap-2 mt-px">
                  <code className="text-[11px] text-muted-foreground/50 font-mono">{k.key_prefix}••••••••</code>
                  <span className="text-[11px] text-muted-foreground/30">{new Date(k.created_at * 1000).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => onDelete(k.id)} className="rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all duration-100">
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 rounded-xl bg-muted/20 border border-border/30 px-4 py-3">
        <p className="text-[12px] text-muted-foreground/50 leading-relaxed">
          Pass as <code className="text-[11px] bg-muted/80 px-1 py-px rounded font-mono text-muted-foreground/70">X-API-Key</code> header
          or <code className="text-[11px] bg-muted/80 px-1 py-px rounded font-mono text-muted-foreground/70">?api_key=</code> query param
          on <code className="text-[11px] bg-muted/80 px-1 py-px rounded font-mono text-muted-foreground/70">/api/v1/action/*</code> endpoints.
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
        <Row label="SIP-action auth" hint="All /api/v1/action/* require API key">
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
      <DialogContent className="sm:max-w-[420px]">
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
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={onSave} disabled={saving || !form.name || !form.email || (!editing && !form.password)}>
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
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{desc}</DialogDescription></DialogHeader>
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={loading}>
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
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader><DialogTitle>Generate API Key</DialogTitle><DialogDescription>For Yealink phones or external integrations.</DialogDescription></DialogHeader>
        {newKey ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
              <p className="text-[12px] text-amber-400 font-medium mb-2.5">Copy now — this key won't be shown again</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[13px] font-mono bg-black/20 rounded-lg px-3 py-2 text-foreground break-all select-all leading-relaxed">{newKey}</code>
                <Button variant="outline" size="icon" className="shrink-0 size-9" onClick={onCopy}>
                  {copied ? <CheckIcon className="size-4 text-emerald-400" /> : <CopyIcon className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end"><Button size="sm" onClick={onDone}>Done</Button></div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input placeholder="e.g., yealink-phones, monitoring-script" value={label} onChange={e => setLabel(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={onGenerate} disabled={saving || !label.trim()}>
                {saving ? <Loader2Icon className="size-3.5 animate-spin mr-1" /> : <KeyIcon className="size-3.5 mr-1" />}Generate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
