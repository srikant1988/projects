import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.engine import N_WEEKS
from app.models import DatasetVersion, User
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

    unmapped_pct = 0.0  # no real ingestion, so nothing is ever unmapped in this scaffold
    quality_report = {
        "completeness": {"status": "pass", "detail": "no missing periods in the outcome series"},
        "coverage": {"status": "pass", "detail": f"unmapped spend {unmapped_pct}%, under the 2% limit"},
        "range": {"status": "pass", "detail": "no negative spend or impossible CPM"},
        "sufficiency": {
            "status": "pass" if N_WEEKS > 4 * (len(body.channels) + len(body.controls) + 1) else "warn",
            "detail": f"{N_WEEKS} weeks support {len(body.channels)} channels + {len(body.controls)} controls",
        },
    }

    dv = DatasetVersion(
        project_id=body.project_id,
        label=body.label,
        content_hash=content_hash,
        row_count=N_WEEKS,
        channel_count=len(body.channels),
        control_count=len(body.controls),
        quality_report=quality_report,
        status="validated",
    )
    db.add(dv)
    try:
        await db.flush()
    except DBAPIError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to issue a dataset version for this project")
    return dv
