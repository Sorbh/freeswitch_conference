# Redline Parts-Locating Network — Product Understanding Brief

*Author: interview-derived, with Saurabh K. Sharma · Date: 2026-05-31*

> This document captures a complete picture of the product as it exists today, the
> decisions made during our review, and the framing for the real objective —
> **breaking a 5-year growth plateau.** It is reference + a launchpad for the
> growth conversation, not an implementation spec.

---

## 1. What the product is

A **subscription voice network for auto dismantlers (salvage yards)** that helps members
**locate and sell used parts they don't have in stock.**

When a yard gets a customer request for a part it doesn't have, the yard **broadcasts a
"sell call"** (a spoken part request) into its regional room. Other yards that *do* have
the part **respond**, and the two yards connect to fulfill the sale for the customer.

- **Operator / vendor:** Redline Used Auto Parts (`apis.redlineusedautoparts.com`).
- **Member:** one account = one **salvage-yard business** (phone sits at the counter, any staffer uses it).
- **Revenue model:** **monthly membership fee** per yard/phone.
- **Scale:** **100–500+ live yards** in production today.
- **Status:** **Live in production**, actively developed.

### The core loop
```
Customer asks Yard A for a part
        │  (Yard A doesn't have it)
        ▼
Yard A broadcasts the request into its regional room  ──►  "sell call"
        │
        ▼
Yards B…N in that region hear it (they join MUTED by default)
        │
        ▼
A yard that HAS the part unmutes and responds
        │
        ├── talk live in the room, OR
        └── take it private
        │  (the system does NOT control which — it's up to the yards)
        ▼
Deal is fulfilled; customer gets the part
        │
        ▼
System logs the broadcast: answered / unanswered, who responded, recording
```

---

## 2. How it works (mechanics)

### Regional rooms
- **12 named rooms** mapped to US regions: California, Texas, Florida, Mexico, ENS,
  Arizona, Ohio, New York, Georgia, Indiana, Michigan, Carolinas.
- Room IDs map by convention (`123456701` = CA, `…02` = TX, …) on the FreeSWITCH
  conference profile **`redline-hotline`**.
- Members join **muted** (always-on hotline behavior); they unmute to speak.
- The server **auto-re-originates** a member's call if it drops, keeping them
  continuously "in the room."

### Broadcast detection & logging
- When a member starts talking, a **room session + recording** begins.
- **Single speaker + ~5s silence → "unanswered"** (logged; pending-alert state — nobody had the part).
- **Multiple speakers → "answered"** (someone responded).
- Recordings saved to `/recordings/ROOMNAME_TIMESTAMP.wav`.
- Dashboard surfaces **answer rate %, hourly/daily volume, top broadcasters, by-room breakdown.**

### Mute / unmute (three paths)
1. **Yealink hardware** — phone hook events arrive via **syslog (UDP 515)**; off-hook = unmute, on-hook = mute.
2. **Web client** — HTTP POST to `/api/v1/action/*`.
3. **Admin UI** — manual per-user buttons.

### Critical-yard alerting
- An account flagged `critical` that goes offline >5 min triggers a **Telegram alert** (repeats every 60s until back online).

---

## 3. Members & devices

- **Device choice is the member's:** **Yealink hardware desk phones** *and* the
  **browser web client (jsSIP)** are both first-class, supported options.
- **Cross-region reach (already handled):** each yard is **profiled to broadcast to ~3
  nearby rooms** (not just its home region), and the **Yealink phone itself lets the user
  switch rooms.** So multi-region reach is solved at the phone/provisioning level — the
  single `accounts.room` value is not the constraint I first assumed.
- **Account management:** **mixed** — there is an *Add User* option on the Users page in
  the admin panel, and accounts can also be inserted directly into the DB.

---

## 4. Technical architecture (reference)

| Layer | Choice |
|---|---|
| Backend | Node.js + Express, ES modules |
| Telephony control | **FreeSWITCH ESL** via `modesl` (port 8021) |
| Web SIP | `jsSIP` browser client |
| Phone hooks | `syslog-server` (UDP 515) for Yealink off/on-hook |
| Data | **SQLite** (`better-sqlite3`, WAL mode) — single file, single process |
| Frontend | React 19, React Router 7, shadcn-ui, Tailwind 4, Recharts, Sonner |
| Realtime UI | Server-Sent Events (SSE) streams |
| Alerts | Telegram Bot API |
| Ports | HTTPS 4007 / HTTP 4070 (app), SIP via FreeSWITCH |

**Entry point** `index.js` boots: HTTP(S) servers → ESL connection → call-origination
service → critical-user alerting → syslog server → periodic tasks (5-min room snapshots, daily cleanup).

**Data model (SQLite tables):** `users` (per-device SIP clients/state), `accounts`
(yard accounts, billing-relevant flags: `active`, `critical`, `kickout`),
`broadcast_log` (sessions, answered, responded_by, participants, recording_path),
`event_log`, `online_history`, `room_snapshots`.

**FreeSWITCH events consumed:** `CHANNEL_ANSWER`, `CHANNEL_HANGUP` (auto-reconnect),
`sofia::register / unregister / expire`, `conference::maintenance` (join, start/stop-talking, mute, del-member).

