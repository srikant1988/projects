import { Fragment, useEffect, useState } from "react";
import { api, Client, Me, Membership, Project } from "../api";
import ProjectStudio from "./ProjectStudio";
import TopBar from "../components/TopBar";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Workspace({ onLogout }: { onLogout: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newClientName, setNewClientName] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openProject, setOpenProject] = useState<Project | null>(null);

  async function loadAll() {
    setError(null);
    try {
      const [meRes, mRes, cRes, pRes] = await Promise.all([
        api.me(),
        api.myMemberships(),
        api.clients(),
        api.projects(),
      ]);
      setMe(meRes);
      setMemberships(mRes);
      setClients(cRes);
      setProjects(pRes);
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

  async function addClient() {
    if (!me || !newClientName.trim()) return;
    try {
      await api.createClient(me.org_id, newClientName.trim());
      setNewClientName("");
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const avatarInitials = me ? initials(me.display_name || me.email) : "?";

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
  const visibleClients = clients.filter((c) => !f || c.name.toLowerCase().includes(f));

  return (
    <div>
      <TopBar avatarInitials={avatarInitials} onLogout={onLogout} />

      <main className="main">
        <div className="head">
          <div>
            <h1>My workspace</h1>
            <p>
              Every client and project you have access to. Expand a client to see its projects. Visibility here
              is enforced by Postgres row-level security, not application filtering.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Search clients"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "6px 10px", border: "1px solid var(--line-hard)", borderRadius: 3, width: 190 }}
            />
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="card">
          <div className="card-h">
            <div>
              <h3>Clients</h3>
              <p className="muted">{clients.length} visible to you</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="New client name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                style={{ padding: "6px 9px", border: "1px solid var(--line-hard)", borderRadius: 3 }}
              />
              <button className="btn pri sm" onClick={addClient}>
                Add client
              </button>
            </div>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Projects</th>
                  <th className="num">Created</th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.map((c) => {
                  const kids = projects.filter((p) => p.client_id === c.id);
                  const open = expanded.has(c.id);
                  return (
                    <Fragment key={c.id}>
                      <tr>
                        <td>
                          <button className="exp" onClick={() => toggle(c.id)} aria-label="Expand">
                            {open ? "−" : "+"}
                          </button>
                          <b>{c.name}</b>
                        </td>
                        <td className="muted">{kids.length} project(s)</td>
                        <td className="num muted">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                      {open &&
                        (kids.length === 0 ? (
                          <tr className="child" key={c.id + "-empty"}>
                            <td colSpan={3} className="muted">
                              No projects yet.
                            </td>
                          </tr>
                        ) : (
                          kids.map((p) => (
                            <tr className="child" key={p.id}>
                              <td colSpan={2}>
                                <button
                                  onClick={() => setOpenProject(p)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    color: "var(--accent)",
                                    font: "inherit",
                                    fontWeight: 600,
                                  }}
                                >
                                  {p.name}
                                </button>{" "}
                                <span className="muted">
                                  — {p.outcome_variable || "no outcome set"} · {p.time_grain}
                                </span>
                              </td>
                              <td className="num muted">{new Date(p.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))
                        ))}
                    </Fragment>
                  );
                })}
                {visibleClients.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No clients visible under your current grants.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
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
  );
}
