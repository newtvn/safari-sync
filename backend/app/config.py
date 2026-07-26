import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./safarisync.db"
    jwt_secret: str = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    # Payment providers - sandbox mode by default (mirrors GoalHub's simulation pattern).
    # Set to false and supply real credentials via env vars to go live.
    payment_sandbox: bool = os.environ.get("PAYMENT_SANDBOX", "true").lower() != "false"

    mpesa_consumer_key: str = os.environ.get("MPESA_CONSUMER_KEY", "")
    mpesa_consumer_secret: str = os.environ.get("MPESA_CONSUMER_SECRET", "")
    mtn_api_key: str = os.environ.get("MTN_API_KEY", "")
    airtel_api_key: str = os.environ.get("AIRTEL_API_KEY", "")

    # Google Sign-In: create an OAuth 2.0 "Web application" Client ID in Google Cloud
    # Console (APIs & Services > Credentials), add your site's real origin(s) under
    # "Authorized JavaScript origins", and set this env var to that Client ID. Must
    # match the client ID configured in the frontend (see index.html's
    # data-client_id / google.accounts.id.initialize call in app.js).
    google_client_id: str = os.environ.get("GOOGLE_CLIENT_ID", "")

    upload_dir: str = os.environ.get(
        "UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    )

    class Config:
        env_file = ".env"


settings = Settings()
