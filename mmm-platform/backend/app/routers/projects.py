from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.models import Project, User
from app.schemas import ProjectCreate, ProjectOut

router = APIRouter(prefix="/v1/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # RLS policy `projects_select` restricts this to projects under clients
    # the caller can see, minus any project-level exclusion.
    result = await db.execute(select(Project))
    return result.scalars().all()


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    project = Project(
        client_id=body.client_id,
        name=body.name,
        outcome_variable=body.outcome_variable,
        time_grain=body.time_grain,
    )
    db.add(project)
    try:
        await db.flush()
    except DBAPIError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to create a project on this client")
    return project
