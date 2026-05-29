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
  const [config, setConfig] = useState(null);
  const [configMsg, setConfigMsg] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [form, setForm] = useState({
    stripeSecretKey: "", stripeWebhookSecret: "", stripeBasicPriceId: "",
    paypalClientId: "", paypalClientSecret: "",
  });

  useEffect(() => {
    const t = localStorage.getItem("kutara_admin_token");
    if (t) { setToken(t); setTab("dashboard"); loadData(t); }
  }, []);

  async function login() {
    const r = await fetch(`${API_BASE}/admin/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
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
    const c = await fetch(`${API_BASE}/admin/config`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json());
    if (c.ok) {
      setConfig(c.config);
      setForm({
        stripeSecretKey: "", stripeWebhookSecret: "",
        stripeBasicPriceId: c.config.stripe?.basicPriceId || "",
        paypalClientId: c.config.paypal?.clientId || "",
        paypalClientSecret: "",
      });
    }
  }

  async function saveConfig() {
    setConfigSaving(true); setConfigMsg("");
    const body = {};
    if (form.stripeSecretKey) body.stripe = { ...(body.stripe || {}), secretKey: form.stripeSecretKey };
    if (form.stripeWebhookSecret) body.stripe = { ...(body.stripe || {}), webhookSecret: form.stripeWebhookSecret };
    if (form.stripeBasicPriceId) body.stripe = { ...(body.stripe || {}), basicPriceId: form.stripeBasicPriceId };
    if (form.paypalClientId) body.paypal = { ...(body.paypal || {}), clientId: form.paypalClientId };
    if (form.paypalClientSecret) body.paypal = { ...(body.paypal || {}), clientSecret: form.paypalClientSecret };

    const r = await fetch(`${API_BASE}/admin/config`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    setConfigMsg(d.ok ? "Saved. Restart API to apply." : d.error || "Error");
    setConfigSaving(false);
    if (d.ok) loadData(token);
  }

  async function resetUser(id) {
    const t = localStorage.getItem("kutara_admin_token");
    await fetch(`${API_BASE}/admin/users/${id}/reset`, { method: "POST", headers: { Authorization: `Bearer ${t}` } });
    loadData(t);
  }

  function logout() {
    localStorage.removeItem("kutara_admin_token");
    setToken(""); setTab("login");
  }

  function switchTab(t) { setTab(t); if (t === "billing" && token) loadData(token); }

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
        {["dashboard", "users", "billing"].map(t => (
          <button key={t} onClick={() => switchTab(t)}
            style={{ border: 0, borderRadius: 8, background: tab === t ? "rgba(255,255,255,0.08)" : "transparent", color: "#d8d8d8", textAlign: "left", padding: 10, textTransform: "capitalize" }}>
            {t === "billing" ? "⚙ Billing Config" : t}
          </button>
        ))}
        <button onClick={logout} style={{
          border: 0, borderRadius: 8, background: "rgba(255,80,80,0.08)",
          color: "#ffb4b4", textAlign: "left", padding: 10, marginTop: "auto"
        }}>Logout</button>
        <div className="footer"><span>Code by</span><strong>CodeTiger.de</strong></div>
      </aside>

      <section className="adminMain">
        <h2>{tab === "dashboard" ? "System Dashboard" : tab === "users" ? "User Management" : "Billing Configuration"}</h2>

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
          <div className="adminCard" style={{ overflowX: "auto" }}>
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

        {tab === "billing" && (
          <div className="adminCard">
            <h3>Stripe</h3>
            <p className="hint">Get keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener" style={{ color: "#f6ca72" }}>Stripe Dashboard</a></p>
            <label>Secret Key</label>
            <input type="password" value={form.stripeSecretKey} onChange={e => setForm({ ...form, stripeSecretKey: e.target.value })} placeholder={config?.stripe?.secretKey ? `Current: ${config.stripe.secretKey}` : "sk_live_... or sk_test_..."} />
            <label>Webhook Secret</label>
            <input type="password" value={form.stripeWebhookSecret} onChange={e => setForm({ ...form, stripeWebhookSecret: e.target.value })} placeholder={config?.stripe?.webhookSecret ? `Current: ${config.stripe.webhookSecret}` : "whsec_..."} />
            <label>Basic Plan Price ID</label>
            <input value={form.stripeBasicPriceId} onChange={e => setForm({ ...form, stripeBasicPriceId: e.target.value })} placeholder={config?.stripe?.basicPriceId || "price_..."} />

            <h3 style={{ marginTop: 24 }}>PayPal</h3>
            <p className="hint">Get keys from <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noopener" style={{ color: "#f6ca72" }}>PayPal Developer Dashboard</a></p>
            <label>Client ID</label>
            <input value={form.paypalClientId} onChange={e => setForm({ ...form, paypalClientId: e.target.value })} placeholder={config?.paypal?.clientId || "A... (client id)"} />
            <label>Client Secret</label>
            <input type="password" value={form.paypalClientSecret} onChange={e => setForm({ ...form, paypalClientSecret: e.target.value })} placeholder={config?.paypal?.clientSecret ? `Current: ${config.paypal.clientSecret}` : "E... (secret)"} />

            <button onClick={saveConfig} disabled={configSaving} style={{ marginTop: 16 }}>
              {configSaving ? "Saving..." : "Save Configuration"}
            </button>
            {configMsg && <p className="hint" style={{ marginTop: 8, color: configMsg.includes("Saved") ? "#10a37f" : "#ef4444" }}>{configMsg}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
