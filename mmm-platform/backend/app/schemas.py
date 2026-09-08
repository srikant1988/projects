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
    role: str
    scope_type: str
    scope_id: uuid.UUID

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    org_id: uuid.UUID

    class Config:
        from_attributes = True


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
    created_at: datetime

    class Config:
        from_attributes = True


class ClientCreate(BaseModel):
    org_id: uuid.UUID
    name: str


class ProjectOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    outcome_variable: str
    time_grain: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    client_id: uuid.UUID
    name: str
    outcome_variable: str = ""
    time_grain: str = "weekly"


class DataSourceOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    source_type: str
    status: str
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
