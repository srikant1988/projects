import { Fragment, useEffect, useState } from "react";
import { api, Client, Me, Membership, ModelRun, ModelSpec, Project } from "../api";
import ProjectStudio, { STEPS } from "./ProjectStudio";
import Admin from "./Admin";
import TopBar from "../components/TopBar";
import PipelineRail from "../components/PipelineRail";

const WORKSPACE_STEPS = [{ title: "My workspace", subtitle: "Choose an engagement" }, ...STEPS];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

export default function Workspace({ onLogout }: { onLogout: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [specs, setSpecs] = useState<ModelSpec[]>([]);
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectClientId, setNewProjectClientId] = useState("");

  async function loadAll() {
    setError(null);
    try {
      const [meRes, mRes, cRes, pRes, sRes, rRes] = await Promise.all([
        api.me(),
        api.myMemberships(),
        api.clients(),
        api.projects(),
        api.allModelSpecs(),
        api.allRuns(),
      ]);
      setMe(meRes);
      setMemberships(mRes);
      setClients(cRes);
      setProjects(pRes);
      setSpecs(sRes);
      setRuns(rRes);
      setSelectedId((prev) => prev ?? (pRes[0]?.id ?? null));
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function toggle(id: string) {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  }

  async function createProject() {
    if (!newProjectName.trim() || !newProjectClientId) return;
    try {
      await api.createProject(newProjectClientId, newProjectName.trim());
      setNewProjectName("");
      setShowCreate(false);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function addClient(name: string, country: string | null, logoUrl: string | null) {
    if (!me) return;
    try {
      const c = await api.createClient(me.org_id, name, country, logoUrl);
      setNewProjectClientId(c.id);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const avatarInitials = me ? initials(me.display_name || me.email) : "?";

  if (showAdmin && me) {
    return (
      <Admin
        orgId={me.org_id}
        avatarInitials={avatarInitials}
        onBack={() => setShowAdmin(false)}
        onLogout={onLogout}
      />
    );
  }

  if (openProject) {
    const client = clients.find((c) => c.id === openProject.client_id);
    return (
      <ProjectStudio
        project={openProject}
        clientName={client?.name ?? ""}
        avatarInitials={avatarInitials}
        onBack={() => {
          setOpenProject(null);
          loadAll();
        }}
        onLogout={onLogout}
      />
    );
  }

  const f = search.toLowerCase();
  const visibleProjects = projects.filter((p) => !f || p.name.toLowerCase().includes(f));
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const clientOf = (id: string) => clients.find((c) => c.id === id);
  const projectRuns = (id: string) => runs.filter((r) => r.project_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const projectChampion = (id: string) => projectRuns(id).find((r) => r.is_champion);
  const specVersion = (specId: string) => specs.find((s) => s.id === specId)?.version;

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const selectedChampion = selected ? projectChampion(selected.id) : undefined;
  const othersWithChampion = projects.filter((p) => p.id !== selected?.id && projectChampion(p.id)).length;

  const publishedCount = projects.filter((p) => projectChampion(p.id)).length;

  function goStep(i: number) {
    if (i === 0) return; // already here
    if (selected) setOpenProject(selected);
  }

  return (
    <div>
      <TopBar avatarInitials={avatarInitials} onLogout={onLogout} onAdmin={() => setShowAdmin(true)} />

      <div className="shell">
        <PipelineRail
          steps={WORKSPACE_STEPS}
          step={0}
          done={[true, false, false, false, false, false, false]}
          onStep={goStep}
          published={publishedCount > 0}
        />
        <main className="main">
        <div className="head">
          <div>
            <h1>My workspace</h1>
            <p>Every modelling engagement you have access to. Expand a project to see its model versions.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "6px 10px", border: "1px solid var(--line-hard)", borderRadius: 3, width: 190 }}
            />
            <button className="btn pri" onClick={() => setShowCreate((v) => !v)}>
              Create project
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {showCreate && (
          <div className="card">
            <div className="card-h">
              <h3>New project</h3>
            </div>
            <div className="card-b">
              <div className="g2">
                <div className="field">
                  <label>Client</label>
                  <select value={newProjectClientId} onChange={(e) => setNewProjectClientId(e.target.value)}>
                    <option value="">Select a client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Project name</label>
                  <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: 4 }}>
                <label>Or create a new client</label>
                <AddClientBox onAdd={addClient} setError={setError} />
              </div>
              <button className="btn pri" style={{ marginTop: 12 }} onClick={createProject}>
                Create project
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Account</th>
                  <th>Frequency</th>
                  <th>Champion</th>
                  <th>Owner</th>
                  <th>Created</th>
                  <th className="num">Last modified</th>
                </tr>
              </thead>
              <tbody>
                {visibleProjects.map((p) => {
                  const open = expanded.has(p.id);
                  const champ = projectChampion(p.id);
                  const pRuns = projectRuns(p.id);
                  const isSelected = p.id === selectedId;
                  return (
                    <Fragment key={p.id}>
                      <tr style={isSelected ? { background: "var(--accent-dim)" } : undefined}>
                        <td>
                          <button className="exp" onClick={() => toggle(p.id)} aria-label="Expand">
                            {open ? "−" : "+"}
                          </button>
                          <button
                            onClick={() => setSelectedId(p.id)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              color: "inherit",
                              font: "inherit",
                              fontWeight: 600,
                            }}
                          >
                            {p.name}
                          </button>
                        </td>
                        <td className="muted">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {clientOf(p.client_id)?.logo_url && (
                              <img
                                src={clientOf(p.client_id)!.logo_url!}
                                alt=""
                                width={16}
                                height={16}
                                style={{ borderRadius: 2, objectFit: "contain" }}
                                onError={(e) => (e.currentTarget.style.display = "none")}
                              />
                            )}
                            {clientName(p.client_id)}
                            {clientOf(p.client_id)?.country && (
                              <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>· {clientOf(p.client_id)!.country}</span>
                            )}
                          </span>
                        </td>
                        <td className="muted">{p.time_grain}</td>
                        <td>
                          {champ ? (
                            <span className="tag champ">v{specVersion(champ.spec_id) ?? "?"}</span>
                          ) : (
                            <span className="tag idle">None yet</span>
                          )}
                        </td>
                        <td className="muted">{me?.display_name ?? "—"}</td>
                        <td className="muted">{fmtDate(p.created_at)}</td>
                        <td className="num muted">{fmtDate(p.created_at)}</td>
                      </tr>
                      {open &&
                        (pRuns.length === 0 ? (
                          <tr className="child" key={p.id + "-empty"}>
                            <td colSpan={7} className="muted">
                              No completed runs yet.
                            </td>
                          </tr>
                        ) : (
                          pRuns.map((r) => (
                            <tr className="child" key={r.id}>
                              <td>
                                spec v{specVersion(r.spec_id) ?? "?"} · run {r.id.slice(0, 8)}
                              </td>
                              <td colSpan={6} className="muted">
                                {r.status === "completed" ? "Complete" : r.status}
                                {r.holdout_mape != null ? ` · MAPE ${r.holdout_mape}%` : ""}
                                {r.is_champion ? " · Champion" : ""}
                              </td>
                            </tr>
                          ))
                        ))}
                    </Fragment>
                  );
                })}
                {visibleProjects.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No projects visible under your current grants.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div className="out">
            <h5>Where you are</h5>
            <ul>
              <li>
                <b>Open project</b> {selected.name}.{" "}
                {selectedChampion
                  ? `Champion v${specVersion(selectedChampion.spec_id) ?? "?"} published, run ${selectedChampion.id.slice(0, 8)}.`
                  : "No champion yet, so its reporting stays sealed."}
              </li>
              <li>
                <b>Others</b>{" "}
                {othersWithChampion > 0
                  ? `${othersWithChampion} other project(s) have live champions and populated reporting.`
                  : "No other project has a published champion yet."}
              </li>
            </ul>
          </div>
        )}

        {selected && (
          <div style={{ marginTop: 14 }}>
            <button className="btn pri" onClick={() => setOpenProject(selected)}>
              Open {selected.name} →
            </button>
          </div>
        )}

        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-h">
            <h3>Your grants</h3>
          </div>
          <div className="card-b">
            {memberships.length === 0 && <p className="muted">No memberships.</p>}
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Scope ID</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={"tag " + (m.role === "excluded" ? "bad" : "ok")}>{m.role}</span>
                    </td>
                    <td className="muted">{m.scope_type}</td>
                    <td className="muted">{m.scope_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}

/** Search-then-preview client creation: typing a name and clicking Search
 * hits GET /v1/clients/lookup (Clearbit domain/logo + a Wikipedia/Wikidata
 * country guess). Nothing from that lookup is trusted blindly -- name,
 * country, and whether to keep the logo are all still editable/removable
 * before "Add client" actually creates anything. */
function AddClientBox({
  onAdd,
  setError,
}: {
  onAdd: (name: string, country: string | null, logoUrl: string | null) => Promise<void>;
  setError: (e: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [adding, setAdding] = useState(false);

  async function search() {
    if (!name.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const result = await api.lookupClient(name.trim());
      setName(result.name);
      setCountry(result.country ?? "");
      setLogoUrl(result.logo_url);
      setSearched(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function add() {
    if (!name.trim()) {
      setError("Enter a client name");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await onAdd(name.trim(), country.trim() || null, logoUrl);
      setName("");
      setCountry("");
      setLogoUrl(null);
      setSearched(false);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            width={34}
            height={34}
            style={{ borderRadius: 3, objectFit: "contain", border: "1px solid var(--line-hard)", flex: "none" }}
            onError={() => setLogoUrl(null)}
          />
        )}
        <input
          placeholder="Client name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSearched(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
          style={{ flex: 1 }}
        />
        <button className="btn sm" disabled={searching || !name.trim()} onClick={search}>
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {searched && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>
            Country <span className="muted">(suggested — verify before saving)</span>
          </label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. United States" />
        </div>
      )}

      <button className="btn sm pri" style={{ marginTop: 8 }} disabled={adding || !name.trim()} onClick={add}>
        {adding ? "Adding…" : "Add client"}
      </button>
    </div>
  );
}
