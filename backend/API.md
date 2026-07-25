# FrameSet API

Base URL: `/api` (the frontend reads it from `VITE_API_URL`, default `/api`).

All responses are JSON. Unless stated otherwise, endpoints expect and return
`application/json`.

**Interactive docs:** an OpenAPI 3.0 spec is served at `GET /api-docs.json` and
browsable via Swagger UI at [`/api-docs`](/api-docs). This document is the
human-readable summary; the spec is the machine-readable source of truth.

## Conventions

### Authentication

The session is carried by **HttpOnly cookies** set on login (`frameset_access_token`,
`frameset_refresh_token`); the browser sends them automatically with
`credentials: 'include'`. A `Bearer` token in the `Authorization` header is also
accepted on protected routes.

- Access token: short-lived (2h).
- Refresh token: longer-lived (7d), **rotated** on every `/auth/refresh` and
  revocable server-side. Tokens issued before a password change are rejected.
  Its cookie is scoped to `path=/api/auth`, so the browser only attaches it to
  the auth endpoints that actually need it (`/auth/refresh`, `/auth/logout`) —
  never to the rest of the API.

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
resend 3 / 10 min, project/norm creation (and duplication) 30/h, public share
views 60/min. A `429` response includes a `Retry-After` header (seconds).

### Demo account

`POST /auth/demo-login` opens a session on a single shared, read-only account
(no credentials needed). For that account, **every mutating request
(`POST`/`PUT`/`PATCH`/`DELETE`) on any endpoint is rejected with `403`** before
it reaches a service or the database — enforced centrally in
`authenticateToken`, so it can't be bypassed per-route. The frontend simulates
those mutations client-side instead, so the demo still feels fully
interactive; nothing it does ever persists.

---

## Health

| Method | Path      | Auth | Description                                                                           |
| ------ | --------- | ---- | ------------------------------------------------------------------------------------- |
| `GET`  | `/health` | –    | Liveness + DB ping. `200` `{ status, db, uptime }`, `503` when the DB is unreachable. |

## Auth — `/api/auth`

