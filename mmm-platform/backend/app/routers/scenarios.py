from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app import engine as fitting_engine
from app.engine import N_WEEKS
from app.database import get_session
from app.deps import get_current_user
from app.models import ModelRun, Scenario, User
from app.schemas import ScenarioCreate, ScenarioOptimize, ScenarioOut

router = APIRouter(prefix="/v1", tags=["scenarios"])


@router.get("/scenarios", response_model=list[ScenarioOut])
async def list_scenarios(
    project_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    stmt = select(Scenario)
    if project_id:
        stmt = stmt.where(Scenario.project_id == project_id)
    result = await db.execute(stmt.order_by(Scenario.created_at.desc()))
    return result.scalars().all()


@router.post("/projects/{project_id}/scenarios", response_model=ScenarioOut, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    project_id: str,
    body: ScenarioCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    run_result = await db.execute(select(ModelRun).where(ModelRun.id == body.run_id))
    run = run_result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found or not visible")

    # Cheap by design (doc section 7): evaluate the stored response curves,
    # never refit. Response curves are calibrated on weekly spend (the same
    # scale as a spec's channel min/max), but contributions.spend is the
    # *cumulative* total over all N_WEEKS -- divide back down so the
    # baseline plan lands in the units the curve and optimizer expect.
    plan = {name: round(c["spend"] / N_WEEKS, 3) for name, c in run.contributions.items()}
    scenario = Scenario(project_id=project_id, run_id=run.id, name=body.name, plan=plan, results={})
    db.add(scenario)
    try:
        await db.flush()
    except DBAPIError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to create a scenario on this project")
    return scenario


def _evaluate(response_curves: dict, plan: dict) -> dict:
    per_channel = {}
    total_spend, total_revenue = 0.0, 0.0
    for name, spend in plan.items():
        curve = response_curves.get(name)
        if curve is None:
            continue
        sat = spend / (spend + curve["half_saturation"]) if spend > 0 else 0
        revenue = curve["coefficient"] * sat * 20
        per_channel[name] = {"spend": round(spend, 2), "revenue": round(revenue, 2)}
        total_spend += spend
        total_revenue += revenue
    roi = round(total_revenue / total_spend, 3) if total_spend > 0 else 0
    return {
        "total_spend": round(total_spend, 2),
        "total_revenue": round(total_revenue, 2),
        "roi": roi,
        "per_channel": per_channel,
    }


@router.post("/scenarios/{scenario_id}/evaluate", response_model=ScenarioOut)
async def evaluate_scenario(
    scenario_id: str,
    plan: dict[str, float],
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    scn_result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = scn_result.scalar_one_or_none()
    if scenario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scenario not found")
    run_result = await db.execute(select(ModelRun).where(ModelRun.id == scenario.run_id))
    run = run_result.scalar_one()

    scenario.plan = plan
    scenario.results = _evaluate(run.response_curves, plan)
    await db.flush()
    return scenario


@router.post("/scenarios/{scenario_id}/optimize", response_model=ScenarioOut)
async def optimize_scenario(
    scenario_id: str,
    body: ScenarioOptimize,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    scn_result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = scn_result.scalar_one_or_none()
    if scenario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scenario not found")
    run_result = await db.execute(select(ModelRun).where(ModelRun.id == scenario.run_id))
    run = run_result.scalar_one()

    alloc = fitting_engine.optimize_allocation(run.response_curves, body.total_budget, body.bounds)
    scenario.plan = alloc
    scenario.results = _evaluate(run.response_curves, alloc)
    await db.flush()
    return scenario
