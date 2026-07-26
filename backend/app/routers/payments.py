import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db, AsyncSessionLocal
from ..models import (
    Payment, Booking, PaymentProvider, PaymentStatus, BookingStatus, ScheduleSeat, SeatStatus, BookingSeat, User,
)
from ..schemas import InitiatePaymentRequest, PaymentStatusOut
from ..security import get_current_user
from ..refs import new_checkout_id
from ..providers import initiate_payment
from .tickets import issue_ticket

router = APIRouter(prefix="/api/payments", tags=["payments"])
logger = logging.getLogger("safarisync.payments")

SANDBOX_APPROVAL_DELAY_SECONDS = 4


@router.post("/initiate", response_model=PaymentStatusOut)
async def initiate(
    payload: InitiatePaymentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    booking = await db.get(Booking, payload.booking_id)
    if not booking or booking.user_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != BookingStatus.pending_payment:
        raise HTTPException(status_code=400, detail=f"Booking is already {booking.status.value}")

    try:
        provider_enum = PaymentProvider(payload.provider)
    except ValueError:
        raise HTTPException(status_code=400, detail="Unsupported payment provider")

    checkout_request_id = new_checkout_id()
    payment = Payment(
        booking_id=booking.id,
        provider=provider_enum,
        amount=booking.total_amount,
        phone=payload.phone,
        status=PaymentStatus.pending,
        checkout_request_id=checkout_request_id,
    )
    db.add(payment)
    await db.commit()

    result = await initiate_payment(payload.provider, payload.phone, booking.total_amount, checkout_request_id)
    if not result.accepted:
        payment.status = PaymentStatus.failed
        await db.commit()
        raise HTTPException(status_code=502, detail=result.message)

    payment.provider_ref = result.provider_ref
    await db.commit()

    asyncio.create_task(_settle_sandbox_payment(checkout_request_id))

    return PaymentStatusOut(
        checkout_request_id=checkout_request_id,
        status=payment.status.value,
        provider=payment.provider.value,
        amount=payment.amount,
    )


async def _settle_sandbox_payment(checkout_request_id: str) -> None:
    """Background approval - stands in for the real webhook a provider would call back on."""
    await asyncio.sleep(SANDBOX_APPROVAL_DELAY_SECONDS)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Payment).where(Payment.checkout_request_id == checkout_request_id))
        payment = result.scalar_one_or_none()
        if not payment or payment.status != PaymentStatus.pending:
            return

        payment.status = PaymentStatus.success
        payment.completed_at = datetime.utcnow()

        booking = await db.get(Booking, payment.booking_id)
        booking.status = BookingStatus.confirmed

        seats_result = await db.execute(select(BookingSeat).where(BookingSeat.booking_id == booking.id))
        for bs in seats_result.scalars().all():
            seat = await db.get(ScheduleSeat, bs.schedule_seat_id)
            seat.status = SeatStatus.booked
            seat.held_until = None

        await issue_ticket(db, booking.id)
        await db.commit()
        logger.info("\U0001F4B3 Payment %s settled for booking %s", checkout_request_id, booking.booking_ref)


@router.get("/status/{checkout_request_id}", response_model=PaymentStatusOut)
async def payment_status(
    checkout_request_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Payment).where(Payment.checkout_request_id == checkout_request_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    return PaymentStatusOut(
        checkout_request_id=payment.checkout_request_id,
        status=payment.status.value,
        provider=payment.provider.value,
        amount=payment.amount,
    )


@router.post("/callback")
async def provider_callback(payload: dict, db: AsyncSession = Depends(get_db)):
    """Real webhook target for live providers (Daraja/MTN/Airtel) once PAYMENT_SANDBOX=false.
    Kept here so switching off sandbox mode doesn't require adding a new route."""
    checkout_request_id = payload.get("checkout_request_id")
    if not checkout_request_id:
        raise HTTPException(status_code=400, detail="Missing checkout_request_id")
    logger.info("Received live provider callback for %s", checkout_request_id)
    return {"received": True}
