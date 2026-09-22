from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.models import Membership, Project, User
from app.schemas import MembershipOut, MeOut

router = APIRouter(prefix="/v1/me", tags=["me"])

# Roles that grant any foothold in Model Studio or the internal Workspace.
# A user whose memberships are *entirely* outside this set (i.e. only ever
# 'client_viewer') gets routed to the read-only client portal instead.
INTERNAL_ROLES = {"super_admin", "org_admin", "client_lead", "analyst", "approver"}


@router.get("", response_model=MeOut)
async def read_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    memberships = (
        (await db.execute(select(Membership).where(Membership.user_id == user.id)))
        .scalars()
        .all()
    )
    has_internal_role = any(m.role in INTERNAL_ROLES for m in memberships)
    has_client_viewer = any(m.role == "client_viewer" for m in memberships)
    client_only = has_client_viewer and not has_internal_role

    accessible_project_ids: list = []
    if client_only:
        # RLS on `projects` already restricts this to what the user can see;
        # we additionally require is_shared, since a client should only ever
        # land on a project an admin explicitly turned into a share link.
        projects = (await db.execute(select(Project).where(Project.is_shared.is_(True)))).scalars().all()
        accessible_project_ids = [p.id for p in projects]

    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        org_id=user.org_id,
        created_at=user.created_at,
        client_only=client_only,
        accessible_project_ids=accessible_project_ids,
    )


@router.get("/memberships", response_model=list[MembershipOut])
async def read_my_memberships(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(Membership).where(Membership.user_id == user.id))
    return result.scalars().all()
