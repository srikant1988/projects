# MMM Platform — multi-tenancy scaffold

Implements the tenant model and isolation invariants from the architecture
doc (Organization → Client → Project, `Client` as a hard permission
boundary) as working code:

- **Backend**: FastAPI + SQLAlchemy (async) + Postgres. Tenant isolation is
  enforced by **Postgres row-level security**, not application-level
  filtering — the API runs `SELECT * FROM clients` unfiltered and the
  database removes rows the caller has no grant for. The permission model
  (`(user, role, scope_type, scope_id)` with an un-overridable client-level
  exclusion) lives in SQL functions used by the RLS policies.
- **Frontend**: React + Vite + TypeScript. Login, a workspace view showing
  the caller's grants, and a client/project tree that only ever shows what
  the API returned — no client-side hiding.

## Prerequisites

- Docker Desktop
- Python 3.11+
- Node 18+

## 1. Start Postgres

```powershell
docker compose up -d
```

This creates the `mmm` database and a non-superuser `app_role` (RLS is
bypassed for superusers and table owners, so the app must connect as a
plain role — see `backend/db_init/01_app_role.sql`).

## 2. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

API is at http://localhost:8000, health check at `/health`.

Seeded demo users (password `password123`), all in one org ("Meridian
Analytics") with four clients (Northfield Foods, Aurelia Beauty, Vantage
Mobility, Halstrom Group):

| User | Grant | What they should see |
|---|---|---|
| s.raman@meridian.example | org_admin, organization scope | All 4 clients |
| j.okafor@meridian.example | client_lead, Aurelia Beauty only | Just Aurelia Beauty |
| l.chen@meridian.example | analyst, organization scope + `excluded` on Halstrom Group | All clients **except** Halstrom Group — the exclusion overrides the org-wide grant |

Log in as each to see the RLS-enforced client list change with no code
path change on the frontend.

## 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## What to look at first

- `backend/migrations/versions/0001_init.py` — the RLS policies and the
  `client_visible` / `project_visible` SQL functions implementing the
  permission model from architecture doc section 9.1.
- `backend/app/deps.py` — `set_tenant_context` binds the authenticated user
  to the Postgres session via `SET LOCAL`, transaction-scoped so it can
  never leak across pooled connections.
- `backend/app/routers/clients.py` — note there is no `WHERE org_id = ...`
  in the query. That's deliberate; enforcement is the database's job.

## Not included (see architecture doc for scope)

Data ingestion, harmonization, the modeling/decision engine, SSO/SCIM,
per-tenant storage/KMS isolation, and the control-plane services beyond
tenancy (catalog, orchestrator, metering). This scaffold is the foundation
those would build on.
