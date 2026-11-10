import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.db.session import SessionLocal
from app.middleware.request_logging import PROCESS_TIME_HEADER, REQUEST_ID_HEADER, RequestLoggingMiddleware
from app.workers.reminder_worker import ReminderWorker

setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger("campusbite")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("%s starting up", settings.APP_NAME)
    worker = None
    if settings.REMINDER_WORKER_ENABLED:
        worker = ReminderWorker(SessionLocal, settings.REMINDER_CHECK_INTERVAL_SECONDS)
        worker.start()
    app.state.reminder_worker = worker
    yield
    if worker is not None:
        await worker.stop()
    logger.info("%s shutting down", settings.APP_NAME)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description="Restaurant ordering & delivery platform API (Customers, Restaurant Owners, Delivery Partners).",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Middleware added last runs first. CORS is outermost so even 500 responses carry CORS headers.
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # Retry-After must be exposed, or the browser hides it from the frontend on 429 responses.
        expose_headers=[REQUEST_ID_HEADER, PROCESS_TIME_HEADER, "Retry-After"],
    )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/", include_in_schema=False)
    def root():
        return {"name": settings.APP_NAME, "docs": "/docs", "health": f"{settings.API_V1_PREFIX}/health"}

    return app


app = create_app()
