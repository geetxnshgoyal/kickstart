# Kickstart 🚀✨

Kickstart is a lightweight hackathon landing page, registration portal and admin console built with Express.js and Firebase Admin SDK. It was created to power onsite hackathons — handle participant registrations (individuals & teams), let organizers team-up solo registrants, mark attendance and export participant lists. 

Live site (example): https://justkickstart.me

---

## Table of Contents 📚

- [Why Kickstart](#why-kickstart)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment & Firebase](#environment--firebase)
- [API Endpoints](#api-endpoints)
- [Admin Console](#admin-console)
- [Deployment](#deployment)
- [Development tips](#development-tips)
- [Contributing](#contributing)
- [License](#license)

---

## Why Kickstart 🎯

Kickstart was designed to get hackathon teams up and running quickly. It focuses on: simple UX for registrants, organizer tools to manage registrations and team formation, and easy exports for event logistics (attendance, seat allocation, CSV/XLSX downloads).

## Features ✨

- Landing page with event details and schedule
- Registration portal for individuals and teams
- Organizer console to view registrations, team up individuals and mark attendance
- Export functionality (CSV & XLSX)
- Firebase-backed (production) with a robust in-memory mock for local development
- Optional serverless wrapper for deployment (serverless-http)

## Tech Stack �️

- Node.js + Express.js (server)
- Firebase Admin SDK (Firestore) for persistent data
- Vanilla HTML/CSS/JS frontend (index.html, register.html, admin.html)
- Optional: Docker, Docker Compose, Vercel (see DEPLOY.md / DEPLOY-VERCEL.md)

## Quick Start ⚡

Prerequisites:

- Node.js (14+ recommended)
- npm or yarn
- Firebase project & admin credentials for production

Steps:

1. Clone the repo

```bash
git clone https://github.com/unnati-jaiswal24/kickstart.git
cd kickstart
```

2. Install dependencies

```bash
npm install
```

3. Add environment variables

Create a `.env` file in the project root (see Environment section). For local development you can skip Firebase to use the in-memory mock.

4. Start the app

```bash
npm start
# or for development mode
NODE_ENV=development npm run dev
```

Open http://localhost:3000

## Environment & Firebase 🔐

The app expects Firebase Admin credentials or the `FIREBASE_CREDENTIALS` / `GOOGLE_APPLICATION_CREDENTIALS` environment variables for production. In development the server will fall back to an in-memory mock DB so you can test registration flows without configuring Firebase.

Typical env variables:

- PORT - server port (default: 3000)
- ADMIN_KEY - shared secret required to access admin endpoints (/api/admin/*)
- CORS_ORIGIN - allowed origin for requests
- FIREBASE_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS - Firebase admin credentials
- NODE_ENV - set to `development` to use the in-memory mock

Important: Do NOT commit your Firebase service account JSON to git. Add it to `.gitignore` and use environment-secure deployment options (Vercel secrets, Docker secrets, CI/CD encrypted variables).

## API Endpoints 🔌

Public:

- POST /api/register
	- body.type = 'individual' or 'team'
	- individual: body.participant = { name, email, phone?, profileLink?, notes? }
	- team: body = { teamName, leader: { name, email, phone?, profileLink? }, members: [...] }

Admin (requires `x-admin-key` header with value set to `ADMIN_KEY`):

- GET /api/admin/registrations?view=all|individuals|teams
- POST /api/admin/team-up - form team from independent participants
- POST /api/admin/attendance - mark/clear attendance for a team
- GET /api/admin/export?format=csv|xlsx&view=all|teams|individuals - download exports

Example: mark attendance (curl)

```bash
curl -X POST https://your-server/api/admin/attendance \
	-H "x-admin-key: $ADMIN_KEY" \
	-H "Content-Type: application/json" \
	-d '{ "teamId": "TEAM_ID", "present": true, "seatNumber": "A12" }'
```

## Admin Console 🧰

Open `/admin.html` in the browser. Provide the `ADMIN_KEY` to unlock the dashboard. From there you can refresh registrations, select solo participants and form teams, export CSV/XLSX and mark attendance.

## Deployment 🚢

This repo includes helper files:

- `Dockerfile` & `docker-compose.yml` - run in containers
- `DEPLOY.md` & `DEPLOY-VERCEL.md` - step-by-step deployment notes
- `pm2.config.js` - PM2 process manager config for production

There is also a `serverless-http` wrapper at `api/index.js` so you can deploy the app as a serverless function on providers that support Node.js.

## Development tips 🧪

- To run with the in-memory mock DB: set `NODE_ENV=development` and omit Firebase credentials. The app seeds a few mock teams and participants.
- Add `ADMIN_KEY` in your `.env` to exercise admin endpoints locally.
- When exporting XLSX, the server lazy-loads `exceljs` only when requested.

## Contributing 🤝

Contributions are welcome. Please open an issue or submit a PR. If you're improving frontend or adding validation, keep changes small and add tests where practical.

If you find a security concern related to Firebase credentials or admin key handling, please report it privately via the repository's security contact.

## License �

This project is provided under the MIT License. See the `LICENSE` file for details