import { useEffect, useState } from "react";
import { AdminUser, api, Client, Membership, Project, ROLES } from "../api";
import TopBar from "../components/TopBar";

function roleTagClass(role: string) {
  if (role === "excluded") return "bad";
  if (role === "super_admin" || role === "org_admin") return "champ";
  return "ok";
}

function scopeLabel(m: Membership, clients: Client[], projects: Project[], orgId: string) {
  if (m.scope_type === "organization") return m.scope_id === orgId ? "Organization" : m.scope_id;
  if (m.scope_type === "client") return clients.find((c) => c.id === m.scope_id)?.name ?? m.scope_id;
  if (m.scope_type === "project") return projects.find((p) => p.id === m.scope_id)?.name ?? m.scope_id;
  return m.scope_id;
}

export default function Admin({
  orgId,
  avatarInitials,
  onBack,
  onLogout,
}: {
  orgId: string;
  avatarInitials: string;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"users" | "access" | "projects">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  async function loadAll() {
    setError(null);
    try {
      const [u, m, c, p] = await Promise.all([api.adminUsers(), api.allMemberships(), api.clients(), api.projects()]);
      setUsers(u);
      setMemberships(m);
      setClients(c);
      setProjects(p);
    } catch (err: any) {
      if (String(err.message).includes("org_admin") || String(err.message).includes("403")) {
        setForbidden(true);
      } else {
        setError(err.message);
      }
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (forbidden) {
    return (
      <div>
        <TopBar avatarInitials={avatarInitials} onLogout={onLogout} onWordmarkClick={onBack} />
        <main className="main">
          <div className="locked">
            <div className="ic">🔒</div>
            <h2>Admin access required</h2>
            <p>User and access-level management needs the org_admin or super_admin role. Ask an org admin to grant it.</p>
            <button className="btn pri" onClick={onBack}>
              Back to workspace
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <TopBar avatarInitials={avatarInitials} onLogout={onLogout} onWordmarkClick={onBack} />
      <main className="main">
        <div className="head">
          <div>
            <button className="btn sm" onClick={onBack} style={{ marginBottom: 8 }}>
              ← Workspace
            </button>
            <h1>Admin</h1>
            <p>Manage accounts, access levels, and projects for this organization.</p>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="vtabs" role="tablist" style={{ marginBottom: 14 }}>
          {(["users", "access", "projects"] as const).map((t) => (
            <button key={t} className="vtab" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === "users" ? "Users" : t === "access" ? "Access levels" : "Projects"}
            </button>
          ))}
        </div>

        {tab === "users" && <UsersTab users={users} reload={loadAll} setError={setError} />}
        {tab === "access" && (
          <AccessTab
            users={users}
            memberships={memberships}
            clients={clients}
            projects={projects}
            orgId={orgId}
            reload={loadAll}
            setError={setError}
          />
        )}
        {tab === "projects" && <ProjectsTab clients={clients} projects={projects} reload={loadAll} setError={setError} />}
      </main>
    </div>
  );
}

function UsersTab({
  users,
  reload,
  setError,
}: {
  users: AdminUser[];
  reload: () => void;
  setError: (e: string | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function createUser() {
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createAdminUser(email.trim(), password, displayName.trim());
      setEmail("");
      setPassword("");
      setDisplayName("");
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    try {
      await api.updateAdminUser(id, { display_name: editName });
      setEditingId(null);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeUser(id: string) {
    try {
      await api.deleteAdminUser(id);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-h">
          <h3>Users</h3>
          <span className="tag ok">{users.length} in this org</span>
        </div>
        <div className="card-b">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display name</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.email}</b>
                    </td>
                    <td>
                      {editingId === u.id ? (
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ padding: "4px 7px" }} />
                      ) : (
                        u.display_name || <span className="muted">—</span>
                      )}
                    </td>
                    <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      {editingId === u.id ? (
                        <>
                          <button className="btn sm pri" onClick={() => saveEdit(u.id)}>
                            Save
                          </button>
                          <button className="btn sm" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn sm"
                            onClick={() => {
                              setEditingId(u.id);
                              setEditName(u.display_name);
                            }}
                          >
                            Edit
                          </button>
                          <button className="btn sm" onClick={() => removeUser(u.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="g3" style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="field">
              <label>Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          </div>
          <button className="btn pri" disabled={busy} onClick={createUser}>
            {busy ? "Creating…" : "Create user"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccessTab({
  users,
  memberships,
  clients,
  projects,
  orgId,
  reload,
  setError,
}: {
  users: AdminUser[];
  memberships: Membership[];
  clients: Client[];
  projects: Project[];
  orgId: string;
  reload: () => void;
  setError: (e: string | null) => void;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<string>("analyst");
  const [scopeType, setScopeType] = useState<"organization" | "client" | "project">("organization");
  const [scopeId, setScopeId] = useState("");

  const scopeOptions = scopeType === "organization" ? [{ id: orgId, name: "Organization" }] : scopeType === "client" ? clients : projects;

  useEffect(() => {
    setScopeId(scopeOptions[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeType]);

  async function grant() {
    if (!userId || !scopeId) {
      setError("Pick a user and a scope");
      return;
    }
    try {
      await api.grantMembership(userId, role, scopeType, scopeId);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function revoke(id: string) {
    try {
      await api.revokeMembership(id);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const userEmail = (id: string) => users.find((u) => u.id === id)?.email ?? id;

  return (
    <div className="card">
      <div className="card-h">
        <h3>Access levels</h3>
        <p className="muted">Grants are (user, role, scope) — an explicit client-level "excluded" always wins, even over super_admin.</p>
      </div>
      <div className="card-b">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Scope</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id}>
                  <td>{userEmail(m.user_id)}</td>
                  <td>
                    <span className={"tag " + roleTagClass(m.role)}>{m.role}</span>
                  </td>
                  <td className="muted">
                    {m.scope_type} · {scopeLabel(m, clients, projects, orgId)}
                  </td>
                  <td>
                    <button className="btn sm" onClick={() => revoke(m.id)}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
              {memberships.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No grants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="g3" style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div className="field">
            <label>User</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Scope type</label>
            <select value={scopeType} onChange={(e) => setScopeType(e.target.value as typeof scopeType)}>
              <option value="organization">Organization</option>
              <option value="client">Client</option>
              <option value="project">Project</option>
            </select>
          </div>
        </div>
        {scopeType !== "organization" && (
          <div className="field">
            <label>Scope</label>
            <select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
              {scopeOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="btn pri" onClick={grant}>
          Grant access
        </button>
      </div>
    </div>
  );
}

function ProjectsTab({
  clients,
  projects,
  reload,
  setError,
}: {
  clients: Client[];
  projects: Project[];
  reload: () => void;
  setError: (e: string | null) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");

  async function create() {
    if (!clientId || !name.trim()) {
      setError("Pick a client and enter a project name");
      return;
    }
    try {
      await api.createProject(clientId, name.trim());
      setName("");
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="card">
      <div className="card-h">
        <h3>Projects</h3>
        <p className="muted">Full project setup — dataset, spec, runs — happens in Model Studio once created here.</p>
      </div>
      <div className="card-b">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                  </td>
                  <td className="muted">{clientName(p.client_id)}</td>
                  <td className="muted">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No projects yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 2 }} />
          <button className="btn pri" onClick={create}>
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}
