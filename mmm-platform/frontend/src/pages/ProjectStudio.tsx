import { Fragment, useEffect, useState } from "react";
import {
  api,
  ChannelSpec,
  DataSource,
  DatasetVersion,
  ModelRun,
  ModelSpec,
  Project,
  Scenario,
} from "../api";
import TopBar from "../components/TopBar";
import PipelineRail, { StepDef } from "../components/PipelineRail";
import AddSourceModal from "../components/AddSourceModal";
import Phase2, { P2Section } from "./Phase2";

export const STEPS: StepDef[] = [
  { title: "Data", subtitle: "Sources, dataset version" },
  { title: "Project setup", subtitle: "Outcome, grain, coverage" },
  { title: "Model spec", subtitle: "Channels, controls, engine" },
  { title: "Runs", subtitle: "Fit, diagnose, iterate" },
  { title: "Workbook", subtitle: "Validate at lowest grain" },
  { title: "Publish", subtitle: "Approve the champion" },
];

function ChannelBuilder({
  channels,
  setChannels,
  controls,
  setControls,
}: {
  channels: ChannelSpec[];
  setChannels: (c: ChannelSpec[]) => void;
  controls: string;
  setControls: (c: string) => void;
}) {
  function update(i: number, field: keyof ChannelSpec, value: string) {
    const next = channels.slice();
    next[i] = { ...next[i], [field]: field === "name" ? value : Number(value) };
    setChannels(next);
  }
  return (
    <div>
      <label>Channels (weekly spend range, Â£M)</label>
      {channels.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            placeholder="channel name"
            value={c.name}
            onChange={(e) => update(i, "name", e.target.value)}
            style={{ flex: 2, padding: "5px 8px", border: "1px solid var(--line-hard)", borderRadius: 3 }}
          />
          <input
            type="number"
            placeholder="min"
            value={c.min}
            onChange={(e) => update(i, "min", e.target.value)}
            style={{ flex: 1, padding: "5px 8px", border: "1px solid var(--line-hard)", borderRadius: 3 }}
          />
          <input
            type="number"
            placeholder="max"
            value={c.max}
            onChange={(e) => update(i, "max", e.target.value)}
            style={{ flex: 1, padding: "5px 8px", border: "1px solid var(--line-hard)", borderRadius: 3 }}
          />
          <button className="btn sm" onClick={() => setChannels(channels.filter((_, j) => j !== i))}>
            remove
          </button>
        </div>
      ))}
      <button className="btn sm" onClick={() => setChannels([...channels, { name: "", min: 0, max: 10 }])}>
        + add channel
      </button>
      <div style={{ marginTop: 10 }}>
        <label>Controls (comma-separated)</label>
        <input
          value={controls}
          onChange={(e) => setControls(e.target.value)}
          placeholder="price_index, distribution"
          style={{ width: "100%", padding: "6px 9px", border: "1px solid var(--line-hard)", borderRadius: 3 }}
        />
      </div>
    </div>
  );
}

