import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db, AsyncSessionLocal
from ..models import Schedule, Route, City, Bus, Operator, TrackingUpdate, ScheduleStatus, User
from ..schemas import TrackingPointOut
from ..security import get_current_user, require_role

router = APIRouter(prefix="/api/tracking", tags=["tracking"])
logger = logging.getLogger("safarisync.tracking")

# Real-time GPS hardware doesn't exist in this environment, so the bus position is
# simulated by interpolating between the route's two cities. The update cadence and
# schema (lat/lng/progress/speed rows over time) are what a real telematics/driver-app
# feed would populate - swapping the simulator for a real device stream means changing
# only `_simulate_trip`, not the API contract or the frontend.
DEMO_TICKS = 40
DEMO_TICK_SECONDS = 3


@router.post("/{schedule_id}/start")
async def start_trip(
    schedule_id: str,
    staff: User = Depends(require_role("operator", "admin")),
    db: AsyncSession = Depends(get_db),
):
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    bus = await db.get(Bus, schedule.bus_id)
    if staff.role.value == "operator" and bus.operator_id != staff.operator.id:
        raise HTTPException(status_code=403, detail="Not your bus")

    if schedule.status == ScheduleStatus.in_transit:
        return {"ok": True, "message": "Already in transit"}

    schedule.status = ScheduleStatus.in_transit
    await db.commit()

    asyncio.create_task(_simulate_trip(schedule_id))
    return {"ok": True, "message": "Trip started, live tracking active"}


async def _simulate_trip(schedule_id: str) -> None:
    async with AsyncSessionLocal() as db:
        schedule = await db.get(Schedule, schedule_id)
        route = await db.get(Route, schedule.route_id)
        origin = await db.get(City, route.from_city_id)
        dest = await db.get(City, route.to_city_id)

    for tick in range(1, DEMO_TICKS + 1):
        await asyncio.sleep(DEMO_TICK_SECONDS)
        progress = tick / DEMO_TICKS
        lat = origin.lat + (dest.lat - origin.lat) * progress
        lng = origin.lng + (dest.lng - origin.lng) * progress
        avg_speed = route.distance_km / max(route.duration_minutes / 60, 0.1)

        async with AsyncSessionLocal() as db:
            db.add(
                TrackingUpdate(
                    schedule_id=schedule_id,
                    lat=lat,
                    lng=lng,
                    progress_pct=round(progress * 100, 1),
                    speed_kmh=round(avg_speed, 1),
                )
            )
            if progress >= 1.0:
                sched = await db.get(Schedule, schedule_id)
                sched.status = ScheduleStatus.completed
            await db.commit()

    logger.info("Trip %s completed simulated run", schedule_id)


@router.get("/{schedule_id}", response_model=TrackingPointOut)
async def get_tracking(schedule_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrackingUpdate)
        .where(TrackingUpdate.schedule_id == schedule_id)
        .order_by(TrackingUpdate.recorded_at.desc())
        .limit(1)
    )
    point = result.scalar_one_or_none()
    if not point:
        raise HTTPException(status_code=404, detail="No tracking data yet - trip may not have started")

    return TrackingPointOut(
        lat=point.lat,
        lng=point.lng,
        progress_pct=point.progress_pct,
        speed_kmh=point.speed_kmh,
        recorded_at=point.recorded_at,
    )
