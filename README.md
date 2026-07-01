
<div align="center">
	<picture>
		<source media="(prefers-color-scheme: dark)" srcset="frontend/public/FrameSet_Logo_Reversed.png">
		<img src="frontend/public/FrameSet_Logo.png" alt="FrameSet logo" width="120" />
	</picture>
	<p><b>FRAMESET — The graphic reference, built for digital illustration.</b></p>
	<p>
		<a href="https://github.com/AxelleDev/frameset/actions/workflows/ci.yml">
			<img src="https://github.com/AxelleDev/frameset/actions/workflows/ci.yml/badge.svg" alt="CI status" />
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

- **Accounts & authentication** — sign up, log in, e-mail verification and profile
  management (JWT, hashed passwords, CSRF protection & rate-limiting).
- **Projects** — a dashboard to create and manage multiple illustration projects.
- **Palettes** — colour management with drag-and-drop reordering and quick code copy.
- **Specs** — typographies (with Google Fonts loading) and brushes (size, opacity,
  usage…).
- **Export** — generate a PDF of the project's complete reference sheet.

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

### Backend (API)

```bash
cd backend
npm install
cp .env.example .env   # configure the DB, JWT and mail settings
npm run migrate        # run the migrations
npm start
```

### Frontend (app)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## ✧･ﾟ: ✧･ﾟ CI (GitHub Actions)

The CI pipeline automatically runs:

- backend tests
- frontend tests
- the frontend build

Workflow: `.github/workflows/ci.yml`

---

## ✧･ﾟ: ✧･ﾟ Contact

Made by Axelle — **axelle.tempier@gmail.com**.

© 2026 Axelle. All rights reserved.
