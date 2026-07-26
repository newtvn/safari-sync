from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import City, Route, Schedule, Bus, Operator, ScheduleSeat, SeatStatus, ScheduleStatus
from ..schemas import CityOut, ScheduleOut, ItineraryOut, ItineraryLegOut, RouteSummaryOut

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/cities", response_model=list[CityOut])
async def list_cities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(City).order_by(City.country, City.name))
    return [CityOut.model_validate(c) for c in result.scalars().all()]


@router.get("/routes", response_model=list[RouteSummaryOut])
async def list_routes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Route))
    routes = result.scalars().all()
    out = []
    for r in routes:
        fc = await db.get(City, r.from_city_id)
        tc = await db.get(City, r.to_city_id)
        sched_result = await db.execute(
            select(Schedule.departure_time)
            .where(Schedule.route_id == r.id, Schedule.status == ScheduleStatus.scheduled)
        )
        days = sorted({row[0].strftime("%A") for row in sched_result.all()})
        out.append(
            RouteSummaryOut(
                id=r.id,
                from_city=fc.name,
                to_city=tc.name,
                from_country=fc.country,
                to_country=tc.country,
                duration_minutes=r.duration_minutes,
                base_price=r.base_price,
                schedule_days=", ".join(days) if days else "See schedule",
            )
        )
    return out


async def _available_seats(db: AsyncSession, schedule_id: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(ScheduleSeat).where(
            ScheduleSeat.schedule_id == schedule_id,
            ScheduleSeat.status == SeatStatus.available,
        )
    )
    return result.scalar_one()


async def _schedule_out(db: AsyncSession, schedule: Schedule) -> ScheduleOut:
    route = await db.get(Route, schedule.route_id)
    bus = await db.get(Bus, schedule.bus_id)
    operator = await db.get(Operator, bus.operator_id)
    from_city = await db.get(City, route.from_city_id)
    to_city = await db.get(City, route.to_city_id)
    available = await _available_seats(db, schedule.id)

    return ScheduleOut(
        id=schedule.id,
        departure_time=schedule.departure_time,
        arrival_time=schedule.arrival_time,
        price=schedule.price,
        status=schedule.status.value,
        operator_name=operator.name,
        operator_rating=operator.rating,
        bus_type=bus.bus_type.value,
        total_seats=bus.total_seats,
        available_seats=available,
        from_city=from_city.name,
        to_city=to_city.name,
        duration_minutes=route.duration_minutes,
    )


async def _find_city(db: AsyncSession, name_or_id: str) -> City | None:
    result = await db.execute(
        select(City).where((City.id == name_or_id) | (func.lower(City.name) == name_or_id.lower()))
    )
    return result.scalar_one_or_none()


@router.get("/routes/search", response_model=list[ScheduleOut])
async def search_routes(
    from_city: str = Query(...),
    to_city: str = Query(...),
    travel_date: str | None = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
):
    fc = await _find_city(db, from_city)
    tc = await _find_city(db, to_city)
    if not fc or not tc:
        return []

    query = (
        select(Schedule)
        .join(Route, Schedule.route_id == Route.id)
        .where(Route.from_city_id == fc.id, Route.to_city_id == tc.id)
        .where(Schedule.status == ScheduleStatus.scheduled)
    )
    if travel_date:
        try:
            day = date.fromisoformat(travel_date)
            query = query.where(func.date(Schedule.departure_time) == day.isoformat())
        except ValueError:
            pass

    result = await db.execute(query.order_by(Schedule.departure_time))
    schedules = result.scalars().all()
    return [await _schedule_out(db, s) for s in schedules]


@router.get("/routes/search-connections", response_model=list[ItineraryOut])
async def search_connections(
    from_city: str = Query(...),
    to_city: str = Query(...),
    travel_date: str | None = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
):
    """One-hop connecting itineraries when no direct route exists (e.g. Nairobi -> Kigali via Kampala)."""
    fc = await _find_city(db, from_city)
    tc = await _find_city(db, to_city)
    if not fc or not tc:
        return []

    all_routes = (await db.execute(select(Route))).scalars().all()
    leg1_routes = [r for r in all_routes if r.from_city_id == fc.id and r.to_city_id != tc.id]
    itineraries: list[ItineraryOut] = []

    for leg1 in leg1_routes:
        leg2_candidates = [r for r in all_routes if r.from_city_id == leg1.to_city_id and r.to_city_id == tc.id]
        if not leg2_candidates:
            continue
        leg2 = leg2_candidates[0]

        leg1_schedules = (
            await db.execute(
                select(Schedule)
                .where(Schedule.route_id == leg1.id, Schedule.status == ScheduleStatus.scheduled)
                .order_by(Schedule.departure_time)
            )
        ).scalars().all()

        for s1 in leg1_schedules:
            if travel_date:
                try:
                    if s1.departure_time.date().isoformat() != travel_date:
                        continue
                except ValueError:
                    pass

            leg2_schedules = (
                await db.execute(
                    select(Schedule)
                    .where(Schedule.route_id == leg2.id, Schedule.status == ScheduleStatus.scheduled)
                    .order_by(Schedule.departure_time)
                )
            ).scalars().all()

            for s2 in leg2_schedules:
                layover = (s2.departure_time - s1.arrival_time).total_seconds() / 60
                if 30 <= layover <= 360:
                    out1 = await _schedule_out(db, s1)
                    out2 = await _schedule_out(db, s2)
                    itineraries.append(
                        ItineraryOut(
                            legs=[
                                ItineraryLegOut(schedule=out1, layover_minutes=0),
                                ItineraryLegOut(schedule=out2, layover_minutes=int(layover)),
                            ],
                            total_price=out1.price + out2.price,
                            total_duration_minutes=int(
                                (s2.arrival_time - s1.departure_time).total_seconds() / 60
                            ),
                            connections=1,
                        )
                    )

    itineraries.sort(key=lambda i: i.total_duration_minutes)
    return itineraries[:10]
