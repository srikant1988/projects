from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Runtime app connection MUST use the non-superuser role so Postgres RLS
    # is actually enforced (superusers and table owners bypass RLS).
    database_url: str = "postgresql+asyncpg://app_role:app_role@localhost:5432/mmm"
    # Migrations run as postgres so DDL (CREATE POLICY etc.) is permitted.
    migration_database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mmm"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8

    class Config:
        env_file = ".env"


settings = Settings()