export default function ProjectStudio({
  project,
  clientName,
  avatarInitials,
  onBack,
  onLogout,
}: {
  project: Project;
  clientName: string;
  avatarInitials: string;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [phase, setPhase] = useState<1 | 2>(1);
  const [step, setStep] = useState(0);
  const [p2Section, setP2Section] = useState<P2Section>("performance");
  const [error, setError] = useState<string | null>(null);

  const [sources, setSources] = useState<DataSource[]>([]);
  const [datasetVersions, setDatasetVersions] = useState<DatasetVersion[]>([]);
  const [specs, setSpecs] = useState<ModelSpec[]>([]);
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [workbookGenerated, setWorkbookGenerated] = useState(false);
  const [setupAcked, setSetupAcked] = useState(true);

  async function loadAll() {
    setError(null);
    try {
      const [ds, dv, sp, rn, sc] = await Promise.all([
        api.dataSources(project.id),
        api.datasetVersions(project.id),
        api.modelSpecs(project.id),
        api.runs(project.id),
        api.scenarios(project.id),
      ]);
      setSources(ds);
      setDatasetVersions(dv);
      setSpecs(sp);
      setRuns(rn);
      setScenarios(sc);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const champion = runs.find((r) => r.is_champion);
  const published = !!champion;

  const done = [
    datasetVersions.length > 0,
    setupAcked,
    specs.length > 0,
    runs.some((r) => r.status === "completed"),
    workbookGenerated,
    published,
  ];

  function goStep(i: number) {
    if (i > 0 && !done[i - 1]) return;
    setStep(i);
  }

  return (
    <div>
      <TopBar
        crumbClient={clientName}
        crumbProject={project.name}
        phase={phase}
        onPhase={setPhase}
        phaseLocked={!published}
        avatarInitials={avatarInitials}
        onLogout={onLogout}
        onWordmarkClick={onBack}
      />
      <div className="shell">
        {phase === 1 ? (
          <PipelineRail
            steps={[{ title: "My workspace", subtitle: "Choose an engagement" }, ...STEPS]}
            step={step + 1}
            done={[true, ...done]}
            onStep={(i) => (i === 0 ? onBack() : goStep(i - 1))}
            published={published}
          />
        ) : (
          <aside className="rail">
            <div className="rail-h">Marketing performance</div>
            <div className="pipe">
              {(
                [
                  { key: "performance", title: "Performance", subtitle: "Portfolio, drivers, tracking, reports" },
                  { key: "optimization", title: "Optimization dashboard", subtitle: "Scenario planning" },
                  { key: "ai", title: "AI Agent", subtitle: "Ask about this project" },
                ] as { key: P2Section; title: string; subtitle: string }[]
              ).map((s) => (
                <button
                  key={s.key}
                  className="step"
                  data-state={p2Section === s.key ? "active" : "idle"}
                  aria-current={p2Section === s.key}
                  onClick={() => setP2Section(s.key)}
                >
                  <span className="dot">●</span>
                  <span>
                    <span className="step-t">{s.title}</span>
                    <span className="step-s">{s.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="muted" style={{ padding: "12px 16px", fontSize: 11.5 }}>
              Reads from champion run {champion?.id.slice(0, 8)}.
            </p>
          </aside>
        )}

        <main className="main">
          {error && <div className="error">{error}</div>}

          {phase === 1 && (
            <>
              <div className="head">
                <button className="btn sm" onClick={onBack} style={{ marginBottom: 8 }}>
                  â† All projects
                </button>
              </div>

              {step === 0 && (
                <DataStep
                  project={project}
                  sources={sources}
                  datasetVersions={datasetVersions}
                  reload={loadAll}
                  setError={setError}
                  onBack={onBack}
                  onContinue={() => goStep(1)}
                />
              )}
              {step === 1 && (
                <SetupStep
                  project={project}
                  onBack={() => goStep(0)}
                  onContinue={() => { setSetupAcked(true); goStep(2); }}
                />
              )}
              {step === 2 && (
                <SpecStep
                  project={project}
                  specs={specs}
                  reload={loadAll}
                  setError={setError}
                  onBack={() => goStep(1)}
                  onContinue={() => goStep(3)}
                />
              )}
              {step === 3 && (
                <RunsStep
                  project={project}
                  specs={specs}
                  datasetVersions={datasetVersions}
                  runs={runs}
                  reload={loadAll}
                  setError={setError}
                  onBack={() => goStep(2)}
                  onContinue={() => goStep(4)}
                />
              )}
              {step === 4 && (
                <WorkbookStep
                  runs={runs}
                  generated={workbookGenerated}
                  onGenerate={() => setWorkbookGenerated(true)}
                  onBack={() => goStep(3)}
                  onContinue={() => goStep(5)}
                />
              )}
              {step === 5 && (
                <PublishStep
                  project={project}
                  runs={runs}
                  workbookGenerated={workbookGenerated}
                  setError={setError}
                  onBack={() => goStep(4)}
                  onPublished={async () => {
                    await loadAll();
                    setPhase(2);
                  }}
                />
              )}
            </>
          )}

          {phase === 2 &&
            (published ? (
              <Phase2
                project={project}
                champion={champion!}
                specs={specs}
                scenarios={scenarios}
                reload={loadAll}
                setError={setError}
                section={p2Section}
              />
            ) : (
              <div className="locked">
                <div className="ic">ðŸ”’</div>
                <h2>Reporting is sealed</h2>
                <p>
                  Marketing performance reads entirely from an approved champion model. Until one is published
                  there is nothing to report.
                </p>
                <ul className="checklist">
                  {STEPS.map((s, i) => (
                    <li key={s.title}>
                      <span className={"tick " + (done[i] ? "y" : "n")}>{done[i] ? "âœ“" : ""}</span> {s.title}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 16 }}>
                  <button className="btn pri" onClick={() => setPhase(1)}>
                    Go to model studio
                  </button>
                </div>
              </div>
            ))}
        </main>
      </div>
    </div>
  );
}

function SetupStep({
  project,
  onBack,
  onContinue,
}: {
  project: Project;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section>
      <div className="head">
        <div>
          <h1>Define the project</h1>
          <p>These fix the modelling contract. Changing them later invalidates existing runs.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-h">
          <h3>Outcome and grain</h3>
        </div>
        <div className="card-b">
          <div className="field">
            <label>Outcome variable</label>
            <input value={project.outcome_variable || "Not set"} disabled />
          </div>
          <div className="field">
            <label>Time grain</label>
            <input value={project.time_grain} disabled />
          </div>
          <p className="muted" style={{ fontSize: 11.5 }}>
            Set at project creation. Editing an established contract is out of scope for this build.
          </p>
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button className="btn" onClick={onBack}>
          Back
        </button>
        <button className="btn pri" onClick={onContinue}>
          Save and continue â†’
        </button>
      </div>
    </section>
  );
}

function DataStep({
  project,
  sources,
  datasetVersions,
  reload,
  setError,
  onBack,
  onContinue,
}: {
  project: Project;
  sources: DataSource[];
  datasetVersions: DatasetVersion[];
  reload: () => void;
  setError: (e: string | null) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [label, setLabel] = useState("dsv_v1");
  const [channels, setChannels] = useState<ChannelSpec[]>([{ name: "tv", min: 0, max: 10 }]);
  const [controls, setControls] = useState("price_index, seasonality");
  const [showAddSource, setShowAddSource] = useState(false);

  const [mode, setMode] = useState<"manual" | "file">("manual");
  const uploadedSources = sources.filter((s) => (s.columns_preview?.columns?.length ?? 0) > 0);
  const [fileSourceId, setFileSourceId] = useState("");
  const [outcomeCol, setOutcomeCol] = useState("");
  const [channelCols, setChannelCols] = useState<Set<string>>(new Set());
  const [controlCols, setControlCols] = useState<Set<string>>(new Set());

  const fileSource = uploadedSources.find((s) => s.id === fileSourceId);
  const fileColumns = fileSource?.columns_preview?.columns ?? [];

  function toggleSet(set: Set<string>, setSet: (s: Set<string>) => void, col: string) {
    const next = new Set(set);
    next.has(col) ? next.delete(col) : next.add(col);
    setSet(next);
  }

  async function addSource(name: string, sourceType: string, file?: File | null) {
    try {
      const ds = await api.createDataSource(project.id, name, sourceType);
      if (file) {
        await api.uploadDataSourceFile(ds.id, file);
      }
      reload();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }

  async function issueDatasetVersion() {
    if (mode === "file") {
      if (!fileSourceId || !outcomeCol || channelCols.size === 0) {
        setError("Pick a source, an outcome column, and at least one channel column");
        return;
      }
      try {
        await api.createDatasetVersion(
          project.id,
          label,
          Array.from(channelCols).map((name) => ({ name, min: 0, max: 10 })),
          Array.from(controlCols),
          fileSourceId,
          outcomeCol
        );
        reload();
      } catch (err: any) {
        setError(err.message);
      }
      return;
    }
    const cleanChannels = channels.filter((c) => c.name.trim());
    if (!cleanChannels.length) {
      setError("Add at least one channel before issuing a dataset version");
      return;
    }
    try {
      await api.createDatasetVersion(
        project.id,
        label,
        cleanChannels,
        controls.split(",").map((c) => c.trim()).filter(Boolean)
      );
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <section>
      <div className="head">
        <div>
          <h1>Data</h1>
          <p>Connect, then issue a dataset version. Nothing models until one is validated.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Sources</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="tag ok">{sources.length} connected</span>
            <button className="btn sm" onClick={() => setShowAddSource(true)}>
              Add source
            </button>
          </div>
        </div>
        <div className="card-b">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>File</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.name}</b>
                    </td>
                    <td className="muted">{s.source_type}</td>
                    <td className="muted">
                      {s.filename ? (
                        <>
                          {s.filename}
                          {s.row_count != null && s.column_count != null && (
                            <span> · {s.row_count} rows × {s.column_count} cols</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={"tag " + (s.status === "valid" ? "ok" : s.status === "warn" ? "warn" : "idle")}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {sources.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No sources connected yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddSource && (
        <AddSourceModal onClose={() => setShowAddSource(false)} onConnect={addSource} />
      )}

      <div className="card">
        <div className="card-h">
          <h3>Dataset versions</h3>
          <p className="muted">Immutable once issued â€” a correction always creates a new version</p>
        </div>
        <div className="card-b">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Shape</th>
                  <th>Hash</th>
                  <th>Quality gate</th>
                </tr>
              </thead>
              <tbody>
                {datasetVersions.map((d) => {
                  const allPass = Object.values(d.quality_report).every((q) => q.status === "pass");
                  return (
                    <tr key={d.id}>
                      <td>
                        <b>{d.label}</b>
                      </td>
                      <td className="muted">
                        {d.row_count} rows Â· {d.channel_count} channels Â· {d.control_count} controls
                      </td>
                      <td className="muted">{d.content_hash.slice(0, 8)}â€¦</td>
                      <td>
                        <span className={"tag " + (allPass ? "ok" : "warn")}>{allPass ? "Passed" : "Warnings"}</span>
                      </td>
                    </tr>
                  );
                })}
                {datasetVersions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No dataset version issued yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div className="field">
              <label>Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>

            <div className="chips" style={{ marginBottom: 12 }}>
              <button className="chip" aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>
                Manual (synthetic fit)
              </button>
              <button className="chip" aria-pressed={mode === "file"} onClick={() => setMode("file")} disabled={uploadedSources.length === 0}>
                From uploaded file{uploadedSources.length === 0 ? " (upload a source first)" : ""}
              </button>
            </div>

            {mode === "manual" ? (
              <ChannelBuilder channels={channels} setChannels={setChannels} controls={controls} setControls={setControls} />
            ) : (
              <div>
                <div className="field">
                  <label>File source</label>
                  <select
                    value={fileSourceId}
                    onChange={(e) => {
                      setFileSourceId(e.target.value);
                      setOutcomeCol("");
                      setChannelCols(new Set());
                      setControlCols(new Set());
                    }}
                  >
                    <option value="">Select…</option>
                    {uploadedSources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.filename})
                      </option>
                    ))}
                  </select>
                </div>

                {fileSource && (
                  <>
                    <div className="field">
                      <label>Outcome column</label>
                      <select value={outcomeCol} onChange={(e) => setOutcomeCol(e.target.value)}>
                        <option value="">Select…</option>
                        {fileColumns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Channel columns (media spend)</label>
                      <div className="chips">
                        {fileColumns
                          .filter((c) => c !== outcomeCol)
                          .map((c) => (
                            <button
                              key={c}
                              type="button"
                              className="chip"
                              aria-pressed={channelCols.has(c)}
                              disabled={controlCols.has(c)}
                              onClick={() => toggleSet(channelCols, setChannelCols, c)}
                            >
                              {c}
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="field">
                      <label>Control columns (optional)</label>
                      <div className="chips">
                        {fileColumns
                          .filter((c) => c !== outcomeCol && !channelCols.has(c))
                          .map((c) => (
                            <button
                              key={c}
                              type="button"
                              className="chip"
                              aria-pressed={controlCols.has(c)}
                              onClick={() => toggleSet(controlCols, setControlCols, c)}
                            >
                              {c}
                            </button>
                          ))}
                      </div>
                    </div>
                    <p className="hint">
                      The fit uses these columns' real values directly — adstock decay is fixed at 0.5 (the true
                      decay isn't known for real data the way it is for the synthetic demo path).
                    </p>
                  </>
                )}
              </div>
            )}

            <button className="btn pri" style={{ marginTop: 10 }} onClick={issueDatasetVersion}>
              Issue dataset version
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button className="btn" onClick={onBack}>
          Back
        </button>
        <button className="btn pri" disabled={datasetVersions.length === 0} onClick={onContinue}>
          Continue â†’
        </button>
      </div>
    </section>
  );
}

function SpecStep({
  project,
  specs,
  reload,
  setError,
  onBack,
  onContinue,
}: {
  project: Project;
  specs: ModelSpec[];
  reload: () => void;
  setError: (e: string | null) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [channels, setChannels] = useState<ChannelSpec[]>([{ name: "tv", min: 0, max: 10 }]);
  const [controls, setControls] = useState("price_index, seasonality");
  const [engine, setEngine] = useState("ridge");

  async function save() {
    const cleanChannels = channels.filter((c) => c.name.trim());
    if (!cleanChannels.length) {
      setError("Add at least one channel");
      return;
    }
    try {
      await api.createModelSpec(
        project.id,
        cleanChannels,
        controls.split(",").map((c) => c.trim()).filter(Boolean),
        engine
      );
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <section>
      <div className="head">
        <div>
          <h1>Model specification</h1>
          <p>Estimator, channels, controls. This is the document that gets version-controlled.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-h">
          <h3>Model specifications</h3>
        </div>
        <div className="card-b">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Engine</th>
                  <th>Channels</th>
                  <th>Controls</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>v{s.version}</b>
                    </td>
                    <td className="muted">{s.engine}</td>
                    <td className="muted">{s.spec.channels.map((c) => c.name).join(", ")}</td>
                    <td className="muted">{s.spec.controls.join(", ") || "â€”"}</td>
                  </tr>
                ))}
                {specs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No spec saved yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div className="field">
              <label>Engine</label>
              <select value={engine} onChange={(e) => setEngine(e.target.value)}>
                <option value="ridge">Regularised regression â€” quick fit</option>
              </select>
            </div>
            <ChannelBuilder channels={channels} setChannels={setChannels} controls={controls} setControls={setControls} />
            <button className="btn pri" style={{ marginTop: 10 }} onClick={save}>
              Save spec
            </button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button className="btn" onClick={onBack}>
          Back
        </button>
        <button className="btn pri" disabled={specs.length === 0} onClick={onContinue}>
          Continue â†’
        </button>
      </div>
    </section>
  );
}

function RunsStep({
  specs,
  datasetVersions,
  runs,
  reload,
  setError,
  onBack,
  onContinue,
}: {
  project: Project;
  specs: ModelSpec[];
  datasetVersions: DatasetVersion[];
  runs: ModelRun[];
  reload: () => void;
  setError: (e: string | null) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [specId, setSpecId] = useState("");
  const [dsvId, setDsvId] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!specId && specs.length) setSpecId(specs[specs.length - 1].id);
    if (!dsvId && datasetVersions.length) setDsvId(datasetVersions[datasetVersions.length - 1].id);
  }, [specs, datasetVersions, specId, dsvId]);

  async function run() {
    if (!specId || !dsvId) return;
    setBusy(true);
    setError(null);
    try {
      await api.createRun(specId, dsvId);
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function promote(id: string) {
    try {
      await api.promoteRun(id);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const statusTag = (s: string) =>
    s === "completed" ? "ok" : s === "failed_diagnostics" ? "warn" : s === "failed" ? "bad" : "idle";

  const hasCompleted = runs.some((r) => r.status === "completed");

  return (
    <section>
      <div className="head">
        <div>
          <h1>Runs</h1>
          <p>Iterate here. Every run is reproducible and comparable.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Fit a run</h3>
        </div>
        <div className="card-b" style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label>Model spec</label>
            <select value={specId} onChange={(e) => setSpecId(e.target.value)}>
              {specs.map((s) => (
                <option key={s.id} value={s.id}>
                  v{s.version} Â· {s.spec.channels.map((c) => c.name).join(", ")}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label>Dataset version</label>
            <select value={dsvId} onChange={(e) => setDsvId(e.target.value)}>
              {datasetVersions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} ({d.content_hash.slice(0, 8)}â€¦)
                </option>
              ))}
            </select>
          </div>
          <button className="btn pri" disabled={busy} onClick={run}>
            {busy ? "Fittingâ€¦" : "Run"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Run history</h3>
        </div>
        <div className="card-b">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Status</th>
                  <th className="num">Holdout MAPE</th>
                  <th className="num">RÂ²</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <Fragment key={r.id}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      <td>
                        <b>{r.id.slice(0, 8)}</b> {r.is_champion && <span className="tag champ">champion</span>}
                      </td>
                      <td>
                        <span className={"tag " + statusTag(r.status)}>{r.status}</span>
                      </td>
                      <td className="num">{r.holdout_mape ?? "â€”"}%</td>
                      <td className="num">{r.r_squared ?? "â€”"}</td>
                      <td>
                        {r.status === "completed" && !r.is_champion && (
                          <button
                            className="btn sm pri"
                            onClick={(e) => {
                              e.stopPropagation();
                              promote(r.id);
                            }}
                          >
                            Promote
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr>
                        <td colSpan={5}>
                          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "8px 0" }}>
                            <div>
                              <b style={{ fontSize: 11.5 }}>Diagnostics</b>
                              <table>
                                <tbody>
                                  {Object.entries(r.diagnostics).map(([k, v]) => (
                                    <tr key={k}>
                                      <td className="muted">{k}</td>
                                      <td>
                                        <span className={"tag " + (v.status === "pass" ? "ok" : "warn")}>{v.status}</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div>
                              <b style={{ fontSize: 11.5 }}>Contributions</b>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Channel</th>
                                    <th className="num">Spend</th>
                                    <th className="num">Revenue</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(r.contributions).map(([name, c]) => (
                                    <tr key={name}>
                                      <td>{name}</td>
                                      <td className="num">Â£{c.spend}</td>
                                      <td className="num">Â£{c.revenue}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button className="btn" onClick={onBack}>
          Back
        </button>
        <button className="btn pri" disabled={!hasCompleted} onClick={onContinue}>
          Continue â†’
        </button>
      </div>
    </section>
  );
}

function WorkbookStep({
  runs,
  generated,
  onGenerate,
  onBack,
  onContinue,
}: {
  runs: ModelRun[];
  generated: boolean;
  onGenerate: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const candidate = runs.find((r) => r.status === "completed" && !r.is_champion) ?? runs.find((r) => r.status === "completed");
  return (
    <section>
      <div className="head">
        <div>
          <h1>Workbook</h1>
          <p>Validate the champion candidate at its lowest granular level before publishing.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-h">
          <h3>Build workbook</h3>
          <p className="muted">Run {candidate?.id.slice(0, 8) ?? "â€”"}</p>
        </div>
        <div className="card-b">
          {generated ? (
            <div className="out" style={{ marginTop: 0 }}>
              <h5>Workbook ready</h5>
              <ul>
                <li>
                  <b>File</b> V1_{candidate?.id.slice(0, 8)}.xlsx
                </li>
                <li>
                  <b>Contents</b> one sheet per channel, full grain preserved
                </li>
              </ul>
            </div>
          ) : (
            <button className="btn pri" onClick={onGenerate}>
              Generate workbook
            </button>
          )}
        </div>
      </div>
      <div className="out">
        <h5>Why this step exists</h5>
        <ul>
          <li>
            <b>Not a gate</b> generating a workbook doesn't block publish, but publish is disabled until this
            step is acknowledged.
          </li>
        </ul>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button className="btn" onClick={onBack}>
          Back to runs
        </button>
        <button className="btn pri" disabled={!generated} onClick={onContinue}>
          Continue to publish â†’
        </button>
      </div>
      {!generated && (
        <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
          Generate a workbook above to unlock Publish.
        </p>
      )}
    </section>
  );
}

function PublishStep({
  project,
  runs,
  workbookGenerated,
  setError,
  onBack,
  onPublished,
}: {
  project: Project;
  runs: ModelRun[];
  workbookGenerated: boolean;
  setError: (e: string | null) => void;
  onBack: () => void;
  onPublished: () => void;
}) {
  const candidate = runs.find((r) => r.status === "completed" && !r.is_champion) ?? runs.find((r) => r.status === "completed");
  const [busy, setBusy] = useState(false);
  const [proj, setProj] = useState(project);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function publish() {
    if (!candidate) return;
    setBusy(true);
    try {
      await api.promoteRun(candidate.id);
      onPublished();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const champion = runs.some((r) => r.is_champion);
  const shareUrl = proj.share_token ? `${window.location.origin}${window.location.pathname}?share=${proj.share_token}` : null;

  async function share() {
    setShareBusy(true);
    try {
      const updated = await api.shareProject(project.id);
      setProj(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setShareBusy(false);
    }
  }

  async function unshare() {
    setShareBusy(true);
    try {
      const updated = await api.unshareProject(project.id);
      setProj(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setShareBusy(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard permission denied -- the URL is still shown in the input, selectable by hand
    }
  }

  const checks: [string, boolean][] = [
    ["A completed run passed all diagnostics", !!candidate],
    ["Workbook exported and reviewed", workbookGenerated],
  ];
  const ready = checks.every(([, ok]) => ok);

  return (
    <section>
      <div className="head">
        <div>
          <h1>Publish to reporting</h1>
          <p>The gate between phases. Everything downstream reads from what you approve here.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-h">
          <h3>Approval â€” run {candidate?.id.slice(0, 8) ?? "â€”"}</h3>
          <span className={"tag " + (ready ? "ok" : "warn")}>{ready ? "Ready" : "Not ready"}</span>
        </div>
        <div className="card-b">
          <ul className="checklist">
            {checks.map(([t, ok]) => (
              <li key={t}>
                <span className={"tick " + (ok ? "y" : "n")}>{ok ? "âœ“" : ""}</span> {t}
              </li>
            ))}
          </ul>
          <div className="out">
            <h5>What publishing does</h5>
            <ul>
              <li>
                <b>Unseals</b> Marketing performance populates from this run
              </li>
              <li>
                <b>Champion</b> exclusive per project â€” promoting demotes the incumbent
              </li>
            </ul>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn" onClick={onBack}>
              Back to workbook
            </button>
            <button className="btn pri" disabled={!ready || busy} onClick={publish}>
              {busy ? "Publishingâ€¦" : "Publish as champion"}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <h3>Share with client</h3>
          <span className={"tag " + (proj.is_shared ? "ok" : "warn")}>{proj.is_shared ? "Shared" : "Not shared"}</span>
        </div>
        <div className="card-b">
          <p className="muted" style={{ marginBottom: 10 }}>
            A share link gives the client a login-gated view of Marketing performance for this project only â€” no Model
            studio, no other projects. Grant the client's users access with the <b>client_viewer</b> role, scoped to this
            project, from Admin â†’ Access levels.
          </p>
          {!champion && <p className="muted">Publish a champion above before sharing â€” the client would otherwise see a sealed report.</p>}
          {shareUrl && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input readOnly value={shareUrl} style={{ flex: 1, padding: "6px 9px", border: "1px solid var(--line-hard)", borderRadius: 3 }} />
              <button className="btn sm" onClick={copyLink}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {!proj.is_shared ? (
              <button className="btn pri" disabled={shareBusy} onClick={share}>
                {shareBusy ? "Generatingâ€¦" : "Generate share link"}
              </button>
            ) : (
              <button className="btn" disabled={shareBusy} onClick={unshare}>
                {shareBusy ? "Revokingâ€¦" : "Revoke share link"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
