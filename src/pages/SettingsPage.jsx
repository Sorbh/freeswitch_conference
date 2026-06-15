import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
} from "lucide-react";

const ROLE_LABELS = { admin: "Admin", editor: "Editor", analytics: "Analytics" };
const ROLE_COLORS = {
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  editor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  analytics: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const EMPTY_ADMIN = { email: "", password: "", name: "", role: "editor" };

const NAV_ITEMS = [
  { key: "general", label: "General", icon: SettingsIcon },
  { key: "users", label: "Admin Users", icon: UsersIcon },
  { key: "api-keys", label: "API Keys", icon: KeyIcon },
  { key: "security", label: "Security", icon: ShieldIcon },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "general";

  const [admins, setAdmins] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingKeys, setLoadingKeys] = useState(true);

  // Admin form
  const [adminFormOpen, setAdminFormOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Delete admin
  const [deleteAdminId, setDeleteAdminId] = useState(null);
  const [deletingAdmin, setDeletingAdmin] = useState(false);

  // API key form
  const [keyFormOpen, setKeyFormOpen] = useState(false);
  const [keyLabel, setKeyLabel] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Delete key
  const [deleteKeyId, setDeleteKeyId] = useState(null);
  const [deletingKey, setDeletingKey] = useState(false);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/auth/admins");
      const json = await res.json();
      if (json.status) setAdmins(json.data);
    } catch {} finally { setLoadingAdmins(false); }
  }, []);

  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/auth/api-keys");
      const json = await res.json();
      if (json.status) setApiKeys(json.data);
    } catch {} finally { setLoadingKeys(false); }
  }, []);

  useEffect(() => { fetchAdmins(); fetchApiKeys(); }, [fetchAdmins, fetchApiKeys]);

  function setTab(key) {
    setSearchParams({ tab: key }, { replace: true });
  }

  // ── Admin CRUD ──

  function openCreateAdmin() {
    setEditingAdmin(null);
    setAdminForm(EMPTY_ADMIN);
    setAdminError("");
    setShowPassword(false);
    setAdminFormOpen(true);
  }

  function openEditAdmin(admin) {
    setEditingAdmin(admin);
    setAdminForm({ email: admin.email, password: "", name: admin.name, role: admin.role });
    setAdminError("");
    setShowPassword(false);
    setAdminFormOpen(true);
  }

  async function handleSaveAdmin() {
    setSavingAdmin(true);
    setAdminError("");
    try {
      const body = { ...adminForm };
      if (editingAdmin && !body.password) delete body.password;
      const url = editingAdmin ? `/api/v1/auth/admins/${editingAdmin.id}` : "/api/v1/auth/admins";
      const res = await apiFetch(url, {
        method: editingAdmin ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setAdminFormOpen(false);
      fetchAdmins();
    } catch (e) {
      setAdminError(e.message);
    } finally {
      setSavingAdmin(false);
    }
  }

  async function handleDeleteAdmin() {
    if (!deleteAdminId) return;
    setDeletingAdmin(true);
    try {
      await apiFetch(`/api/v1/auth/admins/${deleteAdminId}`, { method: "DELETE" });
      setDeleteAdminId(null);
      fetchAdmins();
    } catch {} finally { setDeletingAdmin(false); }
  }

  // ── API Key CRUD ──

  function openCreateKey() {
    setKeyLabel("");
    setNewKey(null);
    setCopiedKey(false);
    setKeyFormOpen(true);
  }

  async function handleCreateKey() {
    if (!keyLabel.trim()) return;
    setSavingKey(true);
    try {
      const res = await apiFetch("/api/v1/auth/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: keyLabel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setNewKey(json.data.key);
      fetchApiKeys();
    } catch {} finally { setSavingKey(false); }
  }

  async function handleDeleteKey() {
    if (!deleteKeyId) return;
    setDeletingKey(true);
    try {
      await apiFetch(`/api/v1/auth/api-keys/${deleteKeyId}`, { method: "DELETE" });
      setDeleteKeyId(null);
      fetchApiKeys();
    } catch {} finally { setDeletingKey(false); }
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  // ── Render ──

  return (
    <div className="-m-6">
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Left sidebar */}
        <nav className="w-56 shrink-0 border-r bg-muted/20 p-3 pt-5">
          <p className="px-3 mb-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Settings</p>
          <div className="space-y-0.5">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-background text-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto px-8 py-8">
            {activeTab === "general" && <GeneralSection user={user} />}
            {activeTab === "users" && (
              <AdminUsersSection
                admins={admins}
                loading={loadingAdmins}
                currentUserId={user?.id}
                onCreateAdmin={openCreateAdmin}
                onEditAdmin={openEditAdmin}
                onDeleteAdmin={setDeleteAdminId}
              />
            )}
            {activeTab === "api-keys" && (
              <ApiKeysSection
                apiKeys={apiKeys}
                loading={loadingKeys}
                onCreateKey={openCreateKey}
                onDeleteKey={setDeleteKeyId}
              />
            )}
            {activeTab === "security" && <SecuritySection />}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AdminFormDialog
        open={adminFormOpen}
        onOpenChange={setAdminFormOpen}
        editing={editingAdmin}
        form={adminForm}
        setForm={setAdminForm}
        error={adminError}
        saving={savingAdmin}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        onSave={handleSaveAdmin}
      />
      <ConfirmDialog
        open={!!deleteAdminId}
        onOpenChange={() => setDeleteAdminId(null)}
        title="Delete Admin User"
        description="This will permanently remove this user's access. Their active sessions will be revoked."
        actionLabel="Delete"
        loading={deletingAdmin}
        onConfirm={handleDeleteAdmin}
      />
      <ApiKeyFormDialog
        open={keyFormOpen}
        onOpenChange={(open) => { if (!open) { setKeyFormOpen(false); setNewKey(null); } }}
        label={keyLabel}
        setLabel={setKeyLabel}
        saving={savingKey}
        newKey={newKey}
        copiedKey={copiedKey}
        onGenerate={handleCreateKey}
        onCopy={copyKey}
        onDone={() => { setKeyFormOpen(false); setNewKey(null); }}
      />
      <ConfirmDialog
        open={!!deleteKeyId}
        onOpenChange={() => setDeleteKeyId(null)}
        title="Revoke API Key"
        description="Any device or integration using this key will immediately lose access."
        actionLabel="Revoke"
        loading={deletingKey}
        onConfirm={handleDeleteKey}
      />
    </div>
  );
}

// ── Section Components ──

function SectionHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between py-4 border-b last:border-b-0">
      <div className="pr-8">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function GeneralSection({ user }) {
  return (
    <>
      <SectionHeader title="General" description="Your profile and console preferences" />
      <div className="rounded-lg border">
        <div className="px-5">
          <SettingRow label="Name" description="Your display name in the console">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
          </SettingRow>
          <SettingRow label="Email" description="Your login email address">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
          </SettingRow>
          <SettingRow label="Role" description="Determines what you can access">
            <Badge variant="outline" className={`${ROLE_COLORS[user?.role]} text-xs`}>
              {ROLE_LABELS[user?.role]}
            </Badge>
          </SettingRow>
        </div>
      </div>
    </>
  );
}

function AdminUsersSection({ admins, loading, currentUserId, onCreateAdmin, onEditAdmin, onDeleteAdmin }) {
  return (
    <>
      <SectionHeader
        title="Admin Users"
        description="Manage who can access the console"
        action={
          <Button size="sm" onClick={onCreateAdmin}>
            <PlusIcon className="size-4 mr-1.5" />
            Add User
          </Button>
        }
      />
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-[72px] rounded-lg" />)}
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No admin users found</div>
      ) : (
        <div className="rounded-lg border divide-y">
          {admins.map(admin => (
            <div key={admin.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-9 items-center justify-center rounded-full bg-muted shrink-0">
                  <UserIcon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{admin.name}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[admin.role]}`}>
                      {ROLE_LABELS[admin.role]}
                    </Badge>
                    {admin.id === currentUserId && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-400 border-yellow-500/20">You</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-4">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => onEditAdmin(admin)}>
                  <PencilIcon className="size-3.5" />
                </Button>
                {admin.id !== currentUserId && (
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => onDeleteAdmin(admin.id)}>
                    <Trash2Icon className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ApiKeysSection({ apiKeys, loading, onCreateKey, onDeleteKey }) {
  return (
    <>
      <SectionHeader
        title="API Keys"
        description="Keys for Yealink phones and external integrations"
        action={
          <Button size="sm" onClick={onCreateKey}>
            <PlusIcon className="size-4 mr-1.5" />
            Generate Key
          </Button>
        }
      />
      {loading ? (
        <Skeleton className="h-[72px] rounded-lg" />
      ) : apiKeys.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <KeyIcon className="size-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No API keys yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Generate a key so Yealink phones can access SIP-action endpoints</p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {apiKeys.map(key => (
            <div key={key.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-9 items-center justify-center rounded-full bg-amber-500/10 shrink-0">
                  <KeyIcon className="size-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium">{key.label}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-xs text-muted-foreground font-mono">{key.key_prefix}••••••••</code>
                    <span className="text-[11px] text-muted-foreground/50">
                      {new Date(key.created_at * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive shrink-0" onClick={() => onDeleteKey(key.id)}>
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Pass the key as an <code className="text-[11px] bg-muted px-1 rounded font-mono">X-API-Key</code> header or <code className="text-[11px] bg-muted px-1 rounded font-mono">?api_key=</code> query param on <code className="text-[11px] bg-muted px-1 rounded font-mono">/api/v1/action/*</code> endpoints.
        </p>
      </div>
    </>
  );
}

function SecuritySection() {
  return (
    <>
      <SectionHeader title="Security" description="Authentication and access control settings" />
      <div className="rounded-lg border">
        <div className="px-5">
          <SettingRow label="Login rate limiting" description="5 attempts per 15 minutes per IP address">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Active</Badge>
          </SettingRow>
          <SettingRow label="Account lockout" description="Accounts lock for 15 minutes after 5 failed login attempts">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Active</Badge>
          </SettingRow>
          <SettingRow label="JWT access tokens" description="Short-lived tokens expire after 15 minutes">
            <span className="text-xs text-muted-foreground font-mono">15m</span>
          </SettingRow>
          <SettingRow label="Refresh tokens" description="Long-lived tokens, 7 days default, 30 days with remember-me">
            <span className="text-xs text-muted-foreground font-mono">7d / 30d</span>
          </SettingRow>
          <SettingRow label="SIP-action auth" description="All /api/v1/action/* endpoints require API key">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Active</Badge>
          </SettingRow>
          <SettingRow label="FreeSWITCH directory" description="XML directory endpoint restricted to localhost only">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Active</Badge>
          </SettingRow>
        </div>
      </div>
    </>
  );
}

// ── Dialog Components ──

function AdminFormDialog({ open, onOpenChange, editing, form, setForm, error, saving, showPassword, setShowPassword, onSave }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Admin User" : "Create Admin User"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update this admin's details. Leave password blank to keep current." : "Add a new user who can access the admin console."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="John Doe" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{editing ? "New Password (optional)" : "Password"}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={editing ? "Leave blank to keep current" : "••••••••"}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — Full access</SelectItem>
                <SelectItem value="editor">Editor — Users, rooms, notifications</SelectItem>
                <SelectItem value="analytics">Analytics — Read-only dashboards</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={saving || !form.name || !form.email || (!editing && !form.password)}>
              {saving && <Loader2Icon className="size-4 animate-spin mr-1.5" />}
              {editing ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({ open, onOpenChange, title, description, actionLabel, loading, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2Icon className="size-4 animate-spin mr-1.5" />}
            {actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeyFormDialog({ open, onOpenChange, label, setLabel, saving, newKey, copiedKey, onGenerate, onCopy, onDone }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Generate API Key</DialogTitle>
          <DialogDescription>Create a key for Yealink phones or external integrations.</DialogDescription>
        </DialogHeader>
        {newKey ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-xs text-amber-400 font-medium mb-2">Copy this key now — it won't be shown again</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-black/30 rounded px-3 py-2 text-foreground break-all select-all">{newKey}</code>
                <Button variant="outline" size="icon" className="shrink-0" onClick={onCopy}>
                  {copiedKey ? <CheckIcon className="size-4 text-emerald-400" /> : <CopyIcon className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={onDone}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input placeholder="e.g., yealink-phones, monitoring-script" value={label} onChange={e => setLabel(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={onGenerate} disabled={saving || !label.trim()}>
                {saving ? <Loader2Icon className="size-4 animate-spin mr-1.5" /> : <KeyIcon className="size-4 mr-1.5" />}
                Generate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
