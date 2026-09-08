from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app import engine as fitting_engine
from app.database import get_session
from app.deps import get_current_user
from app.models import ModelRun, ModelSpec, User
from app.schemas import ModelRunCreate, ModelRunOut

router = APIRouter(prefix="/v1", tags=["model-runs"])


@router.get("/runs", response_model=list[ModelRunOut])
async def list_runs(
    project_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    stmt = select(ModelRun)
    if project_id:
        stmt = stmt.where(ModelRun.project_id == project_id)
    result = await db.execute(stmt.order_by(ModelRun.created_at.desc()))
    return result.scalars().all()


@router.get("/runs/{run_id}", response_model=ModelRunOut)
async def get_run(run_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(ModelRun).where(ModelRun.id == run_id))
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    return run


@router.post("/model-specs/{spec_id}/runs", response_model=ModelRunOut, status_code=status.HTTP_201_CREATED)
async def create_run(
    spec_id: str,
    body: ModelRunCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    spec_result = await db.execute(select(ModelSpec).where(ModelSpec.id == spec_id))
    spec = spec_result.scalar_one_or_none()
    if spec is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Model spec not found or not visible")

    run = ModelRun(
        project_id=spec.project_id,
        spec_id=spec.id,
        dataset_version_id=body.dataset_version_id,
        status="fitting",
    )
    db.add(run)
    try:
        await db.flush()
    except DBAPIError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to run this spec")

    # Synchronous fit -- the ridge/quick-fit engine is seconds, not the
    # 10-90 minutes a real Bayesian job would take (doc section 6.1), so
    # there's no queue/worker split needed yet.
    try:
        result = fitting_engine.fit(spec.spec, str(run.dataset_version_id))
    except ValueError as exc:
        run.status = "failed"
        run.diagnostics = {"error": str(exc)}
        await db.flush()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    run.status = result["status"]
    run.holdout_mape = result["holdout_mape"]
    run.r_squared = result["r_squared"]
    run.diagnostics = result["diagnostics"]
    run.contributions = result["contributions"]
    run.response_curves = result["response_curves"]
    await db.flush()
    return run


@router.post("/runs/{run_id}/promote", response_model=ModelRunOut)
async def promote_run(run_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(ModelRun).where(ModelRun.id == run_id))
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    if run.status != "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a run that passed all diagnostics can be promoted")

    # Champion is exclusive per project (doc section 6.4): demote the
    # incumbent in the same transaction as promoting this one.
    await db.execute(
        update(ModelRun).where(ModelRun.project_id == run.project_id, ModelRun.is_champion.is_(True)).values(is_champion=False)
    )
    run.is_champion = True
    await db.flush()
    return run


@router.get("/runs/{run_id}/response-curves/{channel}")
async def get_response_curve(
    run_id: str,
    channel: str,
    max_spend: float = 20.0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(ModelRun).where(ModelRun.id == run_id))
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    curve = run.response_curves.get(channel)
    if curve is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Channel not in this run")
    return fitting_engine.response_curve_points(
        curve["decay"], curve["half_saturation"], curve["coefficient"], max_spend
    )
