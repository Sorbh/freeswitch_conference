# Hotline HQ — Email Campaign Brief

_Last updated: 2026-07-03 (evening IST). Daily quota: ~300 marketing emails/day on Brevo — use it every day, it does not roll over._

## What works (data through 2026-07-03)

- **Winning creative**: subject `2,847 parts located in 30 days — without a single cold call` + the "Big Number" dark-hero template.
  Proof: 24–27% unique opens across ~800 delivered (Ohio Batch 1 + 2). All other angles (story/question/math/follow-up) did 15–22% on samples too small to matter.
- **Trust unique OPENS only.** Raw click counts are bot-inflated by corporate mail scanners (e.g. 395 "clicks" on 312 delivered; real clickers were ~29).
- **List hygiene matters**: scraped association lists hard-bounced 9–27% (AZ worst). The enriched dealer lists bounce far less. High bounces damage the Brevo sender score.

## Sent so far

| Date | Campaign | List | Delivered | Opens |
|---|---|---|---|---|
| Jun 26–28 | 8 angle tests (assoc. lists) | AARDA/FADRA/TARA/KATRA/IAR etc. | ~350 | 15–35% |
| Jun 30 | OH Batch 1 - Big Number (id 13) | list 6 (581) | 491 | 27.3% |
| Jul 1 | OH Batch 2 - Big Number (id 16) | list 7 (382) | 312 | 23.7% |
| **Jul 3** | **CA Dealers - Big Number (id 18)** | **list 30 (265 sendable)** | dispatching | — |
| **Jul 3** | **Hot Leads - Follow Up (id 19)** | **list 31 (35 engaged leads)** | dispatching | — |

Campaign 18 notes: sent ~11:07 AM PT on the July-4th-observed Friday (owner call: quota is use-it-or-lose-it). Network volume that day was 121 broadcasts vs normal 280–350 — **compare its opens vs the ~26% OH baseline to quantify the holiday/send-day penalty.**

## Critical gotchas (hit these once already)

1. **Regional "Dealers - *" lists (Brevo ids 17–29) have NO contact attributes** — imported email-only. Any template using `{{ contact.FIRSTNAME/COMPANY/STATE }}` renders blank.
   **Fix before every send**: enrich from `dealers_enriched.json` (repo root, 3,715 dealers with name/city/state) — import CSV `EMAIL;COMPANY;CITY;STATE` with `updateExistingContacts=true` into a fresh per-state list. No first names exist anywhere, so the template now uses `{{ contact.FIRSTNAME | default : "there" }}` and `{{ contact.COMPANY | default : "your yard" }}` — keep those fallbacks.
2. **Broadcast play-links must be distinct per card** (old template reused one recording 3×). Pick from `broadcast_log` (sqlite, `data/freeswitch_conference.db`): `answered=1`, `recording_path` set, high `listener_count`; link as `https://hotlinehq.online/b/<share_token>`. Current cards: Camry transmission `f749297e-…`, Toyota 3.5 engine `8a6ff447-…`, Camaro trunk `65e43b7c-…` (all verified HTTP 200).
3. Brevo API: updating campaign recipients requires non-empty `exclusionListIds` — pass `[2]` ("Your first list", 1 contact, harmless).
4. Check `broadcast_log` daily counts as a "are yards working today" signal; aim for ~9:15 AM recipient-local, but never hold a send for a better day (quota rule).

## Tomorrow (Jul 4, Sat) and next sends — in order

1. **Dealers - Florida** (Brevo list 24, 186 contacts; active room) — needs enrichment step first (FL has 176 dealers with emails in `dealers_enriched.json`). ~186 sends, exclude FADRA lists 11 & 12 to dedupe.
2. **Recreate TX + AZ** ("Big Number" to lists 23 + 26, exclude 5/9/10 = 266 net) — this draft was campaign 18 before it was retargeted to CA. Needs enrichment first.
3. **Dealers - West remainder** (WA/OR/CO after CA split-out) and then Midwest (673) / Northeast (518) / Southeast (506).
4. **A/B subject tests only on the 500+ lists** (arms of 150+; smaller lists can't resolve a winner — exploit the proven subject).
5. After results accumulate: refresh the hot-leads list (list 31) and re-run the follow-up pattern.

## Hot-leads follow-up pattern (first run Jul 3, campaign 19)

- Export per-campaign `clickers`/`openers` via Brevo recipient exports (async process -> CSV download).
- Rank: clickers > active-room-state openers > multi-openers with >=2 REAL opens (subtract Apple MPP proxy opens — OH lists are bot-heavy).
- Exclude: existing signups (app sqlite `accounts` table) and unsubscribes.
- Creative: short personal note (NOT the big-number template they already saw), one real call recording, one CTA, "just hit reply" line. Reply-to er.sorbh@gmail.com — watch the inbox for replies.
- Leftover daily quota is the natural budget for these follow-ups.

## Strategy rationale

Active rooms exist only in **CA / TX / AZ / FL** — a dealer who signs up from those states hears live calls immediately (activation), so those states get the quota first. Cold states join an empty room and churn; they come after, ideally once their room can be seeded.
