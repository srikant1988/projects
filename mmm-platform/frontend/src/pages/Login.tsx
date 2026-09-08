import { useState } from "react";
import { api } from "../api";

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("s.raman@meridian.example");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { access_token } = await api.login(email, password);
      localStorage.setItem("token", access_token);
      onLoggedIn();
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="wordmark">
          MM<span>M</span>
        </div>
        <p className="muted" style={{ marginBottom: 18 }}>
          Sign in to your workspace
        </p>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        {error && <div className="error">{error}</div>}
        <button className="btn pri" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="hint">
          Demo users (password123): s.raman (org admin), j.okafor (Aurelia Beauty only), l.chen (org-wide,
          excluded from Halstrom Group)
        </p>
      </form>
    </div>
  );
}
