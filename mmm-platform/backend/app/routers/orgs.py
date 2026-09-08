from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.models import Organization, User
from app.schemas import OrganizationOut

router = APIRouter(prefix="/v1/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationOut])
async def list_organizations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # Organizations are not RLS-scoped in this scaffold (they carry no
    # client data); a user only ever sees their home org here.
    result = await db.execute(select(Organization).where(Organization.id == user.org_id))
    return result.scalars().all()
