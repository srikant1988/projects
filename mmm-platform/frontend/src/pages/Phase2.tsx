import { useEffect, useState } from "react";
import { api, ModelRun, ModelSpec, Project, Scenario } from "../api";
import NewScenarioModal from "../components/NewScenarioModal";
import { BarChart, CurveChart, StackedBar, seriesColor } from "../components/charts";

type View = "grid" | "compare";
/** Sub-tabs shown only within the "Performance" section of the vertical nav. */
type PerformanceTab = "portfolio" | "drivers" | "tracking" | "reports";
export type P2Section = "performance" | "optimization" | "ai";

const PERFORMANCE_TAB_LABEL: Record<PerformanceTab, string> = {
  portfolio: "Portfolio",
  drivers: "Drivers",
  tracking: "Tracking",
  reports: "Reports",
};

function money(v: number) {
  return v >= 1 ? "£" + v.toFixed(2) + "M" : "£" + Math.round(v * 1000) + "K";
}

/** Marginal ROI is the derivative of the Hill response curve at current spend --
 * the doc is explicit this, not average ROI, should drive reallocation calls. */
function marginalRoi(spend: number, k: number, coefficient: number) {
  const scale = coefficient * 20;
  return (scale * k) / (spend + k) ** 2;
}

export default function Phase2({
  project,
  champion,
  specs,
  scenarios,
  reload,
  setError,
  section,
}: {
  project: Project;
  champion: ModelRun;
  specs: ModelSpec[];
  scenarios: Scenario[];
  reload: () => void;
  setError: (e: string | null) => void;
  section: P2Section;
}) {
  const [tab, setTab] = useState<PerformanceTab>("portfolio");

  const spec = specs.find((s) => s.id === champion.spec_id);

  const rows = Object.entries(champion.contributions).map(([name, c]) => {
    const curve = champion.response_curves[name];
    const mroi = curve ? marginalRoi(c.spend, curve.half_saturation, curve.coefficient) : 0;
    return { name, spend: c.spend, revenue: c.revenue, roi: c.revenue / c.spend, mroi };
  });
  const totalSpend = rows.reduce((a, r) => a + r.spend, 0);
  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
  const avgMroi = rows.reduce((a, r) => a + r.mroi * r.spend, 0) / totalSpend;

  return (
    <div>
      <div className="head">
        <div>
          <h1>Marketing performance</h1>
          <p>
            Champion run {champion.id.slice(0, 8)} · R² {champion.r_squared} · holdout MAPE {champion.holdout_mape}%
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <h4>Media spend</h4>
          <div className="v">{money(totalSpend)}</div>
        </div>
        <div className="kpi">
          <h4>Incremental revenue</h4>
          <div className="v">{money(totalRevenue)}</div>
        </div>
        <div className="kpi">
          <h4>Media ROI</h4>
          <div className="v">{(totalRevenue / totalSpend).toFixed(2)}</div>
        </div>
        <div className="kpi">
          <h4>Avg. marginal ROI</h4>
          <div className="v">{avgMroi.toFixed(2)}</div>
        </div>
      </div>

      {section === "performance" && (
        <>
          <div className="card" style={{ padding: 0 }}>
            <div className="vtabs" role="tablist">
              {(["portfolio", "drivers", "tracking", "reports"] as PerformanceTab[]).map((t) => (
                <button key={t} className="vtab" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                  {PERFORMANCE_TAB_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {tab === "portfolio" && <PortfolioTab rows={rows} totalSpend={totalSpend} totalRevenue={totalRevenue} avgMroi={avgMroi} />}
          {tab === "drivers" && <DriversTab rows={rows} />}
          {tab === "tracking" && <TrackingTab />}
          {tab === "reports" && (
            <ReportsTab project={project} champion={champion} rows={rows} totalSpend={totalSpend} totalRevenue={totalRevenue} />
          )}
        </>
      )}

      {section === "optimization" && (
        <ScenariosTab
          project={project}
          champion={champion}
          spec={spec}
          scenarios={scenarios}
          reload={reload}
          setError={setError}
        />
      )}

      {section === "ai" && <AiAgentTab project={project} champion={champion} />}
    </div>
  );
}

/** A collapsible filter-tree section in the Portfolio left rail. Only
 * "Advertising channel" (passed as children by the caller) is backed by a
 * real dimension in this build -- Geographies/Products/Sales
 * Channels/Tactics/Campaigns are rendered exactly like the reference layout
 * but disabled, since this project has no geo/product/campaign breakdown to
 * filter by yet (the champion model reports one whole-project total per
 * channel, not a dimensional cube). */
function FilterSection({
  title,
  disabled,
  children,
}: {
  title: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(!disabled);
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 14px",
          background: "none",
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 12.5,
          fontWeight: 600,
          color: disabled ? "var(--ink-3)" : "var(--ink)",
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10 }}>{disabled ? "not modeled" : open ? "▾" : "▸"}</span>
      </button>
      {open && !disabled && <div style={{ padding: "0 14px 12px" }}>{children}</div>}
    </div>
  );
}

function PortfolioTab({
  rows,
  totalSpend,
  totalRevenue,
  avgMroi,
}: {
  rows: { name: string; spend: number; revenue: number; roi: number; mroi: number }[];
  totalSpend: number;
  totalRevenue: number;
  avgMroi: number;
}) {
  const [view, setView] = useState<View>("grid");
  const [search, setSearch] = useState("");
  const [dimension, setDimension] = useState("channel");

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = filtered.slice().sort((a, b) => b.spend - a.spend);
  const maxRevenue = Math.max(...sorted.map((r) => r.revenue), 1);
  const maxSpendChange = Math.max(...sorted.map((r) => Math.abs((r.mroi - avgMroi) * r.spend * 0.15)), 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12 }}>
      {/* Left: filter rail, mirrors the reference's scope + dimension tree */}
      <div className="card" style={{ margin: 0, padding: 0 }}>
        <div className="card-h">
          <h3 style={{ fontSize: 13 }}>Default scope</h3>
        </div>
        <FilterSection title="Advertising channel">
          <input
            placeholder="Search channels…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "6px 9px", border: "1px solid var(--line-hard)", borderRadius: 3, marginBottom: 8 }}
          />
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {rows.map((r) => (
              <label key={r.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, padding: "3px 0" }}>
                <input type="checkbox" checked disabled />
                {r.name}
              </label>
            ))}
          </div>
        </FilterSection>
        <FilterSection title="Geographies" disabled />
        <FilterSection title="Products" disabled />
        <FilterSection title="Sales Channels" disabled />
        <FilterSection title="Tactics" disabled />
        <FilterSection title="Campaigns" disabled />
        <p className="hint" style={{ padding: "10px 14px" }}>
          This project's champion model reports one total per advertising channel — it isn't broken down by
          geography, product, sales channel, tactic, or campaign, so those filters aren't wired to real data.
        </p>
      </div>

      {/* Right: view toggle, dimension/level chips, and the data grid */}
      <div className="card" style={{ margin: 0 }}>
        <div className="card-h" style={{ borderTop: "none", flexWrap: "wrap", gap: 8 }}>
          <div className="chips">
            <span className="lbl">View</span>
            <button className="chip" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
              Grid
            </button>
            <button className="chip" disabled title="No geo data to map">
              Map
            </button>
            <button className="chip" disabled title="No weekly time series exposed by the API yet">
              Time series
            </button>
            <button className="chip" aria-pressed={view === "compare"} onClick={() => setView("compare")}>
              Chart
            </button>
          </div>
          <div className="chips">
            <span className="lbl">Dimension</span>
            <button className="chip" aria-pressed={dimension === "channel"} onClick={() => setDimension("channel")}>
              Advertising channel
            </button>
            {["Geographies", "Products", "Sales Channels", "Tactics", "Campaigns"].map((d) => (
              <button key={d} className="chip" disabled title="Not modeled in this build">
                {d}
              </button>
            ))}
          </div>
        </div>

        {view === "grid" ? (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="num">Spend</th>
                  <th className="num">Incr. sales</th>
                  <th className="num">Incr. brand</th>
                  <th className="num">Incr. LT sales</th>
                  <th className="num">Spend change</th>
                  <th className="num">Incr. sales change</th>
                </tr>
              </thead>
              <tbody>
                <tr className="rollup">
                  <td>Total</td>
                  <td className="num">{money(totalSpend)}</td>
                  <td className="num">{money(totalRevenue)}</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                </tr>
                {sorted.map((r) => {
                  // "Opportunity" scaled to a suggested spend shift: a channel
                  // whose marginal ROI beats the portfolio average gets a
                  // positive nudge, one below it a negative one -- same
                  // marginal-ROI-vs-average logic as the old Opportunity column.
                  const spendChange = (r.mroi - avgMroi) * r.spend * 0.15;
                  const salesChange = spendChange * r.roi;
                  return (
                    <tr key={r.name}>
                      <td>
                        <b>{r.name}</b>
                      </td>
                      <td className="num">{money(r.spend)}</td>
                      <td className="num">
                        <div className="bcell">
                          <div className="btrack">
                            <i style={{ width: (r.revenue / maxRevenue) * 100 + "%" }} />
                          </div>
                          {money(r.revenue)}
                        </div>
                      </td>
                      <td className="num muted">—</td>
                      <td className="num muted">—</td>
                      <td className="num">
                        <div className="bcell">
                          <div className="btrack">
                            <i
                              style={{
                                width: (Math.abs(spendChange) / maxSpendChange) * 100 + "%",
                                background: spendChange >= 0 ? "var(--pos)" : "var(--neg)",
                              }}
                            />
                          </div>
                          <span className={spendChange >= 0 ? "up" : "down"}>
                            {spendChange >= 0 ? "▲" : "▼"} {money(Math.abs(spendChange))}
                          </span>
                        </div>
                      </td>
                      <td className={"num " + (salesChange >= 0 ? "up" : "down")}>
                        {salesChange >= 0 ? "▲" : "▼"} {money(Math.abs(salesChange))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-b">
            <BarChart data={sorted} valueKey="revenue" labelKey="name" formatValue={money} />
          </div>
        )}

        <div className="out">
          <h5>Reading this</h5>
          <ul>
            <li>
              <b>Spend change / Incr. sales change</b> is a suggested reallocation, not a forecast — it's driven by
              marginal ROI vs. the portfolio average, the same logic as Optimization dashboard's optimizer, scaled
              down to a directional nudge.
            </li>
            <li>
              <b>Incr. brand</b> and <b>Incr. LT sales</b> mirror the reference layout's columns but aren't modeled
              here — this engine only fits a single sales-equivalent outcome variable per project.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function DriversTab({ rows }: { rows: { name: string; spend: number; revenue: number; roi: number; mroi: number }[] }) {
  const sorted = rows.slice().sort((a, b) => b.revenue - a.revenue);
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h3>Revenue contribution by channel</h3>
          <p className="muted">Incremental revenue attributed to each channel by the champion model</p>
        </div>
      </div>
      <div className="card-b">
        <BarChart data={sorted} valueKey="revenue" labelKey="name" formatValue={money} />
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th className="num">Spend</th>
              <th className="num">Incr. revenue</th>
              <th className="num">Share of total</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const total = sorted.reduce((a, x) => a + x.revenue, 0);
              return (
                <tr key={r.name}>
                  <td>
                    <b>{r.name}</b>
                  </td>
                  <td className="num">{money(r.spend)}</td>
                  <td className="num">{money(r.revenue)}</td>
                  <td className="num">{((r.revenue / total) * 100).toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScenariosTab({
  project,
  champion,
  spec,
  scenarios,
  reload,
  setError,
}: {
  project: Project;
  champion: ModelRun;
  spec: ModelSpec | undefined;
  scenarios: Scenario[];
  reload: () => void;
  setError: (e: string | null) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  async function create(name: string) {
    try {
      const scn = await api.createScenario(project.id, champion.id, name);
      setOpenId(scn.id);
      reload();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }

  const open = scenarios.find((s) => s.id === openId);

  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h3>Scenarios</h3>
          <p className="muted">Evaluated against the champion's cached response curves — no refitting happens</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn sm"
            aria-label="Open saved scenarios"
            title="Open saved scenarios"
            onClick={() => setShowSaved((v) => !v)}
          >
            📁
          </button>
          <button className="btn pri sm" onClick={() => setShowNew(true)}>
            + New scenario
          </button>
        </div>
      </div>
      <div className="card-b">
        {showSaved && (
          <div className="hint" style={{ marginBottom: 10 }}>
            Saved-scenario folders (shared/team libraries) aren't wired up yet — every scenario created here already
            appears in the table below.
          </div>
        )}
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Total spend</th>
                <th className="num">Revenue</th>
                <th className="num">ROI</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.name}</b>
                  </td>
                  <td className="num">{"total_spend" in s.results ? money(s.results.total_spend) : "—"}</td>
                  <td className="num">{"total_revenue" in s.results ? money(s.results.total_revenue) : "—"}</td>
                  <td className="num">{"roi" in s.results ? s.results.roi : "—"}</td>
                  <td>
                    <button className="btn sm" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                      {openId === s.id ? "Close" : "Open"}
                    </button>
                  </td>
                </tr>
              ))}
              {scenarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No scenarios yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && <ScenarioDetail scenario={open} champion={champion} spec={spec} reload={reload} setError={setError} />}

      {showNew && (
        <NewScenarioModal channels={spec?.spec.channels ?? []} onClose={() => setShowNew(false)} onCreate={create} />
      )}
    </div>
  );
}

type ResultView = "charts" | "table" | "timeseries" | "curves";

/** Real, disabled dimension filter used in the media-optimizer result header
 * -- honest placeholder, see the note at the bottom of the results panel. */
function FilterField({ label, value }: { label: string; value: string }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label style={{ fontSize: 10.5 }}>{label}</label>
      <select disabled value="" style={{ fontSize: 11.5 }}>
        <option value="">{value}</option>
      </select>
    </div>
  );
}

function ScenarioDetail({
  scenario,
  champion,
  spec,
  reload,
  setError,
}: {
  scenario: Scenario;
  champion: ModelRun;
  spec: ModelSpec | undefined;
  reload: () => void;
  setError: (e: string | null) => void;
}) {
  const channels = Object.keys(champion.response_curves);
  const [plan, setPlan] = useState<Record<string, number>>(scenario.plan);
  const [curveChannel, setCurveChannel] = useState(channels[0]);
  const [curvePoints, setCurvePoints] = useState<{ spend: number; revenue: number }[]>([]);
  const [budget, setBudget] = useState(Object.values(scenario.plan).reduce((a, b) => a + b, 0) || 20);
  const [quickPct, setQuickPct] = useState(0);
  const [resultView, setResultView] = useState<ResultView>("charts");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPlan(scenario.plan);
  }, [scenario.id]);

  useEffect(() => {
    const curve = champion.response_curves[curveChannel];
    if (!curve) return;
    const maxSpend = Math.max((plan[curveChannel] ?? 0) * 2, 20);
    api
      .responseCurve(champion.id, curveChannel, maxSpend)
      .then(setCurvePoints)
      .catch(() => setCurvePoints([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curveChannel, champion.id]);

  function bounds(name: string) {
    const c = spec?.spec.channels.find((ch) => ch.name === name);
    const fallbackMax = (plan[name] ?? 10) * 2 || 10;
    return { min: c?.min ?? 0, max: c?.max ?? fallbackMax };
  }

  async function applyPlan(nextPlan: Record<string, number>) {
    setBusy(true);
    try {
      const updated = await api.evaluateScenario(scenario.id, nextPlan);
      setPlan(updated.plan);
      setStatus("Scenario updated successfully!");
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function optimize() {
    setBusy(true);
    try {
      const boundsMap: Record<string, { min: number; max: number }> = {};
      channels.forEach((c) => (boundsMap[c] = bounds(c)));
      const updated = await api.optimizeScenario(scenario.id, budget, boundsMap);
      setPlan(updated.plan);
      setStatus("Scenario optimized successfully!");
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function revert() {
    setPlan(scenario.plan);
    setStatus(null);
  }

  function applyQuickPct(pct: number) {
    setQuickPct(pct);
    const next: Record<string, number> = {};
    channels.forEach((ch) => {
      const b = bounds(ch);
      const scaled = (plan[ch] ?? 0) * (1 + pct / 100);
      next[ch] = Math.min(b.max, Math.max(b.min, scaled));
    });
    setPlan(next);
  }

  function exportCsv() {
    const rows = [["Media", "Media Investment", "Inc. Sales", "ROI"]];
    channels.forEach((ch) => {
      const r = "per_channel" in scenario.results ? scenario.results.per_channel[ch] : undefined;
      const spend = r?.spend ?? plan[ch] ?? 0;
      const revenue = r?.revenue ?? 0;
      rows.push([ch, spend.toFixed(2), revenue.toFixed(2), spend > 0 ? (revenue / spend).toFixed(2) : "—"]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scenario.name.replace(/\s+/g, "_")}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentRevenue = curvePoints.length
    ? (() => {
        const curve = champion.response_curves[curveChannel];
        const s = plan[curveChannel] ?? 0;
        const sat = s > 0 ? s / (s + curve.half_saturation) : 0;
        return curve.coefficient * sat * 20;
      })()
    : 0;

  const hasResults = "per_channel" in scenario.results;
  const segments = channels.map((ch) => ({
    label: ch,
    value: (hasResults ? scenario.results.per_channel[ch]?.spend : plan[ch]) ?? plan[ch] ?? 0,
  }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 12, marginTop: 12, alignItems: "start" }}>
      {/* Left: plan controls, mirrors the media-optimizer's left rail */}
      <div className="card" style={{ margin: 0 }}>
        <div className="card-h">
          <span className="tag idle" style={{ fontWeight: 600 }}>
            {scenario.name}
          </span>
          <span className="muted" title="Saved-scenario folders and tabs aren't wired up yet" style={{ fontSize: 15 }}>
            📁
          </span>
        </div>
        <div className="card-b">
          <div className="field">
            <label>Time period to optimize</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input readOnly value="W39 (09/20/2026)" style={{ fontSize: 11 }} />
              <span className="muted">→</span>
              <input readOnly value="W42 (10/11/2026)" style={{ fontSize: 11 }} />
            </div>
          </div>

          <div className="field">
            <label>Budget optimization ($)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div className="field">
            <label>Reference time period</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input readOnly value="W39 (09/21/2025)" style={{ fontSize: 11 }} />
              <span className="muted">→</span>
              <input readOnly value="W42 (10/12/2025)" style={{ fontSize: 11 }} />
            </div>
          </div>

          <div className="field">
            <label>Promo scenario</label>
            <select disabled defaultValue="">
              <option value="">Last 12 weeks</option>
            </select>
          </div>
          <div className="field">
            <label>Baseline scenario</label>
            <select disabled defaultValue="">
              <option value="">Last 12 weeks</option>
            </select>
          </div>

          <div className="field">
            <label>Grouping by</label>
            <p className="muted" style={{ fontSize: 12 }}>
              Advertising channel
            </p>
          </div>

          <div className="field">
            <label>Apply quick selection to selection</label>
            <div className="chips">
              <button type="button" className="chip" onClick={() => applyQuickPct(0)}>
                Reset
              </button>
              {[-5, -10, -20, -30].map((p) => (
                <button key={p} type="button" className="chip" onClick={() => applyQuickPct(p)}>
                  {p}%
                </button>
              ))}
              <button
                type="button"
                className="chip"
                onClick={() => {
                  const next: Record<string, number> = {};
                  channels.forEach((ch) => {
                    const b = bounds(ch);
                    next[ch] = b.max;
                  });
                  setPlan(next);
                }}
              >
                Full range
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
              <input
                type="number"
                value={quickPct}
                onChange={(e) => setQuickPct(Number(e.target.value))}
                style={{ width: 70 }}
              />
              <span className="muted">%</span>
              <button type="button" className="btn sm" onClick={() => applyQuickPct(quickPct)}>
                Apply
              </button>
            </div>
          </div>

          <div className="field">
            <label>Group by</label>
            <div className="chips">
              {["None", "Ad platform", "Advertising channel", "Country"].map((g) => (
                <button key={g} type="button" className="chip" aria-pressed={g === "Advertising channel"} disabled>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Media investment budget boundaries</span>
            </label>
            {channels.map((ch, i) => {
              const b = bounds(ch);
              return (
                <div className="slider" key={ch}>
                  <label onClick={() => setCurveChannel(ch)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: seriesColor(i), display: "inline-block" }} />
                    {ch}
                  </label>
                  <input
                    type="range"
                    min={b.min}
                    max={b.max}
                    step={0.01}
                    value={plan[ch] ?? 0}
                    onChange={(e) => setPlan({ ...plan, [ch]: Number(e.target.value) })}
                    onFocus={() => setCurveChannel(ch)}
                  />
                  <span className="v">{money(plan[ch] ?? 0)}</span>
                </div>
              );
            })}
          </div>

          {status && (
            <div className="tag ok" style={{ display: "block", padding: "8px 10px", marginTop: 6, marginBottom: 6 }}>
              {status}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn sm" disabled={busy} onClick={() => applyPlan(plan)}>
              {busy ? "Working…" : "Evaluate plan"}
            </button>
            <button className="btn pri sm" disabled={busy} onClick={optimize}>
              {busy ? "Optimizing…" : "Optimize!"}
            </button>
            <button className="btn sm" onClick={revert}>
              Revert
            </button>
          </div>
        </div>
      </div>

      {/* Right: result views, mirrors Result charts / Result table / Timeseries / Response curves */}
      <div className="card" style={{ margin: 0 }}>
        <div className="card-h" style={{ flexWrap: "wrap", gap: 6 }}>
          <div className="chips">
            {(
              [
                { key: "charts", label: "Result Charts" },
                { key: "table", label: "Result Table" },
                { key: "timeseries", label: "Timeseries" },
                { key: "curves", label: "Response curves" },
              ] as { key: ResultView; label: string }[]
            ).map((t) => (
              <button key={t.key} className="chip" aria-pressed={resultView === t.key} onClick={() => setResultView(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <button className="btn sm" onClick={exportCsv}>
            ⬇ Export
          </button>
        </div>
        <div className="card-b">
          <div className="g3" style={{ marginBottom: 14 }}>
            <FilterField label="Ad platform" value="13 selected" />
            <FilterField label="Advertising channel" value={`${channels.length} selected`} />
            <FilterField label="Country" value="2 selected" />
            <FilterField label="Customer type" value="2 selected" />
            <FilterField label="Sales Channel" value="2 selected" />
            <FilterField label="Product category" value="Overall" />
          </div>

          {resultView === "charts" && (
            <>
              <StackedBar segments={segments} />
              <div className="chips" style={{ marginTop: 12 }}>
                {channels.map((ch, i) => (
                  <span key={ch} className="chips" style={{ fontSize: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: seriesColor(i), display: "inline-block" }} />
                    {ch}
                  </span>
                ))}
              </div>
              {!hasResults && <p className="hint">Evaluate or optimize the plan to see modeled spend split.</p>}
            </>
          )}

          {resultView === "table" && (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Media</th>
                    <th className="num">Media investment ($)</th>
                    <th className="num">Inc. sales ($)</th>
                    <th className="num">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((ch) => {
                    const r = hasResults ? scenario.results.per_channel[ch] : undefined;
                    const spend = r?.spend ?? plan[ch] ?? 0;
                    const revenue = r?.revenue;
                    return (
                      <tr key={ch}>
                        <td>{ch}</td>
                        <td className="num">{spend.toFixed(2)}</td>
                        <td className="num">{revenue !== undefined ? revenue.toFixed(2) : "—"}</td>
                        <td className="num">{revenue !== undefined && spend > 0 ? (revenue / spend).toFixed(2) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {resultView === "timeseries" && (
            <div style={{ textAlign: "center", padding: 30 }}>
              <p className="muted" style={{ marginBottom: 6 }}>
                Weekly plan-vs-time breakdown isn't available yet — the engine returns whole-period totals per
                channel, not a weekly series.
              </p>
              <p className="muted" style={{ fontSize: 11.5 }}>
                See the Tracking tab under Performance for the closest available signal today.
              </p>
            </div>
          )}

          {resultView === "curves" && (
            <>
              <div className="chips" style={{ marginBottom: 10 }}>
                {channels.map((ch) => (
                  <button key={ch} className="chip" aria-pressed={curveChannel === ch} onClick={() => setCurveChannel(ch)}>
                    {ch}
                  </button>
                ))}
              </div>
              <CurveChart points={curvePoints} currentSpend={plan[curveChannel] ?? 0} currentRevenue={currentRevenue} />
            </>
          )}

          <p className="hint" style={{ marginTop: 14 }}>
            Ad platform / Country / Customer type / Sales Channel / Product category filters mirror the reference
            layout but aren't backed by real segment data yet — every number here is at the whole-project level from
            the champion's cached response curves.
          </p>
        </div>
      </div>
    </div>
  );
}

function TrackingTab() {
  return (
    <div className="card">
      <div className="card-b" style={{ textAlign: "center", padding: 40 }}>
        <p className="muted" style={{ marginBottom: 8 }}>
          Plan-versus-actual tracking needs a scheduled refresh against updated ingestion data (doc section 2.3,
          journey 5), which this build doesn't have a pipeline for yet.
        </p>
        <p className="muted" style={{ fontSize: 11.5 }}>
          The champion's holdout diagnostics on the Runs step are the closest available signal today.
        </p>
      </div>
    </div>
  );
}

function ReportsTab({
  project,
  champion,
  rows,
  totalSpend,
  totalRevenue,
}: {
  project: Project;
  champion: ModelRun;
  rows: { name: string; spend: number; revenue: number; roi: number; mroi: number }[];
  totalSpend: number;
  totalRevenue: number;
}) {
  const [title, setTitle] = useState(`${project.name} — Marketing Performance Report`);
  const [periodLabel, setPeriodLabel] = useState("Current period");
  const [comparisonLabel, setComparisonLabel] = useState("");
  const [clientName, setClientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setErr(null);
    try {
      const { buildReportDeck } = await import("../reportDeck");
      const blob = await buildReportDeck({
        title,
        periodLabel,
        comparisonLabel,
        clientName,
        projectName: project.name,
        runId: champion.id,
        rSquared: champion.r_squared,
        holdoutMape: champion.holdout_mape,
        totalSpend,
        totalRevenue,
        rows,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, "_")}_report.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e.message ?? "Failed to build the deck");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h3>Report builder</h3>
          <p className="muted">Exports a PPTX built entirely from this project's champion run — no fabricated figures</p>
        </div>
      </div>
      <div className="card-b">
        {err && <div className="error">{err}</div>}
        <div className="g2">
          <div className="field">
            <label>Report title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Client / audience name (optional)</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Aurelia Beauty" />
          </div>
          <div className="field">
            <label>Period label</label>
            <input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="e.g. H1 2026" />
          </div>
          <div className="field">
            <label>Comparison period label (optional)</label>
            <input
              value={comparisonLabel}
              onChange={(e) => setComparisonLabel(e.target.value)}
              placeholder="e.g. H1 2025"
            />
          </div>
        </div>

        <div className="out" style={{ marginTop: 6 }}>
          <h5>What's in the deck</h5>
          <ul>
            <li>Title slide with the labels above</li>
            <li>KPI summary — media spend, incremental revenue, ROI, and a spend-by-channel chart (real, from the champion run)</li>
            <li>Channel investment table — spend / revenue / ROI / marginal ROI per channel</li>
          </ul>
        </div>
        <p className="hint">
          PDF and Excel export, and multi-period trend slides, aren't built yet — only what's shown above is generated.
        </p>

        <button className="btn pri sm" disabled={busy} onClick={download} style={{ marginTop: 10 }}>
          {busy ? "Building…" : "⬇ Download PPTX"}
        </button>
      </div>
    </div>
  );
}

/* ---- AI Agent -----------------------------------------------------------
 * Layout/interaction only ported from a reference screenshot of another
 * product's agent UI -- colors, radii and type all come from this product's
 * own tokens (--panel/--line/--accent/--r etc.), nothing copied from the
 * source image. There is no live model behind this yet: sending a prompt
 * appends it to a local conversation and returns one canned notice rather
 * than fabricating an answer -- an honest not-wired-up state, same as
 * Tracking/Reports above, until a real agent endpoint exists. */
type ChatMessage = { role: "user" | "assistant"; text: string };

const AI_PROMPTS: { question: string; category: string }[] = [
  { question: "How should I allocate my media budget for the next 4 weeks to maximize sales?", category: "Planning" },
  { question: "How should I allocate my current Meta budget to maximize sales?", category: "Planning" },
  { question: "What were my top performing channels in the most recent weeks?", category: "Analysis" },
  { question: "What were my worst performing channels in the most recent weeks?", category: "Analysis" },
  { question: "What is our current forecasted uplift in media-driven sales for the next 4 weeks?", category: "Forecasting" },
  { question: "How did promotions impact recent sales?", category: "Promotions" },
];

function AiAgentTab({ project, champion }: { project: Project; champion: ModelRun }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setDraft("");
    setSending(true);
    // No agent backend exists yet -- see file header note.
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `The AI Agent isn't connected to a live model for ${project.name} yet. Once wired up, this will answer against champion run ${champion.id.slice(0, 8)}.`,
        },
      ]);
      setSending(false);
    }, 400);
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-h">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3>AI Agent</h3>
          <span className="tag idle">BETA</span>
        </div>
      </div>
      <div style={{ display: "flex", minHeight: 480 }}>
        <div style={{ width: 220, flex: "none", borderRight: "1px solid var(--line)", padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", marginBottom: 10, letterSpacing: ".02em" }}>
            HISTORY
          </div>
          {messages.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
              No conversations yet. Start chatting with the AI to see your conversation history here!
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
              1 conversation this session.
            </p>
          )}
          <button className="btn sm" style={{ width: "100%", marginTop: 14 }} disabled>
            Manage conversations
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 22 }}>
          {messages.length === 0 ? (
            <>
              <h1 style={{ textAlign: "center", marginTop: 24, marginBottom: 22 }}>What can I help you with today?</h1>
              <div style={{ display: "flex", gap: 8, maxWidth: 640, margin: "0 auto", width: "100%" }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(draft)}
                  placeholder="I want to…"
                  style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--line-hard)", borderRadius: "var(--r)" }}
                />
                <button className="btn pri" onClick={() => send(draft)} aria-label="Send">
                  ➤
                </button>
              </div>
              <div
                className="g2"
                style={{ maxWidth: 780, margin: "22px auto 0", width: "100%" }}
              >
                {AI_PROMPTS.map((p) => (
                  <button
                    key={p.question}
                    onClick={() => send(p.question)}
                    style={{
                      textAlign: "left",
                      padding: 13,
                      background: "var(--panel)",
                      border: "1px solid var(--line-hard)",
                      borderRadius: "var(--r)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 12.5, color: "var(--accent)", lineHeight: 1.4, marginBottom: 8 }}>
                      {p.question}
                    </div>
                    <span className="tag idle">{p.category}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "72%",
                      background: m.role === "user" ? "var(--accent-dim)" : "var(--sunken)",
                      border: "1px solid " + (m.role === "user" ? "#D3D2EE" : "var(--line)"),
                      borderRadius: "var(--r)",
                      padding: "8px 11px",
                      fontSize: 12.5,
                      lineHeight: 1.5,
                    }}
                  >
                    {m.text}
                  </div>
                ))}
                {sending && (
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    Thinking…
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(draft)}
                  placeholder="I want to…"
                  style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--line-hard)", borderRadius: "var(--r)" }}
                />
                <button className="btn pri" onClick={() => send(draft)} aria-label="Send">
                  ➤
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
