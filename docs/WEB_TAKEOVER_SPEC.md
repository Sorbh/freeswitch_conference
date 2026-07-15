# Web Takeover — Device Priority Specification

**Date:** 2026-07-15 · **Status:** Approved (interview complete) · **Owner:** Saurabh

## Overview

Each account has two SIP endpoints sharing one identity: a Yealink desk phone
(AOR `user@domain`) and the web client (jsSIP, AOR `user.at.domain@<fs-ip>`,
UA `redline-webclient`). The `web_takeover` flag decides which device owns the
conference call:

- **Flag ON** — web gets priority whenever it is SIP-registered; Yealink is the
  automatic fallback when web is not registered.
- **Flag OFF (default)** — Yealink gets priority; web connects only when the
  Yealink is offline/unregistered.

Foundation (consume-half) already committed in `abba868`: schema columns,
registration guards, callGate direct-originate, client force-register. This
spec covers the missing trigger-half and the corrected routing model.

## Goals

1. Web-client button ("Take over from browser" / "Release to phone") that
   toggles the flag — the only place it can be flipped.
2. Deterministic device routing derived from live FreeSWITCH registration
   state, honored by conference originate AND direct calls.
3. Automatic fallback and automatic re-takeover with no button presses after
   the initial enable.

## Non-Goals

- Admin control of the flag (admin view is read-only).
- Ring-both / forked dialing.
- Sub-120s web-offline detection (SIP-only detection accepted).
- Carrying live mute/broadcast state across a device switch.

## Decided Behavior

### Toggle
- `users.web_takeover` (exists, default 0) is the persistent flag. No
  `accounts` column; if a users row is recreated the flag resets to 0 —
  accepted.
- New authenticated client API endpoints (modules/client/routesApi.js):
  - `POST /api/client/takeover` → set flag=1; if a Yealink conference leg is
    live, hard-switch to web.
  - `POST /api/client/release` → set flag=0; if a web conference leg is live
    and Yealink is registered, hard-switch to Yealink; if Yealink offline, web
    keeps the call (it is the fallback).
- Endpoints operate only on the authenticated account's own user row.

### Routing (single resolution function)
`resolveTargetDevice(user)` — ordered live `sofia_contact` probes; FreeSWITCH
is the sole source of truth (no shadow per-device state in SQLite):
- flag ON → probe web AOR first, then Yealink AOR.
- flag OFF → probe Yealink AOR first, then web AOR.
First AOR returning a contact wins. Used by conference originate (callGate)
and direct calls. Replaces the stored `web_takeover_contact` direct-originate
(callGate.js:169-174) — the stashed contact can go stale; live lookup cannot.

### Events that re-run the gate
- Any `sofia::register` / `sofia::unregister` / `sofia::expire` for either AOR.
- The existing 30s registration poll (onlineSync) as safety net.
- SIP-only detection (decided): a crashed browser tab mid-call may leave up to
  ~120s dead air until registration expiry — accepted trade-off.

### Switchover (hard switch, kill-then-originate)
1. `uuid_kill` the current conference leg.
2. Originate to the device chosen by `resolveTargetDevice`.
3. New leg always joins **muted**; any in-flight broadcast/unmute session is
   closed by the old leg's hangup (existing hangup handling).

Auto re-takeover: flag ON + web `sofia::register` while Yealink holds the call
→ hard switch to web automatically.

### Originate failure (flag ON, web registered, originate fails)
**Web only, keep retrying** — never fall back to Yealink while the web AOR is
registered. Existing retry ladder (5s×5, then 15m/30m/1hr) targets web only.
Accepted risk: a wedged-but-registered browser keeps the yard silent.

### Yealink while web holds the call
Stays registered/online, dormant. Off-hook/on-hook syslog events are ignored
(guard in phoneEvents.js / yealink hook module) while flag=1 and web holds the
call. Release happens only via the web button.

### Direct calls
Same `resolveTargetDevice` priority rule — no separate policy.

### Multi-tab
Existing single-web-session enforcement (second login logs out the first)
already covers this. No new work.

### Admin visibility
- Users page: active-device badge (Web / Yealink) + flag indicator. Read-only.
- `event_log` rows for: takeover enabled, released, fallback-to-Yealink,
  auto-re-takeover, hard-switch performed. For post-hoc "why was this yard
  silent" debugging.

### Web client UI
- Button in the yard web client: "Take over from browser" when flag=0,
  "Release to phone" when flag=1, with current active-device indicator.
- Existing behavior kept: flag=1 skips monitor mode and force-registers
  (redline_sip_client.js:760-763).

## Security

- Toggle endpoints require the existing client session auth; an account can
  only toggle itself.
- No new unauthenticated surface. Rate limiting inherited from client API.

## Rollout

1. Deploy default-off in a quiet window (ask before pm2 restart — production
   callers online).
2. Verify full matrix with a dedicated test account + spare Yealink in a
   non-production room: enable mid-call, release mid-call, tab close →
   fallback after expiry, web re-register → auto re-takeover, mid-broadcast
   switch joins muted, direct call routing both flag states, off-hook ignored.
3. Only then announce the button to yards.

## Implementation Order

1. `resolveTargetDevice()` in callGate (ordered sofia_contact probes); remove
   stored-contact bypass. Wire conference originate + direct calls through it.
2. Registration guard rework in registration.js: flag-aware priority both
   directions incl. auto re-takeover on web register and web→Yealink fallback
   on web unregister/expire; Yealink unregister/expire → web fallback when
   flag=0.
3. Toggle endpoints + hard-switch choreography in modules/client/routesApi.js.
4. phoneEvents.js off-hook guard during active takeover.
5. Web client UI button + states; consume flag from /account.
6. Admin badge + event_log entries.
7. Test-account verification matrix, then quiet-window deploy.

## Decisions Log

| # | Topic | Decision | Pushback / notes |
|---|-------|----------|------------------|
| 1 | Semantics | Persistent flag toggled by a web-client button; ON=web priority, OFF=Yealink priority | Reconciled whiteboard (persistent pref) vs committed code (momentary action) |
| 2 | Ownership | Web client only; no admin toggle | — |
| 3 | Lifetime | Flag persists across sessions; auto re-takeover when web returns | — |
| 4 | Offline detection | **Strictly SIP registration events** | Claude pushed for CHANNEL_HANGUP fast-fallback on mid-call web crash (~free via callEvents); user chose pure SIP after re-asking — accepts up to ~120s dead air |
| 5 | Switchover | Hard switch, kill-then-originate | Make-before-break rejected (dual-leg complexity) |
| 6 | Mute | New leg always joins muted; broadcast session ends with old leg | — |
| 7 | Data model | Flag stays on `users` only | Flag resets if user row recreated — accepted |
| 8 | Multi-tab | Existing first-session-logout covers it | — |
| 9 | Originate failure | Web only, keep retrying; never Yealink while web registered | Claude flagged wedged-browser silent-yard risk — accepted, consistent with SIP-is-truth stance |
| 10 | Off-hook during takeover | Ignored (dormant phone) | Off-hook-reclaim rejected (accidental bumps) |
| 11 | Admin | Read-only badge + event_log audit | — |
| 12 | Direct calls | Same priority rule via shared resolver | — |
| 13 | Liveness source of truth | Live `sofia_contact` probes, ordered by flag; no DB shadow state | Replaces stale `web_takeover_contact` bypass |
| 14 | Rollout | Default off; test account + test room before announcing | Restart only in quiet window with approval |
