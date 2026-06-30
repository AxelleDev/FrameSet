# FrameSet API

Base URL: `/api` (the frontend reads it from `VITE_API_URL`, default `/api`).

All responses are JSON. Unless stated otherwise, endpoints expect and return
`application/json`.

## Conventions

### Authentication
The session is carried by **HttpOnly cookies** set on login (`frameset_access_token`,
`frameset_refresh_token`); the browser sends them automatically with
`credentials: 'include'`. A `Bearer` token in the `Authorization` header is also
accepted on protected routes.

- Access token: short-lived (2h).
- Refresh token: longer-lived (7d), **rotated** on every `/auth/refresh` and
  revocable server-side. Tokens issued before a password change are rejected.

### CSRF
Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) use the **double-submit
cookie** pattern: send the value of the `frameset_csrf_token` cookie back in the
`x-csrf-token` header. Fetch a token first with `GET /api/auth/csrf-token`.
Safe methods (`GET`, `HEAD`, `OPTIONS`) are exempt.

### Errors
Failures return `{ "error": "<message>" }` (server errors also add a generic
`message`). Status codes used: `400` (validation), `401` (unauthenticated),
`403` (forbidden / invalid token / CSRF), `404` (not found), `409`/`429` (rate
limited), `500` (server), `503` (dependency unavailable).

### Limits
JSON body is capped at **10 kB**. Sensitive endpoints are **rate limited** per IP
(or per user), e.g. login/register 5/min, code verification 10 / 10 min, code
resend 3 / 10 min, project/norm creation 30/h.

---

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | – | Liveness + DB ping. `200` `{ status, db, uptime }`, `503` when the DB is unreachable. |

## Auth — `/api/auth`

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| `GET` | `/auth/csrf-token` | – | – | `{ csrfToken }` (also sets the CSRF cookie) |
| `POST` | `/auth/register` | – | `{ name, email, password }` | `{ success, id, name, email, avatarInitials, is_verified, passwordUpdatedAt }` |
| `POST` | `/auth/login` | – | `{ email, password }` | sets auth cookies, `{ success, ...user }` |
| `POST` | `/auth/verify` | – | `{ email, code }` | `{ success }` |
| `POST` | `/auth/resend-code` | – | `{ email }` | `{ success }` |
| `POST` | `/auth/forgot-password` | – | `{ email }` | `{ success }` (identical whether or not the email exists) |
| `POST` | `/auth/reset-password` | – | `{ email, code, newPassword }` | `{ success }` |
| `POST` | `/auth/refresh` | refresh cookie | – | rotates tokens, `{ success }` |
| `POST` | `/auth/logout` | – | – | revokes tokens, clears cookies, `{ success }` |

Password policy: min 8 chars, at least one lowercase, one uppercase and one digit.

## Users — `/api/users`

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| `GET` | `/users/count` | – | – | `{ count }` (public stat) |
| `GET` | `/users/profile` | ✓ | – | `{ id, name, email, avatarInitials, passwordUpdatedAt, pendingEmail }` |
| `PUT` | `/users` | ✓ | `{ name, email }` | `{ success, name, email, pendingEmail }` — an email change is staged as `pendingEmail` until confirmed |
| `POST` | `/users/password` | ✓ | `{ currentPassword, newPassword }` | `{ success, passwordUpdatedAt }` (re-issues the session) |
| `POST` | `/users/email/verify` | ✓ | `{ email, code }` | `{ success, user }` |
| `POST` | `/users/email/resend` | ✓ | `{ email }` | `{ success }` |
| `DELETE` | `/users/me` | ✓ | – | `{ success }` (cascades to the user's projects) |

## Projects — `/api/projects`

All routes require authentication and enforce **ownership** (a user can only read
or mutate their own projects).

| Method | Path | Body | Success |
|---|---|---|---|
| `GET` | `/projects` | – | array of `{ id, name, lastEdited, brushNorms[], typographyNorms[], normsCount, palette[] }` |
| `POST` | `/projects` | `{ name }` (2–50 chars) | the created project |
| `PATCH` | `/projects/:id` | `{ name }` | `{ success, name }` |
| `DELETE` | `/projects/:id` | – | `{ success }` |
| `POST` | `/projects/:id/brush-norms` | `{ name, value, unit?, brushName?, opacity? }` | `{ success, id }` |
| `PUT` | `/projects/:projectId/brush-norms/:normId` | same as create | `{ success }` |
| `DELETE` | `/projects/:projectId/brush-norms/:normId` | – | `{ success }` |
| `POST` | `/projects/:id/typography-norms` | `{ fontFamily, fontWeight?, fontUsage?, fontStyle? }` | `{ success, id }` |
| `PUT` | `/projects/:projectId/typography-norms/:normId` | same as create | `{ success }` |
| `DELETE` | `/projects/:projectId/typography-norms/:normId` | – | `{ success }` |
| `POST` | `/projects/:id/palette` | array of `{ id?, name?, hex }` (≤ 50, `hex` = `#RGB`/`#RRGGBB`) | `{ success, palette }` — atomically replaces the palette, order preserved |

Field notes: brush `value` is a positive number (≤ 1000), `unit` letters/`%`
only, `opacity` in `0..1`. Text fields are trimmed and length-bounded.
