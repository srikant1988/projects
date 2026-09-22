"""Adds real file-upload metadata to data_sources: filename, row_count,
column_count, and a columns_preview (the header row). The "Add source"
modal's Excel/CSV flow previously had a "Choose file..." button that did
nothing -- this backs it with a real endpoint that parses the uploaded
file and stores what it actually found, rather than a fabricated preview.

Revision ID: 0009_data_source_upload
Revises: 0008_projects_update_policy
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009_data_source_upload"
down_revision = "0008_projects_update_policy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("data_sources", sa.Column("filename", sa.String(255), nullable=True))
    op.add_column("data_sources", sa.Column("row_count", sa.Integer(), nullable=True))
    op.add_column("data_sources", sa.Column("column_count", sa.Integer(), nullable=True))
    op.add_column(
        "data_sources",
        sa.Column("columns_preview", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("data_sources", "columns_preview")
    op.drop_column("data_sources", "column_count")
    op.drop_column("data_sources", "row_count")
    op.drop_column("data_sources", "filename")
