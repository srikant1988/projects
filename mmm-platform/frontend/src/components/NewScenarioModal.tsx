import { useState } from "react";
import { ChannelSpec } from "../api";

/** Mirrors the reference "New scenario" wizard field-for-field. Per this
 * product's rule for reference-image builds: only Name -> create is wired to
 * a real call (POST /v1/scenarios, evaluated later against the champion's
 * response curves). Everything else here is real UI with no backing data or
 * engine support yet -- plan-basis inputs, forecast selection, the week/time
 * -period pickers, and the dimension breakdowns are all honest placeholders,
 * disabled or inert, so nothing implies a capability the API doesn't have.
 * Advertising channel count is the one number pulled from real data (the
 * champion spec's channel list). */

type SourceMode = "new" | "own" | "public";
type OptMode = "budget" | "total_sales" | "incremental_sales" | "reference" | "target_roi";
type WeekMode = "count" | "calendar_order" | "calendar_match";
type MediaPerf = "forecast" | "reference_period" | "historical_avg";
type InvestmentForecast = "reference_period" | "sellforte_forecast";
type RefPeriodMode = "last_year" | "same_as_optimize" | "recent" | "custom";

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.key} type="button" className="chip" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <h5 style={{ fontSize: 12.5, marginBottom: 10 }}>{title}</h5>
      {children}
    </div>
  );
}

function DimensionRow({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      disabled
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        padding: "9px 11px",
        marginBottom: 6,
        background: "var(--sunken)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        cursor: "not-allowed",
        color: "var(--ink)",
        fontSize: 12.5,
      }}
    >
      <span>{label}</span>
      <span className="muted">{value}</span>
    </button>
  );
}

export default function NewScenarioModal({
  channels,
  onClose,
  onCreate,
}: {
  channels: ChannelSpec[];
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [source, setSource] = useState<SourceMode>("new");
  const [name, setName] = useState("Scenario 1");
  const [optMode, setOptMode] = useState<OptMode>("budget");
  const [weekMode, setWeekMode] = useState<WeekMode>("count");
  const [mediaPerf, setMediaPerf] = useState<MediaPerf>("forecast");
  const [investment, setInvestment] = useState<InvestmentForecast>("reference_period");
  const [refPeriodMode, setRefPeriodMode] = useState<RefPeriodMode>("same_as_optimize");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await onCreate(name.trim() || "New scenario");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,24,31,.5)",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--panel)",
          borderRadius: "var(--r)",
          width: 640,
          maxWidth: "100%",
          boxShadow: "0 20px 50px -12px rgba(20,24,31,.35)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-h">
          <div>
            <h3>New scenario</h3>
            <p className="muted">Build a spend plan to evaluate against the champion model</p>
          </div>
          <button className="btn sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="card-b">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <ChipGroup
            value={source}
            onChange={setSource}
            options={[
              { key: "new", label: "New scenario" },
              { key: "own", label: "Copy own scenario" },
              { key: "public", label: "Copy public scenario" },
            ]}
          />
          {source !== "new" && (
            <p className="hint">Copying from an existing scenario isn't wired up yet — starting from a blank plan.</p>
          )}

          <Section title="Plan basis">
            <div className="field">
              <label>Reference period</label>
              <select disabled defaultValue="">
                <option value="" disabled>
                  Not connected yet
                </option>
              </select>
            </div>
            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Media plan <span className="tag idle">Coming soon</span>
              </label>
            </div>
          </Section>

          <Section title="Optimization mode">
            <ChipGroup
              value={optMode}
              onChange={setOptMode}
              options={[
                { key: "budget", label: "Budget optimization" },
                { key: "total_sales", label: "Total sales target" },
                { key: "incremental_sales", label: "Incremental sales target" },
                { key: "reference", label: "Reference scenario" },
                { key: "target_roi", label: "Target ROI" },
              ]}
            />
          </Section>

          <Section title="Default week selection">
            <ChipGroup
              value={weekMode}
              onChange={setWeekMode}
              options={[
                { key: "count", label: "Number of weeks" },
                { key: "calendar_order", label: "Calendar weeks (in order)" },
                { key: "calendar_match", label: "Calendar weeks (match week numbers)" },
              ]}
            />
          </Section>

          <Section title="Media performance selection">
            <ChipGroup
              value={mediaPerf}
              onChange={setMediaPerf}
              options={[
                { key: "forecast", label: "Use Sellforte performance forecast" },
                { key: "reference_period", label: "Use reference period media performance" },
                { key: "historical_avg", label: "Use historical average performance" },
              ]}
            />
          </Section>

          <Section title="Investment forecast selection">
            <ChipGroup
              value={investment}
              onChange={setInvestment}
              options={[
                { key: "reference_period", label: "Use reference period investment" },
                { key: "sellforte_forecast", label: "Use Sellforte forecast investment" },
              ]}
            />
          </Section>

          <Section title="Time period to optimize">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input readOnly value="W39 (09/20/2026)" style={{ flex: 1 }} />
              <span className="muted">→</span>
              <input readOnly value="W42 (10/11/2026)" style={{ flex: 1 }} />
              <button className="btn sm" type="button" disabled>
                Select
              </button>
            </div>
            <p className="hint">4 weeks</p>
          </Section>

          <Section title="Reference time period">
            <ChipGroup
              value={refPeriodMode}
              onChange={setRefPeriodMode}
              options={[
                { key: "last_year", label: "Use same weeks from last year" },
                { key: "same_as_optimize", label: "Use same weeks as time period to optimize" },
                { key: "recent", label: "Use most recent weeks" },
                { key: "custom", label: "Custom time period" },
              ]}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
              <input readOnly value="W39 (09/21/2025)" style={{ flex: 1 }} />
              <span className="muted">→</span>
              <input readOnly value="W42 (10/12/2025)" style={{ flex: 1 }} />
            </div>
            <p className="hint">4 weeks</p>
          </Section>

          <Section title="Dimensions">
            <DimensionRow label="Advertising channel" value={`${channels.length} of ${channels.length} selected`} />
            <DimensionRow label="Country" value="2 selected" />
            <DimensionRow label="Customer type" value="2 selected" />
            <DimensionRow label="Sales channel" value="2 selected" />
            <DimensionRow label="Product category" value="Overall" />
            <div className="field" style={{ marginTop: 8 }}>
              <label>Planning group</label>
              <select disabled defaultValue="">
                <option value="" disabled>
                  Not connected yet
                </option>
              </select>
            </div>
            <p className="hint">
              Dimension breakdowns aren't wired to real segment data yet — scenarios currently evaluate at the whole-project
              level via the champion's channel response curves.
            </p>
          </Section>
        </div>

        <div className="card-h" style={{ borderTop: "1px solid var(--line)", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn pri" disabled={busy} onClick={create}>
            {busy ? "Creating…" : "Create scenario"}
          </button>
        </div>
      </div>
    </div>
  );
}
