<div align="center">

# S A F A R I • S Y N C

### T r a v e l   E a s t   A f r i c a   Y o u r   W a y

<br />

**A premium, cross-border bus travel booking platform for the modern traveler.**

[View Demo](#) • [Report Bug](#) • [Request Feature](#)

</div>

<br />

---

## Overview

**Safari Sync** reimagines the bus travel experience across East Africa. Bridging the gap between **Kenya, Uganda, Rwanda, Tanzania, and South Sudan**, we provide a unified platform for seamless booking, real-time tracking, and secure payments.

Designed with a **"Dark Mode First"** aesthetic, the interface features glassmorphism effects, dotted display typography, and smooth animations to deliver a premium user experience.

<br />

## Key Features

Every feature below is backed by a real FastAPI + SQLite database in `backend/` -
nothing is simulated client-side anymore (see [`backend/README.md`](backend/README.md)
for the full API and architecture writeup).

| Feature | Description |
| :--- | :--- |
| **Google Sign-In** | Real Google OAuth login (server-verifies the ID token) - one env var to turn on, see `backend/README.md`. |
| **Real Inventory & Booking** | Live seat maps, seat holds, and bookings persisted in a real database - not hardcoded arrays. |
| **Sandbox Mobile Money** | M-Pesa / MTN / Airtel / Card payment flow with a pluggable provider abstraction, ready to swap in real Daraja/MoMo credentials. |
| **Verified E-Tickets** | Real QR-coded tickets; a conductor "scan to board" endpoint blocks re-use of an already-boarded ticket. |
| **Live GPS Tracking** | A real interactive map (Leaflet/OpenStreetMap - no API key needed) showing a bus's simulated live position, with one-tap "Open in Google Maps" / "Open in Waze" deep links. |
| **Border Document Workflow** | Upload passport/ID/yellow-fever documents; an operator/admin reviews and verifies them. |
| **USSD Booking Channel** | A real Africa's-Talking-shaped USSD webhook (`/api/ussd/webhook`) plus a phone-shaped browser simulator, for travelers without smartphone data. |
| **Multi-leg Itineraries** | Automatic one-hop connecting itinerary search (e.g. Nairobi&rarr;Kigali via Kampala) when no direct route exists. |
| **Parcel Booking** | Real "Send Parcel" booking and tracking, riding along an existing bus schedule. |
| **Operator Portal** | Operators manage their fleet, start live tracking on a trip, scan boarding tickets, and view passenger manifests. |
| **Mobile Optimized** | Fully responsive design that adapts perfectly to phones, tablets, and desktops. |

<br />

## Design System

The project utilizes a custom CSS design system focused on high contrast and elegance.

*   **Typography**: `Codystar` (features/headings) & `DM Sans` (body).
*   **Palette**: Deep Blacks (`#09090b`), Golden Accents (`#fbbf24`), and Glass Whites.
*   **Effects**: Backdrop Blur, Soft Glows, and CSS Grid/Flexbox Layouts.

<br />

## Technology Stack

*   **Frontend**: HTML5, Modern CSS3 (Variables, Grid, Flexbox), Vanilla JavaScript, [Leaflet](https://leafletjs.com/) for live maps
*   **Backend**: FastAPI, SQLAlchemy (async), SQLite, JWT auth, QR ticket generation
*   **Assets**: SVG Animations, Unsplash Integration
*   **Fonts**: Google Fonts (Codystar, DM Sans, Playfair Display)

<br />

## Getting Started

The backend must be running for the frontend to have any real data to show.

```bash
# 1. Start the backend (seeds demo data automatically on first run)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# API docs: http://localhost:8000/docs
# USSD simulator: http://localhost:8000/api/ussd/simulator

# 2. In another terminal, serve the frontend
cd ..
npx http-server -p 5500
# Open http://localhost:5500
```

**Demo logins** (seeded automatically):

| Role | Email | Password |
| :--- | :--- | :--- |
| Traveler | `traveler@safarisync.com` | `traveler123` |
| Operator (owns "Modern Safari") | `operator@safarisync.com` | `operator123` |
| Admin | `admin@safarisync.com` | `admin123` |

All payments run in **sandbox mode** by default (`PAYMENT_SANDBOX=true`): no real
M-Pesa/MTN/Airtel credentials are called, a payment just auto-approves after a
few seconds like a real STK push would. See `backend/app/providers.py` and
`backend/README.md` for how to go live with real provider credentials.

<br />

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

<br />

---

<div align="center">

Powered by [www.prolithica.com](http://www.prolithica.com)
<br />
&copy; 2026 Safari Sync. All Rights Reserved.

</div>
