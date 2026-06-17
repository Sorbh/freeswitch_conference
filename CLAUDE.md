# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Deploy

```bash
npm run build          # Vite build frontend
npm run deploy         # vite build + pm2 restart 10 (frontend+backend)
pm2 restart 10         # backend-only restart
```

Dev server runs on port 5175 (Vite), production on 4007 (HTTPS) + 4070 (internal HTTP).

## FreeSWITCH CLI

```bash
/root/sorbh/freeswitch_1.10.12/freeswitch/bin/fs_cli -H 127.0.0.1 -P 8021 -p "redline_fs_2024" -x "<command>"
```

## Architecture

**Stack**: Express + Vite + React 19 + better-sqlite3 + FreeSWITCH ESL (modesl) + jsSIP

**Entry point**: `index.js` — starts Express, connects ESL, inits DB, starts syslog server (UDP 515).

### Backend Layout

- `service/dbService.js` — SQLite wrapper, schema, all queries. DB at `data/freeswitch_conference.db`
- `service/freeswitch/` — ESL handlers:
  - `connection.js` — ESL connect + event subscription
  - `registration.js` — sofia::register/unregister/expire
  - `callGate.js` — call initiation, eligibility checks, retry/fallback (5s×5, then 15m/30m/1hr)
  - `callEvents.js` — CHANNEL_ANSWER/HANGUP, talking detection
  - `callAction.js` — mute/unmute/honk/kick via FS conference API
  - `broadcast.js` — unmute session tracking, recording, Telegram notification
  - `onlineSync.js` — registration polling (30s), keep-alive MESSAGE handling
  - `notifications.js` — send SIP MESSAGE/NOTIFY to phones
- `service/yealink/` — YMCS REST API (OAuth2, device mgmt, SIP accounts, config push)
- `service/phoneEvents.js` — Yealink syslog parser + HTTP hook handler
- `modules/admin/routesApi.js` — main admin API: user/room CRUD, SSE streams, YMCS control
- `modules/yealink/` — Yealink phone actions (onhook/offhook mute, softkey room change)
- `modules/freeswitch/routesApi.js` — XML directory endpoint for FS digest auth

### Frontend Layout

- `src/pages/` — React pages (Dashboard, Users, Rooms, Broadcasts, Events, System, YmcsControl, FsLogs, PhoneLogs, Notifications)
- `src/hooks/useSSE.js` — SSE event buffer (250ms flush, 2000 max)
- `src/components/ui/` — shadcn/ui components
- UI: TailwindCSS + lucide-react icons + sonner toasts

## Globals

```
global.config, global.db, global.freeswitch, global.callService, global.alerting
global.ConnectionState: { IDEAL, CONNECTING, CONNECTED, HANGUP, RETRY, ERROR }
global.AuthState: { LOGIN, LOGOUT }
```

Real-time updates via `global.db.eventEmitter`: USER_UPDATE, STATE_CHANGE, PHONE_LOG, BROADCAST_LOG → SSE to frontend.

## Database Tables

- **users** — runtime SIP state (connection_state, auth_state, mute, online, fs_channel_uuid, room, current_room)
- **accounts** — admin CRUD (email, password, room, active, kickout, ymcs_device_id)
- **rooms** — room config (id, name, short_code, ymcs_site_id)
- **broadcast_log, event_log, online_history, room_snapshots** — metrics

`users.room` = default room (synced from accounts.room). `users.current_room` = active room (set by softkey change).

## Call Flow

1. Phone registers → `sofia::register` → validate account → create/update user → `initiateCall()`
2. `callGate` checks eligibility → `sofia_contact` lookup → `originate` to conference
3. `CHANNEL_ANSWER` → update DB → emit USER_UPDATE → SSE to frontend
4. Unmute → broadcast session starts → recording → mute/leave → session ends → Telegram notify

## Key Patterns

- No test framework configured
- No web UI auth — admin API is internal use
- MAC-based phone identification for mute/unmute
- SSE for all real-time frontend updates (no WebSocket)
- Yealink syslog on UDP 515 for off-hook/on-hook detection
- Web SIP client at `public/redline_sip_client.js` (jsSIP, register=true, 120s expiry)
