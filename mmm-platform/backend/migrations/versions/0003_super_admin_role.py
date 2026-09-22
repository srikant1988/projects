"""Recognize 'super_admin' in the client/project insert-permission checks.

super_admin is an organization-scope role for user & access-level
administration (see routers/users.py, routers/memberships.py). It is
deliberately NOT given any special reach in client_visible()/project_visible()
-- an org-wide grant, super_admin included, still loses to a client-level
'excluded' membership. Extending governance reach here would break the
un-overridable exclusion invariant (architecture doc section 9.1), so this
migration only touches the two *_insertable() functions (create rights),
never the *_visible() ones (read rights).

Revision ID: 0003_super_admin_role
Revises: 0002_pipeline
Create Date: 2026-09-22
"""
from alembic import op

revision = "0003_super_admin_role"
down_revision = "0002_pipeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION client_insertable(p_user uuid, p_org uuid)
        RETURNS boolean AS $$
        BEGIN
          RETURN EXISTS (
            SELECT 1 FROM memberships
            WHERE user_id = p_user AND scope_type = 'organization' AND scope_id = p_org
              AND role IN ('super_admin', 'org_admin', 'client_lead')
          );
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION project_insertable(p_user uuid, p_client uuid)
        RETURNS boolean AS $$
        DECLARE
          v_org uuid;
        BEGIN
          SELECT org_id INTO v_org FROM clients WHERE id = p_client;
          IF v_org IS NULL OR NOT client_visible(p_user, p_client) THEN
            RETURN false;
          END IF;

          RETURN EXISTS (
            SELECT 1 FROM memberships
            WHERE user_id = p_user
              AND (
                (scope_type = 'organization' AND scope_id = v_org AND role IN ('super_admin', 'org_admin', 'client_lead', 'analyst'))
                OR (scope_type = 'client' AND scope_id = p_client AND role IN ('client_lead', 'analyst'))
              )
          );
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION client_insertable(p_user uuid, p_org uuid)
        RETURNS boolean AS $$
        BEGIN
          RETURN EXISTS (
            SELECT 1 FROM memberships
            WHERE user_id = p_user AND scope_type = 'organization' AND scope_id = p_org
              AND role IN ('org_admin', 'client_lead')
          );
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION project_insertable(p_user uuid, p_client uuid)
        RETURNS boolean AS $$
        DECLARE
          v_org uuid;
        BEGIN
          SELECT org_id INTO v_org FROM clients WHERE id = p_client;
          IF v_org IS NULL OR NOT client_visible(p_user, p_client) THEN
            RETURN false;
          END IF;

          RETURN EXISTS (
            SELECT 1 FROM memberships
            WHERE user_id = p_user
              AND (
                (scope_type = 'organization' AND scope_id = v_org AND role IN ('org_admin', 'client_lead', 'analyst'))
                OR (scope_type = 'client' AND scope_id = p_client AND role IN ('client_lead', 'analyst'))
              )
          );
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
        """
    )
