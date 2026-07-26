import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select

from .database import AsyncSessionLocal, init_db
from .models import City, Operator, Bus, Route, Schedule, User, Role, BusType
from .security import hash_password
from .routers.operators import generate_seats_for_schedule

CITIES = [
    ("Nairobi", "Kenya", "NBO", -1.2921, 36.8219),
    ("Mombasa", "Kenya", "MBA", -4.0435, 39.6682),
    ("Kisumu", "Kenya", "KIS", -0.0917, 34.7680),
    ("Kampala", "Uganda", "KLA", 0.3476, 32.5825),
    ("Entebbe", "Uganda", "EBB", 0.0512, 32.4637),
    ("Jinja", "Uganda", "JIN", 0.4478, 33.2026),
    ("Kigali", "Rwanda", "KGL", -1.9441, 30.0619),
    ("Butare", "Rwanda", "BTR", -2.5967, 29.7397),
    ("Juba", "South Sudan", "JUB", 4.8517, 31.5825),
]

OPERATORS = [
    ("Modern Safari", 4.8, "#d97706", "MS"),
    ("Easy Coach", 4.6, "#059669", "EC"),
    ("Jaguar Express", 4.7, "#dc2626", "JE"),
    ("Trinity Express", 4.5, "#7c3aed", "TE"),
    ("Kampala Coach", 4.4, "#0891b2", "KC"),
    ("Nile Star", 4.3, "#0369a1", "NS"),
    ("Unity Express", 4.2, "#15803d", "UE"),
    ("Mash East Africa", 4.5, "#b91c1c", "ME"),
    ("Climax Coaches", 4.4, "#9333ea", "CC"),
]

# (from, to, distance_km, duration_min, base_price, operator_names)
ROUTES = [
    ("Nairobi", "Kampala", 660, 600, 35, ["Modern Safari", "Easy Coach", "Jaguar Express"]),
    ("Kampala", "Kigali", 510, 480, 30, ["Jaguar Express", "Trinity Express"]),
    ("Nairobi", "Kigali", 1150, 1080, 55, ["Modern Safari", "Kampala Coach"]),
    ("Kampala", "Juba", 580, 720, 45, ["Nile Star", "Unity Express"]),
    ("Nairobi", "Mombasa", 480, 480, 25, ["Modern Safari", "Easy Coach", "Mash East Africa"]),
    ("Nairobi", "Kisumu", 350, 360, 20, ["Easy Coach", "Climax Coaches"]),
    ("Kampala", "Nairobi", 660, 600, 35, ["Modern Safari", "Easy Coach", "Jaguar Express"]),
    ("Kigali", "Kampala", 510, 480, 30, ["Jaguar Express", "Trinity Express"]),
]

DEPARTURE_HOURS = [6, 10, 14, 22]
BUS_TYPES = [BusType.executive, BusType.standard, BusType.vip, BusType.sleeper]


async def seed() -> None:
    await init_db()
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(City))
        if existing.scalar_one_or_none():
            print("Database already seeded, skipping.")
            return

        city_map: dict[str, City] = {}
        for name, country, code, lat, lng in CITIES:
            city = City(name=name, country=country, code=code, lat=lat, lng=lng)
            db.add(city)
            city_map[name] = city
        await db.flush()

        operator_map: dict[str, Operator] = {}
        for name, rating, color, logo in OPERATORS:
            op = Operator(name=name, rating=rating, color=color, logo=logo, verified=True)
            db.add(op)
            operator_map[name] = op
        await db.flush()

        bus_map: dict[str, Bus] = {}
        for i, (name, op) in enumerate(operator_map.items()):
            bus = Bus(
                operator_id=op.id,
                plate_number=f"K{'ABCDEFGHI'[i % 9]}{100 + i}X",
                bus_type=BUS_TYPES[i % len(BUS_TYPES)],
                total_seats=[45, 50, 35, 30][i % 4],
                amenities="WiFi,AC,USB" if i % 2 == 0 else "AC,Meals",
            )
            db.add(bus)
            bus_map[name] = bus
        await db.flush()

        # Normalize to midnight UTC so day_offset=1 reliably means "tomorrow's date",
        # regardless of what time of day the server happens to seed at.
        now = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        for from_name, to_name, distance, duration, price, op_names in ROUTES:
            route = Route(
                from_city_id=city_map[from_name].id,
                to_city_id=city_map[to_name].id,
                distance_km=distance,
                duration_minutes=duration,
                base_price=price,
            )
            db.add(route)
            await db.flush()

            for day_offset in range(1, 4):
                for h_i, op_name in enumerate(op_names):
                    bus = bus_map[op_name]
                    departure = now + timedelta(days=day_offset, hours=DEPARTURE_HOURS[h_i % len(DEPARTURE_HOURS)])
                    arrival = departure + timedelta(minutes=duration)
                    schedule = Schedule(
                        route_id=route.id, bus_id=bus.id, departure_time=departure,
                        arrival_time=arrival, price=float(price),
                    )
                    db.add(schedule)
                    await db.flush()
                    for seat in generate_seats_for_schedule(schedule.id, bus.total_seats):
                        db.add(seat)

        demo_users = [
            ("Aisha", "Traveler", "traveler@safarisync.com", "+254712345678", "traveler123", Role.traveler),
            ("James", "Operator", "operator@safarisync.com", "+254798765432", "operator123", Role.operator),
            ("Admin", "User", "admin@safarisync.com", "+254700000000", "admin123", Role.admin),
        ]
        created_operator_user = None
        for first, last, email, phone, pw, role in demo_users:
            user = User(
                first_name=first, last_name=last, email=email, phone=phone,
                hashed_password=hash_password(pw), role=role,
            )
            db.add(user)
            if role == Role.operator:
                created_operator_user = user
        await db.flush()

        if created_operator_user:
            operator_map["Modern Safari"].owner_user_id = created_operator_user.id

        await db.commit()
        print("Seed complete: 9 cities, 9 operators, 8 routes, schedules for 3 days.")
        print("Demo logins: traveler@safarisync.com / traveler123, operator@safarisync.com / operator123, "
              "admin@safarisync.com / admin123")


if __name__ == "__main__":
    asyncio.run(seed())
