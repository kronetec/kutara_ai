"use client";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.kutara.org/api";

const ICONS = {
  dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  billing: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  logout: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  key: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="15" r="4"/><line x1="10.85" y1="12.15" x2="19" y2="4"/><line x1="18" y1="5" x2="20" y2="7"/><line x1="15" y1="8" x2="17" y2="10"/></svg>`,
};

function Icon({ name, html }) {
  return <span dangerouslySetInnerHTML={{ __html: html || ICONS[name] || "" }} />;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("admin@kutara.org");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [system, setSystem] = useState(null);
  const [tab, setTab] = useState("login");
  const [config, setConfig] = useState(null);
  const [configMsg, setConfigMsg] = useState({ ok: false, text: "" });
  const [configSaving, setConfigSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [resetting, setResetting] = useState(null);
  const [form, setForm] = useState({
    stripeSecretKey: "", stripeWebhookSecret: "", stripeBasicPriceId: "",
    paypalClientId: "", paypalClientSecret: "",
  });
  const [visible, setVisible] = useState({});

  useEffect(() => {
    const t = localStorage.getItem("kutara_admin_token");
    if (t) { setToken(t); setTab("dashboard"); loadData(t); }
  }, []);

  async function login() {
    setError("");
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
    const [u, s, c] = await Promise.all([
      fetch(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
      fetch(`${API_BASE}/admin/system`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
      fetch(`${API_BASE}/admin/config`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
    ]);
    if (u.ok) setUsers(u.users || []);
    if (s.ok) setSystem(s.system);
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
    setConfigSaving(true); setConfigMsg({ ok: false, text: "" });
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
    setConfigMsg({ ok: d.ok, text: d.ok ? "Configuration saved. Restart API to apply." : d.error || "Error" });
    setConfigSaving(false);
    if (d.ok) loadData(token);
  }

  async function resetUser(id) {
    setResetting(id);
    await fetch(`${API_BASE}/admin/users/${id}/reset`, {
      method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("kutara_admin_token")}` }
    });
    loadData(localStorage.getItem("kutara_admin_token"));
    setTimeout(() => setResetting(null), 600);
  }

  function logout() {
    localStorage.removeItem("kutara_admin_token");
    setToken(""); setTab("login");
  }

  function switchTab(t) {
    setTab(t);
    if (t === "billing" && token) loadData(token);
    setConfigMsg({ ok: false, text: "" });
  }

  function toggleVisible(field) {
    setVisible(prev => ({ ...prev, [field]: !prev[field] }));
  }

  function mask(val) {
    if (!val || val.length < 8) return val || "";
    return val.slice(0, 4) + "\u2022".repeat(8) + val.slice(-4);
  }

  if (tab === "login") {
    return (
      <main className="adminLoginPage">
        <div className="adminLoginBg" />
        <div className="adminLoginCard">
          <div className="adminLoginLogo">
            <div className="adminLoginIcon">K</div>
          </div>
          <h1>Kutara AI</h1>
          <p className="adminLoginSub">Admin Panel</p>
          <div className="adminLoginFields">
            <div className="adminField">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@kutara.org" />
            </div>
            <div className="adminField">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && login()} placeholder="Enter password" />
            </div>
          </div>
          {error && <div className="adminLoginError">{error}</div>}
          <button className="adminLoginBtn" onClick={login}>Sign In</button>
          <a href="/" className="adminLoginBack">Back to Chat</a>
        </div>
      </main>
    );
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "users", label: "Users", icon: "users" },
    { id: "billing", label: "Billing", icon: "billing" },
  ];

  return (
    <main className="adminLayout">
      <aside className="adminNav">
        <div className="adminNavBrand">
          <div className="adminNavIcon">K</div>
          <div className="adminNavInfo">
            <strong>Kutara AI</strong>
            <span>Admin Panel</span>
          </div>
        </div>
        <nav className="adminNavLinks">
          {tabs.map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)}
              className={`adminNavLink ${tab === t.id ? "active" : ""}`}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
              {t.id === "users" && users.length > 0 && (
                <span className="adminNavBadge">{users.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="adminNavFooter">
          <button className="adminNavLink logout" onClick={logout}>
            <Icon name="logout" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <section className="adminContent">
        <header className="adminHeader">
          <div>
            <h2>{tabs.find(t => t.id === tab)?.label || ""}</h2>
            <p className="adminHeaderSub">
              {tab === "dashboard" && "System overview and statistics"}
              {tab === "users" && `Manage ${users.length} registered user${users.length !== 1 ? "s" : ""}`}
              {tab === "billing" && "Configure payment provider keys"}
            </p>
          </div>
          {tab === "users" && (
            <div className="adminSearch">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Search users..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
          )}
        </header>

        <div className="adminPanel">
          {tab === "dashboard" && system && (
            <div className="adminDashboard">
              <div className="adminStatsRow">
                <div className="adminStatCard users">
                  <div className="adminStatIcon users"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
                  <div className="adminStatInfo"><span>Total Users</span><strong>{system.users}</strong></div>
                </div>
                <div className="adminStatCard chats">
                  <div className="adminStatIcon chats"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
                  <div className="adminStatInfo"><span>Total Chats</span><strong>{system.chats}</strong></div>
                </div>
                <div className="adminStatCard free">
                  <div className="adminStatIcon free"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
                  <div className="adminStatInfo"><span>Free Users</span><strong>{system.tiers?.free || 0}</strong></div>
                </div>
                <div className="adminStatCard paid">
                  <div className="adminStatIcon paid"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
                  <div className="adminStatInfo"><span>Paid Users</span><strong>{(system.tiers?.basic || 0) + (system.tiers?.pro || 0)}</strong></div>
                </div>
              </div>

              <div className="adminChartCard">
                <h3>Tier Distribution</h3>
                <div className="adminBarChart">
                  {[
                    { label: "Free", value: system.tiers?.free || 0, color: "#6b7280" },
                    { label: "Basic", value: system.tiers?.basic || 0, color: "#f6ca72" },
                    { label: "Pro", value: system.tiers?.pro || 0, color: "#10a37f" },
                  ].map(item => {
                    const max = Math.max(system.tiers?.free || 1, system.tiers?.basic || 1, system.tiers?.pro || 1);
                    const pct = max > 0 ? (item.value / max) * 100 : 0;
                    return (
                      <div key={item.label} className="adminBarItem">
                        <span className="adminBarLabel">{item.label}</span>
                        <div className="adminBarTrack">
                          <div className="adminBarFill" style={{ width: `${pct}%`, background: item.color }} />
                        </div>
                        <span className="adminBarValue">{item.value}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="adminVersionRow">
                  <span className="adminVersionLabel">API Version</span>
                  <span className="adminVersionBadge">{system.version}</span>
                </div>
              </div>
            </div>
          )}

          {tab === "dashboard" && !system && (
            <div className="adminLoading">Loading dashboard...</div>
          )}

          {tab === "users" && (
            <div className="adminTableWrap">
              <table className="adminTable">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Tier</th>
                    <th>Questions</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={5} className="adminEmpty">No users found</td></tr>
                  )}
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td className="adminUserEmail">
                        <span className="adminUserDot" />
                        {u.email}
                      </td>
                      <td><span className={`adminTier ${u.tier}`}>{u.tier}</span></td>
                      <td>
                        <span className={`adminQuestions ${u.questions_remaining === 0 ? "empty" : ""}`}>
                          {u.questions_remaining}
                        </span>
                      </td>
                      <td className="adminDate">{new Date(u.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
                      <td>
                        {u.tier === "free" && (
                          <button className="adminResetBtn" onClick={() => resetUser(u.id)} disabled={resetting === u.id}>
                            {resetting === u.id ? "Resetting..." : "Reset Quota"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "billing" && (
            <div className="adminBilling">
              <div className="adminBillingCard stripe">
                <div className="adminBillingCardHeader">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  <div><h3>Stripe</h3><p>Payment processor for subscriptions</p></div>
                </div>
                <div className="adminField">
                  <label>Secret Key</label>
                  <div className="adminFieldRow">
                    <input type={visible.stripeSecretKey ? "text" : "password"}
                      value={form.stripeSecretKey}
                      onChange={e => setForm({ ...form, stripeSecretKey: e.target.value })}
                      placeholder={config?.stripe?.secretKey ? `Current: ${mask(config.stripe.secretKey)}` : "sk_live_..."} />
                    <button className="adminToggleBtn" onClick={() => toggleVisible("stripeSecretKey")}>
                      {visible.stripeSecretKey ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="adminField">
                  <label>Webhook Secret</label>
                  <div className="adminFieldRow">
                    <input type={visible.stripeWebhookSecret ? "text" : "password"}
                      value={form.stripeWebhookSecret}
                      onChange={e => setForm({ ...form, stripeWebhookSecret: e.target.value })}
                      placeholder={config?.stripe?.webhookSecret ? `Current: ${mask(config.stripe.webhookSecret)}` : "whsec_..."} />
                    <button className="adminToggleBtn" onClick={() => toggleVisible("stripeWebhookSecret")}>
                      {visible.stripeWebhookSecret ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="adminField">
                  <label>Basic Plan Price ID</label>
                  <input value={form.stripeBasicPriceId}
                    onChange={e => setForm({ ...form, stripeBasicPriceId: e.target.value })}
                    placeholder={config?.stripe?.basicPriceId || "price_..."} />
                  <p className="adminFieldHint">Create a product in <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener">Stripe Dashboard</a></p>
                </div>
              </div>

              <div className="adminBillingCard paypal">
                <div className="adminBillingCardHeader">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0070ba" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  <div><h3>PayPal</h3><p>Alternative payment provider</p></div>
                </div>
                <div className="adminField">
                  <label>Client ID</label>
                  <input value={form.paypalClientId}
                    onChange={e => setForm({ ...form, paypalClientId: e.target.value })}
                    placeholder={config?.paypal?.clientId || "A... (client id)"} />
                </div>
                <div className="adminField">
                  <label>Client Secret</label>
                  <div className="adminFieldRow">
                    <input type={visible.paypalClientSecret ? "text" : "password"}
                      value={form.paypalClientSecret}
                      onChange={e => setForm({ ...form, paypalClientSecret: e.target.value })}
                      placeholder={config?.paypal?.clientSecret ? `Current: ${mask(config.paypal.clientSecret)}` : "E... (secret)"} />
                    <button className="adminToggleBtn" onClick={() => toggleVisible("paypalClientSecret")}>
                      {visible.paypalClientSecret ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <button className="adminSaveBtn" onClick={saveConfig} disabled={configSaving}>
                {configSaving ? (
                  <><span className="adminSpinner" /> Saving...</>
                ) : "Save Configuration"}
              </button>
              {configMsg.text && (
                <div className={`adminMsg ${configMsg.ok ? "ok" : "err"}`}>
                  {configMsg.text}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
