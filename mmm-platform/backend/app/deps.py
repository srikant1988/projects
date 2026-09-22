import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Membership, User
from app.security import decode_access_token

ADMIN_ROLES = ("super_admin", "org_admin")

bearer_scheme = HTTPBearer(auto_error=False)


async def set_tenant_context(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Binds the authenticated user to the current Postgres transaction.
    RLS policies on clients/projects read this via current_setting('app.user_id').
    `true` makes it transaction-local so it can never leak to a pooled connection
    reused by a different request."""
    await db.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(user_id)})


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_session),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    await set_tenant_context(db, uuid.UUID(user_id))

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


async def require_org_admin(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> User:
    """User and access-level management is org_admin/super_admin only.
    Deliberately checked in application code, not RLS: the users/memberships
    tables carry no RLS policies (see 0001_init.py), so this is the only
    enforcement point for who may manage accounts."""
    result = await db.execute(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.scope_type == "organization",
            Membership.scope_id == user.org_id,
            Membership.role.in_(ADMIN_ROLES),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requires org_admin or super_admin")
    return user
