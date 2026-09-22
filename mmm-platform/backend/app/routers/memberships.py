from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import require_org_admin
from app.models import Client, Membership, Project, User
from app.schemas import MembershipCreate, MembershipOut

router = APIRouter(prefix="/v1/memberships", tags=["memberships"])

VALID_ROLES = {"super_admin", "org_admin", "client_lead", "analyst", "approver", "client_viewer", "excluded"}
VALID_SCOPE_TYPES = {"organization", "client", "project"}


@router.get("", response_model=list[MembershipOut])
async def list_memberships(
    admin: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_session),
):
    # Memberships carry no org_id column directly -- scope by joining out to
    # whichever scope the grant points at, restricted to this admin's org.
    org_scoped = select(Membership).where(Membership.scope_type == "organization", Membership.scope_id == admin.org_id)
    client_ids = select(Client.id).where(Client.org_id == admin.org_id)
    client_scoped = select(Membership).where(Membership.scope_type == "client", Membership.scope_id.in_(client_ids))
    project_ids = select(Project.id).join(Client, Project.client_id == Client.id).where(Client.org_id == admin.org_id)
    project_scoped = select(Membership).where(Membership.scope_type == "project", Membership.scope_id.in_(project_ids))

    results = []
    for stmt in (org_scoped, client_scoped, project_scoped):
        res = await db.execute(stmt)
        results.extend(res.scalars().all())
    return results


@router.post("", response_model=MembershipOut, status_code=status.HTTP_201_CREATED)
async def create_membership(
    body: MembershipCreate,
    admin: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_session),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"role must be one of {sorted(VALID_ROLES)}")
    if body.scope_type not in VALID_SCOPE_TYPES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"scope_type must be one of {sorted(VALID_SCOPE_TYPES)}")

    # Confirm the scope actually belongs to this admin's org before granting
    # into it -- otherwise an org_admin could hand out access to a tenant
    # they don't administer.
    if body.scope_type == "organization" and body.scope_id != admin.org_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot grant organization scope outside your own org")
    if body.scope_type == "client":
        res = await db.execute(select(Client).where(Client.id == body.scope_id, Client.org_id == admin.org_id))
        if res.scalar_one_or_none() is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found in your org")
    if body.scope_type == "project":
        res = await db.execute(
            select(Project).join(Client, Project.client_id == Client.id).where(
                Project.id == body.scope_id, Client.org_id == admin.org_id
            )
        )
        if res.scalar_one_or_none() is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found in your org")

    target = await db.execute(select(User).where(User.id == body.user_id, User.org_id == admin.org_id))
    if target.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found in your org")

    membership = Membership(user_id=body.user_id, role=body.role, scope_type=body.scope_type, scope_id=body.scope_id)
    db.add(membership)
    await db.flush()
    return membership


@router.delete("/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_membership(
    membership_id: str,
    admin: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(Membership).where(Membership.id == membership_id))
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")

    # Re-derive that this grant is actually within the admin's org (same
    # scoping logic as list_memberships) before allowing the revoke.
    in_org = False
    if membership.scope_type == "organization" and membership.scope_id == admin.org_id:
        in_org = True
    elif membership.scope_type == "client":
        res = await db.execute(select(Client).where(Client.id == membership.scope_id, Client.org_id == admin.org_id))
        in_org = res.scalar_one_or_none() is not None
    elif membership.scope_type == "project":
        res = await db.execute(
            select(Project).join(Client, Project.client_id == Client.id).where(
                Project.id == membership.scope_id, Client.org_id == admin.org_id
            )
        )
        in_org = res.scalar_one_or_none() is not None
    if not in_org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")

    await db.delete(membership)
