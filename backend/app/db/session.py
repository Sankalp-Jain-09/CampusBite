from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def enable_sqlite_foreign_keys(engine: Engine) -> None:
    """SQLite ignores foreign keys unless asked; turn them on (used for local runs and tests)."""

    @event.listens_for(engine, "connect")
    def _set_pragma(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)
if _is_sqlite:
    enable_sqlite_foreign_keys(engine)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one database session per request, always closed afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session_factory() -> sessionmaker:
    """Dependency returning the session factory, for work that outlives the request (background tasks).
    Tests override it to point at the test database."""
    return SessionLocal


def ping_database(db: Session) -> bool:
    """Run a trivial raw SQL query to confirm the database is reachable."""
    db.execute(text("SELECT 1"))
    return True
