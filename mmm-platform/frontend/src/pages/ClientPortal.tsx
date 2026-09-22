import { useEffect, useState } from "react";
import { api, Client, Me, ModelRun, ModelSpec, Project, Scenario } from "../api";
import TopBar from "../components/TopBar";
import Phase2, { P2Section } from "./Phase2";

/** The client-facing surface reached from a project's share link. Deliberately
 * a separate component from ProjectStudio, not a restricted mode of it: it
 * must be structurally impossible to reach Model Studio or any other
 * project from here, not just hidden behind a permission check. */
export default function ClientPortal({
  me,
  onLogout,
  shareToken,
}: {
  me: Me;
  onLogout: () => void;
  shareToken?: string | null;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [champion, setChampion] = useState<ModelRun | null>(null);
  const [specs, setSpecs] = useState<ModelSpec[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [section, setSection] = useState<P2Section>("performance");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProjectList() {
    setError(null);
    try {
      if (shareToken) {
        // A share link resolves to exactly one project, independent of
        // this user's own membership set -- RLS on the by-token lookup
        // still applies, so this only succeeds if the project is visible.
        const [cRes, project] = await Promise.all([api.clients(), api.projectByToken(shareToken)]);
        setClients(cRes);
        setProjects([project]);
        await openStudio(project);
        return;
      }
      const [cRes, pRes] = await Promise.all([api.clients(), api.projects()]);
      setClients(cRes);
      const allowed = pRes.filter((p) => me.accessible_project_ids.includes(p.id));
      setProjects(allowed);
      if (allowed.length === 1) await openStudio(allowed[0]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openStudio(project: Project) {
    setError(null);
    try {
      const [runs, sp, sc] = await Promise.all([api.runs(project.id), api.modelSpecs(project.id), api.scenarios(project.id)]);
      const ch = runs.find((r) => r.is_champion) ?? null;
      setChampion(ch);
      setSpecs(sp);
      setScenarios(sc);
      setOpenProject(project);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadProjectList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avatarInitials = (me.display_name || me.email).slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div>
        <TopBar avatarInitials={avatarInitials} onLogout={onLogout} />
        <div className="shell">
          <main className="main">
            <p className="muted">Loading…</p>
          </main>
        </div>
      </div>
    );
  }

  if (!openProject) {
    const client = (id: string) => clients.find((c) => c.id === id);
    return (
      <div>
        <TopBar avatarInitials={avatarInitials} onLogout={onLogout} />
        <div className="shell">
          <main className="main">
            {error && <div className="error">{error}</div>}
            <div className="head">
              <h1>Your reports</h1>
              <p>Marketing performance for the projects you've been given access to.</p>
            </div>
            {projects.length === 0 ? (
              <p className="muted">No projects have been shared with you yet. Ask your account contact for access.</p>
            ) : (
              <div className="card">
                <div className="card-b">
                  {projects.map((p) => (
                    <div key={p.id} className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                      <div>
                        <b>{p.name}</b>
                        <div className="muted" style={{ fontSize: 12 }}>{client(p.client_id)?.name ?? ""}</div>
                      </div>
                      <button className="btn pri sm" onClick={() => openStudio(p)}>
                        Open →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  const client = clients.find((c) => c.id === openProject.client_id);

  return (
    <div>
      <TopBar
        crumbClient={client?.name}
        crumbProject={openProject.name}
        avatarInitials={avatarInitials}
        onLogout={onLogout}
        onWordmarkClick={projects.length > 1 ? () => setOpenProject(null) : undefined}
      />
      <div className="shell">
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
                data-state={section === s.key ? "active" : "idle"}
                aria-current={section === s.key}
                onClick={() => setSection(s.key)}
              >
                <span className="dot">●</span>
                <span>
                  <span className="step-t">{s.title}</span>
                  <span className="step-s">{s.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>
        <main className="main">
          {error && <div className="error">{error}</div>}
          {champion ? (
            <Phase2
              project={openProject}
              champion={champion}
              specs={specs}
              scenarios={scenarios}
              reload={() => openStudio(openProject)}
              setError={setError}
              section={section}
            />
          ) : (
            <div className="locked">
              <div className="ic">🔒</div>
              <h2>Reporting is sealed</h2>
              <p>This project hasn't published a champion model yet. Check back soon.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
