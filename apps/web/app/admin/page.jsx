"use client";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.kutara.org";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("admin@kutara.org");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [system, setSystem] = useState(null);
  const [tab, setTab] = useState("login");

  useEffect(() => { const t = localStorage.getItem("kutara_admin_token"); if (t) { setToken(t); setTab("dashboard"); loadData(t); } }, []);

  async function login() {
    const r = await fetch(`${API_BASE}/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const d = await r.json();
    if (!d.ok) { setError(d.error || "Login failed"); return; }
    localStorage.setItem("kutara_admin_token", d.token);
    setToken(d.token); setTab("dashboard"); loadData(d.token);
  }

  async function loadData(t) {
    const u = await fetch(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json());
    if (u.ok) setUsers(u.users || []);
    const s = await fetch(`${API_BASE}/admin/system`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json());
    if (s.ok) setSystem(s.system);
  }

  async function resetUser(id) {
    const t = localStorage.getItem("kutara_admin_token");
    await fetch(`${API_BASE}/admin/users/${id}/reset`, { method: "POST", headers: { Authorization: `Bearer ${t}` } });
    loadData(t);
  }

  function logout() { localStorage.removeItem("kutara_admin_token"); setToken(""); setTab("login"); }

  if (tab === "login") {
    return (
      <main className="authPage">
        <div className="authCard">
          <div className="brand" style={{ marginBottom: 18 }}>
            <div className="brandIcon">K</div>
            <div><h1>Kutara AI</h1><p>Admin Panel</p></div>
          </div>
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
          {error && <div className="authError">{error}</div>}
          <button onClick={login}>Login</button>
          <a href="/" className="switch">Back to Chat</a>
        </div>
      </main>
    );
  }

  return (
    <main className="adminShell">
      <aside className="adminSidebar">
        <div className="brand">
          <div className="brandIcon">K</div>
          <div><h1>Kutara AI</h1><p>Admin Panel</p></div>
        </div>
        <button onClick={() => setTab("dashboard")} style={{ border: 0, borderRadius: 8, background: tab === "dashboard" ? "rgba(255,255,255,0.08)" : "transparent", color: "#d8d8d8", textAlign: "left", padding: 10 }}>Dashboard</button>
        <button onClick={() => setTab("users")} style={{ border: 0, borderRadius: 8, background: tab === "users" ? "rgba(255,255,255,0.08)" : "transparent", color: "#d8d8d8", textAlign: "left", padding: 10 }}>Users</button>
        <button onClick={logout} style={{ border: 0, borderRadius: 8, background: "rgba(255,80,80,0.08)", color: "#ffb4b4", textAlign: "left", padding: 10, marginTop: "auto" }}>Logout</button>
        <div className="footer"><span>Code by</span><strong>CodeTiger.de</strong></div>
      </aside>

      <section className="adminMain">
        <h2>{tab === "dashboard" ? "System Dashboard" : "User Management"}</h2>

        {tab === "dashboard" && system && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div className="adminCard"><h3>Total Users</h3><p style={{ fontSize: 32, margin: 0, color: "#f6ca72" }}>{system.users}</p></div>
            <div className="adminCard"><h3>Total Chats</h3><p style={{ fontSize: 32, margin: 0, color: "#f6ca72" }}>{system.chats}</p></div>
            <div className="adminCard"><h3>Free Users</h3><p style={{ fontSize: 32, margin: 0, color: "#f6ca72" }}>{system.tiers?.free || 0}</p></div>
            <div className="adminCard"><h3>Basic Users</h3><p style={{ fontSize: 32, margin: 0, color: "#f6ca72" }}>{system.tiers?.basic || 0}</p></div>
            <div className="adminCard"><h3>Version</h3><p style={{ fontSize: 24, margin: 0, color: "#aaa" }}>{system.version}</p></div>
          </div>
        )}

        {tab === "users" && (
          <div className="adminCard">
            <table>
              <thead><tr><th>Email</th><th>Tier</th><th>Questions Left</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td><span className={`tierBadge ${u.tier}`}>{u.tier}</span></td>
                    <td>{u.questions_remaining}</td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>{u.tier === "free" && <button onClick={() => resetUser(u.id)}>Reset</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
