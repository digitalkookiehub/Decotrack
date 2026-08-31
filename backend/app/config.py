from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "DecoTrack"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/decotrack"
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5200",
        "http://localhost:5201",
        "http://localhost:3000",
        "http://localhost:80",
    ]

    # S3 / MinIO
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "decotrack-photos"
    S3_REGION: str = "ap-south-1"

    # Push Notifications
    FCM_SERVER_KEY: str = ""

    # Application
    APP_BASE_URL: str = "http://localhost:5200"
    TIMEZONE: str = "Asia/Kolkata"

    # Delivery geofencing — flags a delivery photo taken further than this
    # from the geocoded delivery address (advisory only, never blocks delivery)
    GEOFENCE_RADIUS_M: float = 500.0

    # AI Vision — reads handwritten/printed cutting lists in the Cut Planner
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"


    # CRM Public API Keys (comma-separated)
    # Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
    CRM_API_KEYS: str = ""
    # Allowed origins for public CRM endpoints (comma-separated domains)
    CRM_ALLOWED_ORIGINS: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
