# Backend conventions — MMX

Brief, since this skill is primarily about the frontend matching the design system — but the
API contract shapes what the frontend can render, so keep these in sync.

## Stack

- Python + **FastAPI**
- **PostgreSQL** with row-level security for multi-tenant isolation
- **dbt** for data harmonization/transformation
- **Temporal** for long-running model-run orchestration
- Modeling: **statsmodels** / PyMC-style Bayesian fitting, **PuLP or CBC** for the scenario
  optimizer, **XGBoost / scikit-learn** for the challenger engine
- Deployed on **Azure Container Apps**

## API surface (route shape)

Mirror the domain hierarchy in `information-architecture.md` — resources nest the same way:

```
/v1/clients
/v1/clients/{id}/members
/v1/projects
/v1/projects/{id}/data-sources
/v1/data-sources/{id}/sync              → 202, poll for IngestionRun status
/v1/projects/{id}/dataset-versions      → 202 (harmonize + validate)
/v1/dataset-versions/{id}/quality-report
/v1/projects/{id}/model-specs
/v1/model-specs/{id}/runs               → 202, poll for ModelRun status
/v1/runs/{id}/diagnostics
/v1/runs/{id}/contributions
/v1/runs/{id}/response-curves
/v1/runs/{id}/promote                   → champion
/v1/projects/{id}/scenarios
/v1/scenarios/{id}/optimize
```

**Long-running operations return `202` with a resource to poll or a webhook to subscribe to.**
This is why the frontend's Workbook and Add Source flows use a "Preparing → Ready" pattern
rather than blocking — match that pattern for any new async backend operation instead of making
the frontend poll ad hoc.

## Response field names the frontend already depends on

Don't rename these without updating every screen in `component-library.md`'s `<DataTable>`
instances that reads them:

- `spend`, `rev` (incremental revenue), `brand` (incremental brand equity), `lt` (incremental
  long-term revenue), `roi`, `mroi` (marginal ROI — drives the "opportunity"/reallocation
  columns, distinct from average `roi`)
- Diagnostics categories: `convergence`, `fit`, `generalization`, `plausibility`, `stability`,
  `calibration` — each with a pass/warn/fail status, matching the `<Tag>` variants
- Dataset lineage: every `ModelRun` response includes its `dataset_version_id`, `spec_hash`, and
  `engine_version` — the frontend surfaces these as the reproducibility callout, don't drop them

## IP-protection principle

A recurring product requirement: **clients receive only governed analytical outputs, never raw
underlying data.** Any new endpoint should be checked against this before exposing it — e.g. an
endpoint that returns per-row media spend to a client-scoped token is very likely wrong; one
that returns aggregated contribution/ROI is the intended shape. When in doubt, favor the
already-established response shapes above over adding a new raw-data endpoint.