| Method | Path                    | Auth           | Body                               | Success                                                                                                                                                                              |
| ------ | ----------------------- | -------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/auth/csrf-token`      | –              | –                                  | `{ csrfToken }` (also sets the CSRF cookie)                                                                                                                                          |
| `POST` | `/auth/register`        | –              | `{ name, email, password }`        | `{ success, id, name, email, avatarInitials, is_verified, passwordUpdatedAt }`                                                                                                       |
| `POST` | `/auth/login`           | –              | `{ email, password }`              | sets auth cookies, `{ success, ...user }`                                                                                                                                            |
| `POST` | `/auth/demo-login`      | –              | –                                  | sets auth cookies for the shared read-only demo account, `{ success, ...user }` (`isDemo: true`); `503` if no demo account is seeded                                                 |
| `POST` | `/auth/google`          | –              | `{ credential }` (Google ID token) | sets auth cookies, `{ success, ...user }` — signs in, links to an existing email/password account, or creates a new (passwordless) account; `503` if Google sign-in isn't configured |
| `POST` | `/auth/verify`          | –              | `{ email, code }`                  | `{ success }`                                                                                                                                                                        |
| `POST` | `/auth/resend-code`     | –              | `{ email }`                        | `{ success }`                                                                                                                                                                        |
| `POST` | `/auth/forgot-password` | –              | `{ email }`                        | `{ success }` (identical whether or not the email exists)                                                                                                                            |
| `POST` | `/auth/reset-password`  | –              | `{ email, code, newPassword }`     | `{ success }`                                                                                                                                                                        |
| `POST` | `/auth/refresh`         | refresh cookie | –                                  | rotates tokens, `{ success }`                                                                                                                                                        |
| `POST` | `/auth/logout`          | –              | –                                  | revokes tokens, clears cookies, `{ success }`                                                                                                                                        |

Password policy: min 8 chars, at least one lowercase, one uppercase and one digit.

## Users — `/api/users`

| Method   | Path                  | Auth | Body                               | Success                                                                                                |
| -------- | --------------------- | ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`    | `/users/count`        | –    | –                                  | `{ count }` (public stat)                                                                              |
| `GET`    | `/users/profile`      | ✓    | –                                  | `{ id, name, email, avatarInitials, passwordUpdatedAt, pendingEmail, isDemo }`                         |
| `PUT`    | `/users`              | ✓    | `{ name, email }`                  | `{ success, name, email, pendingEmail }` — an email change is staged as `pendingEmail` until confirmed |
| `POST`   | `/users/password`     | ✓    | `{ currentPassword, newPassword }` | `{ success, passwordUpdatedAt }` (re-issues the session)                                               |
| `POST`   | `/users/email/verify` | ✓    | `{ email, code }`                  | `{ success, user }`                                                                                    |
| `POST`   | `/users/email/resend` | ✓    | `{ email }`                        | `{ success }`                                                                                          |
| `DELETE` | `/users/me`           | ✓    | –                                  | `{ success }` (cascades to the user's projects)                                                        |

## Projects — `/api/projects`

All routes require authentication and enforce **ownership** (a user can only read
or mutate their own projects).

### Core

| Method   | Path                                | Body                    | Success                                                                                                                                                                                                                                                                                                                                |
| -------- | ----------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/projects?page=&pageSize=&search=` | –                       | `{ projects: [{ id, name, lastEdited, pinned, shareToken, brushNorms[], typographyNorms[], normsCount, palette[] }], pagination: { page, pageSize, total, totalPages } }` — paginated (`pageSize` defaults to 12, capped at 50); pinned projects sort first, then newest-edited; `search` filters by name (case-insensitive substring) |
| `GET`    | `/projects/search?q=`               | –                       | `{ projects[], colors[], brushNorms[], typographyNorms[] }` — global search (the app's Ctrl+K): one term (1–100 chars, `LIKE` wildcards escaped) matched against project names, colour names/hex (`#` optional) and standards, capped at 5 matches per category; only the caller's live (non-trashed) content is searched              |
| `POST`   | `/projects`                         | `{ name }` (2–50 chars) | the created project                                                                                                                                                                                                                                                                                                                    |
| `POST`   | `/projects/:id/duplicate`           | –                       | the new project — copies the palette and standards (order preserved), named `"<name> (copy)"`; shares the project-creation rate limit                                                                                                                                                                                                  |
| `PATCH`  | `/projects/:id`                     | `{ name }`              | `{ success, name }`                                                                                                                                                                                                                                                                                                                    |
| `DELETE` | `/projects/:id`                     | –                       | `{ success }` — soft delete, moves the project to the trash                                                                                                                                                                                                                                                                            |

### Trash (30-day soft delete)

Applies uniformly to projects, palette colors, and brush/typography standards:
delete moves an item to the trash, where it's restorable for **30 days**
before a scheduled purge deletes it permanently. Each resource has the same
three-endpoint shape (`GET .../trash`, `POST .../:childId/restore`,
`DELETE .../:childId/permanent`).

| Method   | Path                                                      | Success                                                     |
| -------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/projects/trash`                                         | `{ projects: [{ id, name, deletedAt, daysLeft }] }`         |
| `POST`   | `/projects/:id/restore`                                   | the restored project                                        |
| `DELETE` | `/projects/:id/permanent`                                 | `{ success }` — irreversible                                |
| `GET`    | `/projects/:id/palette/trash`                             | `{ colors: [{ id, name, hex, deletedAt, daysLeft }] }`      |
| `POST`   | `/projects/:id/palette/:colorId/restore`                  | `{ success }`                                               |
| `DELETE` | `/projects/:id/palette/:colorId/permanent`                | `{ success }` — irreversible                                |
| `GET`    | `/projects/:projectId/brush-norms/trash`                  | `{ norms: [{ id, name, ..., deletedAt, daysLeft }] }`       |
| `POST`   | `/projects/:projectId/brush-norms/:normId/restore`        | `{ success }`                                               |
| `DELETE` | `/projects/:projectId/brush-norms/:normId/permanent`      | `{ success }` — irreversible                                |
| `GET`    | `/projects/:projectId/typography-norms/trash`             | `{ norms: [{ id, fontFamily, ..., deletedAt, daysLeft }] }` |
| `POST`   | `/projects/:projectId/typography-norms/:normId/restore`   | `{ success }`                                               |
| `DELETE` | `/projects/:projectId/typography-norms/:normId/permanent` | `{ success }` — irreversible                                |

### Pinning

Pinned projects sort before unpinned ones on `GET /projects`.

| Method   | Path                       | Body                        | Success                                                                         |
| -------- | -------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `POST`   | `/projects/:id/pin`        | –                           | `{ success }` — idempotent, appended after the user's other pinned projects     |
| `DELETE` | `/projects/:id/pin`        | –                           | `{ success }`                                                                   |
| `POST`   | `/projects/pinned/reorder` | array of pinned project ids | `{ success }` — reorders the user's pinned projects to match the given sequence |

### Sharing

| Method   | Path                  | Auth | Success                                                                                                                                                                                                    |
| -------- | --------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/projects/:id/share` | ✓    | `{ shareToken }` — mints (or returns the existing) public share token                                                                                                                                      |
| `DELETE` | `/projects/:id/share` | ✓    | `{ success }` — revokes the link immediately                                                                                                                                                               |
| `GET`    | `/share/:token`       | –    | the read-only reference sheet: `{ name, brushNorms[], typographyNorms[], palette[], ownerName }` — public, rate limited per IP (60/min); `404` if the token is invalid, revoked, or the project is trashed |

`ownerName` is the owner's display name only — never their id or email — shown
as a "Made by …" credit on the public page and in the exported PDF.

### Standards (brush & typography norms)

| Method   | Path                                            | Body                                                  | Success                                                                                     |
| -------- | ----------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `POST`   | `/projects/:id/brush-norms`                     | `{ name, value, unit?, brushName?, opacity? }`        | `{ success, id }`                                                                           |
| `PUT`    | `/projects/:projectId/brush-norms/:normId`      | same as create                                        | `{ success }`                                                                               |
| `DELETE` | `/projects/:projectId/brush-norms/:normId`      | –                                                     | `{ success }` — soft delete                                                                 |
| `POST`   | `/projects/:id/brush-norms/reorder`             | array of brush-norm ids                               | `{ success }` — reorders to match the given sequence; unrecognized ids are silently skipped |
| `POST`   | `/projects/:id/typography-norms`                | `{ fontFamily, fontWeight?, fontUsage?, fontStyle? }` | `{ success, id }`                                                                           |
| `PUT`    | `/projects/:projectId/typography-norms/:normId` | same as create                                        | `{ success }`                                                                               |
| `DELETE` | `/projects/:projectId/typography-norms/:normId` | –                                                     | `{ success }` — soft delete                                                                 |
| `POST`   | `/projects/:id/typography-norms/reorder`        | array of typography-norm ids                          | `{ success }` — same contract as the brush-norm reorder                                     |

Field notes: brush `value` is a positive number (≤ 1000), `unit` letters/`%`
only, `opacity` in `0..1`. Text fields are trimmed and length-bounded.

### Palette

| Method   | Path                             | Body                                                            | Success                                                                                                           |
| -------- | -------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/projects/:id/palette`          | array of `{ id?, name?, hex }` (≤ 50, `hex` = `#RGB`/`#RRGGBB`) | `{ success, palette }` — atomically replaces the whole palette, order preserved; used for add/edit/delete/reorder |
| `DELETE` | `/projects/:id/palette/:colorId` | –                                                               | `{ success }` — soft delete of a single color (independent of the bulk replace above)                             |

## Fonts — `/api/fonts`

| Method | Path     | Auth | Success                                                                                                                                      |
| ------ | -------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/fonts` | ✓    | `{ items: [{ family, variants[] }] }` — Google Fonts catalog, proxied server-side and cached so the API key never ships in the client bundle |
