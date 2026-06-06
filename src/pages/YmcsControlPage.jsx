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
} from "lucide-react";

function SyncLog({ entries }) {
  const containerRef = useRef(null);
  const visible = entries.slice(-4);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="mt-4 rounded-lg border border-border/50 bg-muted/20 font-mono text-xs">
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
    <div className="mt-3 flex items-center gap-3">
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
  const [sipHost, setSipHost] = useState("50.28.84.57");
  const [sipPort, setSipPort] = useState("5070");
  const abortRef = useRef(null);
  const anySyncing = syncingAccounts || syncingDevices || syncingBind || syncingSipServer || rebooting;
  const [confirmAction, setConfirmAction] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    try {
      const res = await fetch("/api/v1/admin/accounts");
      const json = await res.json();
      const accounts = json.data || [];
      const missingDevice = accounts.filter(a => !a.ymcs_device_id);
      setStats({
        total: accounts.length,
        missingAccountId: accounts.filter(a => !a.ymcs_account_id).length,
        missingDeviceId: missingDevice.length,
        missingDeviceList: missingDevice.map(a => ({ email: a.email, name: a.display_name, hasAccountId: !!a.ymcs_account_id })),
        eligibleRebind: accounts.filter(a => a.ymcs_account_id && a.ymcs_device_id).length,
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
      const res = await fetch("/api/v1/admin/accounts");
      const json = await res.json();
      const accounts = json.data || [];
      addLog(setAccountLog, { type: "info", message: `Found ${accounts.length} accounts` });

      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        const prefix = `[${i + 1}/${accounts.length}] ${acc.email}`;

        try {
          const r = await fetch(`/api/v1/admin/accounts/${acc.id}/refresh-account-id`, { method: "POST" });
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

  async function syncAllDeviceAccounts() {
    setSyncingBind(true);
    setBindLog([]);
    setBindResult(null);
    const start = Date.now();

    try {
      const eventSource = new EventSource("/api/v1/admin/ymcs/update-all-device-accounts");

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
      const eventSource = new EventSource(`/api/v1/admin/ymcs/update-all-sip-server?host=${encodeURIComponent(sipHost)}&port=${encodeURIComponent(sipPort)}`);

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
      const eventSource = new EventSource("/api/v1/admin/ymcs/reboot-all-devices");

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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">YMCS Control</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sync account and device IDs from Yealink Management Cloud Service
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <HashIcon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Sync All Account IDs</h3>
                  <p className="text-sm text-muted-foreground">
                    Fetch YMCS account ID for each account using email lookup
                  </p>
                  {stats && (
                    <p className={`text-xs mt-1 ${stats.missingAccountId > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {stats.missingAccountId > 0
                        ? `${stats.missingAccountId} of ${stats.total} accounts missing YMCS Account ID`
                        : `All ${stats.total} accounts synced`}
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => setConfirmAction({ title: "Sync All Account IDs", description: "This will call the YMCS API for every account to fetch their YMCS Account ID. This may take a few minutes.", action: syncAllAccountIds })}
                disabled={anySyncing}
              >
                {syncingAccounts
                  ? <><Loader2Icon className="size-4 mr-2 animate-spin" />Syncing...</>
                  : <><PlayIcon className="size-4 mr-2" />Start Sync</>
                }
              </Button>
            </div>
            <SyncResult result={accountResult} />
            {accountLog.length > 0 && (
              <div data-sync-log>
                <SyncLog entries={accountLog} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CloudIcon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Sync All Device IDs</h3>
                  <p className="text-sm text-muted-foreground">
                    Fetch YMCS device ID for each device using device details
                  </p>
                  {stats && (
                    <p className={`text-xs mt-1 ${stats.missingDeviceId > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {stats.missingDeviceId > 0
                        ? `${stats.missingDeviceId} of ${stats.total} accounts missing YMCS Device ID`
                        : `All ${stats.total} accounts synced`}
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => setConfirmAction({ title: "Sync All Device IDs", description: "This will list all devices from YMCS, get each device's account details, and save the device ID to matching accounts in our DB. This may take a few minutes.", action: syncAllDeviceIds })}
                disabled={anySyncing}
              >
                {syncingDevices
                  ? <><Loader2Icon className="size-4 mr-2 animate-spin" />Syncing...</>
                  : <><PlayIcon className="size-4 mr-2" />Start Sync</>
                }
              </Button>
            </div>
            <SyncResult result={deviceResult} />
            {deviceLog.length > 0 && (
              <div data-sync-log>
                <SyncLog entries={deviceLog} />
              </div>
            )}
            {stats?.missingDeviceId > 0 && (
              <details className="mt-4">
                <summary className="flex items-center gap-1.5 text-xs text-red-400 cursor-pointer select-none hover:text-red-300 transition-colors">
                  <ChevronDownIcon className="size-3.5 transition-transform [details[open]>&]:rotate-180" />
                  {stats.missingDeviceId} accounts without device — not bound to any YMCS device
                </summary>
                <div className="mt-2 rounded-lg border border-border/50 bg-muted/20 max-h-[250px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr className="text-muted-foreground/70 text-left">
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Account ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {stats.missingDeviceList.map((a, i) => (
                        <tr key={i} className="text-muted-foreground hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-mono">{a.email}</td>
                          <td className="px-3 py-1.5">{a.name || "—"}</td>
                          <td className="px-3 py-1.5">{a.hasAccountId ? <span className="text-emerald-400">Yes</span> : <span className="text-red-400">No</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <LinkIcon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Update Account on All Devices</h3>
                  <p className="text-sm text-muted-foreground">
                    Unbind old accounts and rebind the correct YMCS account to each device
                  </p>
                  {stats && (
                    <p className="text-xs text-red-400 mt-1">{stats.eligibleRebind} of {stats.total} accounts ready to rebind</p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => setConfirmAction({ title: "Update Account on All Devices", description: `This will forcefully unbind and rebind the YMCS account on ${stats?.eligibleRebind || 0} devices that have both Account ID and Device ID. This affects live SIP phones.`, action: syncAllDeviceAccounts, destructive: true })}
                disabled={anySyncing}
              >
                {syncingBind
                  ? <><Loader2Icon className="size-4 mr-2 animate-spin" />Updating...</>
                  : <><PlayIcon className="size-4 mr-2" />Start Update</>
                }
              </Button>
            </div>
            <SyncResult result={bindResult} />
            {bindLog.length > 0 && (
              <div data-sync-log>
                <SyncLog entries={bindLog} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <ServerIcon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Update SIP Server &amp; Port</h3>
                  <p className="text-sm text-muted-foreground">
                    Update SIP server address and port on all YMCS accounts
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setConfirmAction({ title: "Update SIP Server & Port", description: `This will update the SIP server to ${sipHost}:${sipPort} on all YMCS accounts. Phones will re-register to the new server.`, action: updateAllSipServer, destructive: true })}
                disabled={anySyncing || !sipHost || !sipPort}
              >
                {syncingSipServer
                  ? <><Loader2Icon className="size-4 mr-2 animate-spin" />Updating...</>
                  : <><PlayIcon className="size-4 mr-2" />Start Update</>
                }
              </Button>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">SIP Server Host</Label>
                <Input value={sipHost} onChange={(e) => setSipHost(e.target.value)} placeholder="50.28.84.57" disabled={anySyncing} />
              </div>
              <div className="w-28">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Port</Label>
                <Input value={sipPort} onChange={(e) => setSipPort(e.target.value)} placeholder="5060" disabled={anySyncing} />
              </div>
            </div>
            <SyncResult result={sipServerResult} />
            {sipServerLog.length > 0 && (
              <div data-sync-log>
                <SyncLog entries={sipServerLog} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                  <RotateCwIcon className="size-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold">Reboot All Devices</h3>
                  <p className="text-sm text-muted-foreground">
                    Send reboot command to all YMCS managed devices
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={() => setConfirmAction({ title: "Reboot All Devices", description: "This will send a reboot command to ALL YMCS devices. All phones will restart and temporarily go offline.", action: rebootAllDevices, destructive: true })}
                disabled={anySyncing}
              >
                {rebooting
                  ? <><Loader2Icon className="size-4 mr-2 animate-spin" />Rebooting...</>
                  : <><RotateCwIcon className="size-4 mr-2" />Reboot All</>
                }
              </Button>
            </div>
            <SyncResult result={rebootResult} />
            {rebootLog.length > 0 && (
              <div data-sync-log>
                <SyncLog entries={rebootLog} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
