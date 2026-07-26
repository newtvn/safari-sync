"""
USSD booking channel (Africa's Talking webhook contract).

Roughly half of East African travelers who'd use a cross-border bus don't
have reliable smartphone data - but every phone, feature or smart, can dial
a USSD code. This router implements the same request/response contract
Africa's Talking's USSD gateway calls (sessionId, phoneNumber, text), so
pointing a real short-code at POST /api/ussd/webhook is the only step left
to go live; everything else (menu state machine, real booking + sandbox
payment) is already wired to the same database as the web app.

A phone-shaped simulator lives at GET /api/ussd/simulator for testing
without a registered short-code or an Africa's Talking account.
"""

import asyncio
import json
import random
import string

from fastapi import APIRouter, Depends, Form
from fastapi.responses import PlainTextResponse, HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import (
    User, Role, Route, City, Schedule, ScheduleSeat, SeatStatus, Booking, BookingSeat,
    BookingStatus, ScheduleStatus, Payment, PaymentProvider, PaymentStatus,
)
from ..security import hash_password
from ..refs import new_booking_ref, new_checkout_id
from ..providers import initiate_payment
from .payments import _settle_sandbox_payment

router = APIRouter(prefix="/api/ussd", tags=["ussd"])


async def _get_or_create_ussd_user(db: AsyncSession, phone: str) -> User:
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if user:
        return user

    random_pw = "".join(random.choices(string.ascii_letters + string.digits, k=16))
    user = User(
        first_name="USSD",
        last_name="Customer",
        email=f"ussd-{phone.strip('+')}@safarisync.local",
        phone=phone,
        hashed_password=hash_password(random_pw),
        role=Role.traveler,
    )
    db.add(user)
    await db.flush()
    return user


async def _list_direct_routes(db: AsyncSession, limit: int = 5):
    result = await db.execute(select(Route).limit(limit))
    routes = result.scalars().all()
    out = []
    for r in routes:
        fc = await db.get(City, r.from_city_id)
        tc = await db.get(City, r.to_city_id)
        sched_result = await db.execute(
            select(Schedule)
            .where(Schedule.route_id == r.id, Schedule.status == ScheduleStatus.scheduled)
            .order_by(Schedule.departure_time)
            .limit(1)
        )
        schedule = sched_result.scalar_one_or_none()
        out.append({"route": r, "from": fc.name, "to": tc.name, "schedule": schedule})
    return [o for o in out if o["schedule"] is not None]


async def _book_via_ussd(db: AsyncSession, phone: str, schedule_id: str, seat_count: int) -> tuple[str, float]:
    user = await _get_or_create_ussd_user(db, phone)
    schedule = await db.get(Schedule, schedule_id)

    seats_result = await db.execute(
        select(ScheduleSeat)
        .where(ScheduleSeat.schedule_id == schedule_id, ScheduleSeat.status == SeatStatus.available)
        .order_by(ScheduleSeat.label)
        .limit(seat_count)
    )
    seats = seats_result.scalars().all()
    if len(seats) < seat_count:
        raise ValueError("Not enough seats available")

    total = 2.0  # service fee
    booking = Booking(
        booking_ref=new_booking_ref(),
        user_id=user.id,
        schedule_id=schedule.id,
        status=BookingStatus.pending_payment,
        total_amount=0,
    )
    db.add(booking)
    await db.flush()

    for i, seat in enumerate(seats):
        seat.status = SeatStatus.held
        price = schedule.price + (10 if seat.is_vip else 0)
        total += price
        db.add(
            BookingSeat(
                booking_id=booking.id,
                schedule_seat_id=seat.id,
                passenger_name=f"USSD Passenger {i + 1}",
            )
        )

    booking.total_amount = round(total, 2)

    checkout_request_id = new_checkout_id()
    payment = Payment(
        booking_id=booking.id,
        provider=PaymentProvider.mpesa,
        amount=booking.total_amount,
        phone=phone,
        status=PaymentStatus.pending,
        checkout_request_id=checkout_request_id,
    )
    db.add(payment)
    await db.commit()

    result = await initiate_payment("mpesa", phone, booking.total_amount, checkout_request_id)
    payment.provider_ref = result.provider_ref
    await db.commit()

    asyncio.create_task(_settle_sandbox_payment(checkout_request_id))
    return booking.booking_ref, booking.total_amount


