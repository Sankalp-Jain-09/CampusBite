from fastapi import APIRouter

from app.main import create_app


def test_health_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


def test_middleware_adds_request_id_and_timing_headers(client):
    response = client.get("/api/v1/health")
    assert response.headers.get("X-Request-ID")
    assert float(response.headers["X-Process-Time"]) >= 0


def test_middleware_propagates_incoming_request_id(client):
    response = client.get("/api/v1/health", headers={"X-Request-ID": "abc123"})
    assert response.headers["X-Request-ID"] == "abc123"


def test_unhandled_exception_returns_clean_500():
    from fastapi.testclient import TestClient

    app = create_app()
    router = APIRouter()

    @router.get("/boom")
    def boom():
        raise RuntimeError("kaboom")

    app.include_router(router)
    with TestClient(app, raise_server_exceptions=False) as c:
        response = c.get("/boom")

    assert response.status_code == 500
    body = response.json()
    assert body["detail"] == "Internal server error"
    assert "kaboom" not in response.text
    assert response.headers["X-Request-ID"] == body["request_id"]


def test_cors_exposes_retry_after_for_rate_limit_messages(client):
    """The browser only lets the frontend read Retry-After (429 → "try again in N seconds") if CORS exposes it."""
    r = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    exposed = [h.strip().lower() for h in r.headers["access-control-expose-headers"].split(",")]
    assert "retry-after" in exposed
    assert "x-request-id" in exposed
