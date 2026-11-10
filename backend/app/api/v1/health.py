import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import get_db, ping_database

router = APIRouter(tags=["System"])
logger = logging.getLogger(__name__)


@router.get("/health", summary="Liveness check with database ping")
def health(db: Session = Depends(get_db)):
    try:
        ping_database(db)
    except Exception:
        logger.exception("Health check: database unreachable")
        return JSONResponse(status_code=503, content={"status": "degraded", "db": "error"})
    return {"status": "ok", "db": "ok"}
