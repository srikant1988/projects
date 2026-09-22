from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import require_org_admin
from app.models import User
from app.schemas import UserCreate, UserOut, UserUpdate
from app.security import hash_password

router = APIRouter(prefix="/v1/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    admin: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_session),
):
    # No RLS on users -- scope explicitly to the admin's own org so one
    # tenant's admin can never enumerate another tenant's accounts.
    result = await db.execute(select(User).where(User.org_id == admin.org_id).order_by(User.created_at))
    return result.scalars().all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    admin: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_session),
):
    new_user = User(
        org_id=admin.org_id,
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(new_user)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")
    return new_user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    admin: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(User).where(User.id == user_id, User.org_id == admin.org_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if body.display_name is not None:
        target.display_name = body.display_name
    if body.password:
        target.hashed_password = hash_password(body.password)
    await db.flush()
    return target


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    admin: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_session),
):
    if user_id == str(admin.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id, User.org_id == admin.org_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    await db.delete(target)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Revoke this user's access grants before deleting the account",
        )
