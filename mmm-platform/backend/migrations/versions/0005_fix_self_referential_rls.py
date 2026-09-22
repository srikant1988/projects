"""Fix clients/projects SELECT policies: they self-referentially look up
their own table by id (client_visible(uid, id) does
`SELECT org_id FROM clients WHERE id = p_client`). Postgres evaluates the
SELECT policy for INSERT...RETURNING using a snapshot that can't see the
row the very same INSERT command is still producing, so the self-lookup
returns NULL and access is wrongly denied -- every client/project ever
created via the API (not the direct-SQL seed script) has hit this.

Fix: give clients_select/projects_select policies a version of the check
that reads the needed column (org_id / client_id) directly off the row
instead of re-querying the table for it. No self-lookup, no RETURNING bug.
client_visible()/project_visible() themselves are untouched -- still used,
safely, for cross-table lookups (e.g. project_insertable looking up an
*existing* client).

Revision ID: 0005_fix_self_referential_rls
Revises: 0004_client_logo_country
Create Date: 2026-09-22
"""
from alembic import op

revision = "0005_fix_self_referential_rls"
down_revision = "0004_client_logo_country"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION client_visible_row(p_user uuid, p_client uuid, p_org uuid)
        RETURNS boolean AS $$
        BEGIN
          IF p_org IS NULL THEN
            RETURN false;
          END IF;

          IF EXISTS (
            SELECT 1 FROM memberships
            WHERE user_id = p_user AND scope_type = 'client' AND scope_id = p_client AND role = 'excluded'
          ) THEN
            RETURN false;
          END IF;

          RETURN EXISTS (
            SELECT 1 FROM memberships
            WHERE user_id = p_user
              AND (
                (scope_type = 'organization' AND scope_id = p_org)
                OR (scope_type = 'client' AND scope_id = p_client)
              )
          );
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION project_visible_row(p_user uuid, p_project uuid, p_client uuid)
        RETURNS boolean AS $$
        BEGIN
          IF p_client IS NULL OR NOT client_visible(p_user, p_client) THEN
            RETURN false;
          END IF;

          IF EXISTS (
            SELECT 1 FROM memberships
            WHERE user_id = p_user AND scope_type = 'project' AND scope_id = p_project AND role = 'excluded'
          ) THEN
            RETURN false;
          END IF;

          RETURN true;
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
        """
    )

    for fn in ("client_visible_row(uuid, uuid, uuid)", "project_visible_row(uuid, uuid, uuid)"):
        op.execute(f"REVOKE EXECUTE ON FUNCTION {fn} FROM PUBLIC")
        op.execute(f"GRANT EXECUTE ON FUNCTION {fn} TO app_role")

    op.execute("DROP POLICY IF EXISTS clients_select ON clients")
    op.execute(
        """
        CREATE POLICY clients_select ON clients FOR SELECT
        USING (client_visible_row(current_setting('app.user_id', true)::uuid, id, org_id))
        """
    )

    op.execute("DROP POLICY IF EXISTS projects_select ON projects")
    op.execute(
        """
        CREATE POLICY projects_select ON projects FOR SELECT
        USING (project_visible_row(current_setting('app.user_id', true)::uuid, id, client_id))
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS projects_select ON projects")
    op.execute(
        """
        CREATE POLICY projects_select ON projects FOR SELECT
        USING (project_visible(current_setting('app.user_id', true)::uuid, id))
        """
    )
    op.execute("DROP POLICY IF EXISTS clients_select ON clients")
    op.execute(
        """
        CREATE POLICY clients_select ON clients FOR SELECT
        USING (client_visible(current_setting('app.user_id', true)::uuid, id))
        """
    )
    op.execute("DROP FUNCTION IF EXISTS project_visible_row(uuid, uuid, uuid)")
    op.execute("DROP FUNCTION IF EXISTS client_visible_row(uuid, uuid, uuid)")
