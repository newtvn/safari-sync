import random
import string
from datetime import datetime


def _rand(n: int) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=n))


def new_booking_ref() -> str:
    return f"SS-{datetime.utcnow():%y%m}-{_rand(6)}"


def new_ticket_code() -> str:
    return f"TKT-{_rand(8)}"


def new_tracking_code() -> str:
    return f"PCL-{_rand(8)}"


def new_checkout_id() -> str:
    return f"ck_{_rand(16)}"
