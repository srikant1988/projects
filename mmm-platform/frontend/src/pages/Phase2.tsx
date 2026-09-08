import { useEffect, useState } from "react";
import { api, ModelRun, ModelSpec, Project, Scenario } from "../api";
import { BarChart, CurveChart } from "../components/charts";

type View = "grid" | "compare";
type Tab = "portfolio" | "drivers" | "scenarios" | "tracking" | "reports";

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
}: {
  project: Project;
  champion: ModelRun;
  specs: ModelSpec[];
  scenarios: Scenario[];
  reload: () => void;
  setError: (e: string | null) => void;
}) {
  const [tab, setTab] = useState<Tab>("portfolio");

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

      <div className="card" style={{ padding: 0 }}>
        <div className="vtabs" role="tablist">
          {(["portfolio", "drivers", "scenarios", "tracking", "reports"] as Tab[]).map((t) => (
            <button key={t} className="vtab" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === "portfolio" && <PortfolioTab rows={rows} totalSpend={totalSpend} totalRevenue={totalRevenue} avgMroi={avgMroi} />}
      {tab === "drivers" && <DriversTab rows={rows} />}
      {tab === "scenarios" && (
        <ScenariosTab
          project={project}
          champion={champion}
          spec={spec}
          scenarios={scenarios}
          reload={reload}
          setError={setError}
        />
      )}
      {tab === "tracking" && <TrackingTab />}
      {tab === "reports" && <ReportsTab />}
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
  const sorted = rows.slice().sort((a, b) => b.spend - a.spend);
  const maxRevenue = Math.max(...sorted.map((r) => r.revenue), 1);

  return (
    <div className="card">
      <div className="card-h" style={{ borderTop: "none" }}>
        <div className="chips">
          <span className="lbl">View</span>
          <button className="chip" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
            Grid
          </button>
          <button className="chip" aria-pressed={view === "compare"} onClick={() => setView("compare")}>
            Compare
          </button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th className="num">Spend</th>
                <th className="num">Incr. revenue</th>
                <th className="num">ROI</th>
                <th className="num">Marginal ROI</th>
                <th className="num">Opportunity</th>
              </tr>
            </thead>
            <tbody>
              <tr className="rollup">
                <td>Total</td>
                <td className="num">{money(totalSpend)}</td>
                <td className="num">{money(totalRevenue)}</td>
                <td className="num">{(totalRevenue / totalSpend).toFixed(2)}</td>
                <td className="num">—</td>
                <td className="num">—</td>
              </tr>
              {sorted.map((r) => {
                const opp = (r.mroi - avgMroi) * r.spend * 0.42;
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
                    <td className="num">{r.roi.toFixed(2)}</td>
                    <td className="num">{r.mroi.toFixed(2)}</td>
                    <td className={"num " + (opp > 0 ? "up" : "down")}>
                      {opp > 0 ? "▲" : "▼"} {money(Math.abs(opp))}
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
            <b>Marginal ROI</b> drives the opportunity column, not average ROI — it's the derivative of each
            channel's saturation curve at current spend, so a channel deep into diminishing returns can average
            well above the portfolio while returning little on the next pound.
          </li>
        </ul>
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
  const [name, setName] = useState("New scenario");
  const [openId, setOpenId] = useState<string | null>(null);

  async function create() {
    try {
      const scn = await api.createScenario(project.id, champion.id, name);
      setOpenId(scn.id);
      reload();
    } catch (err: any) {
      setError(err.message);
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
      </div>
      <div className="card-b">
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
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, padding: "6px 9px", border: "1px solid var(--line-hard)", borderRadius: 3 }}
          />
          <button className="btn pri sm" onClick={create}>
            Create scenario
          </button>
        </div>
      </div>

      {open && <ScenarioDetail scenario={open} champion={champion} spec={spec} reload={reload} setError={setError} />}
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

  async function applyPlan() {
    try {
      const updated = await api.evaluateScenario(scenario.id, plan);
      setPlan(updated.plan);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function optimize() {
    try {
      const boundsMap: Record<string, { min: number; max: number }> = {};
      channels.forEach((c) => (boundsMap[c] = bounds(c)));
      const updated = await api.optimizeScenario(scenario.id, budget, boundsMap);
      setPlan(updated.plan);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const currentRevenue = curvePoints.length
    ? (() => {
        const curve = champion.response_curves[curveChannel];
        const s = plan[curveChannel] ?? 0;
        const sat = s > 0 ? s / (s + curve.half_saturation) : 0;
        return curve.coefficient * sat * 20;
      })()
    : 0;

  return (
    <div className="g2" style={{ marginTop: 12 }}>
      <div className="card" style={{ margin: 0 }}>
        <div className="card-h">
          <h3>Plan</h3>
        </div>
        <div className="card-b">
          {channels.map((ch) => {
            const b = bounds(ch);
            return (
              <div className="slider" key={ch}>
                <label onClick={() => setCurveChannel(ch)} style={{ cursor: "pointer" }}>
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
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn pri sm" onClick={applyPlan}>
              Evaluate plan
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <label style={{ margin: 0 }}>Budget for optimiser £M</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              style={{ width: 90, padding: "6px 9px", border: "1px solid var(--line-hard)", borderRadius: 3 }}
            />
            <button className="btn sm" onClick={optimize}>
              Optimise allocation
            </button>
          </div>
          {"total_revenue" in scenario.results && (
            <p className="muted" style={{ marginTop: 10 }}>
              {money(scenario.results.total_spend)} spend → {money(scenario.results.total_revenue)} revenue · ROI{" "}
              {scenario.results.roi}
            </p>
          )}
        </div>
      </div>
      <div className="card" style={{ margin: 0 }}>
        <div className="card-h">
          <h3>Response curve</h3>
          <p className="muted">{curveChannel}</p>
        </div>
        <div className="card-b">
          <CurveChart points={curvePoints} currentSpend={plan[curveChannel] ?? 0} currentRevenue={currentRevenue} />
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

function ReportsTab() {
  return (
    <div className="card">
      <div className="card-h">
        <h3>Report builder</h3>
      </div>
      <div className="card-b" style={{ textAlign: "center", padding: 40 }}>
        <p className="muted">Export rendering (PPT/PDF/Excel) isn't wired up in this build.</p>
        <p className="muted" style={{ fontSize: 11.5 }}>
          Every figure on Portfolio/Drivers/Scenarios already traces to champion run and can be read via the API.
        </p>
      </div>
    </div>
  );
}
