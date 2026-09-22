import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MembershipOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    scope_type: str
    scope_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class MembershipCreate(BaseModel):
    user_id: uuid.UUID
    role: str
    scope_type: str
    scope_id: uuid.UUID


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    org_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str = ""


class UserUpdate(BaseModel):
    display_name: str | None = None
    password: str | None = None


class OrganizationOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class ClientOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    country: str | None = None
    logo_url: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ClientCreate(BaseModel):
    org_id: uuid.UUID
    name: str
    country: str | None = None
    logo_url: str | None = None


class ClientLookupResult(BaseModel):
    name: str
    domain: str | None = None
    logo_url: str | None = None
    country: str | None = None
    country_confidence: str  # "suggested" -- never treated as authoritative, see routers/clients.py


class ProjectOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    outcome_variable: str
    time_grain: str
    is_shared: bool
    share_token: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    client_id: uuid.UUID
    name: str
    outcome_variable: str = ""
    time_grain: str = "weekly"


class MeOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    org_id: uuid.UUID
    created_at: datetime
    # True when this user holds only 'client_viewer' grants -- no org/client/
    # project role that would ever let Model Studio or the internal Workspace
    # render. The frontend uses this to route straight to the client portal.
    client_only: bool
    # Project ids this user may see in the client portal: RLS-visible AND
    # explicitly shared by an admin -- being visible under RLS alone is not
    # enough, a project must be turned into a share link first.
    accessible_project_ids: list[uuid.UUID]

    class Config:
        from_attributes = True


class DataSourceOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    source_type: str
    status: str
    filename: str | None = None
    row_count: int | None = None
    column_count: int | None = None
    columns_preview: dict = {}
    created_at: datetime

    class Config:
        from_attributes = True


class DataSourceCreate(BaseModel):
    project_id: uuid.UUID
    name: str
    source_type: str


class DatasetVersionOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    label: str
    content_hash: str
    row_count: int
    channel_count: int
    control_count: int
    quality_report: dict
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChannelSpec(BaseModel):
    name: str
    min: float = 0.0
    max: float = 10.0


class DatasetVersionCreate(BaseModel):
    project_id: uuid.UUID
    label: str
    channels: list[ChannelSpec]
    controls: list[str] = []
    # When set, the dataset version is issued from this data source's real
    # parsed rows instead of being synthesized: outcome_column and each
    # channel's `name` / each control string must match a column header
    # exactly (as returned by GET /v1/data-sources/{id}).
    data_source_id: uuid.UUID | None = None
    outcome_column: str | None = None


class ModelSpecOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    version: int
    engine: str
    spec: dict
    created_at: datetime

    class Config:
        from_attributes = True


class ModelSpecCreate(BaseModel):
    project_id: uuid.UUID
    engine: str = "ridge"
    channels: list[ChannelSpec]
    controls: list[str] = []


class ModelRunOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    spec_id: uuid.UUID
    dataset_version_id: uuid.UUID
    status: str
    is_champion: bool
    holdout_mape: float | None
    r_squared: float | None
    diagnostics: dict
    contributions: dict
    response_curves: dict
    created_at: datetime

    class Config:
        from_attributes = True


class ModelRunCreate(BaseModel):
    spec_id: uuid.UUID
    dataset_version_id: uuid.UUID


class ScenarioOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    run_id: uuid.UUID
    name: str
    plan: dict
    results: dict
    created_at: datetime

    class Config:
        from_attributes = True


class ScenarioCreate(BaseModel):
    project_id: uuid.UUID
    run_id: uuid.UUID
    name: str


class ScenarioOptimize(BaseModel):
    total_budget: float
    bounds: dict[str, dict[str, float]] = {}
