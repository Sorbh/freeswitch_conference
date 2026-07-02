# Hotline HQ Email Campaign Summary

**Period:** June 26 - 29, 2026
**Platform:** Brevo (free plan, 300 emails/day)
**Sender:** Hotline HQ <er.sorbh@gmail.com>
**First Signup:** chazsusedparts@gmail.com (Chaz's Used Auto Parts, Taneytown MD) - June 28

---

## What Worked

### Best Templates (by click rate)
1. **yard_08_bignumber** (Big Number) - 46-52% click rate across lists. Got our first signup. Subject: "2,847 parts located in 30 days - without a single cold call"
2. **yard_03_audio** (Audio Proof) - 26-52% click rate. Strong proof-based messaging.
3. **yard_05_competitor** (Competitor) - 36% click rate. FOMO angle works.
4. **yard_01_question** (Quick Question) - 40% click rate on TX list.

### Best Lists (by open rate)
1. **TARA TX** - 36% open rate (42 delivered)
2. **AARDA Alberta (Canada)** - 30-33% open rate (45-46 delivered)
3. **Midwest OH** - 27% open rate (229 delivered) - largest list, got the signup

### Key Wins
- Page load speed fixed: 22s LCP down to 2.2s (render-blocking CSS @import removed)
- Login buttons removed from all email templates (was confusing visitors)
- Query params now flow through entire funnel: email -> landing/broadcast -> signup
- Broadcast page redesigned with split layout (hero left, broadcast card right)

## What Didn't Work

### Dead Templates (zero clicks)
- **yard_06_story** (The Story) - 0 clicks on AZ list. Too narrative, no urgency.
- **yard_04_math** (The Math) - 0 clicks on KY list. Too analytical for cold outreach.

### Low Performers
- **followup** template - 2% click rate on Canada (3rd email fatigue), 31% on FL (but FL was warm)
- **yard_02_vision** (Vision) - 4% click rate. Abstract messaging doesn't convert.

### Issues Discovered
- ~90% of Brevo's reported "clicks" are email security bot scanners (corporate email filters)
- Real visitor count is ~6-8 humans per 73 reported clicks
- Canada got first unsubscribe after 3rd email - list fatigue setting in
- STATE attribute used as room param doesn't always match a real room (falls back to CA)

## Campaign Log

| ID | Campaign | List | Delivered | Opens | Clicks | Unsubs | Date |
|----|----------|------|-----------|-------|--------|--------|------|
| 1 | AARDA AB - Audio Proof | Canada (13) | 46 | 14 (30%) | 12 (26%) | 0 | Jun 26 |
| 2 | Own Hotline - Vision | Own (14) | 26 | 5 (19%) | 1 (4%) | 0 | Jun 26 |
| 3 | IAR Iowa - The Question | Iowa (16) | 37 | 7 (19%) | 0 (0%) | 0 | Jun 26 |
| 4 | KATRA KY - The Math | Kentucky (15) | 22 | 4 (18%) | 0 (0%) | 0 | Jun 26 |
| 5 | FADRA Board FL - Competitor | FL Board (11) | 67 | 14 (21%) | 24 (36%) | 0 | Jun 26 |
| 6 | AARA AZ - The Story | Arizona (9) | 18 | 4 (22%) | 0 (0%) | 0 | Jun 27 |
| 7 | FADRA FL - Big Number | Florida (12) | 64 | 11 (17%) | 33 (52%) | 0 | Jun 27 |
| 8 | AARDA AB - Follow Up | Canada (13) | 46 | 11 (24%) | 1 (2%) | 0 | Jun 27 |
| 9 | FADRA Board FL - Follow Up | FL Board (11) | 67 | 15 (22%) | 21 (31%) | 0 | Jun 27 |
| 10 | AutoPartHotline TX - Audio Proof | TX (5) | 33 | 7 (21%) | 17 (52%) | 0 | Jun 27 |
| 11 | TARA TX - Quick Question | TX (10) | 42 | 15 (36%) | 17 (40%) | 0 | Jun 27 |
| 12 | AARDA AB - Big Number | Canada (13) | 45 | 15 (33%) | 11 (24%) | 1 | Jun 28 |
| 13 | Midwest OH - Big Number | Ohio (6) | 229+ | 62 (27%) | 107 (47%) | 0 | Jun 28-29 |

**Totals:** ~869 sent, ~737 delivered, ~1 signup, 1 unsubscribe

## Available Lists

| List | Contacts | Emails Sent | Status |
|------|----------|-------------|--------|
| AutoPartHotline TX (5) | 46 | 1 campaign | Could follow up |
| Midwest OH Batch 1 (6) | 585 | 1 campaign (329 remaining resumed Jun 29) | In progress |
| Midwest OH Batch 2 (7) | 386 | 0 campaigns | Fresh - next target |
| AARA AZ (9) | 29 | 1 campaign (0 clicks) | Try different template |
| TARA TX (10) | 54 | 1 campaign | Could follow up |
| FADRA Board FL (11) | 74 | 2 campaigns | Warm - could follow up |
| FADRA FL (12) | 66 | 1 campaign | Could follow up |
| AARDA AB - Canada (13) | 46 | 3 campaigns | Saturated - pause |
| Own Hotline (14) | 36 | 1 campaign | Low engagement |
| KATRA KY (15) | 25 | 1 campaign (0 clicks) | Try different template |
| IAR IA (16) | 41 | 1 campaign (0 clicks) | Try different template |

## Future Plan

### Immediate (this week)
1. **Jun 29 (today):** Resume Midwest OH Batch 1 remaining 329 emails (Big Number template)
2. **Jun 30:** Send Midwest OH Batch 2 (386 contacts) with Big Number template
3. **Jul 1:** Follow up on engaged TX lists (TARA + AutoPartHotline, ~96 contacts) with Audio Proof template

### Short Term (next 2 weeks)
4. Re-send to zero-click lists (AZ, KY, IA = ~95 contacts) using Big Number template instead of failed templates
5. Follow up FADRA FL + Board (130 contacts) with a new angle
6. Pause Canada list - 3 emails sent, first unsubscribe, list fatigue

### Template Strategy
- **First touch:** Always use yard_08_bignumber (proven best converter)
- **Follow up:** Use yard_03_audio (audio proof) as second touch
- **Don't use:** yard_06_story, yard_04_math, yard_02_vision (zero/low performance)

### Improvements Needed
- Add server-side visit tracking (don't rely on Clarity JS loading)
- Add UTM parameters to email links for better campaign attribution
- Consider Apollo.io for contact enrichment (free plan too limited at 900 credits/year)
- Consider Instantly.ai or Lemlist for bot-click filtering and email warmup ($30-39/mo)

### Conversion Funnel
```
Email sent (869) -> Delivered (737, 85%) -> Opened (~185, 25%) -> Clicked (~107 unique real) -> Visited site (~10 real) -> Signup (1)
```

**Conversion rate:** 0.14% (1 signup / 737 delivered)
**Target:** Get to 1% (7-8 signups per 737) by fixing the funnel drop-off between click and signup.
