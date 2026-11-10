from datetime import timedelta
from typing import Any, Dict, Optional

import bcrypt
import jwt

from app.core.config import settings
from app.db.types import utcnow


class TokenError(Exception):
    """Raised when a JWT is missing, malformed, tampered with or expired."""


# ---------- Passwords (bcrypt used directly; passlib is incompatible with bcrypt 4.x) ----------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# Used to spend the same bcrypt time when the email does not exist (avoids user enumeration by timing).
DUMMY_PASSWORD_HASH = hash_password("campusbite-dummy-password")


# ---------- JWT ----------

def create_access_token(user_id: int, role: str, expires_delta: Optional[timedelta] = None) -> str:
    now = utcnow()
    expire = now + (expires_delta if expires_delta is not None
                    else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": str(user_id), "role": role, "iat": now, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
