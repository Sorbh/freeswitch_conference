# Voicemail Feature Spec

## Overview

When a direct call goes unanswered (15s timeout) or is explicitly declined, the caller can leave a voice message for the callee. Messages are recorded via ESL (`uuid_record`), stored in SQLite, and surfaced through a web widget on both admin and client pages.

Phone-only feature — web SIP clients keep the existing "no answer" behavior.

## Goals

- Let callers leave messages when direct calls aren't picked up
- Surface voicemails in the existing FAB widget (admin: all messages, client: per-user)
- Provide browser playback and play-to-phone options
- Enable callback to the voicemail sender via direct call

## Non-Goals

- No web SIP client voicemail (phone-only)
- No auto-transcription
- No MWI (phone LED) or push notifications — SSE only
- No per-user greetings or TTS prompts
- No mod_voicemail — fully custom via Node.js + ESL

---

## Call Flow

### Trigger

Voicemail activates on both:
1. **No-answer timeout** — 15s expires in `_timeoutCall()`
2. **Explicit decline** — callee taps Reject softkey in `_declineCall()`

If the callee has `voicemail_enabled = false`, the existing behavior continues unchanged (no voicemail prompt).

### Caller Experience

1. Direct call times out or is declined
2. Caller's Yealink phone shows softkeys: **"Leave Message"** / **"Cancel"**
3. If **Cancel**: standard "No answer" flow, caller returns to conference
4. If **Leave Message**:
   - Beep tone plays (no greeting, no TTS)
   - Recording starts via `uuid_record`
   - Max duration: **60 seconds**
   - Recording ends when caller **hangs up** or hits the 60s cap
   - If recording < **2 seconds**: auto-discarded (accidental hangup)
   - Caller returns to conference after recording

### Callee Experience

