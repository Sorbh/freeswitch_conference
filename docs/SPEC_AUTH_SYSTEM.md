# Authentication & Authorization System — Specification

## Overview

Add login authentication and role-based access control (RBAC) to the FreeSWITCH conference admin dashboard. Currently all 70+ API endpoints and 6 SSE streams are publicly accessible with no auth.

### Goals
- Protect all dashboard API endpoints with JWT authentication
- Implement three roles: Admin, Editor, Analytics
- Protect SIP-action endpoints with per-integration API keys
- Lock FreeSWITCH XML directory to localhost only
- Add login UI with redirect flow
- Remove raw SQL debug endpoint

### Non-Goals
- Hashing existing SIP account passwords (separate concern)
- Self-registration or public signup
- 2FA/MFA (future enhancement)
- OAuth/SSO integration

---

## Data Model

### New Table: `admins`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| email | TEXT | UNIQUE NOT NULL | Login identifier |
| password_hash | TEXT | NOT NULL | bcrypt hash |
| name | TEXT | NOT NULL | Display name |
| role | TEXT | NOT NULL DEFAULT 'analytics' | 'admin', 'editor', 'analytics' |
| active | INTEGER | NOT NULL DEFAULT 1 | 0 = disabled |
| locked_until | TEXT | NULL | ISO timestamp, set on brute-force lockout |
| failed_attempts | INTEGER | NOT NULL DEFAULT 0 | Reset on successful login |
| created_by | INTEGER | NULL | FK → admins.id (NULL for seed admin) |
| created_at | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

### New Table: `refresh_tokens`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| admin_id | INTEGER | NOT NULL | FK → admins.id |
| token_hash | TEXT | UNIQUE NOT NULL | SHA-256 of refresh token |
| expires_at | TEXT | NOT NULL | 7 days from creation |
| created_at | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

### New Table: `api_keys`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| label | TEXT | NOT NULL | e.g., 'yealink-phones', 'monitoring' |
| key_hash | TEXT | UNIQUE NOT NULL | SHA-256 of API key |
| key_prefix | TEXT | NOT NULL | First 8 chars for identification |
| active | INTEGER | NOT NULL DEFAULT 1 | 0 = revoked |
| created_by | INTEGER | NOT NULL | FK → admins.id |
| created_at | TEXT | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

---

## Role Permissions Matrix

| Feature Area | Admin | Editor | Analytics |
|--------------|-------|--------|-----------|
| Dashboard / stats (read) | YES | YES | YES |
| Broadcasts / events (read) | YES | YES | YES |
| SSE streams (all) | YES | YES | YES |
| User actions (mute/kick/reconnect) | YES | YES | NO |
| Room management (CRUD) | YES | YES | NO |
| Notifications (Telegram/WhatsApp) | YES | YES | NO |
| Announcements (audio ads) | YES | YES | NO |
| Account CRUD (SIP accounts) | YES | NO | NO |
| YMCS device control | YES | NO | NO |
| System / debug endpoints | YES | NO | NO |
| API key management | YES | NO | NO |
| Admin user management | YES | NO | NO |

---

## Authentication Flows

### 1. Dashboard Login (JWT)

**Endpoint:** `POST /api/v1/auth/login`

```
Request:  { email, password }
Response: { accessToken, user: { id, email, name, role } }
+ Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800
+ Set-Cookie: sse_token=<sse_jwt>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/admin/events; Max-Age=900
```

- Validate email exists in `admins` table
- Check `active = 1` and `locked_until` not in future
- Compare password with bcrypt hash
- On success: reset `failed_attempts`, generate access token (15min) + refresh token (7 days) + SSE cookie
- On failure: increment `failed_attempts`, set `locked_until` after 5 failures (15min lockout)
- Log attempt to `event_log`

### 2. Token Refresh

**Endpoint:** `POST /api/v1/auth/refresh`

```
Request:  Cookie: refresh_token=<token>
Response: { accessToken }
+ Set-Cookie: sse_token=<new_sse_jwt>; ...
```

- Validate refresh token exists in DB and not expired
- Issue new access token + rotate SSE cookie
- Refresh token itself stays the same until logout/expiry

### 3. Logout

**Endpoint:** `POST /api/v1/auth/logout`

- Delete refresh token from DB
- Clear cookies (refresh_token + sse_token)

### 4. Token Structure

