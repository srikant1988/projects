"""Add nullable country and logo_url to clients, for the "Add client" lookup feature.

Revision ID: 0004_client_logo_country
Revises: 0003_super_admin_role
Create Date: 2026-09-22
"""
import sqlalchemy as sa
from alembic import op

revision = "0004_client_logo_country"
down_revision = "0003_super_admin_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("country", sa.String(120), nullable=True))
    op.add_column("clients", sa.Column("logo_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("clients", "logo_url")
    op.drop_column("clients", "country")
