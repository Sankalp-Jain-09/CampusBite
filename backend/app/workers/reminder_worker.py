"""Periodic background task: scan for stale orders every REMINDER_CHECK_INTERVAL_SECONDS.

Started and stopped by the FastAPI lifespan (app/main.py). Runs in-process, so it assumes a
single backend replica (documented limitation); the scan itself is idempotent.
"""
import asyncio
import logging
from typing import Callable, Optional

from starlette.concurrency import run_in_threadpool

from app.services import reminder_service

logger = logging.getLogger(__name__)


class ReminderWorker:
    def __init__(self, session_factory: Callable, interval_seconds: float):
        self._session_factory = session_factory
        self._interval = interval_seconds
        self._stop = asyncio.Event()
        self._task: Optional[asyncio.Task] = None
        self.runs = 0

    async def _loop(self) -> None:
        logger.info("Reminder worker started (every %ss)", self._interval)
        while not self._stop.is_set():
            try:
                # The DB work is synchronous; run it off the event loop.
                await run_in_threadpool(reminder_service.scan_with_factory, self._session_factory)
                self.runs += 1
            except Exception:  # never let the loop die
                logger.exception("Reminder worker iteration failed")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                pass
        logger.info("Reminder worker stopped")

    def start(self) -> None:
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            await self._task
