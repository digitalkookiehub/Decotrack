import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.exceptions import AppException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title=settings.APP_NAME, version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "code": exc.code},
    )


@app.get("/health")
async def health():
    return {"status": "healthy", "service": settings.APP_NAME}


# ── Serve uploaded photos ──────────────────────────────────────
uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


# ── All Routers ────────────────────────────────────────────────
from app.routers import auth, admin  # noqa: E402
from app.routers import categories, raw_materials, vendors  # noqa: E402
from app.routers import clients, projects, products  # noqa: E402
from app.routers import purchase_orders, grn, approvals  # noqa: E402
from app.routers import work_orders, production  # noqa: E402
from app.routers import drivers  # noqa: E402

app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1")
app.include_router(raw_materials.router, prefix="/api/v1")
app.include_router(vendors.router, prefix="/api/v1")
app.include_router(clients.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(purchase_orders.router, prefix="/api/v1")
app.include_router(grn.router, prefix="/api/v1")
app.include_router(approvals.router, prefix="/api/v1")
app.include_router(work_orders.router, prefix="/api/v1")
app.include_router(production.router, prefix="/api/v1")

from app.routers import dispatches, delivery  # noqa: E402
from app.routers import dashboard, reports, notifications  # noqa: E402
from app.routers import bulk  # noqa: E402

app.include_router(drivers.router, prefix="/api/v1")

app.include_router(dispatches.router, prefix="/api/v1")
app.include_router(delivery.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(bulk.router, prefix="/api/v1")

from app.routers import expenses  # noqa: E402
app.include_router(expenses.router, prefix="/api/v1")

from app.routers import crm  # noqa: E402
app.include_router(crm.router, prefix="/api/v1")

from app.routers import cutting  # noqa: E402
app.include_router(cutting.router, prefix="/api/v1")

from app.routers import cutlist  # noqa: E402
app.include_router(cutlist.router, prefix="/api/v1")

from app.routers import elevation  # noqa: E402
app.include_router(elevation.router, prefix="/api/v1")

from app.routers import quotations  # noqa: E402
app.include_router(quotations.router, prefix="/api/v1")

from app.routers import client_portal  # noqa: E402
app.include_router(client_portal.router, prefix="/api/v1")

from app.routers import company  # noqa: E402
app.include_router(company.router, prefix="/api/v1")
