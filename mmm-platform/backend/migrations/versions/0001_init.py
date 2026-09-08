"""Initial schema: tenant hierarchy, memberships, and RLS enforcement.

Revision ID: 0001_init
Revises:
Create Date: 2026-09-07
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.create_table(
        "organizations",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "clients",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", pg.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "projects",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", pg.UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("outcome_variable", sa.String(200), server_default=""),
        sa.Column("time_grain", sa.String(50), server_default="weekly"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", pg.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(200), server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "memberships",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("scope_type", sa.String(20), nullable=False),
        sa.Column("scope_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_memberships_user", "memberships", ["user_id"])
    op.create_index("ix_memberships_scope", "memberships", ["scope_type", "scope_id"])

    # --- Permission model (doc section 9.1) ------------------------------
    # A grant is (user, role, scope_type, scope_id). Effective permission is
    # the union of grants EXCEPT an explicit client-level 'excluded' grant,
    # which always wins regardless of any broader org-level grant.
    op.execute(
        """
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
    )

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
        CREATE OR REPLACE FUNCTION project_visible(p_user uuid, p_project uuid)
        RETURNS boolean AS $$
        DECLARE
          v_client uuid;
        BEGIN
          SELECT client_id INTO v_client FROM projects WHERE id = p_project;
          IF v_client IS NULL OR NOT client_visible(p_user, v_client) THEN
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

    # These run as their (superuser) owner, so restrict who may call them
    # directly rather than leaving default PUBLIC execute rights.
    for fn in (
        "client_visible(uuid, uuid)",
        "client_insertable(uuid, uuid)",
        "project_visible(uuid, uuid)",
        "project_insertable(uuid, uuid)",
    ):
        op.execute(f"REVOKE EXECUTE ON FUNCTION {fn} FROM PUBLIC")
        op.execute(f"GRANT EXECUTE ON FUNCTION {fn} TO app_role")

    # --- RLS: fail closed by default -------------------------------------
    for table in ("clients", "projects"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    op.execute(
        """
        CREATE POLICY clients_select ON clients FOR SELECT
        USING (client_visible(current_setting('app.user_id', true)::uuid, id))
        """
    )
    op.execute(
        """
        CREATE POLICY clients_insert ON clients FOR INSERT
        WITH CHECK (client_insertable(current_setting('app.user_id', true)::uuid, org_id))
        """
    )

    op.execute(
        """
        CREATE POLICY projects_select ON projects FOR SELECT
        USING (project_visible(current_setting('app.user_id', true)::uuid, id))
        """
    )
    op.execute(
        """
        CREATE POLICY projects_insert ON projects FOR INSERT
        WITH CHECK (project_insertable(current_setting('app.user_id', true)::uuid, client_id))
        """
    )

    # Grants for the runtime role (RLS is what actually restricts rows).
    # asyncpg refuses multiple statements in a single prepared execute, so
    # these must be separate op.execute() calls.
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON organizations, clients, projects, users, memberships TO app_role"
    )
    op.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_role")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS projects_insert ON projects")
    op.execute("DROP POLICY IF EXISTS projects_select ON projects")
    op.execute("DROP POLICY IF EXISTS clients_insert ON clients")
    op.execute("DROP POLICY IF EXISTS clients_select ON clients")
    op.execute("DROP FUNCTION IF EXISTS project_insertable(uuid, uuid)")
    op.execute("DROP FUNCTION IF EXISTS project_visible(uuid, uuid)")
    op.execute("DROP FUNCTION IF EXISTS client_insertable(uuid, uuid)")
    op.execute("DROP FUNCTION IF EXISTS client_visible(uuid, uuid)")
    op.drop_table("memberships")
    op.drop_table("users")
    op.drop_table("projects")
    op.drop_table("clients")
    op.drop_table("organizations")
