import { useState } from "react";

type SourceType = "excel" | "database" | "lake";

const OPTIONS: { type: SourceType; icon: string; title: string; desc: string; alias: string }[] = [
  { type: "excel", icon: "📄", title: "Excel / CSV", desc: "Upload a file from your computer", alias: "e.g. Retail media network" },
  { type: "database", icon: "🗄️", title: "Database", desc: "SQL, warehouse, managed connector", alias: "e.g. Sales warehouse" },
  { type: "lake", icon: "🌊", title: "Data lake / other", desc: "S3, GCS, SFTP, API feed", alias: "e.g. Media archive" },
];

const TYPE_LABEL: Record<SourceType, string> = { excel: "excel", database: "database", lake: "lake" };

export default function AddSourceModal({
  onClose,
  onConnect,
}: {
  onClose: () => void;
  onConnect: (name: string, sourceType: string) => Promise<void>;
}) {
  const [picked, setPicked] = useState<SourceType | null>(null);
  const [alias, setAlias] = useState("");
  const [busy, setBusy] = useState(false);

  const option = OPTIONS.find((o) => o.type === picked);

  async function connect() {
    if (!picked) return;
    setBusy(true);
    try {
      await onConnect(alias.trim() || `New ${option?.title} source`, TYPE_LABEL[picked]);
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
          width: 600,
          maxWidth: "100%",
          boxShadow: "0 20px 50px -12px rgba(20,24,31,.35)",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-h">
          <div>
            <h3>Add a data source</h3>
            <p className="muted">Connect the source holding the time series listed in the specification file</p>
          </div>
          <button className="btn sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="card-b">
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 13 }}>
            One row per period, one column per variable — the specification file defines the exact names and
            grain this source needs to match.
          </p>
          <div className="g3">
            {OPTIONS.map((o) => (
              <button
                key={o.type}
                onClick={() => setPicked(o.type)}
                style={{
                  textAlign: "left",
                  padding: 13,
                  cursor: "pointer",
                  background: picked === o.type ? "var(--accent-dim)" : "var(--panel)",
                  border: "1.5px solid " + (picked === o.type ? "var(--accent)" : "var(--line-hard)"),
                  borderRadius: "var(--r)",
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 6 }}>{o.icon}</div>
                <b style={{ fontSize: 12.5 }}>{o.title}</b>
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                  {o.desc}
                </div>
              </button>
            ))}
          </div>

          {option && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <div className="field">
                <label>Source alias</label>
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder={option.alias}
                  autoFocus
                />
              </div>

              {option.type === "excel" && (
                <div
                  style={{
                    border: "1.5px dashed var(--line-hard)",
                    borderRadius: "var(--r)",
                    padding: 20,
                    textAlign: "center",
                    background: "var(--sunken)",
                  }}
                >
                  <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                    Drop a .xlsx or .csv here, or
                  </p>
                  <button className="btn sm" type="button">
                    Choose file…
                  </button>
                </div>
              )}

              {option.type === "database" && (
                <>
                  <div className="field">
                    <label>Connection</label>
                    <select defaultValue="PostgreSQL">
                      <option>PostgreSQL</option>
                      <option>Snowflake</option>
                      <option>BigQuery</option>
                      <option>Databricks</option>
                      <option>SQL Server</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Host / connection string</label>
                    <input placeholder="host:port/database" />
                  </div>
                  <div className="field">
                    <label>Table or query</label>
                    <input placeholder="schema.table or SELECT …" />
                  </div>
                  <button className="btn sm" type="button">
                    Test connection
                  </button>
                </>
              )}

              {option.type === "lake" && (
                <>
                  <div className="field">
                    <label>Provider</label>
                    <select defaultValue="Amazon S3">
                      <option>Amazon S3</option>
                      <option>Google Cloud Storage</option>
                      <option>Azure Blob</option>
                      <option>SFTP</option>
                      <option>API feed</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Path or URL</label>
                    <input placeholder="s3://bucket/path/ or https://…" />
                  </div>
                  <div className="hint" style={{ marginTop: -6 }}>
                    Credentials are stored in the secrets manager and never shown here after saving.
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="card-h" style={{ borderTop: "1px solid var(--line)", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          {option && (
            <button className="btn pri" disabled={busy} onClick={connect}>
              {busy ? "Connecting…" : "Connect source"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
