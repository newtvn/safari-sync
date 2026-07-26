from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class SignupRequest(BaseModel):
    first_name: str
    last_name: str = ""
    email: EmailStr
    phone: str
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str  # the ID token JWT returned by Google Identity Services


class UserOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    phone: str
    role: str
    wallet_points: int

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Routes / Search ----------
class CityOut(BaseModel):
    id: str
    name: str
    country: str
    code: str

    class Config:
        from_attributes = True


class ScheduleOut(BaseModel):
    id: str
    departure_time: datetime
    arrival_time: datetime
    price: float
    status: str
    operator_name: str
    operator_rating: float
    bus_type: str
    total_seats: int
    available_seats: int
    from_city: str
    to_city: str
    duration_minutes: int


class ItineraryLegOut(BaseModel):
    schedule: ScheduleOut
    layover_minutes: int = 0


class ItineraryOut(BaseModel):
    legs: list[ItineraryLegOut]
    total_price: float
    total_duration_minutes: int
    connections: int


# ---------- Seats ----------
class SeatOut(BaseModel):
    id: str
    label: str
    is_vip: bool
    status: str
    price: float


class HoldSeatsRequest(BaseModel):
    schedule_id: str
    seat_labels: list[str]


class HoldSeatsResponse(BaseModel):
    hold_ids: list[str]
    expires_at: datetime
    total_price: float


# ---------- Bookings ----------
class PassengerIn(BaseModel):
    seat_label: str
    full_name: str
    id_number: str = ""


class CreateBookingRequest(BaseModel):
    schedule_id: str
    passengers: list[PassengerIn]
    itinerary_ref: str | None = None
    leg_index: int = 0


class BookingOut(BaseModel):
    id: str
    booking_ref: str
    schedule_id: str
    status: str
    total_amount: float
    currency: str


class BookingDetailOut(BookingOut):
    from_city: str
    to_city: str
    from_lat: float
    from_lng: float
    to_lat: float
    to_lng: float
    departure_time: datetime
    arrival_time: datetime
    operator_name: str
    seat_labels: list[str]
    ticket_status: str | None = None


class RouteSummaryOut(BaseModel):
    id: str
    from_city: str
    to_city: str
    from_country: str
    to_country: str
    duration_minutes: int
    base_price: float
    schedule_days: str


# ---------- Payments ----------
class InitiatePaymentRequest(BaseModel):
    booking_id: str
    provider: str  # mpesa | mtn | airtel | card
    phone: str = ""


class PaymentStatusOut(BaseModel):
    checkout_request_id: str
    status: str
    provider: str
    amount: float


# ---------- Tracking ----------
class TrackingPointOut(BaseModel):
    lat: float
    lng: float
    progress_pct: float
    speed_kmh: float
    recorded_at: datetime


# ---------- Documents ----------
class DocumentOut(BaseModel):
    id: str
    doc_type: str
    original_filename: str
    status: str
    reviewer_note: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Parcels ----------
class CreateParcelRequest(BaseModel):
    schedule_id: str
    sender_name: str
    sender_phone: str
    receiver_name: str
    receiver_phone: str
    weight_kg: float
    description: str = ""


class ParcelOut(BaseModel):
    id: str
    tracking_code: str
    status: str
    price: float


# ---------- Operator portal ----------
class CreateScheduleRequest(BaseModel):
    route_id: str
    bus_id: str
    departure_time: datetime
    arrival_time: datetime
    price: float


class ManifestEntryOut(BaseModel):
    seat_label: str
    passenger_name: str
    passenger_id_number: str
    booking_ref: str
    ticket_status: str