1. New voicemail saved → SSE event (`voicemail_new`) emitted to callee
2. Existing FAB widget shows unread voicemail count badge
3. Widget panel lists voicemails with:
   - Caller name + extension
   - Timestamp
   - Duration
   - Read/unread indicator
   - **Play** button (browser HTML5 audio)
   - **Play to phone** button (conference play to callee's member ID)
   - **Callback** button (initiates direct call to sender)
   - **Delete** button

---

## Database

### New table: `voicemails`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `caller_email` | TEXT | Sender's account email |
| `callee_email` | TEXT | Recipient's account email |
| `caller_extension` | TEXT | Sender's extension |
| `callee_extension` | TEXT | Recipient's extension |
| `caller_display_name` | TEXT | Sender's display name at time of recording |
| `recording_path` | TEXT | File path relative to recordings dir |
| `duration_ms` | INTEGER | Recording duration in milliseconds |
| `is_read` | INTEGER | 0 = unread, 1 = read |
| `created_at` | TEXT | ISO timestamp |

### accounts table change

Add column: `voicemail_enabled INTEGER DEFAULT 1`

---

## File Storage

- Directory: `recordings/voicemail/`
- Naming: `vm_{callerExt}_to_{calleeExt}_{ISO-timestamp}.wav`
- Follows existing pattern from `recordings/direct/`

---

## Backend Implementation

### Hook point: `service/freeswitch/directCall.js`

Modify `_timeoutCall()` and `_declineCall()` to:
1. Check `callee.voicemail_enabled`
2. If enabled: show softkeys to caller ("Leave Message" / "Cancel")
3. On "Leave Message" softkey hit (via Yealink HTTP callback):
   - Play beep tone to caller
   - Start `uuid_record` on caller's channel
   - Set 60s timeout timer
   - On hangup or timeout: stop recording, check duration
   - If >= 2s: save to DB + emit SSE event
   - If < 2s: delete file, no DB entry

### New file: `service/freeswitch/voicemail.js`

- `startVoicemailRecording(callerInfo, calleeInfo, callId)` — beep + record
- `stopVoicemailRecording(callerUserName)` — stop, validate, save
- `playVoicemailToPhone(voicemailId, userName)` — conference play to member

### New routes

Add to `modules/admin/routesApi.js` (or dedicated `modules/admin/voicemails.js`):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/voicemails` | List all voicemails (admin) or per-user (client, filtered by email) |
| `GET` | `/voicemails/:id` | Get single voicemail details |
| `PATCH` | `/voicemails/:id/read` | Mark as read |
| `DELETE` | `/voicemails/:id` | Delete voicemail + recording file |
| `POST` | `/voicemails/:id/play-to-phone` | Play voicemail audio to user's phone via FS |
| `POST` | `/voicemails/:id/callback` | Initiate direct call to voicemail sender |

### Yealink softkey route

Add to `modules/yealink/routesApi.js`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/voicemail/leave?mac=` | Caller chose "Leave Message" — start recording |
| `GET` | `/voicemail/cancel?mac=` | Caller chose "Cancel" — return to conference |

### SSE Events

New event type on existing client SSE stream:
- `voicemail_new` — new voicemail received (payload: voicemail record)
- `voicemail_deleted` — voicemail removed (payload: voicemail ID)

### DB Service additions

Add to `service/dbService.js`:
- `createVoicemail(data)` — insert new record
- `getVoicemails(filters)` — list with optional email filter
- `getVoicemail(id)` — single record
- `markVoicemailRead(id)` — set is_read = 1
- `deleteVoicemail(id)` — delete record, return recording_path for file cleanup
- `getUnreadVoicemailCount(email)` — for badge count

---

## Frontend Implementation

### FAB Widget Enhancement

Update the existing FAB widget component to:
1. Fetch voicemail list on mount (`GET /voicemails`)
2. Subscribe to `voicemail_new` and `voicemail_deleted` SSE events
3. Show unread count badge on FAB icon
4. Render voicemail list in the panel with:
   - Audio player (HTML5 `<audio>` element)
   - Play to phone button → `POST /voicemails/:id/play-to-phone`
   - Callback button → `POST /voicemails/:id/callback`
   - Delete button → `DELETE /voicemails/:id`
   - Auto-mark as read when played → `PATCH /voicemails/:id/read`

### Admin vs Client view

- **Admin**: sees all voicemails across all users, filter by user/room
- **Client**: sees only voicemails where `callee_email` matches their email

---

## Implementation Order

1. **DB schema** — add `voicemails` table + `voicemail_enabled` column on accounts
2. **DB service** — CRUD functions for voicemails
3. **voicemail.js** — recording logic (beep, uuid_record, save, duration check)
4. **directCall.js hooks** — modify timeout/decline to offer voicemail softkey
5. **Yealink routes** — `/voicemail/leave` and `/voicemail/cancel` endpoints
6. **Admin API routes** — voicemail CRUD + play-to-phone + callback
7. **SSE events** — `voicemail_new` and `voicemail_deleted` emission
8. **FAB widget** — voicemail tab/section with player and controls
9. **Admin view** — all-voicemails view with filters

---

## Decisions Log

| Decision | Choice | Alternatives considered |
|----------|--------|------------------------|
| Trigger | Both no-answer and decline | No-answer only; no-answer + optional on decline |
| Caller UX | Softkey choice (Leave Message / Cancel) | Auto-record after beep; DTMF opt-in |
| Web client | No voicemail from web | UI buttons in browser; DTMF fallback |
| Notification | SSE event only, FAB widget | MWI LED; web push; Telegram |
| Widget target | Both admin + client views | Admin only; client only |
| Playback | Browser audio + play to phone | Browser only; phone only |
| Greeting | Just a beep | TTS greeting; per-user recorded greeting |
| Recording | 60s max, hangup ends it | 30s + DTMF; 120s |
| Transcription | None | Auto-transcribe; on-demand |
| Architecture | Full custom Node.js + ESL | mod_voicemail native; hybrid |
| Short recordings | Discard < 2s | Keep everything |
| Opt-out | Per-user voicemail_enabled flag | No opt-out |
| Message management | Play + delete + callback, no auto-expiry | No callback; 30-day expiry |
