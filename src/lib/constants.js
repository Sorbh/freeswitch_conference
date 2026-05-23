export const ROOM_NAMES = {
  123456701: "California",
  123456702: "Texas",
  123456703: "Florida",
  123456704: "Mexico",
  123456705: "ENS",
  123456706: "Arizona",
  123456707: "Ohio",
  123456708: "New York",
  123456709: "Georgia",
  123456710: "Indiana",
  123456711: "Michigan",
  123456712: "Carolinas",
};

export const EVENT_COLORS = {
  registration: "#3b82f6",
  register: "#3b82f6",
  unregister: "#71717a",
  conference_join: "#22c55e",
  join: "#22c55e",
  conference_leave: "#ef4444",
  leave: "#ef4444",
  mute: "#f59e0b",
  unmute: "#f59e0b",
  offline: "#71717a",
  online: "#22c55e",
  broadcast: "#06b6d4",
  error: "#ef4444",
};

export function timeAgo(timestamp) {
  if (!timestamp) return "Never";
  const now = Date.now();
  const t = typeof timestamp === "number" && timestamp < 1e12
    ? timestamp * 1000
    : new Date(timestamp).getTime();
  const seconds = Math.floor((now - t) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return "-";
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatUptimeSeconds(seconds) {
  if (!seconds) return "-";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export function formatBytes(bytes) {
  if (bytes == null || bytes === undefined) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}
