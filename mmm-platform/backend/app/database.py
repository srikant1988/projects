from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_session():
    """Yields a session bound to a single transaction. The caller is
    responsible for calling `set_tenant_context` before running any
    tenant-scoped query, otherwise RLS policies deny all rows."""
    async with SessionLocal() as session:
        async with session.begin():
            yield session
