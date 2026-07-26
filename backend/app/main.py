import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .seed import seed
from .routers import auth, catalog, seats, bookings, payments, tickets, tracking, documents, parcels, ussd, operators

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed()
    yield


app = FastAPI(title="Safari Sync API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(seats.router)
app.include_router(bookings.router)
app.include_router(payments.router)
app.include_router(tickets.router)
app.include_router(tracking.router)
app.include_router(documents.router)
app.include_router(parcels.router)
app.include_router(ussd.router)
app.include_router(operators.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "safari-sync-api"}