**Access Token (JWT):**
```json
{
  "sub": 1,
  "email": "admin@example.com",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**SSE Cookie:** Same JWT payload, separate token, 15min expiry. Validated by SSE endpoints via cookie instead of Authorization header.

### 5. SIP-Action API Keys

**Header:** `X-API-Key: <key>`  
**Fallback:** `?api_key=<key>` query param (for devices that can't set headers)

- Key is a random 32-byte hex string, shown once on creation
- Stored as SHA-256 hash in `api_keys` table
- Validated by middleware on `/api/v1/action/*` routes

### 6. FreeSWITCH XML Directory

- Middleware checks `req.ip` is `127.0.0.1` or `::1`
- Reject all other IPs with 403

---

## Rate Limiting

**Login endpoint only:**
- 5 requests per 15 minutes per IP (using in-memory map, reset on server restart)
- After 5 failed attempts for the same email: lock account for 15 minutes
- All failed attempts logged to `event_log` with IP and email

---

## API Changes

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/auth/login | None | Login |
| POST | /api/v1/auth/refresh | Cookie | Refresh access token |
| POST | /api/v1/auth/logout | JWT | Logout (revoke refresh token) |
| GET | /api/v1/auth/me | JWT | Get current user info |
| GET | /api/v1/admin/auth/admins | JWT (admin) | List admin users |
| POST | /api/v1/admin/auth/admins | JWT (admin) | Create admin user |
| PUT | /api/v1/admin/auth/admins/:id | JWT (admin) | Update admin user |
| DELETE | /api/v1/admin/auth/admins/:id | JWT (admin) | Delete admin user |
| GET | /api/v1/admin/auth/api-keys | JWT (admin) | List API keys |
| POST | /api/v1/admin/auth/api-keys | JWT (admin) | Create API key |
| DELETE | /api/v1/admin/auth/api-keys/:id | JWT (admin) | Revoke API key |

### Removed Endpoints

| Method | Path | Reason |
|--------|------|--------|
| GET | /api/v1/debug/tables | Security risk, unused |
| GET | /api/v1/debug/table/:name | Security risk, unused |
| GET | /api/v1/debug/query | Raw SQL execution, critical vulnerability |
| GET | /api/v1/debug/conferences | Can use fs_cli instead |

### Modified Endpoints

All existing `/api/v1/admin/*` endpoints: add JWT middleware  
All existing `/api/v1/action/*` endpoints: add API key middleware  
`POST /api/v1/freeswitch/directory`: add localhost IP check

---

## Frontend Changes

### New Components
- `/login` page — email + password form, error display, redirect after auth
- `AuthProvider` context — stores user/token, provides login/logout/refresh
- `ProtectedRoute` wrapper — redirects to /login if not authenticated
- Role-based nav filtering — hide menu items based on user role

### Auth Token Management
- Access token stored in memory (React state, not localStorage)
- Refresh token in httpOnly cookie (auto-sent)
- SSE token in httpOnly cookie (auto-sent to /events/* paths)
- On 401 response: attempt silent refresh, redirect to /login if refresh fails
- `useFetch` hook updated to include Authorization header

### Nav Visibility by Role

| Nav Item | Admin | Editor | Analytics |
|----------|-------|--------|-----------|
| Dashboard | YES | YES | YES |
| Users | YES | YES | NO |
| Rooms | YES | YES | NO |
| Broadcasts | YES | YES | YES |
| Events | YES | YES | YES |
| Notifications | YES | YES | NO |
| Announcements | YES | YES | NO |
| System | YES | NO | NO |
| YMCS Control | YES | NO | NO |
| FS Logs | YES | NO | NO |
| Phone Logs | YES | NO | NO |
| Admin Users | YES | NO | NO |
| API Keys | YES | NO | NO |

---

## Bootstrap / Seed

On first run (no admins in table), create seed admin from environment variables:

```
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=<strong-password>
SEED_ADMIN_NAME=Admin
```

If env vars not set, prompt in console log with a generated password.

---

## Implementation Order

1. **Database schema** — Add admins, refresh_tokens, api_keys tables to dbService.js
2. **Auth middleware** — JWT verify, role check, API key verify, IP check
3. **Auth routes** — login, refresh, logout, me
4. **Admin management routes** — CRUD for admins and API keys
5. **Apply middleware** — Protect existing routes, remove debug routes
6. **Seed admin** — Bootstrap on first run
7. **Frontend AuthProvider** — Context, token management, refresh logic
8. **Login page** — UI with form, validation, error handling
9. **Protected routes** — Wrap dashboard routes, role-based nav
10. **Update useFetch/useSSE** — Add auth headers/cookie handling

---

## Security Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Separate admins table from accounts | Yes | SIP accounts have different lifecycle, plaintext passwords for digest auth |
| httpOnly cookie for SSE | Yes | EventSource doesn't support Authorization header |
| Remove debug SQL endpoint | Yes | Critical vulnerability, unused by frontend |
| Per-integration API keys | Yes | Better auditability than shared key |
| 15-min access token | Yes | Short enough to limit damage, long enough to avoid constant refresh |
| 7-day refresh token | Yes | Reasonable for internal tool, stored hashed in DB |
| Account lockout after 5 failures | Yes | With 15-min cooldown to prevent DoS-via-lockout |
| No accounts table migration | Yes | Separate concern, avoids breaking SIP auth flow |
