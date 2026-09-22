import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def uuid_pk():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    clients: Mapped[list["Client"]] = relationship(back_populates="organization")


class Client(Base):
    """A client/brand workspace. Hard permission boundary per the domain model."""
    __tablename__ = "clients"
    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country: Mapped[str | None] = mapped_column(String(120), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped["Organization"] = relationship(back_populates="clients")
    projects: Mapped[list["Project"]] = relationship(back_populates="client")


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[uuid.UUID] = uuid_pk()
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    outcome_variable: Mapped[str] = mapped_column(String(200), default="")
    time_grain: Mapped[str] = mapped_column(String(50), default="weekly")
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    share_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client: Mapped["Client"] = relationship(back_populates="projects")


class DataSource(Base):
    __tablename__ = "data_sources"
    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # excel | database | lake
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending | valid | warn
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    column_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    columns_preview: Mapped[dict] = mapped_column(JSONB, default=dict)  # {"columns": [...]} -- first row's headers
    data: Mapped[dict] = mapped_column(JSONB, default=dict)  # {"columns": [...], "rows": [[...], ...]} -- full parsed values
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DatasetVersion(Base):
    """Immutable once validated -- callers never update a row, only insert a new one."""
    __tablename__ = "dataset_versions"
    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    channel_count: Mapped[int] = mapped_column(Integer, default=0)
    control_count: Mapped[int] = mapped_column(Integer, default=0)
    quality_report: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="validated")  # validated | failed
    data: Mapped[dict] = mapped_column(JSONB, default=dict)  # {"outcome": [...], "channels": {name: [...]}, "controls": {name: [...]}}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ModelSpec(Base):
    """A versioned, serializable modeling contract -- stored as JSONB, not columns."""
    __tablename__ = "model_specs"
    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    engine: Mapped[str] = mapped_column(String(50), default="ridge")  # ridge | bayesian
    spec: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {channels:[{name,min,max}], controls:[...]}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ModelRun(Base):
    __tablename__ = "model_runs"
    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    spec_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("model_specs.id"), nullable=False)
    dataset_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dataset_versions.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="queued")  # queued|fitting|completed|failed|failed_diagnostics
    is_champion: Mapped[bool] = mapped_column(Boolean, default=False)
    holdout_mape: Mapped[float] = mapped_column(Float, nullable=True)
    r_squared: Mapped[float] = mapped_column(Float, nullable=True)
    diagnostics: Mapped[dict] = mapped_column(JSONB, default=dict)
    contributions: Mapped[dict] = mapped_column(JSONB, default=dict)  # {channel: {spend, revenue, coef}}
    response_curves: Mapped[dict] = mapped_column(JSONB, default=dict)  # {channel: {k, scale}} saturation params
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("model_runs.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    plan: Mapped[dict] = mapped_column(JSONB, default=dict)  # {channel: spend}
    results: Mapped[dict] = mapped_column(JSONB, default=dict)  # {revenue, roi, per_channel}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = uuid_pk()
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Membership(Base):
    """A permission grant tuple: (user, role, scope_type, scope_id).

    scope_type is one of 'organization' | 'client' | 'project'.
    role 'excluded' on a client scope is the un-overridable competitor wall:
    it always wins over any broader org-level grant for that client.
    """
    __tablename__ = "memberships"
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    scope_type: Mapped[str] = mapped_column(String(20), nullable=False)
    scope_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
