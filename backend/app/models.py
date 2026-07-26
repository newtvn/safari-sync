import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, ForeignKey, Enum as SAEnum, Text, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def uid() -> str:
    return uuid.uuid4().hex


class Role(str, enum.Enum):
    traveler = "traveler"
    operator = "operator"
    admin = "admin"


class BusType(str, enum.Enum):
    standard = "standard"
    executive = "executive"
    vip = "vip"
    sleeper = "sleeper"


class ScheduleStatus(str, enum.Enum):
    scheduled = "scheduled"
    boarding = "boarding"
    in_transit = "in_transit"
    completed = "completed"
    cancelled = "cancelled"


class BookingStatus(str, enum.Enum):
    pending_payment = "pending_payment"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


class PaymentProvider(str, enum.Enum):
    mpesa = "mpesa"
    mtn = "mtn"
    airtel = "airtel"
    card = "card"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    success = "success"
    failed = "failed"


class SeatStatus(str, enum.Enum):
    available = "available"
    held = "held"
    booked = "booked"


class DocStatus(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class DocType(str, enum.Enum):
    passport = "passport"
    national_id = "national_id"
    yellow_fever = "yellow_fever"


class ParcelStatus(str, enum.Enum):
    booked = "booked"
    in_transit = "in_transit"
    delivered = "delivered"
    cancelled = "cancelled"


class TicketStatus(str, enum.Enum):
    issued = "issued"
    boarded = "boarded"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100), default="")
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(32))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(SAEnum(Role), default=Role.traveler)
    wallet_points: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    operator: Mapped["Operator"] = relationship(back_populates="owner", uselist=False)


class City(Base):
    __tablename__ = "cities"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(10))
    lat: Mapped[float] = mapped_column(Float, default=0.0)
    lng: Mapped[float] = mapped_column(Float, default=0.0)


class Operator(Base):
    __tablename__ = "operators"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(150), unique=True)
    rating: Mapped[float] = mapped_column(Float, default=4.5)
    color: Mapped[str] = mapped_column(String(10), default="#ffffff")
    logo: Mapped[str] = mapped_column(String(10), default="OP")
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=True)

    owner: Mapped["User"] = relationship(back_populates="operator")
    buses: Mapped[list["Bus"]] = relationship(back_populates="operator")


class Bus(Base):
    __tablename__ = "buses"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    operator_id: Mapped[str] = mapped_column(ForeignKey("operators.id"))
    plate_number: Mapped[str] = mapped_column(String(20))
    bus_type: Mapped[BusType] = mapped_column(SAEnum(BusType), default=BusType.standard)
    total_seats: Mapped[int] = mapped_column(Integer, default=45)
    amenities: Mapped[str] = mapped_column(String(255), default="")  # comma-separated

    operator: Mapped["Operator"] = relationship(back_populates="buses")


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    from_city_id: Mapped[str] = mapped_column(ForeignKey("cities.id"))
    to_city_id: Mapped[str] = mapped_column(ForeignKey("cities.id"))
    distance_km: Mapped[int] = mapped_column(Integer, default=0)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0)
    base_price: Mapped[float] = mapped_column(Float, default=20.0)

    from_city: Mapped["City"] = relationship(foreign_keys=[from_city_id])
    to_city: Mapped["City"] = relationship(foreign_keys=[to_city_id])


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    route_id: Mapped[str] = mapped_column(ForeignKey("routes.id"))
    bus_id: Mapped[str] = mapped_column(ForeignKey("buses.id"))
    departure_time: Mapped[datetime] = mapped_column(DateTime)
    arrival_time: Mapped[datetime] = mapped_column(DateTime)
    price: Mapped[float] = mapped_column(Float)
    status: Mapped[ScheduleStatus] = mapped_column(SAEnum(ScheduleStatus), default=ScheduleStatus.scheduled)

    route: Mapped["Route"] = relationship()
    bus: Mapped["Bus"] = relationship()


class ScheduleSeat(Base):
    __tablename__ = "schedule_seats"
    __table_args__ = (UniqueConstraint("schedule_id", "label", name="uq_schedule_seat_label"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    schedule_id: Mapped[str] = mapped_column(ForeignKey("schedules.id"))
    label: Mapped[str] = mapped_column(String(10))
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[SeatStatus] = mapped_column(SAEnum(SeatStatus), default=SeatStatus.available)
    held_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    booking_ref: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    schedule_id: Mapped[str] = mapped_column(ForeignKey("schedules.id"))
    status: Mapped[BookingStatus] = mapped_column(SAEnum(BookingStatus), default=BookingStatus.pending_payment)
    total_amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    itinerary_ref: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    leg_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    schedule: Mapped["Schedule"] = relationship()
    seats: Mapped[list["BookingSeat"]] = relationship(back_populates="booking")


class BookingSeat(Base):
    __tablename__ = "booking_seats"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id"))
    schedule_seat_id: Mapped[str] = mapped_column(ForeignKey("schedule_seats.id"))
    passenger_name: Mapped[str] = mapped_column(String(150))
    passenger_id_number: Mapped[str] = mapped_column(String(50), default="")

    booking: Mapped["Booking"] = relationship(back_populates="seats")
    schedule_seat: Mapped["ScheduleSeat"] = relationship()


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id"))
    provider: Mapped[PaymentProvider] = mapped_column(SAEnum(PaymentProvider))
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    phone: Mapped[str] = mapped_column(String(32), default="")
    status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus), default=PaymentStatus.pending)
    provider_ref: Mapped[str] = mapped_column(String(64), default="")
    checkout_request_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id"), unique=True)
    ticket_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    status: Mapped[TicketStatus] = mapped_column(SAEnum(TicketStatus), default=TicketStatus.issued)
    boarded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TrackingUpdate(Base):
    __tablename__ = "tracking_updates"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    schedule_id: Mapped[str] = mapped_column(ForeignKey("schedules.id"), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    progress_pct: Mapped[float] = mapped_column(Float, default=0.0)
    speed_kmh: Mapped[float] = mapped_column(Float, default=0.0)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    doc_type: Mapped[DocType] = mapped_column(SAEnum(DocType))
    file_path: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[DocStatus] = mapped_column(SAEnum(DocStatus), default=DocStatus.pending)
    reviewer_note: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ParcelBooking(Base):
    __tablename__ = "parcel_bookings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    tracking_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    sender_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    schedule_id: Mapped[str] = mapped_column(ForeignKey("schedules.id"))
    sender_name: Mapped[str] = mapped_column(String(150))
    sender_phone: Mapped[str] = mapped_column(String(32))
    receiver_name: Mapped[str] = mapped_column(String(150))
    receiver_phone: Mapped[str] = mapped_column(String(32))
    weight_kg: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(String(255), default="")
    price: Mapped[float] = mapped_column(Float)
    status: Mapped[ParcelStatus] = mapped_column(SAEnum(ParcelStatus), default=ParcelStatus.booked)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    schedule: Mapped["Schedule"] = relationship()


class USSDSession(Base):
    __tablename__ = "ussd_sessions"

    session_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    phone_number: Mapped[str] = mapped_column(String(32))
    stage: Mapped[str] = mapped_column(String(50), default="start")
    data: Mapped[str] = mapped_column(Text, default="{}")  # JSON blob of gathered inputs
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
