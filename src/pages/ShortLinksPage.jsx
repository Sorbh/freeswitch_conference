import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  PlusIcon,
  Trash2Icon,
  LinkIcon,
  CopyIcon,
  ExternalLinkIcon,
} from "lucide-react";

function formatDate(d) {
  if (!d) return "";
  const ms = typeof d === "number" && d < 1e12 ? d * 1000 : d;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateUrl(url, max = 40) {
  if (!url) return "";
  if (url.length <= max) return url;
  return url.substring(0, max) + "…";
}

const BASE_URL = "https://hotline.redlineusedautoparts.com";

export default function ShortLinksPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ destination_url: "", label: "", expires_at: "" });

  const fetchLinks = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/admin/short-urls");
      const json = await res.json();
      if (json.status) setLinks(json.data);
    } catch (e) {
      console.error("Failed to fetch short links:", e);
      toast.error("Failed to load short links");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.destination_url.trim()) return;
    setCreating(true);
    try {
      const body = {
        destination_url: form.destination_url.trim(),
        label: form.label.trim() || null,
        expires_at: form.expires_at || null,
      };
      const res = await apiFetch("/api/v1/admin/short-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.status) {
        setLinks((prev) => [json.data, ...prev]);
        setForm({ destination_url: "", label: "", expires_at: "" });
        toast.success("Short link created");
      } else {
        toast.error(json.error || "Failed to create short link");
      }
    } catch (e) {
      console.error("Create failed:", e);
      toast.error("Failed to create short link");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    try {
      const res = await apiFetch(`/api/v1/admin/short-urls/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.status) {
        setLinks((prev) => prev.filter((l) => l.id !== id));
        toast.success("Short link deleted");
      } else {
        toast.error(json.error || "Failed to delete");
      }
    } catch (e) {
      console.error("Delete failed:", e);
      toast.error("Failed to delete short link");
    }
  }

  function copyToClipboard(code) {
    const url = `${BASE_URL}/s/${code}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy")
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight leading-tight">Short Links</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          URL shortener for campaigns and emails
        </p>
      </div>

      {/* Create Form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 min-w-0 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Destination URL</label>
              <Input
                placeholder="https://example.com/landing-page"
                value={form.destination_url}
                onChange={(e) => setForm((f) => ({ ...f, destination_url: e.target.value }))}
                required
                type="url"
              />
            </div>
            <div className="sm:w-48 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Label</label>
              <Input
                placeholder="e.g. Texas Outreach Q1"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="sm:w-40 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Expires</label>
              <Input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={creating || !form.destination_url.trim()} className="h-10 sm:w-auto">
              <PlusIcon className="size-4 mr-2" />
              {creating ? "Creating..." : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Links Table */}
      {links.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LinkIcon className="size-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No short links yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Create your first short link above
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Short URL
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Label
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                      Destination
                    </th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Clicks
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                      Created
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                      Expires
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {links.map((link) => (
                    <tr key={link.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`${BASE_URL}/s/${link.code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sm text-primary hover:underline underline-offset-2"
                          >
                            /s/{link.code}
                          </a>
                          <button
                            onClick={() => copyToClipboard(link.code)}
                            className="text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer p-0.5"
                            title="Copy full URL"
                          >
                            <CopyIcon className="size-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm">{link.label || <span className="text-muted-foreground/40">--</span>}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <a
                          href={link.destination_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 max-w-[280px]"
                          title={link.destination_url}
                        >
                          <span className="truncate">{truncateUrl(link.destination_url)}</span>
                          <ExternalLinkIcon className="size-3 shrink-0" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-sm tabular-nums">{link.clicks ?? 0}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{formatDate(link.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {link.expires_at ? formatDate(link.expires_at) : <span className="text-muted-foreground/40">--</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive"
                          onClick={() => handleDelete(link.id)}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
