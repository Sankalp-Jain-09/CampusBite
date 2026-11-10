from typing import Callable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from typing_extensions import Annotated

from app.core.security import TokenError, decode_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False, description="Paste the access_token from /auth/login")

DbSession = Annotated[Session, Depends(get_db)]


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    db: DbSession,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> User:
    """Authenticate the request from its Bearer token.

    The user (and therefore the role) is always re-loaded from the database:
    a token for a deleted or deactivated user stops working immediately.
    """
    if credentials is None or not credentials.credentials:
        raise _unauthorized()

    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (TokenError, KeyError, ValueError):
        raise _unauthorized("Invalid or expired token")

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _unauthorized("Invalid or expired token")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole) -> Callable[..., User]:
    """Dependency factory: allow the request only if the user has one of `roles` (else 403)."""

    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return checker


# Shared instances: using the same callable lets FastAPI run each check only once per request,
# even when it is applied both on a router and on a route.
customer_required = require_roles(UserRole.CUSTOMER)
owner_required = require_roles(UserRole.RESTAURANT_OWNER)
delivery_partner_required = require_roles(UserRole.DELIVERY_PARTNER)

CurrentCustomer = Annotated[User, Depends(customer_required)]
CurrentOwner = Annotated[User, Depends(owner_required)]
CurrentDeliveryPartner = Annotated[User, Depends(delivery_partner_required)]
