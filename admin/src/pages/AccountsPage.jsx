import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ROOM_NAMES, timeAgo } from "@/lib/constants";
import {
  PlusIcon,
  SearchIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

const EMPTY_FORM = {
  email: "",
  password: "",
  display_name: "",
  company_name: "",
  company_address: "",
  city: "",
  state: "",
  zip: "",
  room: "",
};

export default function AccountsPage() {
  const { data, loading, refetch } = useFetch("/api/v1/admin/accounts", 30000);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const accounts = data?.status ? data.data : [];
  const filtered = accounts.filter(
    (a) =>
      (a.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.company_name || "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(account) {
    setEditing(account);
    setForm({
      email: account.email || "",
      password: "",
      display_name: account.display_name || "",
      company_name: account.company_name || "",
      company_address: account.company_address || "",
      city: account.city || "",
      state: account.state || "",
      zip: account.zip || "",
      room: account.room ? String(account.room) : "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = { ...form };
      if (editing && !body.password) delete body.password;

      const url = editing
        ? `/api/v1/admin/accounts/${editing.id}`
        : "/api/v1/admin/accounts";

      await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setDialogOpen(false);
      refetch();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/v1/admin/accounts/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }

  async function toggleActive(account) {
    try {
      await fetch(`/api/v1/admin/accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: account.active ? 0 : 1 }),
      });
      refetch();
    } catch (e) {
      console.error("Toggle failed:", e);
    }
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono tabular-nums">{accounts.length}</span> registered accounts
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4 mr-2" />
          Add Account
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search email, name, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead className="hidden md:table-cell">Company</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="text-right w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-12"
                  >
                    {accounts.length === 0
                      ? "No accounts yet. Click \"Add Account\" to create one."
                      : "No accounts match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((account) => (
                  <TableRow key={account.id} className="group">
                    <TableCell className="font-medium text-sm">
                      {account.email}
                    </TableCell>
                    <TableCell className="text-sm">
                      {account.display_name || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {account.company_name || "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {[account.city, account.state].filter(Boolean).join(", ") || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ROOM_NAMES[account.room] || account.room || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.active ? "default" : "secondary"}>
                        {account.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground tabular-nums">
                      {timeAgo(account.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Edit"
                          onClick={() => openEdit(account)}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive"
                          title="Delete"
                          onClick={() => {
                            setDeleteTarget(account);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Account" : "Create Account"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the account details below."
                : "Fill in the details to create a new SIP account."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {editing ? "(leave blank to keep)" : "*"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={editing ? "••••••••" : "Enter password"}
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  placeholder="John Doe"
                  value={form.display_name}
                  onChange={(e) => updateField("display_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  placeholder="ACME Auto Parts"
                  value={form.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_address">Company Address</Label>
              <Input
                id="company_address"
                placeholder="123 Main St"
                value={form.company_address}
                onChange={(e) => updateField("company_address", e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Los Angeles"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="CA"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">Zip</Label>
                <Input
                  id="zip"
                  placeholder="90001"
                  value={form.zip}
                  onChange={(e) => updateField("zip", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="room">Conference Room</Label>
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
              {editing && (
                <div className="space-y-2">
                  <Label>Active</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={editing.active === 1}
                      onCheckedChange={(checked) => toggleActive(editing)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {editing.active ? "Account active" : "Account disabled"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full mt-2"
              onClick={handleSave}
              disabled={saving || !form.email || (!editing && !form.password)}
            >
              {saving ? "Saving..." : editing ? "Update Account" : "Create Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.email}
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
    </div>
  );
}
