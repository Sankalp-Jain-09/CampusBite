import logging
import time
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger("campusbite.request")

REQUEST_ID_HEADER = "X-Request-ID"
PROCESS_TIME_HEADER = "X-Process-Time"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs method, path, status and duration for every request.

    - Generates (or propagates) an X-Request-ID and exposes it on `request.state.request_id`.
    - Adds an X-Process-Time header (milliseconds).
    - Converts unhandled exceptions into a clean 500 JSON response, logging the stack trace.
    Request bodies and the Authorization header are never logged.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        request.state.request_id = request_id
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "%s %s 500 %.2fms request_id=%s",
                request.method, request.url.path, duration_ms, request_id,
            )
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
            )
            response.headers[REQUEST_ID_HEADER] = request_id
            response.headers[PROCESS_TIME_HEADER] = f"{duration_ms:.2f}"
            return response

        duration_ms = (time.perf_counter() - start) * 1000
        response.headers[REQUEST_ID_HEADER] = request_id
        response.headers[PROCESS_TIME_HEADER] = f"{duration_ms:.2f}"
        logger.info(
            "%s %s %s %.2fms request_id=%s",
            request.method, request.url.path, response.status_code, duration_ms, request_id,
        )
        return response
