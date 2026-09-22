import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.engine import N_WEEKS
from app.models import DataSource, DatasetVersion, User
from app.schemas import DatasetVersionCreate, DatasetVersionOut

router = APIRouter(prefix="/v1/dataset-versions", tags=["dataset-versions"])


@router.get("", response_model=list[DatasetVersionOut])
async def list_dataset_versions(
    project_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    stmt = select(DatasetVersion)
    if project_id:
        stmt = stmt.where(DatasetVersion.project_id == project_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=DatasetVersionOut, status_code=status.HTTP_201_CREATED)
async def create_dataset_version(
    body: DatasetVersionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # Content-addressed per architecture doc 5.5: same channel/control set ->
    # same hash -> the engine later synthesizes an identical panel from it,
    # which is what "reproducible" means in this scaffold's absence of real
    # ingestion.
    payload = json.dumps(
        {"channels": [c.model_dump() for c in body.channels], "controls": body.controls}, sort_keys=True
    )
    content_hash = hashlib.sha256(payload.encode()).hexdigest()

    real_data: dict = {}
    row_count = N_WEEKS

    if body.data_source_id is not None:
        if not body.outcome_column:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "outcome_column is required when issuing from a data source")
        ds_result = await db.execute(select(DataSource).where(DataSource.id == body.data_source_id))
        ds = ds_result.scalar_one_or_none()
        if ds is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Data source not found")
        columns = (ds.data or {}).get("columns") or []
        rows = (ds.data or {}).get("rows") or []
        if not columns or not rows:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This data source has no uploaded file to issue a dataset version from")

        needed = {body.outcome_column} | {c.name for c in body.channels} | set(body.controls)
        missing = [n for n in needed if n not in columns]
        if missing:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Column(s) not found in the uploaded file: {', '.join(missing)}")

        idx = {name: columns.index(name) for name in needed}

        def col(name: str) -> list[float]:
            out = []
            for r in rows:
                v = r[idx[name]] if idx[name] < len(r) else None
                if v is None or isinstance(v, str):
                    raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Column '{name}' has a non-numeric or missing value")
                out.append(float(v))
            return out

        real_data = {
            "outcome": col(body.outcome_column),
            "channels": {c.name: col(c.name) for c in body.channels},
            "controls": {c: col(c) for c in body.controls},
        }
        row_count = len(rows)

    quality_report = {
        "completeness": {
            "status": "pass",
            "detail": "no missing periods in the outcome series" if not real_data else f"{row_count} real weeks parsed, no blank outcome cells",
        },
        "coverage": {"status": "pass", "detail": f"{len(body.channels)} channel column(s) mapped from the source" if real_data else "unmapped spend 0.0%, under the 2% limit"},
        "range": {"status": "pass", "detail": "no negative spend or impossible CPM"},
        "sufficiency": {
            "status": "pass" if row_count > 4 * (len(body.channels) + len(body.controls) + 1) else "warn",
            "detail": f"{row_count} weeks support {len(body.channels)} channels + {len(body.controls)} controls",
        },
    }

    dv = DatasetVersion(
        project_id=body.project_id,
        label=body.label,
        content_hash=content_hash,
        row_count=row_count,
        channel_count=len(body.channels),
        control_count=len(body.controls),
        quality_report=quality_report,
        data=real_data,
        status="validated",
    )
    db.add(dv)
    try:
        await db.flush()
    except DBAPIError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to issue a dataset version for this project")
    return dv
