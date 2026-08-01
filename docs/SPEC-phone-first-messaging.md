# SPEC: Phone-First Messaging & Copper Migration Landing Page

**Date**: 2026-08-01
**Status**: Draft
**Author**: Interview with product owner

---

## Problem Statement

Customers believe Hotline HQ is a web-based hotline service. It is not. It is a **physical Yealink IP desk phone system** with a web SIP client as secondary fallback. A real copper-hotline customer rejected HQ because they thought it was browser-only — not realizing HQ delivers the exact same UX as their copper line: a dedicated phone on the counter, always on, pick up and you're on the line.

### Root Causes (from codebase analysis)

1. The homepage hero says "voice network" without ever naming or showing a physical phone
2. The most interactive element on the homepage (Listen Live audio player) is a browser experience
3. Primary CTAs ("Sign Up Free", "Login") lead to web flows
4. The desk phone page (`/features/desk-phone`) is **not in main nav or footer** — completely buried
5. Zero phone images or illustrations on the landing page
6. "Desk phone" first appears in the 5th section, presented as one of two equal options
7. The signup flow is entirely web-based, reinforcing the "software product" perception
8. No migration/upgrade messaging exists anywhere for copper-era customers

---

## Goals

1. Make it impossible for a visitor to think HQ is a web-only product
2. Create a dedicated landing page for copper hotline groups considering migration
3. Add "The Phone" to main navigation so the hardware is always one click away
4. Update all public-facing pages to lead with phone-first messaging
5. Attract and convert copper hotline clusters (25+ yard groups) — a key untapped growth segment

## Non-Goals

- Changing the actual product (SIP client, conference system, etc.)
- Hiding or removing the web client — it remains featured as the secondary/mobile option
- Building a self-serve group migration flow (this is high-touch, personal call within 24-48h)
- Redesigning the admin dashboard or client dashboard

---

## Target Personas

### Persona A: Individual Yard (existing target)
- Never had a hotline before
- Finds parts via databases, Facebook, calling around
- Joins an existing HQ room with 20+ members
- Signs up individually, gets a phone shipped

### Persona B: Copper Upgrader (key growth segment)
- Already knows what a hotline is — had a copper wire hotline
- Their copper hotline experience: **dedicated phone on the wall, always on, pick up and you're on the line with everyone**
- HQ delivers the exact same UX with modern tech
- **Cannot upgrade individually** — their group of 25+ yards needs to switch together
- Pain points: copper lines dying/expensive, limited to one local region, no recordings or accountability
- Decision-maker could be the hotline operator OR an influential yard in the group

---

## Phone vs Web Positioning

| Aspect | Desk Phone (Primary) | Web Client (Secondary) |
|--------|---------------------|----------------------|
| Label | "The counter line" | "The mobile line" |
| Framing | What we ship you. The way 90% of yards use it. | Take the hotline with you. |
| Use case | Always-on at the shop counter | Road trips, auctions, second locations |
| Prominence | Featured, hero-level, nav link | Mentioned but clearly #2 |
| Never say | "Phone or computer" (implies equal) | "Web-based hotline" (implies primary) |

---

## Changes Required

### 1. Homepage Hero Update (`Landing2Page.jsx`)

**Current hero**: "Every 'we don't have it' is a customer walking out. It doesn't have to be."
- Abstract "voice network" language. No physical phone. No hardware.

**New hero direction**: "This isn't an app. It's a phone on your counter."
- Sub: Hotline HQ is a dedicated desk phone that connects your yard to 500+ recyclers. No browser. No login. Just pick up the handset.
- Attack the web misconception head-on in the first words a visitor reads
- Include a **stylized illustration** of the Yealink T31P desk phone (use `blog-image` skill to generate)

### 2. New "Already on a Hotline?" Section on Homepage

Add a new section on the main landing page between the existing sections:

```
"Already on a hotline?"

If your group is on a copper line, a radio network, or any legacy
hotline — bring them to HQ.

Same group. Better line.

[Bring Your Group →] → links to /replace-copper-hotline
```

### 3. Navigation Updates

**Add to main nav**: "The Phone" → links to `/features/desk-phone`

```
Nav: Find Parts | Sell Parts | The Phone | Own a Hotline | Blog | Login | Sign Up Free
```

**Add to footer** (Product column): "Replace Your Copper Hotline" → links to `/replace-copper-hotline`

### 4. New Page: `/replace-copper-hotline`

**Purpose**: Convert copper hotline clusters (25+ yard groups) to HQ.

**Target**: Hotline operators OR influential yard owners who can bring their group.

#### Page Structure

**Hero**:
- Headline direction: Frame the switch as bringing the same hotline experience with better technology
- Sub: Acknowledge what they already have (dedicated phone, always on, the group) and show what HQ adds
- CTA: "Bring Your Group to HQ" (primary) + "Sign Up Free" (secondary, for individual exploration)

**"Same experience, better line" Section**:
- Acknowledge the copper hotline UX: dedicated phone on the wall, always on, pick up and everyone hears you
- Show that HQ delivers the exact same thing: a dedicated Yealink desk phone on the counter, always on, pick up and you're on the line
- One-to-one mapping of the experience

**Comparison Table** (Copper vs Hotline HQ):

| Dimension | Copper Hotline | Hotline HQ |
|-----------|---------------|------------|
| Reach | Local only | 12 regional rooms |
| Voice quality | Analog | HD digital |
| Recordings | None | Every call recorded |
| Cost per yard | Rising (telco sunset) | Flat monthly |
| Reliability | Declining infrastructure | 99.9% uptime |
| Scalability | Fixed capacity | Add yards anytime |
| Cross-room | Not possible | Yes |

