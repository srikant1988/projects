from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.models import DataSource, User
from app.schemas import DataSourceCreate, DataSourceOut

router = APIRouter(prefix="/v1/data-sources", tags=["data-sources"])


@router.get("", response_model=list[DataSourceOut])
async def list_data_sources(
    project_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    stmt = select(DataSource)
    if project_id:
        stmt = stmt.where(DataSource.project_id == project_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=DataSourceOut, status_code=status.HTTP_201_CREATED)
async def create_data_source(
    body: DataSourceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    ds = DataSource(project_id=body.project_id, name=body.name, source_type=body.source_type, status="valid")
    db.add(ds)
    try:
        await db.flush()
    except DBAPIError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to add a data source to this project")
    return ds
