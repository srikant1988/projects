"""Adds a client-shareable link to projects: `is_shared` + a unique
`share_token`. An admin turns this on from the Publish step; the generated
URL is the portal a client logs into and, per the RLS-enforced visibility
rules, can only ever land on their own permitted, shared projects --
Model Studio is never reachable from that portal (enforced in the frontend
route split, not here).

Revision ID: 0006_project_share_link
Revises: 0005_fix_self_referential_rls
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_project_share_link"
down_revision = "0005_fix_self_referential_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("projects", sa.Column("share_token", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_projects_share_token", "projects", ["share_token"])


def downgrade() -> None:
    op.drop_constraint("uq_projects_share_token", "projects", type_="unique")
    op.drop_column("projects", "share_token")
    op.drop_column("projects", "is_shared")
