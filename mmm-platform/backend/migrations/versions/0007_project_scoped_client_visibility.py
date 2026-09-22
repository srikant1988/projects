"""Lets a project-scope membership alone grant visibility of that project's
client. Needed for the client-portal access model: an admin maps a client
user to specific *projects* (role client_viewer, scope_type='project'), not
to the whole client -- but project_visible()/project_visible_row() both
require client_visible() to already be true, and until now client_visible()
only looked at organization/client-scope grants. A user with nothing but a
project-scope grant was therefore invisible to their own project.

The exclusion invariant is untouched: an explicit client-level 'excluded'
grant is still checked first and still wins over this new path, since a
project the client's already been walled off from should not become visible
just because they were separately handed access to one specific project.

Revision ID: 0007_project_scope_vis
Revises: 0006_project_share_link
Create Date: 2026-09-22
"""
from alembic import op

revision = "0007_project_scope_vis"
down_revision = "0006_project_share_link"
branch_labels = None
depends_on = None

_OLD_CLIENT_VISIBLE = """
CREATE OR REPLACE FUNCTION client_visible(p_user uuid, p_client uuid)
RETURNS boolean AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM clients WHERE id = p_client;
  IF v_org IS NULL THEN
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
        (scope_type = 'organization' AND scope_id = v_org)
        OR (scope_type = 'client' AND scope_id = p_client)
      )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
"""

_NEW_CLIENT_VISIBLE = """
CREATE OR REPLACE FUNCTION client_visible(p_user uuid, p_client uuid)
RETURNS boolean AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM clients WHERE id = p_client;
  IF v_org IS NULL THEN
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
        (scope_type = 'organization' AND scope_id = v_org)
        OR (scope_type = 'client' AND scope_id = p_client)
      )
  ) OR EXISTS (
    SELECT 1 FROM memberships m
    JOIN projects pr ON pr.id = m.scope_id
    WHERE m.user_id = p_user AND m.scope_type = 'project' AND m.role != 'excluded' AND pr.client_id = p_client
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
"""

_OLD_CLIENT_VISIBLE_ROW = """
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

_NEW_CLIENT_VISIBLE_ROW = """
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
  ) OR EXISTS (
    SELECT 1 FROM memberships m
    JOIN projects pr ON pr.id = m.scope_id
    WHERE m.user_id = p_user AND m.scope_type = 'project' AND m.role != 'excluded' AND pr.client_id = p_client
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
"""


def upgrade() -> None:
    op.execute(_NEW_CLIENT_VISIBLE)
    op.execute(_NEW_CLIENT_VISIBLE_ROW)


def downgrade() -> None:
    op.execute(_OLD_CLIENT_VISIBLE)
    op.execute(_OLD_CLIENT_VISIBLE_ROW)
