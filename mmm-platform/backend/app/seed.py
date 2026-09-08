"""Seeds demo tenants that exercise the isolation model end to end:
- l.chen has an ORG-WIDE analyst grant, but an explicit client-level
  exclusion on Halstrom Group. That exclusion must win: l.chen sees every
  client except Halstrom Group, no matter the broader grant.

Run with: python -m app.seed
"""
import asyncio
import uuid

import asyncpg

from app.config import settings
from app.security import hash_password


async def main() -> None:
    dsn = settings.migration_database_url.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(dsn)

    org_id = uuid.uuid4()
    await conn.execute("INSERT INTO organizations (id, name) VALUES ($1, $2)", org_id, "Meridian Analytics")

    users = {
        "s.raman": ("s.raman@meridian.example", "Sanjay Raman"),
        "j.okafor": ("j.okafor@meridian.example", "Jide Okafor"),
        "l.chen": ("l.chen@meridian.example", "Lin Chen"),
    }
    user_ids = {}
    for key, (email, name) in users.items():
        uid = uuid.uuid4()
        user_ids[key] = uid
        await conn.execute(
            "INSERT INTO users (id, org_id, email, hashed_password, display_name) VALUES ($1,$2,$3,$4,$5)",
            uid, org_id, email, hash_password("password123"), name,
        )

    # s.raman: org admin, full reach within the tenant
    await conn.execute(
        "INSERT INTO memberships (id, user_id, role, scope_type, scope_id) VALUES ($1,$2,'org_admin','organization',$3)",
        uuid.uuid4(), user_ids["s.raman"], org_id,
    )
    # l.chen: org-wide analyst ...
    await conn.execute(
        "INSERT INTO memberships (id, user_id, role, scope_type, scope_id) VALUES ($1,$2,'analyst','organization',$3)",
        uuid.uuid4(), user_ids["l.chen"], org_id,
    )

    clients = {}
    for name in ["Northfield Foods", "Aurelia Beauty", "Vantage Mobility", "Halstrom Group"]:
        cid = uuid.uuid4()
        clients[name] = cid
        await conn.execute("INSERT INTO clients (id, org_id, name) VALUES ($1,$2,$3)", cid, org_id, name)

    # ... except an explicit, un-overridable exclusion on Halstrom Group.
    await conn.execute(
        "INSERT INTO memberships (id, user_id, role, scope_type, scope_id) VALUES ($1,$2,'excluded','client',$3)",
        uuid.uuid4(), user_ids["l.chen"], clients["Halstrom Group"],
    )

    # j.okafor: client_lead scoped to a single client only
    await conn.execute(
        "INSERT INTO memberships (id, user_id, role, scope_type, scope_id) VALUES ($1,$2,'client_lead','client',$3)",
        uuid.uuid4(), user_ids["j.okafor"], clients["Aurelia Beauty"],
    )

    projects = [
        ("Northfield Foods", "UK Core Range – FY26 Weekly", "Net revenue (£)", "weekly"),
        ("Northfield Foods", "Q3 Promo Effectiveness", "Units sold", "weekly"),
        ("Aurelia Beauty", "Nordic Launch – H1 26", "Net revenue (£)", "weekly"),
        ("Vantage Mobility", "Always-On Retail Media", "New customers", "monthly"),
        ("Halstrom Group", "Brand Equity Refresh 2026", "Net revenue (£)", "weekly"),
    ]
    for client_name, proj_name, outcome, grain in projects:
        await conn.execute(
            "INSERT INTO projects (id, client_id, name, outcome_variable, time_grain) VALUES ($1,$2,$3,$4,$5)",
            uuid.uuid4(), clients[client_name], proj_name, outcome, grain,
        )

    await conn.close()
    print("Seed complete.")
    print("  s.raman@meridian.example / password123  -> org_admin, sees all 4 clients")
    print("  j.okafor@meridian.example / password123 -> client_lead on Aurelia Beauty only")
    print("  l.chen@meridian.example / password123   -> org-wide analyst, EXCLUDED from Halstrom Group")


if __name__ == "__main__":
    asyncio.run(main())
