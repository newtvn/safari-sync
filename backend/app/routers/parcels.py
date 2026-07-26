from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import ParcelBooking, Schedule, ParcelStatus, User, TrackingUpdate
from ..schemas import CreateParcelRequest, ParcelOut
from ..security import get_current_user
from ..refs import new_tracking_code

router = APIRouter(prefix="/api/parcels", tags=["parcels"])

BASE_PARCEL_PRICE = 3.0
PRICE_PER_KG = 1.5
MAX_PARCEL_KG = 30


@router.post("", response_model=ParcelOut)
async def create_parcel(
    payload: CreateParcelRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    schedule = await db.get(Schedule, payload.schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if payload.weight_kg <= 0 or payload.weight_kg > MAX_PARCEL_KG:
        raise HTTPException(status_code=400, detail=f"Weight must be between 0 and {MAX_PARCEL_KG}kg")

    price = round(BASE_PARCEL_PRICE + payload.weight_kg * PRICE_PER_KG, 2)

    parcel = ParcelBooking(
        tracking_code=new_tracking_code(),
        sender_user_id=user.id,
        schedule_id=schedule.id,
        sender_name=payload.sender_name,
        sender_phone=payload.sender_phone,
        receiver_name=payload.receiver_name,
        receiver_phone=payload.receiver_phone,
        weight_kg=payload.weight_kg,
        description=payload.description,
        price=price,
        status=ParcelStatus.booked,
    )
    db.add(parcel)
    await db.commit()
    await db.refresh(parcel)

    return ParcelOut(
        id=parcel.id, tracking_code=parcel.tracking_code, status=parcel.status.value, price=parcel.price
    )


@router.get("/track/{tracking_code}")
async def track_parcel(tracking_code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParcelBooking).where(ParcelBooking.tracking_code == tracking_code))
    parcel = result.scalar_one_or_none()
    if not parcel:
        raise HTTPException(status_code=404, detail="No parcel found with that tracking code")

    schedule = await db.get(Schedule, parcel.schedule_id)

    live = None
    tracking_result = await db.execute(
        select(TrackingUpdate)
        .where(TrackingUpdate.schedule_id == parcel.schedule_id)
        .order_by(TrackingUpdate.recorded_at.desc())
        .limit(1)
    )
    point = tracking_result.scalar_one_or_none()
    if point:
        live = {"progress_pct": point.progress_pct, "lat": point.lat, "lng": point.lng}
        if point.progress_pct >= 100 and parcel.status == ParcelStatus.booked:
            parcel.status = ParcelStatus.delivered
            await db.commit()
        elif point.progress_pct > 0 and parcel.status == ParcelStatus.booked:
            parcel.status = ParcelStatus.in_transit
            await db.commit()

    return {
        "tracking_code": parcel.tracking_code,
        "status": parcel.status.value,
        "receiver_name": parcel.receiver_name,
        "weight_kg": parcel.weight_kg,
        "price": parcel.price,
        "schedule_status": schedule.status.value,
        "live": live,
    }
