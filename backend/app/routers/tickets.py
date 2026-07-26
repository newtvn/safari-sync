import base64
import io

import qrcode
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db, AsyncSessionLocal
from ..models import (
    Ticket, Booking, TicketStatus, User, BookingSeat, ScheduleSeat, Schedule, Route, City, Bus, Operator,
)
from ..refs import new_ticket_code
from ..security import get_current_user, require_role

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


async def issue_ticket(db: AsyncSession, booking_id: str) -> Ticket:
    existing = await db.execute(select(Ticket).where(Ticket.booking_id == booking_id))
    ticket = existing.scalar_one_or_none()
    if ticket:
        return ticket

    ticket = Ticket(booking_id=booking_id, ticket_code=new_ticket_code(), status=TicketStatus.issued)
    db.add(ticket)
    await db.flush()
    return ticket


def _qr_base64(payload: str) -> str:
    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@router.get("/by-booking/{booking_id}")
async def get_ticket_for_booking(
    booking_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    booking = await db.get(Booking, booking_id)
    if not booking or booking.user_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found")

    result = await db.execute(select(Ticket).where(Ticket.booking_id == booking_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not issued yet - payment may still be processing")

    seats_result = await db.execute(select(BookingSeat).where(BookingSeat.booking_id == booking_id))
    booking_seats = seats_result.scalars().all()
    seat_labels = []
    is_vip = False
    passenger_name = ""
    for bs in booking_seats:
        seat = await db.get(ScheduleSeat, bs.schedule_seat_id)
        seat_labels.append(seat.label)
        is_vip = is_vip or seat.is_vip
        passenger_name = bs.passenger_name

    schedule = await db.get(Schedule, booking.schedule_id)
    route = await db.get(Route, schedule.route_id)
    bus = await db.get(Bus, schedule.bus_id)
    operator = await db.get(Operator, bus.operator_id)
    from_city = await db.get(City, route.from_city_id)
    to_city = await db.get(City, route.to_city_id)

    return {
        "ticket_code": ticket.ticket_code,
        "status": ticket.status.value,
        "booking_ref": booking.booking_ref,
        "seats": seat_labels,
        "qr_base64": _qr_base64(ticket.ticket_code),
        "from_city": from_city.name,
        "from_code": from_city.code,
        "to_city": to_city.name,
        "to_code": to_city.code,
        "departure_time": schedule.departure_time.isoformat(),
        "duration_minutes": route.duration_minutes,
        "operator_name": operator.name,
        "bus_plate": bus.plate_number,
        "is_vip": is_vip,
        "passenger_name": passenger_name,
    }


@router.post("/scan")
async def scan_ticket(
    ticket_code: str,
    staff: User = Depends(require_role("operator", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Conductor/operator scans the QR at boarding. Blocks re-use of an already-boarded ticket -
    this is the anti-fraud check that a static paper/screenshot ticket can't provide."""
    result = await db.execute(select(Ticket).where(Ticket.ticket_code == ticket_code))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status == TicketStatus.boarded:
        raise HTTPException(status_code=409, detail="Ticket already used for boarding")
    if ticket.status == TicketStatus.cancelled:
        raise HTTPException(status_code=409, detail="Ticket was cancelled")

    booking = await db.get(Booking, ticket.booking_id)
    seats_result = await db.execute(select(BookingSeat).where(BookingSeat.booking_id == booking.id))
    booking_seats = seats_result.scalars().all()
    names = [bs.passenger_name for bs in booking_seats]

    from datetime import datetime

    ticket.status = TicketStatus.boarded
    ticket.boarded_at = datetime.utcnow()
    await db.commit()

    return {"ok": True, "booking_ref": booking.booking_ref, "passengers": names, "message": "Boarding confirmed"}
