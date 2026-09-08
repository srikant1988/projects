from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.models import ModelSpec, User
from app.schemas import ModelSpecCreate, ModelSpecOut

router = APIRouter(prefix="/v1/model-specs", tags=["model-specs"])


@router.get("", response_model=list[ModelSpecOut])
async def list_model_specs(
    project_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    stmt = select(ModelSpec)
    if project_id:
        stmt = stmt.where(ModelSpec.project_id == project_id)
    result = await db.execute(stmt.order_by(ModelSpec.version))
    return result.scalars().all()


@router.post("", response_model=ModelSpecOut, status_code=status.HTTP_201_CREATED)
async def create_model_spec(
    body: ModelSpecCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    existing = await db.execute(
        select(func.max(ModelSpec.version)).where(ModelSpec.project_id == body.project_id)
    )
    next_version = (existing.scalar() or 0) + 1

    spec = ModelSpec(
        project_id=body.project_id,
        version=next_version,
        engine=body.engine,
        spec={"channels": [c.model_dump() for c in body.channels], "controls": body.controls},
    )
    db.add(spec)
    try:
        await db.flush()
    except DBAPIError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to create a model spec for this project")
    return spec
