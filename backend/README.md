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
