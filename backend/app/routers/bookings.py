from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import (
    Booking, BookingSeat, Schedule, ScheduleSeat, SeatStatus, BookingStatus, User,
    Route, City, Bus, Operator, Ticket,
)
from ..schemas import CreateBookingRequest, BookingOut, BookingDetailOut
from ..security import get_current_user
from ..refs import new_booking_ref
from .seats import release_expired_holds

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

SEAT_HOLD_MINUTES = 10
SERVICE_FEE = 2.0


@router.post("", response_model=BookingOut)
async def create_booking(
    payload: CreateBookingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    schedule = await db.get(Schedule, payload.schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not payload.passengers:
        raise HTTPException(status_code=400, detail="At least one passenger is required")

    await release_expired_holds(db, payload.schedule_id)

    labels = [p.seat_label for p in payload.passengers]
    result = await db.execute(
        select(ScheduleSeat).where(
            ScheduleSeat.schedule_id == payload.schedule_id,
            ScheduleSeat.label.in_(labels),
        )
    )
    seats = {s.label: s for s in result.scalars().all()}

    missing = [label for label in labels if label not in seats]
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown seats: {', '.join(missing)}")

    unavailable = [label for label in labels if seats[label].status != SeatStatus.available]
    if unavailable:
        raise HTTPException(
            status_code=409,
            detail=f"Seats already taken: {', '.join(unavailable)}. Please pick different seats.",
        )

    total = SERVICE_FEE
    hold_until = datetime.utcnow() + timedelta(minutes=SEAT_HOLD_MINUTES)
    for seat in seats.values():
        seat.status = SeatStatus.held
        seat.held_until = hold_until
        total += schedule.price + (10 if seat.is_vip else 0)

    booking = Booking(
        booking_ref=new_booking_ref(),
        user_id=user.id,
        schedule_id=schedule.id,
        status=BookingStatus.pending_payment,
        total_amount=round(total, 2),
        itinerary_ref=payload.itinerary_ref,
        leg_index=payload.leg_index,
    )
    db.add(booking)
    await db.flush()

    for p in payload.passengers:
        db.add(
            BookingSeat(
                booking_id=booking.id,
                schedule_seat_id=seats[p.seat_label].id,
                passenger_name=p.full_name,
                passenger_id_number=p.id_number,
            )
        )

    await db.commit()
    await db.refresh(booking)

    return BookingOut(
        id=booking.id,
        booking_ref=booking.booking_ref,
        schedule_id=booking.schedule_id,
        status=booking.status.value,
        total_amount=booking.total_amount,
        currency=booking.currency,
    )


async def _enrich(db: AsyncSession, booking: Booking) -> BookingDetailOut:
    schedule = await db.get(Schedule, booking.schedule_id)
    route = await db.get(Route, schedule.route_id)
    bus = await db.get(Bus, schedule.bus_id)
    operator = await db.get(Operator, bus.operator_id)
    from_city = await db.get(City, route.from_city_id)
    to_city = await db.get(City, route.to_city_id)

    seats_result = await db.execute(select(BookingSeat).where(BookingSeat.booking_id == booking.id))
    labels = []
    for bs in seats_result.scalars().all():
        seat = await db.get(ScheduleSeat, bs.schedule_seat_id)
        labels.append(seat.label)

    ticket_result = await db.execute(select(Ticket).where(Ticket.booking_id == booking.id))
    ticket = ticket_result.scalar_one_or_none()

    return BookingDetailOut(
        id=booking.id,
        booking_ref=booking.booking_ref,
        schedule_id=booking.schedule_id,
        status=booking.status.value,
        total_amount=booking.total_amount,
        currency=booking.currency,
        from_city=from_city.name,
        to_city=to_city.name,
        from_lat=from_city.lat,
        from_lng=from_city.lng,
        to_lat=to_city.lat,
        to_lng=to_city.lng,
        departure_time=schedule.departure_time,
        arrival_time=schedule.arrival_time,
        operator_name=operator.name,
        seat_labels=labels,
        ticket_status=ticket.status.value if ticket else None,
    )


@router.get("/mine", response_model=list[BookingDetailOut])
async def my_bookings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Booking).where(Booking.user_id == user.id).order_by(Booking.created_at.desc())
    )
    return [await _enrich(db, b) for b in result.scalars().all()]


@router.get("/by-ref/{booking_ref}")
async def get_booking_by_ref(booking_ref: str, db: AsyncSession = Depends(get_db)):
    """Public lookup so a booking reference alone (e.g. shared by a traveler with family) is
    enough to check status or track the ride - no login required, same as a paper ticket."""
    result = await db.execute(select(Booking).where(Booking.booking_ref == booking_ref))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="No booking found with that reference")
    detail = await _enrich(db, booking)
    return detail


@router.get("/{booking_id}", response_model=BookingDetailOut)
async def get_booking(booking_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    booking = await db.get(Booking, booking_id)
    if not booking or booking.user_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    return await _enrich(db, booking)
