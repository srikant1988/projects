const API_BASE = "http://localhost:8000";

export type Organization = { id: string; name: string; created_at: string };
export type Client = {
  id: string;
  org_id: string;
  name: string;
  country?: string | null;
  logo_url?: string | null;
  created_at: string;
};
export type ClientLookupResult = {
  name: string;
  domain: string | null;
  logo_url: string | null;
  country: string | null;
  country_confidence: string;
};
export type Project = {
  id: string;
  client_id: string;
  name: string;
  outcome_variable: string;
  time_grain: string;
  is_shared: boolean;
  share_token: string | null;
  created_at: string;
};
export type Membership = {
  id: string;
  user_id: string;
  role: string;
  scope_type: string;
  scope_id: string;
  created_at: string;
};
export type Me = {
  id: string;
  email: string;
  display_name: string;
  org_id: string;
  client_only: boolean;
  accessible_project_ids: string[];
};
export type AdminUser = { id: string; email: string; display_name: string; org_id: string; created_at: string };

export const ROLES = ["super_admin", "org_admin", "client_lead", "analyst", "approver", "client_viewer", "excluded"] as const;
export type Role = (typeof ROLES)[number];

export type ChannelSpec = { name: string; min: number; max: number };

export type DataSource = {
  id: string;
  project_id: string;
  name: string;
  source_type: string;
  status: string;
  filename?: string | null;
  row_count?: number | null;
  column_count?: number | null;
  columns_preview?: { columns?: string[] };
  created_at: string;
};

export type DatasetVersion = {
  id: string;
  project_id: string;
  label: string;
  content_hash: string;
  row_count: number;
  channel_count: number;
  control_count: number;
  quality_report: Record<string, { status: string; detail: string }>;
  status: string;
  created_at: string;
};

export type ModelSpec = {
  id: string;
  project_id: string;
  version: number;
  engine: string;
  spec: { channels: ChannelSpec[]; controls: string[] };
  created_at: string;
};

export type Contribution = { spend: number; revenue: number; coefficient: number };
export type ResponseCurveParams = { decay: number; half_saturation: number; coefficient: number };

export type ModelRun = {
  id: string;
  project_id: string;
  spec_id: string;
  dataset_version_id: string;
  status: string;
  is_champion: boolean;
  holdout_mape: number | null;
  r_squared: number | null;
  diagnostics: Record<string, { status: string; [k: string]: unknown }>;
  contributions: Record<string, Contribution>;
  response_curves: Record<string, ResponseCurveParams>;
  created_at: string;
};

export type ScenarioResults = {
  total_spend: number;
  total_revenue: number;
  roi: number;
  per_channel: Record<string, { spend: number; revenue: number }>;
};