**Three Pain Points Section**:
1. **Copper lines are dying** — Telcos sunsetting POTS, prices rising, reliability declining
2. **Limited reach** — Copper covers one local area. HQ connects 12 regions. Cross-room broadcasting.
3. **No accountability** — No recordings, no tracking, no data. HQ records every call, shows who's answering.

**"Bring Your Group" CTA + Form**:
- Headline: "Bring Your Group to HQ"
- Sub: "Your hotline group already works. We just give it better tools. Tell us about your group and we'll show you what switching looks like."
- Form fields: Name, yard name, phone/email, how many yards on your line, what state/region
- Follow-up: Personal call within 24-48h

**FAQ Section**:
- "Do all yards need to switch at once?"
- "What happens to our copper line?"
- "Is this a phone or a computer thing?" → Explicitly: "It's a phone. A Yealink T31P desk phone ships to each yard. Plug in one ethernet cable and you're live."
- "Can we try it before the whole group switches?"
- "What does each yard get?"

### 5. All SEO/Feature Pages — Phone-First Messaging

Update these pages to lead with the physical phone, not abstract "voice network" language:

- `/find-used-auto-parts` (FindPartsPage)
- `/sell-used-auto-parts` (SellPartsPage)
- `/how-auto-parts-hotlines-work` (HowItWorksPage)
- `/used-auto-parts-hotline` (AutoPartsHotlinePage)
- `/car-part-alternative` (CarPartAlternativePage)
- `/hard-to-find-auto-parts` (HardToFindPartsPage)
- `/salvage-yard-marketing` (SalvageYardMarketingPage)
- `/ev-hybrid-auto-parts` (EvHybridPartsPage)
- Industry pages: heavy equipment, farm equipment, aviation, mining, marine, railroad
- Regional pages (`/used-auto-parts/california`, etc.)
- `/own-a-hotline` (OwnHotlinePage)
- `/classic` (LandingPage)

**Pattern for each page**: Where the page currently says "voice network" or "connect through the network," add a concrete hardware reference. Where FAQ answers already mention the desk phone, ensure the hero/headline also reflects it.

### 6. Visual Strategy

- **Approach**: Stylized illustrations (not product photos) of the Yealink T31P
- **Generate using**: `blog-image` skill
- **Where needed**:
  - Homepage hero (phone on a counter illustration)
  - `/replace-copper-hotline` hero (copper phone → digital phone transition illustration)
  - `/features/desk-phone` (may keep existing photo or add illustration)
- **Style**: Clean, modern, matches existing site aesthetic (dark theme, minimal)

---

## Decisions Log

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | Hero approach | "It's not an app, it's a phone" — attack misconception head-on | User chose this over softer "same hotline, modern phone" or "keep current hero" approaches |
| 2 | Copper upgrader priority | Key growth unlock — they already understand the value | 50/50 split with hotline-new yards, but copper upgraders are untapped |
| 3 | Copper UX baseline | Dedicated phone on the wall, always on | Identical to HQ's Yealink experience — the 1:1 mapping is the core selling point |
| 4 | Phone vs Web | Phone primary ("counter line"), web secondary ("mobile line") | Web client featured but clearly #2, not equal |
| 5 | Copper page CTA | "Bring Your Group to HQ" + form → personal call in 24-48h | Group migration is high-touch, not self-serve. "Sign Up Free" doesn't fit a 25-yard decision. |
| 6 | Group migration | First-time use case — hasn't been done yet | Page is also a discovery tool to attract first copper cluster and design the process |
| 7 | Copper page URL | `/replace-copper-hotline` | Best SEO match for search intent ("replace copper hotline") |
| 8 | Comparison style | Direct side-by-side Copper vs HQ table | User preferred direct comparison over soft "what you loved + what's new" framing |
| 9 | Visual approach | Illustrations, not photos | Maintains clean modern aesthetic while grounding visitors in physical hardware |
| 10 | Nav changes | "The Phone" in main nav, copper page in footer | Phone page needs max visibility; copper page is targeted audience via campaigns |
| 11 | Main page copper section | Add "Already on a hotline?" section | Catches copper upgraders who land on homepage, funnels to `/replace-copper-hotline` |
| 12 | Page update scope | All public pages get phone-first messaging | Consistent messaging across the entire site, not just homepage |

---

## Implementation Order

### Phase 1: Core Messaging Fix (highest impact)
1. Update homepage hero to phone-first messaging
2. Add phone illustration to homepage hero (generate via `blog-image`)
3. Add "The Phone" to main navigation
4. Add "Already on a hotline?" section to homepage

### Phase 2: Copper Migration Page
5. Create `/replace-copper-hotline` page with full structure
6. Generate copper→digital transition illustration (via `blog-image`)
7. Add copper page link to footer
8. Add route to `client/src/App.jsx`

### Phase 3: Site-Wide Consistency
9. Update all SEO/feature page heroes and key sections
10. Update industry pages
11. Update regional pages
12. Update `/own-a-hotline` and `/classic`

### Dependencies
- Phase 1 can start immediately
- Phase 2 depends on illustration generation but page structure can be built in parallel
- Phase 3 depends on Phase 1 (establishing the messaging pattern to apply everywhere)
- All phases: `blog-image` skill needed for illustration generation
- All phases: Frontend-only changes (`cd client && npm run build` to deploy)