**SIP auth:** FreeSWITCH `xml_curl` directory callback (`POST /api/v1/freeswitch/directory`)
returns the account password for digest challenge. This authenticates *joining a room* —
it does **not** protect the HTTP control API (see Security).

---

## 5. Security decision (resolved this session)

**Finding:** Two independent layers exist. (1) FreeSWITCH SIP auth gating room join — OK.
(2) The **HTTP control API** (`/api/v1/admin/*`, `/api/v1/action/*`) has **no
authentication** and the app ports are **reachable from the public internet** on a
**live 100–500-yard network.** Anyone who finds the IP can, unauthenticated:
- `GET /action/allendcall` → drop **every** yard at once
- `POST /action/delete` → delete accounts
- `/action/onhook`, `/action/honkRoom` → mute/honk anyone
- `/admin/users`, `/admin/broadcasts/recent` → exfiltrate all member data + recordings

**Decision (owner, 2026-05-31):** No interim network lockdown. Security will be addressed
**in the future** via a **login page + a JWT-protected API** (all endpoints require a
token). The owner has **explicitly accepted the live public-exposure risk** until then.
> ⚠️ Until JWT ships, the control plane remains world-reachable and unauthenticated; the
> exposure described above stays open. Recommend prioritizing the JWT work.

**Secondary security notes (documented, not blocking):**
- SIP passwords stored **plaintext** in SQLite. Partly inherent to SIP digest auth, but
  storing the **A1 hash** instead of cleartext is the stronger pattern.
- A hardcoded **default SIP password (`12345678`)** fallback exists — should be removed / per-account.

---

## 6. Scale & reliability watch-list (for 100–500+ yards)

- **SQLite + single Node process** is the current ceiling; fine now, will strain as the
  network grows. Candidate for Postgres + horizontal concerns later.
- **In-memory maps** (`roomSessions`, `pendingBroadcasts`, `sipBlocks`) aren't actively
  garbage-collected — watch for memory growth.
- **State sync on ESL reconnect** relies partly on caller-ID string matching — fragile.
- **No automated tests** today.

*(None of these are blocking; they're the reliability backlog as growth continues.)*

---

## 7. The real objective — breaking the 5-year plateau

**Stated goal:** the network has grown **<10% in 5 years**. The owner wants guidance on
**how to enhance the product** and **how to market it** to grow.

**Owner's own read on the bottleneck — a classic *leaky bucket*:**
1. **Acquisition is weak** — not enough new yards joining.
2. **Retention is weak** — yards join but **go quiet / churn.**

Net effect: sign-ups roughly cancel out cancellations → flat.

This is the right frame: growth = (new yards in) − (yards out). Both taps are the problem,
so both need work. The product mechanics above are the levers.

### Open questions to drive the growth conversation (next session)
*Acquisition*
- How are new yards found and sold today (referrals, cold outreach, events)?
- What's the #1 objection a prospective yard gives for not joining?
- Who are the competitors yards use instead (Car-Part.com, Hollander/eDen, PartsTrader, Facebook groups, phone trees)? What do they have that this doesn't?

*Retention / engagement*
- For yards that go quiet — is it because **too few requests** reach them, **too many irrelevant** ones, or the **hardware/UX friction**?
- Is there data on which yards are active vs. dormant, and answer rates per yard?
- Does a yard that *responds* and *wins deals* stay longer? (Can we prove value with the broadcast log?)

*Product levers that may move both*
- **Tune broadcast reach** — yards already broadcast to ~3 nearby rooms; auto-widening that radius when a local request goes **unanswered** = bigger matching pool, more value per request.
- **Mobile/web app** so a yard doesn't need a desk phone — lowers acquisition friction.
- **Surfacing ROI to members** — "you answered N requests / won $X this month" — to fight churn.
- **Unanswered-request follow-up** — escalate misses to other regions instead of dropping them.

---

## 8. Decisions Log

| # | Topic | Pushback / Issue | Resolution |
|---|---|---|---|
| 1 | Public unauthenticated control API on live network | **Hard block** — world-reachable `allendcall`/`delete`/data exfiltration | Owner deferred all mitigation to a **future login page + JWT** (no interim lockdown). Live exposure **explicitly accepted** until JWT ships. |
| 2 | Plaintext SIP passwords | Stored cleartext in SQLite | Documented; recommend A1-hash storage. Not blocking. |
| 3 | Hardcoded default password `12345678` | Weak fallback | Documented; recommend removal. Not blocking. |
| 4 | Cross-region membership | I mis-flagged this as a single-`room` data gap | **Corrected:** already handled — yards are profiled to broadcast to ~3 nearby rooms, and the Yealink phone lets users switch rooms. Not a gap. |
| 5 | Answer/fulfillment flow | System doesn't control whether deals happen in-room or private | Confirmed intentional — out of system scope. |
| 6 | Account management | No single source of truth (Add-User UI *and* manual DB inserts) | Documented as mixed; candidate for consolidation. |
| 7 | Spec scope | Started as product spec; owner's true goal is **growth** | Reframed: product brief + growth launchpad. |

---

*Next step: the growth working session — start from §7's open questions.*
