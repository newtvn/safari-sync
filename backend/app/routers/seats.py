from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import ScheduleSeat, SeatStatus, Schedule
from ..schemas import SeatOut

router = APIRouter(prefix="/api", tags=["seats"])


async def release_expired_holds(db: AsyncSession, schedule_id: str) -> None:
    now = datetime.utcnow()
    result = await db.execute(
        select(ScheduleSeat).where(
            ScheduleSeat.schedule_id == schedule_id,
            ScheduleSeat.status == SeatStatus.held,
            ScheduleSeat.held_until < now,
        )
    )
    stale = result.scalars().all()
    for seat in stale:
        seat.status = SeatStatus.available
        seat.held_until = None
    if stale:
        await db.commit()


@router.get("/schedules/{schedule_id}/seats", response_model=list[SeatOut])
async def list_seats(schedule_id: str, db: AsyncSession = Depends(get_db)):
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    await release_expired_holds(db, schedule_id)

    result = await db.execute(
        select(ScheduleSeat).where(ScheduleSeat.schedule_id == schedule_id).order_by(ScheduleSeat.label)
    )
    seats = result.scalars().all()
    return [
        SeatOut(
            id=s.id,
            label=s.label,
            is_vip=s.is_vip,
            status=s.status.value,
            price=schedule.price + (10 if s.is_vip else 0),
        )
        for s in seats
    ]
