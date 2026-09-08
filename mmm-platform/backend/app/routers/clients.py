from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import get_current_user
from app.models import Client, User
from app.schemas import ClientCreate, ClientOut

router = APIRouter(prefix="/v1/clients", tags=["clients"])


@router.get("", response_model=list[ClientOut])
async def list_clients(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # No application-level tenant filter here on purpose: Postgres RLS
    # (policy `clients_select`) is what actually restricts the rows that
    # come back for this session. This is the enforcement layer, not a
    # convenience filter -- see architecture doc section 8.3.
    result = await db.execute(select(Client))
    return result.scalars().all()


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    client = Client(org_id=body.org_id, name=body.name)
    db.add(client)
    try:
        await db.flush()
    except DBAPIError:
        # RLS WITH CHECK on the insert policy rejected the row.
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to create a client in this organization")
    return client
