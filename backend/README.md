# Safari Sync API

A real FastAPI + SQLAlchemy (async) + SQLite backend behind the Safari Sync frontend.
Everything the frontend shows - routes, seats, bookings, payments, tickets, tracking,
documents, parcels, USSD sessions, operator manifests - is a persisted, real operation
against this API. Nothing is faked client-side anymore.

## Running it

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On first startup the app seeds a fresh `safarisync.db` (SQLite) with 9 East African
cities, 9 bus operators, 8 routes, and 3 days of schedules, plus three demo accounts
(see the root `README.md`). Delete `safarisync.db` and restart to reseed.

- Interactive API docs: `http://localhost:8000/docs`
- USSD browser simulator: `http://localhost:8000/api/ussd/simulator`

## Deploying (Render)

The frontend (on Vercel) is static and has nothing to actually call unless this
backend is running somewhere reachable. Vercel's own serverless functions can't
host it as-is - it uses background `asyncio` tasks (payment settlement, GPS
simulation) and a SQLite file that both need to survive between requests, which
serverless doesn't support. Render's free tier does, so a `render.yaml`
(repo root, one level up from here) is included:

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the [Render dashboard](https://dashboard.render.com), New → **Blueprint**,
   and point it at this GitHub repo. Render reads `render.yaml` automatically and
   provisions a free web service named `safari-sync-api` with `JWT_SECRET`
   auto-generated and `PAYMENT_SANDBOX=true`.
3. Wait for the first deploy to finish, then copy the service's URL (something like
   `https://safari-sync-api.onrender.com`).
4. Set that URL as `API_BASE` in the frontend (`app.js`, near the top:
   `const API_BASE = window.SAFARI_SYNC_API_BASE || '...'`) and redeploy the
   frontend on Vercel so it points at the live backend instead of `localhost:8000`.

Notes specific to Render's free tier:
- The instance spins down after 15 minutes of inactivity and takes ~30-60s to wake
  up on the next request - the first request after idle will be slow, not broken.
- The filesystem (and so the SQLite database) resets on every redeploy, which is
  fine here since the app auto-reseeds demo data on startup if the DB is empty -
  just know that any real bookings made against it won't survive a redeploy. For
  persistent data across redeploys, either add a Render persistent disk mounted at
  `backend/` (paid plans only) or switch `DATABASE_URL` to a real Postgres instance
  (e.g. a free Supabase project, same pattern the sibling GoalHub project uses).
- Add `GOOGLE_CLIENT_ID` / real payment provider keys as additional environment
  variables on the Render service once you have them (see below).

## Architecture

```
app/
├── main.py            FastAPI app, CORS, static /uploads mount, router wiring
├── config.py           Settings (env-driven): DB URL, JWT secret, payment sandbox flag
├── database.py         Async SQLAlchemy engine/session, init_db()
├── models.py            All ORM models + enums
├── schemas.py          Pydantic request/response models
├── security.py         Password hashing, JWT issue/verify, role-based dependencies
├── refs.py             Human-readable reference/code generators (booking, ticket, ...)
├── providers.py        Payment provider abstraction (sandbox-mode by default)
├── seed.py             Idempotent demo-data seeder
└── routers/
    ├── auth.py           Signup / login / me (JWT)
    ├── catalog.py         Cities, direct route search, one-hop connecting itineraries
    ├── seats.py           Per-schedule seat map + expired-hold release
    ├── bookings.py        Create booking (holds seats), list/get, enriched detail view
    ├── payments.py        Initiate sandbox payment, poll status, provider callback stub
    ├── tickets.py         QR ticket issue, fetch, and conductor "scan to board"
    ├── tracking.py        Start a trip (spawns simulated GPS), poll live position
    ├── documents.py       Passport/ID/yellow-fever upload + operator review workflow
    ├── parcels.py         Parcel booking + tracking (rides along a bus schedule)
    ├── ussd.py            Africa's-Talking-shaped USSD webhook + phone simulator page
    └── operators.py       Operator registration, fleet/schedule management, manifest
```

### Design choices worth knowing about

- **Payments run in sandbox mode by default** (`PAYMENT_SANDBOX=true`). A payment is
  accepted immediately and a background task "approves" it a few seconds later - the
  same shape a real M-Pesa STK push / MTN MoMo request-to-pay has. To go live, set
  `PAYMENT_SANDBOX=false` and implement the real HTTP calls in `providers.py` for
  whichever provider(s) you have credentials for (each raises `NotImplementedError`
  with a pointer to what's needed).
- **GPS tracking is simulated** by interpolating between a route's two city
  coordinates over a compressed demo timescale (see `tracking.py`). The API contract
  (`POST /tracking/{id}/start`, `GET /tracking/{id}`) is exactly what a real
  telematics/driver-app feed would populate, so swapping the simulator for a real
  device stream doesn't change the frontend or the rest of the API.
- **Seat holds** are soft: selecting seats marks them `held` for 10 minutes; if
  payment isn't completed in that window, the next read of that schedule's seats
  lazily releases the stale hold back to `available`.
- **Ticket fraud prevention**: `POST /tickets/scan` flips a ticket to `boarded` and
  rejects any further scan of the same ticket (`409 Ticket already used for
  boarding`) - the reason a QR ticket is meaningfully harder to resell than a
  screenshot.
- **USSD** (`/ussd/webhook`) speaks the same request shape Africa's Talking's
  gateway calls (`sessionId`, `phoneNumber`, `text`), so pointing a real short-code
  at that URL is the only remaining step to go live. It reuses the exact same
  booking + sandbox-payment path as the web app, just through a text menu instead
  of a browser.

## Environment variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite+aiosqlite:///./safarisync.db` | SQLAlchemy async connection string |
| `JWT_SECRET` | `dev-secret-change-in-production` | **Change this in production** |
| `PAYMENT_SANDBOX` | `true` | `false` requires real provider credentials below |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | - | Safaricom Daraja credentials |
| `MTN_API_KEY` | - | MTN MoMo Collections credentials |
| `AIRTEL_API_KEY` | - | Airtel Money credentials |
| `UPLOAD_DIR` | `backend/uploads` | Where document uploads are stored on disk |
