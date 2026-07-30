# Clarity Analysis — 2026-07-29

_Microsoft Clarity data from Jul 15-29, 2026. 163 sessions, 41 unique visitors._

## Key Metrics

- Homepage bounce rate: **85%** (22s active time, 67% scroll depth)
- Dashboard dead clicks: **167** (out of 200 total)
- Traffic: 70% internal (dashboard users), 15 from Brevo emails, 1 from Google
- Mobile: 5.5% of sessions (9 total), 58s active time

## Issues Found & Fixed (all shipped 2026-07-29)

| # | Issue | Fix | File |
|---|-------|-----|------|
| 1 | Referral banner not actionable — users rage-clicked 8-12 times | Added "Share Link" button (copies referral URL or triggers native share) | ConferencePage.jsx |
| 2 | No live proof on homepage | Added NetworkPulse component (live yard count, room count, today's broadcasts) | Landing2Page.jsx |
| 3 | No mid-funnel CTA | Added "Listen to a live call" link on feature pages + email contact in bottom CTAs | FeaturePages.jsx |
| 4 | Conference participant rows looked clickable | Set cursor:default, userSelect:text on CallerCard | ConferencePage.jsx |
| 5 | Dashboard LCP 13 seconds | Parallel chunk prefetch + DashboardSkeleton with shimmer | App.jsx, main.jsx |
| 6 | Dashboard CLS 1.3-1.5 | Stats bar always renders, gesture/mute sections use grid collapse | ConferencePage.jsx |
| 7 | Active nav link not highlighted | NavLink with l2-nav-active class (red + underline) | site.jsx, Landing2Page.jsx |

## Backend Changes

- New endpoint: `GET /api/v1/public/network-stats` — returns listeningNow, activeRooms, totalMembers, todayBroadcasts
- Used by NetworkPulse component on homepage hero (polls every 30s)

## What To Monitor Next

- Homepage bounce rate (target: < 70% within 2 weeks)
- Dashboard dead clicks (target: < 50, down from 167)
- Referral banner click-through rate (new metric — track via Clarity)
- Mobile active time (target: > 120s)
- LCP on dashboard initial load (target: < 3s)
