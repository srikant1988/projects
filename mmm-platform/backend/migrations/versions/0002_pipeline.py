"""Model pipeline entities: DataSource, DatasetVersion, ModelSpec, ModelRun, Scenario.

All are project-scoped and reuse the existing project_visible()/project_insertable()
SECURITY DEFINER functions from 0001 for RLS -- no new policy logic needed since
a project's children inherit its visibility.

Revision ID: 0002_pipeline
Revises: 0001_init
Create Date: 2026-09-07
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0002_pipeline"
down_revision = "0001_init"
branch_labels = None
depends_on = None

PROJECT_SCOPED_TABLES = ["data_sources", "dataset_versions", "model_specs", "model_runs", "scenarios"]


def upgrade() -> None:
    op.create_table(
        "data_sources",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", pg.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(30), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "dataset_versions",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", pg.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("row_count", sa.Integer, server_default="0"),
        sa.Column("channel_count", sa.Integer, server_default="0"),
        sa.Column("control_count", sa.Integer, server_default="0"),
        sa.Column("quality_report", pg.JSONB, server_default="{}"),
        sa.Column("status", sa.String(30), server_default="validated"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "model_specs",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", pg.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("engine", sa.String(50), server_default="ridge"),
        sa.Column("spec", pg.JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "model_runs",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", pg.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("spec_id", pg.UUID(as_uuid=True), sa.ForeignKey("model_specs.id"), nullable=False),
        sa.Column("dataset_version_id", pg.UUID(as_uuid=True), sa.ForeignKey("dataset_versions.id"), nullable=False),
        sa.Column("status", sa.String(30), server_default="queued"),
        sa.Column("is_champion", sa.Boolean, server_default=sa.false()),
        sa.Column("holdout_mape", sa.Float, nullable=True),
        sa.Column("r_squared", sa.Float, nullable=True),
        sa.Column("diagnostics", pg.JSONB, server_default="{}"),
        sa.Column("contributions", pg.JSONB, server_default="{}"),
        sa.Column("response_curves", pg.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "scenarios",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", pg.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("run_id", pg.UUID(as_uuid=True), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("plan", pg.JSONB, server_default="{}"),
        sa.Column("results", pg.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    for table in PROJECT_SCOPED_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY {table}_select ON {table} FOR SELECT
            USING (project_visible(current_setting('app.user_id', true)::uuid, project_id))
            """
        )
        op.execute(
            f"""
            CREATE POLICY {table}_insert ON {table} FOR INSERT
            WITH CHECK (project_visible(current_setting('app.user_id', true)::uuid, project_id))
            """
        )
        op.execute(
            f"""
            CREATE POLICY {table}_update ON {table} FOR UPDATE
            USING (project_visible(current_setting('app.user_id', true)::uuid, project_id))
            WITH CHECK (project_visible(current_setting('app.user_id', true)::uuid, project_id))
            """
        )
        op.execute(f"GRANT SELECT, INSERT, UPDATE ON {table} TO app_role")


def downgrade() -> None:
    for table in reversed(PROJECT_SCOPED_TABLES):
        op.execute(f"DROP POLICY IF EXISTS {table}_update ON {table}")
        op.execute(f"DROP POLICY IF EXISTS {table}_insert ON {table}")
        op.execute(f"DROP POLICY IF EXISTS {table}_select ON {table}")
        op.drop_table(table)
