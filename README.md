
<div align="center">
	<picture>
		<source media="(prefers-color-scheme: dark)" srcset="frontend/public/FrameSet_Logo_Reversed.png">
		<img src="frontend/public/FrameSet_Logo.png" alt="FrameSet logo" width="120" />
	</picture>
	<p><b>FRAMESET — The graphic reference, built for digital illustration.</b></p>
	<p>
		<a href="https://github.com/AxelleDev/FrameSet/actions/workflows/ci.yml">
			<img src="https://github.com/AxelleDev/FrameSet/actions/workflows/ci.yml/badge.svg" alt="CI status" />
		</a>
	</p>
</div>

---

## ✧･ﾟ: ✧･ﾟ About the project

FrameSet is a full-stack web app for illustrators and digital creators. It lets you
**centralise, structure and export** the graphic references of an illustration project —
colour palettes, typographies and brush specs — so you keep a consistent visual identity
from one drawing to the next.

---

## ✧･ﾟ: ✧･ﾟ Features

- **Accounts & authentication** — sign up, log in (email/password or "Continue
  with Google"), e-mail verification and profile management (JWT, hashed
  passwords, CSRF protection & rate-limiting).
- **Projects** — a dashboard to create, duplicate and manage multiple illustration
  projects (duplication copies the standards and palette, to reuse a setup as a base).
  Deleted projects go to a trash and stay restorable for 30 days before being purged.
- **Palettes** — colour management with drag-and-drop reordering and quick code copy.
- **Specs** — typographies (with Google Fonts loading) and brushes (size, opacity,
  usage…).
- **Export & share** — generate a PDF of the project's complete reference sheet,
  or share a public read-only link (revocable anytime) that anyone can open
  without an account.

---

## ✧･ﾟ: ✧･ﾟ Tech stack

**Frontend** — React 18, Vite, React Router, Tailwind CSS, react-select, jsPDF
**Backend** — Node.js, Express, MySQL, JWT, bcrypt, Helmet, Nodemailer
**Quality** — Vitest (front), Jest + Supertest (back), GitHub Actions CI

---

## ✧･ﾟ: ✧･ﾟ Project structure

```
frameset/
├── backend/            # Node.js API (Express + MySQL)
│   ├── API.md          # REST API reference (endpoints, auth, errors)
│   ├── migrations/     # Versioned SQL scripts
│   ├── src/            # Routes, controllers, services, middlewares
│   └── tests/          # Unit & integration tests
└── frontend/           # React application
    └── src/            # Pages, components, contexts, hooks
```

The full REST API (endpoints, authentication, CSRF, error conventions) is
documented in [backend/API.md](backend/API.md).

---

## ✧･ﾟ: ✧･ﾟ Getting started

### Prerequisites

- **Node.js ≥ 20** (see `.nvmrc`) and **npm**
- **MySQL 8** or **MariaDB** — your own install, or the bundled dev database:
  `docker compose up -d` (starts MySQL and creates `frameset_db` for you)

### Backend (API)

```bash
cd backend
npm install
cp .env.example .env   # configure the DB, JWT and mail settings

# Create the database first (skip this if you used `docker compose up -d`):
#   mysql -u root -p -e "CREATE DATABASE frameset_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

npm run migrate        # create the tables
npm start              # API on http://localhost:3000
```

Interactive API docs (Swagger UI) are served at `/api-docs`, with a health probe
at `/health`. The docs are on by default in development; in production they are
opt-in — set `ENABLE_API_DOCS=true` to expose them.

### Frontend (app)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev            # app on http://localhost:5173
```

> From the repo root, convenience scripts proxy to each package:
> `npm run dev:backend`, `npm run dev:frontend`, `npm run migrate:backend`,
> `npm run test:backend`, `npm run test:frontend`, `npm run build:frontend`.

---

## ✧･ﾟ: ✧･ﾟ CI (GitHub Actions)

On every push / pull request to `main`, GitHub Actions runs — for both backend
and frontend:

- a production dependency audit (`npm audit`, high severity)
- linting (ESLint)
- formatting (Prettier, check-only)
- the test suites (Jest + Supertest / Vitest)
- the frontend build

Workflow: `.github/workflows/ci.yml`. Dependency updates are proposed monthly by
Dependabot (`.github/dependabot.yml`).

---

## ✧･ﾟ: ✧･ﾟ Deployment

The two halves deploy independently — the API does **not** serve the frontend build:

- **Frontend** — a static SPA (`frontend/`), built with `npm run build`. SPA
  fallback + security headers/CSP are configured for Vercel
  ([`frontend/vercel.json`](frontend/vercel.json)); a Netlify redirect file
  ([`frontend/public/_redirects`](frontend/public/_redirects)) is also provided —
  keep the one matching your host.
- **Backend** — the Express API (`backend/`) runs as a plain Node service behind a
  reverse proxy that terminates HTTPS.

Production checklist:

- Set **`NODE_ENV=production`** on the API (enables secure cookies, HSTS, JSON
  logs, and makes SMTP config mandatory).
- Run the API behind **exactly one** reverse proxy — it trusts a single hop
  (`trust proxy = 1`) so per-IP rate limiting stays per-client.
- **Cross-domain cookies**: auth cookies are `HttpOnly` + `SameSite`. If the app
  and API are on different domains, set `FRONTEND_ORIGIN` (API) and
  `VITE_API_URL` (frontend) to the real HTTPS origins.
- Point the frontend CSP `connect-src` (in `vercel.json`) at the real API origin.
- Restrict the `GOOGLE_FONTS_API_KEY` in the Google console; `/api-docs` stays
  hidden in production unless you opt in with `ENABLE_API_DOCS=true`.
- **Google sign-in (optional)**: create an OAuth 2.0 **Web** client ID in the
  Google Cloud console (APIs & Services → Credentials) with your frontend origin
  under "Authorized JavaScript origins", then set the same value as
  `GOOGLE_CLIENT_ID` (API) and `VITE_GOOGLE_CLIENT_ID` (frontend). Leave both
  empty to disable the feature (the button is hidden and the endpoint answers 503).
- Rate limiting is **in-memory (per instance)**: run a single API instance, or
  move to a shared store (e.g. Redis) before scaling horizontally.
- Run `npm run migrate` against the production database.

> Not yet provided (add when the hosting target is chosen): a continuous
> deployment workflow, a backend Dockerfile, and migration rollbacks.

---

## ✧･ﾟ: ✧･ﾟ License

Proprietary — © 2026 Axelle Tempier. All rights reserved. This repository is
public for portfolio purposes only; see [LICENSE](LICENSE). No reuse or
distribution without written consent.

---

## ✧･ﾟ: ✧･ﾟ Contact

Made by Axelle — **axelle.tempier@gmail.com**.
