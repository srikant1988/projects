"""projects had no UPDATE policy at all, so RLS default-denied every UPDATE
(discovered via the new share-link endpoint: `UPDATE ... WHERE id = :id`
matched 0 rows for a project the caller could SELECT just fine). Admin-ness
itself is still enforced in the application layer (require_org_admin on the
share/unshare routes); this policy only re-applies the same visibility rule
already used for SELECT, so an UPDATE can't succeed on a project outside
what the caller could see in the first place.

Revision ID: 0008_projects_update_policy
Revises: 0007_project_scope_vis
Create Date: 2026-09-22
"""
from alembic import op

revision = "0008_projects_update_policy"
down_revision = "0007_project_scope_vis"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP POLICY IF EXISTS projects_update ON projects")
    op.execute(
        """
        CREATE POLICY projects_update ON projects FOR UPDATE
        USING (project_visible_row(current_setting('app.user_id', true)::uuid, id, client_id))
        WITH CHECK (project_visible_row(current_setting('app.user_id', true)::uuid, id, client_id))
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS projects_update ON projects")
