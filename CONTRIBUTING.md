# Contributing to FrameSet

Thanks for your interest in contributing! This guide gets you set up and explains how to propose changes.

## Prerequisites

- **Node.js >= 20**
- **MySQL or MariaDB** (a local instance, e.g. via XAMPP)

## Local setup

```bash
git clone https://github.com/AxelleDev/frameset.git
cd frameset
```

Create the database once (name it `frameset_db`), then:

**Backend**
```bash
cd backend
npm install
cp .env.example .env     # fill in DB + JWT; email can stay empty in dev
npm run migrate          # apply the SQL migrations
npm run dev              # API on http://localhost:3000
```

**Frontend** (in a second terminal)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev              # app on http://localhost:5173
```

> **Emails in development:** if no SMTP is configured, the app automatically
> creates an [Ethereal](https://ethereal.email) test account on the first send
> and logs a preview URL to the backend console — nothing is sent to real
> inboxes, and no setup is required.

## Before opening a pull request

Run the checks in the package you changed:

```bash
npm run lint     # ESLint
npm test         # backend: Jest · frontend: Vitest
npm run build    # frontend only
```

## Pull requests

- Create a branch from `main` (e.g. `feat/...`, `fix/...`).
- Keep PRs focused and describe what changed and why.
- Make sure lint and tests pass.
- Do not commit secrets — keep them in your local `.env` (which is git-ignored).

## Reporting bugs / requesting features

Open an issue using the provided templates, or reach out at **axelle.tempier@gmail.com**.
