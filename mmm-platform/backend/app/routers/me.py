from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.models import Membership, User
from app.schemas import MembershipOut, UserOut

router = APIRouter(prefix="/v1/me", tags=["me"])


@router.get("", response_model=UserOut)
async def read_me(user: User = Depends(get_current_user)):
    return user


@router.get("/memberships", response_model=list[MembershipOut])
async def read_my_memberships(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(Membership).where(Membership.user_id == user.id))
    return result.scalars().all()
