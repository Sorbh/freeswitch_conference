import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import {
  CloudIcon,
  PlayIcon,
  Loader2Icon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
  HashIcon,
  LinkIcon,
  AlertTriangleIcon,
  ChevronDownIcon,
  ServerIcon,
  RotateCwIcon,
  ShieldAlertIcon,
  FileCodeIcon,
  MapPinIcon,
} from "lucide-react";

function SyncLog({ entries }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="mt-3 rounded-lg border border-border/50 bg-muted/20 font-mono text-xs">
      <div ref={containerRef} className="p-3 space-y-0.5 max-h-[120px] overflow-y-auto">
        {entries.map((entry, i) => (
          <div key={i} className={`flex items-start gap-2 py-0.5 ${entry.type === "error" ? "text-red-400" : entry.type === "success" ? "text-emerald-400" : entry.type === "skip" ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
            {entry.type === "success" && <CheckCircleIcon className="size-3 mt-0.5 shrink-0" />}
            {entry.type === "error" && <XCircleIcon className="size-3 mt-0.5 shrink-0" />}
            {entry.type === "skip" && <MinusCircleIcon className="size-3 mt-0.5 shrink-0" />}
            {entry.type === "info" && <CloudIcon className="size-3 mt-0.5 shrink-0" />}
            <span>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncResult({ result }) {
  if (!result) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
        {result.success} synced
      </Badge>
      <Badge variant="outline" className="text-red-400 border-red-500/30">
        {result.failed} failed
      </Badge>
      <Badge variant="outline" className="text-muted-foreground border-border/50">
        {result.skipped} skipped
      </Badge>
      <span className="text-xs text-muted-foreground">
        {result.total} total in {result.duration}s
      </span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 pt-2 pb-1">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold">{children}</p>
      <div className="flex-1 h-px bg-border/30" />
    </div>
  );
}

export default function YmcsControlPage() {
  const [syncingAccounts, setSyncingAccounts] = useState(false);
  const [syncingDevices, setSyncingDevices] = useState(false);
  const [syncingBind, setSyncingBind] = useState(false);
  const [syncingSipServer, setSyncingSipServer] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [accountLog, setAccountLog] = useState([]);
  const [deviceLog, setDeviceLog] = useState([]);
  const [bindLog, setBindLog] = useState([]);
  const [sipServerLog, setSipServerLog] = useState([]);
  const [accountResult, setAccountResult] = useState(null);
  const [deviceResult, setDeviceResult] = useState(null);
  const [bindResult, setBindResult] = useState(null);
  const [sipServerResult, setSipServerResult] = useState(null);
  const [rebootLog, setRebootLog] = useState([]);
  const [rebootResult, setRebootResult] = useState(null);
  const [syncingSites, setSyncingSites] = useState(false);
  const [siteLog, setSiteLog] = useState([]);
  const [siteResult, setSiteResult] = useState(null);
  const [sipHost, setSipHost] = useState("50.28.84.57");
  const [sipPort, setSipPort] = useState("5070");
  const [sipRoom, setSipRoom] = useState("all");
  const [rebootRoom, setRebootRoom] = useState("all");
  const [rebindRoom, setRebindRoom] = useState("all");
  const [rooms, setRooms] = useState([]);
  const [syncingConfigs, setSyncingConfigs] = useState(false);
  const [configSyncLog, setConfigSyncLog] = useState([]);
  const [configSyncResult, setConfigSyncResult] = useState(null);
  const abortRef = useRef(null);
  const anySyncing = syncingAccounts || syncingDevices || syncingBind || syncingSipServer || rebooting || syncingSites || syncingConfigs;
  const [confirmAction, setConfirmAction] = useState(null);
  const [stats, setStats] = useState(null);
  const [missingDialog, setMissingDialog] = useState(null);

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    try {
      const [accRes, roomRes] = await Promise.all([
        apiFetch("/api/v1/admin/accounts").then(r => r.json()),
        apiFetch("/api/v1/admin/rooms/config").then(r => r.json()),
      ]);
      const accounts = accRes.data || [];
      const roomsList = roomRes.data?.rooms || [];
      setRooms(roomsList);
      const missingDevice = accounts.filter(a => !a.ymcs_device_id);
      const missingAccount = accounts.filter(a => !a.ymcs_account_id);
      const notEligible = accounts.filter(a => !a.ymcs_account_id || !a.ymcs_device_id);
      const missingSite = roomsList.filter(r => !r.ymcs_site_id);
      const missingConfig = accounts.filter(a => a.ymcs_device_id && !a.ymcs_config_id);
      setStats({
        total: accounts.length,
        missingAccountId: missingAccount.length,
        missingAccountList: missingAccount.map(a => ({ email: a.email, name: a.display_name })),
        missingDeviceId: missingDevice.length,
        missingDeviceList: missingDevice.map(a => ({ email: a.email, name: a.display_name, hasAccountId: !!a.ymcs_account_id })),
        eligibleRebind: accounts.filter(a => a.ymcs_account_id && a.ymcs_device_id).length,
        notEligibleList: notEligible.map(a => ({ email: a.email, name: a.display_name, hasAccountId: !!a.ymcs_account_id, hasDeviceId: !!a.ymcs_device_id })),
        missingSiteId: missingSite.length,
        missingSiteList: missingSite.map(r => ({ name: r.name, id: String(r.id), short_code: r.short_code })),
        missingConfigId: missingConfig.length,
        missingConfigList: missingConfig.map(a => ({ email: a.email, name: a.display_name })),
        totalRooms: roomsList.length,
      });
    } catch {}
  }

  function addLog(setter, entry) {
    setter(prev => {
      const next = [...prev, entry];
      setTimeout(() => {
        const el = document.querySelector("[data-sync-log] > div > div:last-child");
        el?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return next;
    });
  }

  async function syncAllAccountIds() {
    setSyncingAccounts(true);
    setAccountLog([]);
    setAccountResult(null);
    const start = Date.now();
    let success = 0, failed = 0, skipped = 0;

    try {
      addLog(setAccountLog, { type: "info", message: "Fetching all accounts..." });
      const res = await apiFetch("/api/v1/admin/accounts");
      const json = await res.json();
      const accounts = json.data || [];
      addLog(setAccountLog, { type: "info", message: `Found ${accounts.length} accounts` });

      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        const prefix = `[${i + 1}/${accounts.length}] ${acc.email}`;

        try {
          const r = await apiFetch(`/api/v1/admin/accounts/${acc.id}/refresh-account-id`, { method: "POST" });
          const data = await r.json();
          if (data.status) {
            success++;
            addLog(setAccountLog, { type: "success", message: `${prefix} → ${data.ymcs_account_id}` });
          } else {
            if (r.status === 404) {
              skipped++;
              addLog(setAccountLog, { type: "skip", message: `${prefix} — not found in YMCS` });
            } else {
              failed++;
              addLog(setAccountLog, { type: "error", message: `${prefix} — ${data.error}` });
            }
          }
        } catch (e) {
          failed++;
          addLog(setAccountLog, { type: "error", message: `${prefix} — ${e.message}` });
        }
      }

      const duration = ((Date.now() - start) / 1000).toFixed(1);
      setAccountResult({ success, failed, skipped, total: accounts.length, duration });
      addLog(setAccountLog, { type: "info", message: `Done — ${success} synced, ${failed} failed, ${skipped} skipped (${duration}s)` });
    } catch (e) {
      addLog(setAccountLog, { type: "error", message: `Fatal: ${e.message}` });
    } finally {
      setSyncingAccounts(false); fetchStats();
    }
  }

  async function syncAllDeviceIds() {
    setSyncingDevices(true);
    setDeviceLog([]);
    setDeviceResult(null);
    const start = Date.now();

    try {
      const eventSource = new EventSource("/api/v1/admin/ymcs/sync-all-device-ids");

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "done") {
          eventSource.close();
          const duration = ((Date.now() - start) / 1000).toFixed(1);
          setDeviceResult({ success: data.success, failed: data.failed, skipped: data.skipped, total: data.total, duration });
          addLog(setDeviceLog, { type: "info", message: `Done — ${data.success} synced, ${data.failed} failed, ${data.skipped} skipped (${duration}s)` });
          setSyncingDevices(false); fetchStats();
        } else {
          addLog(setDeviceLog, data);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        addLog(setDeviceLog, { type: "error", message: "Connection lost" });
        setSyncingDevices(false);
      };
    } catch (e) {
      addLog(setDeviceLog, { type: "error", message: `Fatal: ${e.message}` });
      setSyncingDevices(false);
    }
  }

  async function syncRoomSites() {
    setSyncingSites(true);
    setSiteLog([]);
    setSiteResult(null);
    const start = Date.now();

    try {
      const eventSource = new EventSource("/api/v1/admin/ymcs/sync-room-sites");

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "done") {
          eventSource.close();
          const duration = ((Date.now() - start) / 1000).toFixed(1);
          setSiteResult({ success: data.success, failed: data.failed, skipped: data.skipped, total: data.total, duration });
          addLog(setSiteLog, { type: "info", message: `Done — ${data.success} matched, ${data.skipped} skipped (${duration}s)` });
          setSyncingSites(false); fetchStats();
        } else {
          addLog(setSiteLog, data);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        addLog(setSiteLog, { type: "error", message: "Connection lost" });
        setSyncingSites(false);
      };
    } catch (e) {
      addLog(setSiteLog, { type: "error", message: `Fatal: ${e.message}` });
      setSyncingSites(false);
    }
  }

  async function syncConfigIds() {
    setSyncingConfigs(true);
    setConfigSyncLog([]);
    setConfigSyncResult(null);
    const start = Date.now();
    let success = 0, failed = 0, skipped = 0;

    try {
      addLog(setConfigSyncLog, { type: "info", message: "Fetching accounts..." });
      const res = await apiFetch("/api/v1/admin/accounts");
      const json = await res.json();
      const accounts = (json.data || []).filter(a => a.ymcs_device_id && !a.ymcs_config_id);
      addLog(setConfigSyncLog, { type: "info", message: `Found ${accounts.length} accounts missing config ID` });

      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        const prefix = `[${i + 1}/${accounts.length}] ${acc.email}`;

        try {
          const r = await apiFetch(`/api/v1/admin/accounts/${acc.id}/ymcs/sync-config-id`, { method: "POST" });
          const data = await r.json();
          if (data.status) {
            success++;
            addLog(setConfigSyncLog, { type: "success", message: `${prefix} → ${data.ymcs_config_id}` });
          } else {
            if (r.status === 404) {
              skipped++;
              addLog(setConfigSyncLog, { type: "skip", message: `${prefix} — ${data.error}` });
            } else {
              failed++;
              addLog(setConfigSyncLog, { type: "error", message: `${prefix} — ${data.error}` });
            }
          }
        } catch (e) {
          failed++;
          addLog(setConfigSyncLog, { type: "error", message: `${prefix} — ${e.message}` });
        }
      }

      const duration = ((Date.now() - start) / 1000).toFixed(1);
      setConfigSyncResult({ success, failed, skipped, total: accounts.length, duration });
      addLog(setConfigSyncLog, { type: "info", message: `Done — ${success} synced, ${failed} failed, ${skipped} skipped (${duration}s)` });
    } catch (e) {
      addLog(setConfigSyncLog, { type: "error", message: `Fatal: ${e.message}` });
    } finally {
      setSyncingConfigs(false); fetchStats();
    }
  }

  async function syncAllDeviceAccounts() {
    setSyncingBind(true);
    setBindLog([]);
    setBindResult(null);
    const start = Date.now();

    try {
      const roomParam = rebindRoom !== "all" ? `?room=${encodeURIComponent(rebindRoom)}` : "";
      const eventSource = new EventSource(`/api/v1/admin/ymcs/update-all-device-accounts${roomParam}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "done") {
          eventSource.close();
          const duration = ((Date.now() - start) / 1000).toFixed(1);
          setBindResult({ success: data.success, failed: data.failed, skipped: data.skipped, total: data.total, duration });
          addLog(setBindLog, { type: "info", message: `Done — ${data.success} updated, ${data.failed} failed, ${data.skipped} skipped (${duration}s)` });
          setSyncingBind(false); fetchStats();
        } else {
          addLog(setBindLog, data);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        addLog(setBindLog, { type: "error", message: "Connection lost" });
        setSyncingBind(false);
      };
    } catch (e) {
      addLog(setBindLog, { type: "error", message: `Fatal: ${e.message}` });
      setSyncingBind(false);
    }
  }

  async function updateAllSipServer() {
    setSyncingSipServer(true);
    setSipServerLog([]);
    setSipServerResult(null);
    const start = Date.now();

    try {
      const roomParam = sipRoom !== "all" ? `&room=${encodeURIComponent(sipRoom)}` : "";
      const eventSource = new EventSource(`/api/v1/admin/ymcs/update-all-sip-server?host=${encodeURIComponent(sipHost)}&port=${encodeURIComponent(sipPort)}${roomParam}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "done") {
          eventSource.close();
          const duration = ((Date.now() - start) / 1000).toFixed(1);
          setSipServerResult({ success: data.success, failed: data.failed, skipped: data.skipped, total: data.total, duration });
          addLog(setSipServerLog, { type: "info", message: `Done — ${data.success} updated, ${data.failed} failed (${duration}s)` });
          setSyncingSipServer(false);
        } else {
          addLog(setSipServerLog, data);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        addLog(setSipServerLog, { type: "error", message: "Connection lost" });
        setSyncingSipServer(false);
      };
    } catch (e) {
      addLog(setSipServerLog, { type: "error", message: `Fatal: ${e.message}` });
      setSyncingSipServer(false);
    }
  }

  async function rebootAllDevices() {
    setRebooting(true);
    setRebootLog([]);
    setRebootResult(null);
    const start = Date.now();

    try {
      const roomParam = rebootRoom !== "all" ? `?room=${encodeURIComponent(rebootRoom)}` : "";
      const eventSource = new EventSource(`/api/v1/admin/ymcs/reboot-all-devices${roomParam}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "done") {
          eventSource.close();
          const duration = ((Date.now() - start) / 1000).toFixed(1);
          setRebootResult({ success: data.success, failed: data.failed, skipped: data.skipped, total: data.total, duration });
          addLog(setRebootLog, { type: "info", message: `Done — ${data.success} rebooted, ${data.failed} failed (${duration}s)` });
          setRebooting(false);
        } else {
          addLog(setRebootLog, data);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        addLog(setRebootLog, { type: "error", message: "Connection lost" });
        setRebooting(false);
      };
    } catch (e) {
      addLog(setRebootLog, { type: "error", message: `Fatal: ${e.message}` });
      setRebooting(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">YMCS Control</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Yealink Management Cloud Service operations
            <span className="text-red-500 font-medium ml-2">· YMCS commands only work when the phone is in idle state</span>
          </p>
        </div>
        {stats && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-mono gap-1.5">
              <span className={`size-1.5 rounded-full ${stats.missingAccountId === 0 ? "bg-emerald-500" : "bg-amber-500"}`} />
              {stats.total - stats.missingAccountId}/{stats.total} accounts
            </Badge>
            <Badge variant="outline" className="text-[11px] font-mono gap-1.5">
              <span className={`size-1.5 rounded-full ${stats.missingDeviceId === 0 ? "bg-emerald-500" : "bg-amber-500"}`} />
              {stats.total - stats.missingDeviceId}/{stats.total} devices
            </Badge>
          </div>
        )}
      </div>

      {/* ── Section 1: Sync ── */}
      <SectionLabel>Sync</SectionLabel>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Sync Account IDs */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <HashIcon className="size-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Sync Account IDs</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fetch YMCS account ID via email lookup
                  </p>
                  {stats && (
                    stats.missingAccountId > 0 ? (
                      <button onClick={() => setMissingDialog({ title: "Accounts Missing YMCS Account ID", list: stats.missingAccountList, columns: ["email", "name"] })} className="text-[11px] mt-1.5 font-mono text-red-400 hover:text-red-300 transition-colors cursor-pointer underline underline-offset-2 decoration-red-400/30">
                        {stats.missingAccountId} missing
                      </button>
                    ) : (
                      <p className="text-[11px] mt-1.5 font-mono text-emerald-400">all synced</p>
                    )
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setConfirmAction({ title: "Sync All Account IDs", description: "This will call the YMCS API for every account to fetch their YMCS Account ID. This may take a few minutes.", action: syncAllAccountIds })}
                disabled={anySyncing}
                className="shrink-0"
              >
                {syncingAccounts
                  ? <Loader2Icon className="size-3.5 animate-spin" />
                  : <PlayIcon className="size-3.5" />
                }
              </Button>
            </div>
            <SyncResult result={accountResult} />
            {accountLog.length > 0 && (
              <div data-sync-log><SyncLog entries={accountLog} /></div>
            )}
          </CardContent>
        </Card>

        {/* Sync Device IDs */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <CloudIcon className="size-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Sync Device IDs</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Match devices to accounts via bound accounts
                  </p>
                  {stats && (
                    stats.missingDeviceId > 0 ? (
                      <button onClick={() => setMissingDialog({ title: "Accounts Missing YMCS Device ID", list: stats.missingDeviceList, columns: ["email", "name", "hasAccountId"] })} className="text-[11px] mt-1.5 font-mono text-red-400 hover:text-red-300 transition-colors cursor-pointer underline underline-offset-2 decoration-red-400/30">
                        {stats.missingDeviceId} missing
                      </button>
                    ) : (
                      <p className="text-[11px] mt-1.5 font-mono text-emerald-400">all synced</p>
                    )
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setConfirmAction({ title: "Sync All Device IDs", description: "This will list all devices from YMCS, get each device's account details, and save the device ID to matching accounts in our DB. This may take a few minutes.", action: syncAllDeviceIds })}
                disabled={anySyncing}
                className="shrink-0"
              >
                {syncingDevices
                  ? <Loader2Icon className="size-3.5 animate-spin" />
                  : <PlayIcon className="size-3.5" />
                }
              </Button>
            </div>
            <SyncResult result={deviceResult} />
            {deviceLog.length > 0 && (
              <div data-sync-log><SyncLog entries={deviceLog} /></div>
            )}
          </CardContent>
        </Card>

        {/* Sync Room Sites */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPinIcon className="size-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Sync Room Sites</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Match YMCS sites to local rooms by name
                  </p>
                  {stats && (
                    stats.missingSiteId > 0 ? (
                      <button onClick={() => setMissingDialog({ title: "Rooms Missing YMCS Site ID", list: stats.missingSiteList, columns: ["name", "id", "short_code"] })} className="text-[11px] mt-1.5 font-mono text-red-400 hover:text-red-300 transition-colors cursor-pointer underline underline-offset-2 decoration-red-400/30">
                        {stats.missingSiteId} missing
                      </button>
                    ) : (
                      <p className="text-[11px] mt-1.5 font-mono text-emerald-400">all synced</p>
                    )
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setConfirmAction({ title: "Sync Room Sites", description: "This will fetch all YMCS sites and match them to local rooms by name, short code, or room ID. Matched rooms will store the YMCS site ID.", action: syncRoomSites })}
                disabled={anySyncing}
                className="shrink-0"
              >
                {syncingSites
                  ? <Loader2Icon className="size-3.5 animate-spin" />
                  : <PlayIcon className="size-3.5" />
                }
              </Button>
            </div>
            <SyncResult result={siteResult} />
            {siteLog.length > 0 && (
              <div data-sync-log><SyncLog entries={siteLog} /></div>
            )}
          </CardContent>
        </Card>

        {/* Sync Config IDs */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <FileCodeIcon className="size-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Sync Config IDs</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Match YMCS device configs to accounts via MAC
                  </p>
                  {stats && (
                    stats.missingConfigId > 0 ? (
                      <button onClick={() => setMissingDialog({ title: "Accounts Missing YMCS Config ID", list: stats.missingConfigList, columns: ["email", "name"] })} className="text-[11px] mt-1.5 font-mono text-red-400 hover:text-red-300 transition-colors cursor-pointer underline underline-offset-2 decoration-red-400/30">
                        {stats.missingConfigId} missing
                      </button>
                    ) : (
                      <p className="text-[11px] mt-1.5 font-mono text-emerald-400">all synced</p>
                    )
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setConfirmAction({ title: "Sync Config IDs", description: "This will look up each account's MAC address in YMCS device configs and store the matching config ID. Only targets accounts with a device ID but no config ID.", action: syncConfigIds })}
                disabled={anySyncing}
                className="shrink-0"
              >
                {syncingConfigs
                  ? <Loader2Icon className="size-3.5 animate-spin" />
                  : <PlayIcon className="size-3.5" />
                }
              </Button>
            </div>
            <SyncResult result={configSyncResult} />
            {configSyncLog.length > 0 && (
              <div data-sync-log><SyncLog entries={configSyncLog} /></div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section 2: Device Management ── */}
      <SectionLabel>Device Management</SectionLabel>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Rebind All Devices */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <LinkIcon className="size-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Rebind All Devices</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Unbind and rebind YMCS account on each device
                  </p>
                  {stats && (
                    <span className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-mono text-emerald-400">{stats.eligibleRebind} ready</span>
                      {stats.notEligibleList?.length > 0 && (
                        <button onClick={() => setMissingDialog({ title: "Accounts Not Eligible for Rebind", list: stats.notEligibleList, columns: ["email", "name", "hasAccountId", "hasDeviceId"] })} className="text-[11px] font-mono text-red-400 hover:text-red-300 transition-colors cursor-pointer underline underline-offset-2 decoration-red-400/30">
                          {stats.total - stats.eligibleRebind} not ready
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={rebindRoom} onValueChange={setRebindRoom} disabled={anySyncing} items={{ all: "All Rooms", ...Object.fromEntries(rooms.map(r => [String(r.id), r.name])) }}>
                  <SelectTrigger className="h-8 text-xs !w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rooms</SelectItem>
                    {rooms.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => { const roomName = rebindRoom === "all" ? "ALL" : rooms.find(r => String(r.id) === rebindRoom)?.name || rebindRoom; setConfirmAction({ title: `Rebind ${roomName === "ALL" ? "All" : `"${roomName}"`} Devices`, description: `This will forcefully unbind and rebind the YMCS account on ${roomName === "ALL" ? "all" : `"${roomName}"`} devices that have both Account ID and Device ID. This affects live SIP phones.`, action: syncAllDeviceAccounts, destructive: true }); }}
                  disabled={anySyncing}
                >
                  {syncingBind
                    ? <Loader2Icon className="size-3.5 animate-spin" />
                    : <PlayIcon className="size-3.5" />
                  }
                </Button>
              </div>
            </div>
            <SyncResult result={bindResult} />
            {bindLog.length > 0 && (
              <div data-sync-log><SyncLog entries={bindLog} /></div>
            )}
          </CardContent>
        </Card>

        {/* Update SIP Server */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <ServerIcon className="size-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Update SIP Server</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Change SIP server address and port on all accounts
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={sipRoom} onValueChange={setSipRoom} disabled={anySyncing} items={{ all: "All Rooms", ...Object.fromEntries(rooms.map(r => [String(r.id), r.name])) }}>
                  <SelectTrigger className="h-8 text-xs !w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rooms</SelectItem>
                    {rooms.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => { const roomName = sipRoom === "all" ? "ALL" : rooms.find(r => String(r.id) === sipRoom)?.name || sipRoom; setConfirmAction({ title: "Update SIP Server & Port", description: `This will update the SIP server to ${sipHost}:${sipPort} on ${roomName === "ALL" ? "all" : `"${roomName}"`} YMCS accounts. Phones will re-register to the new server.`, action: updateAllSipServer, destructive: true }); }}
                  disabled={anySyncing || !sipHost || !sipPort}
                >
                  {syncingSipServer
                    ? <Loader2Icon className="size-3.5 animate-spin" />
                    : <PlayIcon className="size-3.5" />
                  }
                </Button>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-[11px] text-muted-foreground/60 mb-1 block">Host</Label>
                <Input value={sipHost} onChange={(e) => setSipHost(e.target.value)} placeholder="50.28.84.57" disabled={anySyncing} className="h-8 text-xs" />
              </div>
              <div className="w-20">
                <Label className="text-[11px] text-muted-foreground/60 mb-1 block">Port</Label>
                <Input value={sipPort} onChange={(e) => setSipPort(e.target.value)} placeholder="5070" disabled={anySyncing} className="h-8 text-xs" />
              </div>
            </div>
            <SyncResult result={sipServerResult} />
            {sipServerLog.length > 0 && (
              <div data-sync-log><SyncLog entries={sipServerLog} /></div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section 3: Danger Zone ── */}
      <SectionLabel>Danger Zone</SectionLabel>
      <Card className="border-destructive/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                <ShieldAlertIcon className="size-4 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Reboot Devices</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send reboot command to YMCS managed phones. Devices will restart and temporarily go offline.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Select value={rebootRoom} onValueChange={setRebootRoom} disabled={anySyncing} items={{ all: "All Rooms", ...Object.fromEntries(rooms.map(r => [String(r.id), r.name])) }}>
                <SelectTrigger className="h-8 text-xs !w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {rooms.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => { const roomName = rebootRoom === "all" ? "ALL" : rooms.find(r => String(r.id) === rebootRoom)?.name || rebootRoom; setConfirmAction({ title: `Reboot ${roomName === "ALL" ? "All" : `"${roomName}"`} Devices`, description: `This will send a reboot command to ${roomName === "ALL" ? "ALL" : `"${roomName}"`} YMCS devices. Phones will restart and temporarily go offline.`, action: rebootAllDevices, destructive: true }); }}
                disabled={anySyncing}
              >
                {rebooting
                  ? <Loader2Icon className="size-3.5 animate-spin" />
                  : <RotateCwIcon className="size-3.5" />
                }
              </Button>
            </div>
          </div>
          <SyncResult result={rebootResult} />
          {rebootLog.length > 0 && (
            <div data-sync-log><SyncLog entries={rebootLog} /></div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={`size-10 rounded-lg flex items-center justify-center ${confirmAction?.destructive ? "bg-destructive/10 border border-destructive/20" : "bg-orange-500/10 border border-orange-500/20"}`}>
                <AlertTriangleIcon className={`size-5 ${confirmAction?.destructive ? "text-destructive" : "text-orange-500"}`} />
              </div>
              <DialogTitle>{confirmAction?.title}</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {confirmAction?.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.destructive ? "destructive" : "default"}
              onClick={() => { const fn = confirmAction.action; setConfirmAction(null); fn(); }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Missing List Dialog */}
      <Dialog open={!!missingDialog} onOpenChange={(open) => { if (!open) setMissingDialog(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{missingDialog?.title}</DialogTitle>
            <DialogDescription>{missingDialog?.list?.length || 0} accounts</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto rounded-lg border border-border/50 bg-muted/20">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                <tr className="text-muted-foreground/70 text-left">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  {missingDialog?.columns?.includes("hasAccountId") && (
                    <th className="px-3 py-2 font-medium">Account ID</th>
                  )}
                  {missingDialog?.columns?.includes("hasDeviceId") && (
                    <th className="px-3 py-2 font-medium">Device ID</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {(missingDialog?.list || []).map((a, i) => (
                  <tr key={i} className="text-muted-foreground hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-mono text-muted-foreground/40">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono">{a.email}</td>
                    <td className="px-3 py-1.5">{a.name || "—"}</td>
                    {missingDialog?.columns?.includes("hasAccountId") && (
                      <td className="px-3 py-1.5">{a.hasAccountId ? <span className="text-emerald-400">Yes</span> : <span className="text-red-400">No</span>}</td>
                    )}
                    {missingDialog?.columns?.includes("hasDeviceId") && (
                      <td className="px-3 py-1.5">{a.hasDeviceId ? <span className="text-emerald-400">Yes</span> : <span className="text-red-400">No</span>}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
