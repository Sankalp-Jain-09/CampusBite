"""Block until the database accepts connections (or give up after a timeout)."""
import os
import sys
import time

from sqlalchemy import create_engine, text

TIMEOUT_SECONDS = int(os.getenv("DB_WAIT_TIMEOUT", "60"))


def main() -> int:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("wait_for_db: DATABASE_URL is not set", file=sys.stderr)
        return 1

    engine = create_engine(url, pool_pre_ping=True)
    deadline = time.monotonic() + TIMEOUT_SECONDS
    attempt = 0
    while True:
        attempt += 1
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"wait_for_db: database is ready (attempt {attempt})")
            return 0
        except Exception as exc:  # noqa: BLE001
            if time.monotonic() >= deadline:
                print(f"wait_for_db: gave up after {TIMEOUT_SECONDS}s: {exc}", file=sys.stderr)
                return 1
            print(f"wait_for_db: not ready yet (attempt {attempt}), retrying in 2s...")
            time.sleep(2)


if __name__ == "__main__":
    sys.exit(main())
