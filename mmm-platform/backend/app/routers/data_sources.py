from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app import file_parse
from app.database import get_session
from app.deps import get_current_user
from app.models import DataSource, User
from app.schemas import DataSourceCreate, DataSourceOut

router = APIRouter(prefix="/v1/data-sources", tags=["data-sources"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB -- generous for a spec-driven MMM input file


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


@router.post("/{data_source_id}/upload", response_model=DataSourceOut)
async def upload_data_source_file(
    data_source_id: str,
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(DataSource).where(DataSource.id == data_source_id))
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Data source not found")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File exceeds the 20 MB limit")

    try:
        parsed = file_parse.parse_upload(file.filename or "upload", content)
    except file_parse.ParseError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    ds.filename = file.filename
    ds.row_count = parsed["row_count"]
    ds.column_count = len(parsed["columns"])
    ds.columns_preview = {"columns": parsed["columns"][:60]}
    ds.data = {"columns": parsed["columns"], "rows": parsed["rows"]}
    ds.status = "valid" if parsed["row_count"] > 0 else "warn"
    try:
        await db.flush()
    except DBAPIError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to update this data source")
    return ds
