# Referral System Spec

## Overview

Track which accounts referred which new signups. Referrers accumulate a count; admin manually reviews legitimacy and applies discounts when billing goes live. Users see a banner encouraging referrals and can copy their unique referral link.

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Attribution trigger | Manual admin review | No automated billing; admin checks legitimacy |
| Reward structure | Track count only, no formula | Discount decided manually per-account; billing doesn't exist yet |
| Banner placement | Persistent on Conference dashboard | Drive awareness where users spend the most time |
| Referral details | Account Settings page | Referral code, copy link, referral count |
| Signup capture | Auto-fill from URL `?ref=CODE` + manual entry field | Cover both link-click and verbal sharing |
| Admin UI | Columns on existing Accounts table | Minimal UI change; "Referral Code", "Referred By", count |
| Code format | Random 6-char alphanumeric | Auto-generated, unique, not guessable |
| Sharing mechanism | Copy link button only | QR and email can be added later |
| Existing accounts | Backfill referral codes for all | So existing users can immediately start referring |
| Referred user benefit | None (one-sided) | Service is free; nothing to discount for new users |
| Banner copy | "Refer a yard, get 10% off" | Commit to specific messaging to drive action |

## Data Model

### Schema Changes (`accounts` table)

```sql
ALTER TABLE accounts ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE accounts ADD COLUMN referred_by INTEGER REFERENCES accounts(id);
```

Referral count is derived: `SELECT COUNT(*) FROM accounts WHERE referred_by = ?`

### Migration

- Check-and-add columns (existing pattern in `dbService.js`)
- Backfill: generate 6-char alphanumeric codes for all existing accounts where `referral_code IS NULL`

## API Changes

### Client API

- `GET /api/v1/client/referral` — returns `{ referral_code, referral_link, referral_count }`
- `POST /api/v1/client/signup` — accept optional `referral_code` param, resolve to `referred_by` account ID

### Admin API

- `GET /api/v1/admin/accounts` — add `referral_code`, `referred_by`, `referral_count` to response

## Frontend Changes

### Client App (`client/`)

1. **Conference page banner**: dismissible banner — "Refer a yard, get 10% off your future bill! Share your link in Settings."
2. **Account Settings page**: new "Referrals" section with referral code display, copy-link button, referral count
3. **Signup page**: optional "Referral Code" field, auto-filled from `?ref=` URL param

### Admin App (`src/`)

1. **Users/Accounts table**: add "Referral Code" and "Referred By" columns

## Implementation Order

1. DB schema migration + backfill
2. Backend: referral code generation on account creation
3. Backend: signup flow accepts referral_code
4. Backend: client referral endpoint
5. Backend: admin accounts response includes referral data
6. Frontend client: signup page referral field
7. Frontend client: account settings referral section
8. Frontend client: dashboard banner
9. Frontend admin: accounts table columns
