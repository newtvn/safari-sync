from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Operator, Bus, Schedule, ScheduleSeat, Route, User, Role, BusType, BookingSeat, Booking, Ticket
from ..schemas import CreateScheduleRequest, ManifestEntryOut
from ..security import get_current_user, require_role

router = APIRouter(prefix="/api/operators", tags=["operators"])


def generate_seats_for_schedule(schedule_id: str, total_seats: int) -> list[ScheduleSeat]:
    seats = []
    for i in range(total_seats):
        row, col = divmod(i, 4)
        label = chr(65 + col) + str(row + 1)
        seats.append(ScheduleSeat(schedule_id=schedule_id, label=label, is_vip=i < 8))
    return seats


@router.post("/register")
async def register_operator(company_name: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.operator:
        raise HTTPException(status_code=400, detail="Already registered as an operator")

    existing = await db.execute(select(Operator).where(Operator.name == company_name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Operator name taken")

    operator = Operator(name=company_name, owner_user_id=user.id, verified=False, rating=0.0, logo=company_name[:2].upper())
    db.add(operator)
    user.role = Role.operator
    await db.commit()
    return {"ok": True, "operator_id": operator.id, "message": "Operator profile created - pending verification"}


@router.get("/me")
async def my_operator(staff: User = Depends(require_role("operator")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bus).where(Bus.operator_id == staff.operator.id))
    buses = result.scalars().all()
    return {
        "id": staff.operator.id,
        "name": staff.operator.name,
        "verified": staff.operator.verified,
        "rating": staff.operator.rating,
        "buses": [
            {"id": b.id, "plate_number": b.plate_number, "bus_type": b.bus_type.value, "total_seats": b.total_seats}
            for b in buses
        ],
    }


@router.post("/me/buses")
async def create_bus(
    plate_number: str,
    bus_type: str,
    total_seats: int,
    amenities: str = "",
    staff: User = Depends(require_role("operator")),
    db: AsyncSession = Depends(get_db),
):
    try:
        bt = BusType(bus_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bus type")

    bus = Bus(
        operator_id=staff.operator.id,
        plate_number=plate_number,
        bus_type=bt,
        total_seats=total_seats,
        amenities=amenities,
    )
    db.add(bus)
    await db.commit()
    await db.refresh(bus)
    return {"id": bus.id, "plate_number": bus.plate_number}


@router.post("/me/schedules")
async def create_schedule(
    payload: CreateScheduleRequest,
    staff: User = Depends(require_role("operator")),
    db: AsyncSession = Depends(get_db),
):
    bus = await db.get(Bus, payload.bus_id)
    if not bus or bus.operator_id != staff.operator.id:
        raise HTTPException(status_code=404, detail="Bus not found for this operator")
    route = await db.get(Route, payload.route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    schedule = Schedule(
        route_id=payload.route_id,
        bus_id=payload.bus_id,
        departure_time=payload.departure_time,
        arrival_time=payload.arrival_time,
        price=payload.price,
    )
    db.add(schedule)
    await db.flush()

    for seat in generate_seats_for_schedule(schedule.id, bus.total_seats):
        db.add(seat)

    await db.commit()
    return {"id": schedule.id, "message": "Schedule published"}


@router.get("/schedules/{schedule_id}/manifest", response_model=list[ManifestEntryOut])
async def manifest(
    schedule_id: str, staff: User = Depends(require_role("operator", "admin")), db: AsyncSession = Depends(get_db)
):
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    bus = await db.get(Bus, schedule.bus_id)
    if staff.role == Role.operator and bus.operator_id != staff.operator.id:
        raise HTTPException(status_code=403, detail="Not your schedule")

    seats_result = await db.execute(select(ScheduleSeat).where(ScheduleSeat.schedule_id == schedule_id))
    seat_ids = {s.id: s.label for s in seats_result.scalars().all()}

    entries: list[ManifestEntryOut] = []
    bs_result = await db.execute(select(BookingSeat).where(BookingSeat.schedule_seat_id.in_(seat_ids.keys())))
    for bs in bs_result.scalars().all():
        booking = await db.get(Booking, bs.booking_id)
        ticket_result = await db.execute(select(Ticket).where(Ticket.booking_id == booking.id))
        ticket = ticket_result.scalar_one_or_none()
        entries.append(
            ManifestEntryOut(
                seat_label=seat_ids[bs.schedule_seat_id],
                passenger_name=bs.passenger_name,
                passenger_id_number=bs.passenger_id_number,
                booking_ref=booking.booking_ref,
                ticket_status=ticket.status.value if ticket else "unpaid",
            )
        )
    return entries