@router.post("/webhook", response_class=PlainTextResponse)
async def ussd_webhook(
    sessionId: str = Form(...),
    phoneNumber: str = Form(...),
    text: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    parts = [p for p in text.split("*") if p != ""] if text else []

    if len(parts) == 0:
        return "CON Welcome to Safari Sync\n1. Book a bus ticket\n2. Track a parcel\n3. Check booking status"

    if parts[0] == "1":
        routes = await _list_direct_routes(db)
        if len(parts) == 1:
            if not routes:
                return "END No routes available right now. Please try again later."
            lines = [
                f"{i + 1}. {r['from']}-{r['to']} ${r['schedule'].price:.0f}" for i, r in enumerate(routes)
            ]
            return "CON Select a route:\n" + "\n".join(lines)

        if len(parts) == 2:
            try:
                idx = int(parts[1]) - 1
                routes[idx]
            except (ValueError, IndexError):
                return "END Invalid route selection."
            return "CON Enter number of seats (1-4):"

        if len(parts) == 3:
            try:
                idx = int(parts[1]) - 1
                seats = int(parts[2])
                if not (1 <= seats <= 4):
                    raise ValueError
                routes[idx]
            except (ValueError, IndexError):
                return "END Invalid number of seats."
            return "CON Enter M-Pesa phone number to pay (07XXXXXXXX):"

        if len(parts) == 4:
            try:
                idx = int(parts[1]) - 1
                seats = int(parts[2])
                route_info = routes[idx]
            except (ValueError, IndexError):
                return "END Session expired, please dial in again."
            pay_phone = parts[3]
            try:
                ref, total = await _book_via_ussd(db, pay_phone, route_info["schedule"].id, seats)
            except ValueError as e:
                return f"END {e}"
            return (
                f"END Booking confirmed!\nRef: {ref}\nTotal: ${total:.2f}\n"
                f"An M-Pesa prompt has been sent to {pay_phone}. Enter your PIN to complete payment."
            )

    if parts[0] == "2":
        if len(parts) == 1:
            return "CON Enter your parcel tracking code:"
        code = parts[1]
        from ..models import ParcelBooking

        result = await db.execute(select(ParcelBooking).where(ParcelBooking.tracking_code == code))
        parcel = result.scalar_one_or_none()
        if not parcel:
            return "END No parcel found with that tracking code."
        return f"END Parcel {code}: {parcel.status.value.upper()}\nTo: {parcel.receiver_name}"

    if parts[0] == "3":
        if len(parts) == 1:
            return "CON Enter your booking reference:"
        ref = parts[1]
        result = await db.execute(select(Booking).where(Booking.booking_ref == ref))
        booking = result.scalar_one_or_none()
        if not booking:
            return "END No booking found with that reference."
        return f"END Booking {ref}: {booking.status.value.upper()}\nAmount: ${booking.total_amount:.2f}"

    return "END Invalid input."


@router.get("/simulator", response_class=HTMLResponse)
async def simulator():
    return """
<!doctype html><html><head><title>USSD Simulator</title>
<style>
body{font-family:monospace;background:#111;color:#eee;display:flex;justify-content:center;padding:40px}
.phone{width:300px;background:#000;border:8px solid #333;border-radius:24px;padding:16px}
.screen{background:#c8e6c9;color:#000;padding:12px;min-height:220px;white-space:pre-wrap;font-size:13px;border-radius:4px}
input{width:100%;margin-top:10px;padding:8px;box-sizing:border-box}
button{margin-top:8px;width:100%;padding:8px;cursor:pointer}
</style></head><body>
<div class="phone">
  <div class="screen" id="screen">Dial *384*7# and press send to begin.</div>
  <input id="input" placeholder="Enter response, e.g. 1">
  <button onclick="send()">Send</button>
  <button onclick="reset()">New Session</button>
</div>
<script>
let sessionId = 'sim-' + Math.random().toString(36).slice(2);
let text = '';
async function send() {
  const val = document.getElementById('input').value;
  document.getElementById('input').value = '';
  text = text ? text + '*' + val : (val === '' ? '' : val);
  if (document.getElementById('screen').textContent.includes('Dial *384*7#')) { text = ''; }
  const body = new URLSearchParams({sessionId, phoneNumber: '+254712345678', text});
  const res = await fetch('/api/ussd/webhook', {method:'POST', body});
  const out = await res.text();
  document.getElementById('screen').textContent = out;
  if (out.startsWith('END')) { text = ''; }
}
function reset() { text=''; sessionId = 'sim-' + Math.random().toString(36).slice(2);
  document.getElementById('screen').textContent = 'Dial *384*7# and press send to begin.'; }
</script>
</body></html>
"""
