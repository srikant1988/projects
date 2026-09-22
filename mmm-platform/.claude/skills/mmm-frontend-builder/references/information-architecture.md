# Information architecture — MMX

The product is two interconnected phases. **Phase 2 is sealed until Phase 1 publishes a
champion model** — this gate is the organizing idea of the whole product and must not be
weakened by a new feature (e.g. never add a way to preview Phase 2 data before publish).

## Domain model

```
Organization (tenant)
  └─ Client (brand workspace — hard permission boundary)
       └─ Project (an engagement, e.g. "US skincare, weekly, 2023-2026")
            ├─ DataSource        (connector config + credentials)
            ├─ DatasetVersion    (immutable validated snapshot)
            ├─ ModelSpec         (outcome, features, transforms, priors)
            │    └─ ModelRun     (fitted artifact + diagnostics + lineage)
            └─ Scenario          (budget plan evaluated against a ModelRun)
```

A `ModelRun` always references one frozen `DatasetVersion`, never a live table. A `Client` is a
permission boundary, not a folder — this matters for any access-control UI. Keep this hierarchy
in mind when naming routes/params (`/clients/:clientId/projects/:projectId/...`) and when
placing a new feature — it belongs at the level of the entity it operates on, not wherever is
visually convenient.

## Phase 1 — Model Studio (7-stage pipeline)

| # | Stage | Purpose | Key screens/patterns |
|---|---|---|---|
| 0 | **Workspace** | Project list across the workspace | Searchable table, expandable rows showing prior model versions per project |
| 1 | **Project setup** | Fix the modelling contract | Outcome/grain/geography fields; **Analytic plan specification** card: Download spec → Upload completed plan → Locked state |
| 2 | **Data** | Connect and validate sources | Sources table; **Add Source modal** (Excel/CSV, Database, Data lake/other — three distinct forms); Channel mapping; Variable buckets; blocking Quality gate checklist |
| 3 | **Model spec** | Estimator, transforms, priors | Engine choice (Bayesian/regression/GBM) with runtime guidance that changes per choice; per-channel adstock/saturation/prior table |
| 4 | **Runs** | Fit, diagnose, iterate | Run history table; **Model result** sub-tabs: Summary, Coefficients, Contribution review, Level stats |
| 5 | **Workbook** | Validate at lowest granularity before publish | Model-group selection, Generate → async Preparing→Ready workbook list, single Excel-style export per run |
| 6 | **Publish** | Approve the champion | Checklist of gating conditions (diagnostics passed, dataset frozen, workbook reviewed, second reviewer signed off) → unseals Phase 2 |

Each stage's "what did this produce" is shown via the `<Callout kind="out">` pattern — always
end a config/setup screen with one of these rather than leaving the user to infer the result.

## Phase 2 — Marketing Performance (5 tabs, sealed until publish)

| Tab | Purpose | Key screens/patterns |
|---|---|---|
| **Portfolio** | Channel/brand/tactic/campaign performance | View toggle (Grid / Compare / Map / Time series); Dimension toggle (Brand/Channel/Tactics/Campaigns) + Level 1/2/3 drilldown (Level only meaningful for the Channel dimension); Export & Add Column menus |
| **Drivers** | What moved the topline | Weekly trend chart w/ year-ago overlay; cumulative waterfall ("what moved revenue"); driver detail table |
| **Scenarios** | Budget planning | **List-first**: saved scenarios table with Plan Scope chips (single/multiple/none-filtered), Create/Copy/Compare/Delete, empty state → opens a detail view with live sliders, a response curve per channel, and an optimizer evaluating the *cached posterior* (no refitting) |
| **Tracking** | Plan vs. actual | Forecast-vs-actual matrix (to-date and full-year columns); time series with the remaining-forecast period visually shaded; gap-by-channel table |
| **Reports** | Deliverable generation | Report builder (template, section checklist, output format) + list of previously published outputs, each stamped with the model version that produced it |

Scope filters that persist across all five tabs: **Period, Geography, Product, Channel,
Tactics, Campaigns** — live in the left `<ScopeFilterRail>`, not per-tab.

## Placement rule for new features

Before building anything, locate it in exactly one of the twelve places above (7 pipeline
stages + 5 tabs). If it doesn't fit any of them, it's either:
- a new **stage** in Phase 1 (rare — the pipeline is sequential and validated; adding a stage
  changes the gate logic, so confirm with the user before doing this), or
- a new **tab** in Phase 2 (same caution), or
- a cross-cutting concern (e.g. audit log, admin/RBAC screens) that lives outside both phases
  entirely and should not be forced into either one.

Never bolt a feature onto an existing screen in a way that changes what that screen is for —
e.g. don't add budget-planning controls to Portfolio; that's Scenarios' job.
