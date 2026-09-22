from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth,
    clients,
    data_sources,
    dataset_versions,
    me,
    memberships,
    model_runs,
    model_specs,
    orgs,
    projects,
    scenarios,
    users,
)

app = FastAPI(title="MMM Platform API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(orgs.router)
app.include_router(clients.router)
app.include_router(projects.router)
app.include_router(data_sources.router)
app.include_router(dataset_versions.router)
app.include_router(model_specs.router)
app.include_router(model_runs.router)
app.include_router(scenarios.router)
app.include_router(users.router)
app.include_router(memberships.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
