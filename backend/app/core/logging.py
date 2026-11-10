import logging
import sys

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


def setup_logging(level: str = "INFO") -> None:
    """Configure root logging once for the whole application."""
    root = logging.getLogger()
    root.setLevel(level.upper())

    if not any(getattr(h, "_campusbite", False) for h in root.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        handler._campusbite = True  # type: ignore[attr-defined]
        root.addHandler(handler)

    # Our middleware logs every request, so silence uvicorn's duplicate access log.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
