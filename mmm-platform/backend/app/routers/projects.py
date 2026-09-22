import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user, require_org_admin
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


@router.get("/by-token/{token}", response_model=ProjectOut)
async def get_project_by_token(
    token: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # RLS still applies: this only resolves the project if the logged-in
    # user can already see it. A share link is a shortcut into the app,
    # not a bypass of who's allowed to see what.
    result = await db.execute(
        select(Project).where(Project.share_token == token, Project.is_shared.is_(True))
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No shared project for this link")
    return project


@router.post("/{project_id}/share", response_model=ProjectOut)
async def share_project(
    project_id: str,
    user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_session),
):
    """Turns on the client-facing share link for this project. Idempotent:
    calling it again reuses the existing token instead of rotating it, so a
    link already handed to a client keeps working."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if not project.share_token:
        project.share_token = secrets.token_urlsafe(24)
    project.is_shared = True
    await db.flush()
    return project


@router.post("/{project_id}/unshare", response_model=ProjectOut)
async def unshare_project(
    project_id: str,
    user: User = Depends(require_org_admin),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    project.is_shared = False
    await db.flush()
    return project