export type Scenario = {
  id: string;
  project_id: string;
  run_id: string;
  name: string;
  plan: Record<string, number>;
  results: ScenarioResults | Record<string, never>;
  created_at: string;
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<Me>("/v1/me"),
  myMemberships: () => request<Membership[]>("/v1/me/memberships"),
  organizations: () => request<Organization[]>("/v1/organizations"),
  clients: () => request<Client[]>("/v1/clients"),
  createClient: (org_id: string, name: string, country?: string | null, logo_url?: string | null) =>
    request<Client>("/v1/clients", { method: "POST", body: JSON.stringify({ org_id, name, country, logo_url }) }),
  lookupClient: (q: string) => request<ClientLookupResult>(`/v1/clients/lookup?q=${encodeURIComponent(q)}`),
  projects: () => request<Project[]>("/v1/projects"),
  createProject: (client_id: string, name: string) =>
    request<Project>("/v1/projects", { method: "POST", body: JSON.stringify({ client_id, name }) }),
  shareProject: (project_id: string) => request<Project>(`/v1/projects/${project_id}/share`, { method: "POST" }),
  unshareProject: (project_id: string) => request<Project>(`/v1/projects/${project_id}/unshare`, { method: "POST" }),
  projectByToken: (token: string) => request<Project>(`/v1/projects/by-token/${token}`),

  dataSources: (project_id: string) => request<DataSource[]>(`/v1/data-sources?project_id=${project_id}`),
  createDataSource: (project_id: string, name: string, source_type: string) =>
    request<DataSource>("/v1/data-sources", {
      method: "POST",
      body: JSON.stringify({ project_id, name, source_type }),
    }),
  uploadDataSourceFile: async (data_source_id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/v1/data-sources/${data_source_id}/upload`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<DataSource>;
  },

  datasetVersions: (project_id: string) =>
    request<DatasetVersion[]>(`/v1/dataset-versions?project_id=${project_id}`),
  createDatasetVersion: (
    project_id: string,
    label: string,
    channels: ChannelSpec[],
    controls: string[],
    dataSourceId?: string,
    outcomeColumn?: string
  ) =>
    request<DatasetVersion>("/v1/dataset-versions", {
      method: "POST",
      body: JSON.stringify({
        project_id,
        label,
        channels,
        controls,
        data_source_id: dataSourceId ?? null,
        outcome_column: outcomeColumn ?? null,
      }),
    }),

  modelSpecs: (project_id: string) => request<ModelSpec[]>(`/v1/model-specs?project_id=${project_id}`),
  allModelSpecs: () => request<ModelSpec[]>("/v1/model-specs"),
  createModelSpec: (project_id: string, channels: ChannelSpec[], controls: string[], engine = "ridge") =>
    request<ModelSpec>("/v1/model-specs", {
      method: "POST",
      body: JSON.stringify({ project_id, engine, channels, controls }),
    }),

  runs: (project_id: string) => request<ModelRun[]>(`/v1/runs?project_id=${project_id}`),
  allRuns: () => request<ModelRun[]>("/v1/runs"),
  createRun: (spec_id: string, dataset_version_id: string) =>
    request<ModelRun>(`/v1/model-specs/${spec_id}/runs`, {
      method: "POST",
      body: JSON.stringify({ spec_id, dataset_version_id }),
    }),
  promoteRun: (run_id: string) => request<ModelRun>(`/v1/runs/${run_id}/promote`, { method: "POST" }),
  responseCurve: (run_id: string, channel: string, max_spend = 20) =>
    request<{ spend: number; revenue: number }[]>(
      `/v1/runs/${run_id}/response-curves/${encodeURIComponent(channel)}?max_spend=${max_spend}`
    ),

  scenarios: (project_id: string) => request<Scenario[]>(`/v1/scenarios?project_id=${project_id}`),
  createScenario: (project_id: string, run_id: string, name: string) =>
    request<Scenario>(`/v1/projects/${project_id}/scenarios`, {
      method: "POST",
      body: JSON.stringify({ project_id, run_id, name }),
    }),
  evaluateScenario: (scenario_id: string, plan: Record<string, number>) =>
    request<Scenario>(`/v1/scenarios/${scenario_id}/evaluate`, { method: "POST", body: JSON.stringify(plan) }),
  optimizeScenario: (scenario_id: string, total_budget: number, bounds: Record<string, { min: number; max: number }>) =>
    request<Scenario>(`/v1/scenarios/${scenario_id}/optimize`, {
      method: "POST",
      body: JSON.stringify({ total_budget, bounds }),
    }),

  adminUsers: () => request<AdminUser[]>("/v1/users"),
  createAdminUser: (email: string, password: string, display_name: string) =>
    request<AdminUser>("/v1/users", { method: "POST", body: JSON.stringify({ email, password, display_name }) }),
  updateAdminUser: (user_id: string, body: { display_name?: string; password?: string }) =>
    request<AdminUser>(`/v1/users/${user_id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAdminUser: (user_id: string) => request<void>(`/v1/users/${user_id}`, { method: "DELETE" }),

  allMemberships: () => request<Membership[]>("/v1/memberships"),
  grantMembership: (user_id: string, role: string, scope_type: string, scope_id: string) =>
    request<Membership>("/v1/memberships", {
      method: "POST",
      body: JSON.stringify({ user_id, role, scope_type, scope_id }),
    }),
  revokeMembership: (membership_id: string) => request<void>(`/v1/memberships/${membership_id}`, { method: "DELETE" }),
};
