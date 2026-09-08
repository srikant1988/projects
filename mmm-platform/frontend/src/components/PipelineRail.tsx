export type StepDef = { title: string; subtitle: string };

export default function PipelineRail({
  steps,
  step,
  done,
  onStep,
  published,
}: {
  steps: StepDef[];
  step: number;
  done: boolean[];
  onStep: (i: number) => void;
  published: boolean;
}) {
  const completedCount = done.filter(Boolean).length;
  const pct = published ? 100 : Math.round((completedCount / steps.length) * 100);

  return (
    <aside className="rail">
      <div className="rail-h">Model pipeline</div>
      <div className="pipe">
        {steps.map((s, i) => {
          const state = done[i] ? "done" : i === step ? "active" : "idle";
          const unlocked = i === 0 || done[i - 1];
          return (
            <button
              key={s.title}
              className="step"
              data-state={state}
              aria-current={i === step}
              disabled={!unlocked}
              onClick={() => onStep(i)}
            >
              <span className="dot">{done[i] ? "✓" : i + 1}</span>
              <span>
                <span className="step-t">{s.title}</span>
                <span className="step-s">{done[i] ? "Complete" : s.subtitle}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className={"seal" + (published ? " open" : "")}>
        <div className="seal-t">
          <span>{published ? "✓" : "🔒"}</span>
          <span>{published ? "Reporting is live" : "Reporting is sealed"}</span>
        </div>
        <div className="seal-b">
          {published
            ? "Champion published. Marketing performance reads from this run."
            : `${completedCount} of ${steps.length} stages complete. Publish an approved champion to unlock reporting.`}
        </div>
        <div className="pbar">
          <i style={{ width: pct + "%" }} />
        </div>
      </div>
    </aside>
  );
}
