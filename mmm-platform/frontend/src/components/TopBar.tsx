export default function TopBar({
  crumbClient,
  crumbProject,
  phase,
  onPhase,
  phaseLocked,
  avatarInitials,
  onLogout,
  onWordmarkClick,
}: {
  crumbClient?: string;
  crumbProject?: string;
  phase?: 1 | 2;
  onPhase?: (p: 1 | 2) => void;
  phaseLocked?: boolean;
  avatarInitials: string;
  onLogout: () => void;
  onWordmarkClick?: () => void;
}) {
  return (
    <div className="top">
      <button className="wordmark" onClick={onWordmarkClick} style={{ cursor: onWordmarkClick ? "pointer" : "default" }}>
        MM<span>M</span>
      </button>
      {(crumbClient || crumbProject) && (
        <div className="crumb">
          {crumbClient && <span className="muted">{crumbClient}</span>}
          {crumbClient && crumbProject && <span className="sep">/</span>}
          {crumbProject && <b>{crumbProject}</b>}
        </div>
      )}
      {phase !== undefined && onPhase && (
        <div className="ptabs" role="tablist">
          <button className="ptab" role="tab" aria-selected={phase === 1} onClick={() => onPhase(1)}>
            <span className="n">1</span> Model studio
          </button>
          <button
            className="ptab"
            role="tab"
            aria-selected={phase === 2}
            data-locked={phaseLocked ? "true" : "false"}
            onClick={() => onPhase(2)}
          >
            <span className="n">2</span> Marketing performance {phaseLocked && "🔒"}
          </button>
        </div>
      )}
      <div style={{ marginLeft: phase === undefined ? "auto" : 0, display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn sm" onClick={onLogout}>
          Sign out
        </button>
        <div className="avatar">{avatarInitials}</div>
      </div>
    </div>
  );
}
