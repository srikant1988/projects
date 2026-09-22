"""Real ingestion, phase 1: stores the actual parsed values behind a data
source upload (`data_sources.data`) and the actual outcome/channel/control
arrays a dataset version was issued from (`dataset_versions.data`). Until
now, a validated DatasetVersion never carried real rows -- engine.fit()
always synthesized a panel from the spec's shape (see engine.py's module
docstring). When `dataset_versions.data` is present, engine.fit() now fits
against it directly instead of synthesizing.

Revision ID: 0010_real_ingestion
Revises: 0009_data_source_upload
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010_real_ingestion"
down_revision = "0009_data_source_upload"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "data_sources",
        sa.Column("data", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "dataset_versions",
        sa.Column("data", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("dataset_versions", "data")
    op.drop_column("data_sources", "data")
