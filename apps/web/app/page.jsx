"use client";
import { useEffect, useState, useRef } from "react";

const API_BASE = "https://api.kutara.org";

function getToken() { return typeof window !== "undefined" ? localStorage.getItem("kutara_token") : null; }
function setToken(t) { localStorage.setItem("kutara_token", t); }
function clearToken() { localStorage.removeItem("kutara_token"); }

function MarkdownView({ content }) {
  const blocks = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) blocks.push({ type: "text", value: content.slice(last, m.index) });
    blocks.push({ type: "code", lang: m[1] || "text", value: m[2].trim() });
    last = regex.lastIndex;
  }
  if (last < content.length) blocks.push({ type: "text", value: content.slice(last) });

  return (<div className="markdown">{
    blocks.map((b, i) => b.type === "code" ? (
      <div className="codeBlock" key={i}>
        <div className="codeTop"><span>{b.lang}</span><button onClick={() => navigator.clipboard.writeText(b.value)}>Copy</button></div>
        <pre><code>{b.value}</code></pre>
      </div>
    ) : (
      <div key={i}>{b.value.split("\n").map((l, j) => {
        const line = l.trimEnd();
        if (!line.trim()) return <div key={j} className="spaceLine" />;
        if (line.startsWith("### ")) return <h3 key={j}>{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h2 key={j}>{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h1 key={j}>{line.slice(2)}</h1>;
        if (line.startsWith("- ")) return <li key={j}>{line.slice(2)}</li>;
        if (/^\d+\.\s/.test(line)) return <li key={j}>{line.replace(/^\d+\.\s/, "")}</li>;
        return <p key={j}>{line}</p>;
      })}</div>
    ))
  }</div>);
}

export default function Home() {
  const [view, setView] = useState("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [models, setModels] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const t = getToken();
    if (t) {
      fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.json()).then(d => { if (d.ok) { setUser(d.user); setView("chat"); loadChats(); } else clearToken(); })
        .catch(() => {});
    }
    fetch(`${API_BASE}/models`).then(r => r.json()).then(d => setModels(d.models || [])).catch(() => {});
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadChats() {
    const t = getToken(); if (!t) return;
    const r = await fetch(`${API_BASE}/chat`, { headers: { Authorization: `Bearer ${t}` } });
    const d = await r.json();
    if (d.ok) setChats(d.chats || []);
  }

  async function login() {
    setAuthError(""); setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!d.ok) { setAuthError(d.error || "Login failed"); setLoading(false); return; }
      setToken(d.accessToken); setUser(d.user); setView("chat"); setLoading(false); loadChats();
    } catch { setAuthError("Connection error"); setLoading(false); }
  }

  async function register() {
    setAuthError(""); setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!d.ok) { setAuthError(d.error || "Register failed"); setLoading(false); return; }
      setToken(d.accessToken); setUser(d.user); setView("chat"); setLoading(false); loadChats();
    } catch { setAuthError("Connection error"); setLoading(false); }
  }

  function logout() { clearToken(); setUser(null); setView("auth"); setMessages([]); setChats([]); setActiveChat(null); }

  async function handleUpgrade() {
    setUpgradeLoading(true);
    try {
      const t = getToken();
      const r = await fetch(`${API_BASE}/stripe/create-checkout-session`, {
        method: "POST", headers: { Authorization: `Bearer ${t}` }
      });
      const d = await r.json();
      if (d.ok && d.url) {
        window.location.href = d.url;
      } else {
        alert(d.error || "Upgrade failed");
      }
    } catch {
      alert("Connection error");
    }
    setUpgradeLoading(false);
  }

  async function handleManageSubscription() {
    setUpgradeLoading(true);
    try {
      const t = getToken();
      const r = await fetch(`${API_BASE}/stripe/create-portal-session`, {
        method: "POST", headers: { Authorization: `Bearer ${t}` }
      });
      const d = await r.json();
      if (d.ok && d.url) {
        window.location.href = d.url;
      } else {
        alert("No subscription found");
      }
    } catch {
      alert("Connection error");
    }
    setUpgradeLoading(false);
  }

  async function sendMessage() {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput(""); setSending(true);
    const userMsg = { role: "user", content: msg };
    const pendingMsg = { role: "assistant", content: "..." };
    setMessages(prev => [...prev, userMsg, pendingMsg]);

    try {
      const t = getToken();
      const r = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ message: msg, model: selectedModel || undefined, chatId: activeChat?.id || undefined })
      });
      const d = await r.json();
      if (d.ok) {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: d.response };
          return next;
        });
        if (d.questionsRemaining !== undefined) setUser(prev => ({ ...prev, questions_remaining: d.questionsRemaining }));
        loadChats();
      } else {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `Error: ${d.error || "Unknown error"}` };
          return next;
        });
        if (d.lockout) setTimeout(() => { setUser(prev => ({ ...prev, questions_remaining: 0 })); }, 100);
      }
    } catch {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: "Connection error. Check API." };
        return next;
      });
    }
    setSending(false);
  }

  function newChat() { setMessages([]); setActiveChat(null); }

  async function loadChat(id) {
    const t = getToken(); if (!t) return;
    const r = await fetch(`${API_BASE}/chat/${id}`, { headers: { Authorization: `Bearer ${t}` } });
    const d = await r.json();
    if (d.ok && d.chat) {
      setActiveChat({ id: d.chat.id, title: d.chat.title });
      setMessages(d.chat.messages || []);
    }
  }

  function getTierLabel() {
    if (!user) return "";
    if (user.tier === "pro") return "Pro";
    if (user.tier === "basic") return "Basic";
    return `Free (${user.questions_remaining || 0} left)`;
  }

  if (view === "auth") {
    return (
      <main className="authPage">
        <div className="authCard">
          <div className="brand" style={{ marginBottom: 18 }}>
            <div className="brandIcon">K</div>
            <div><h1>Kutara AI</h1><p>Sign in to your account</p></div>
          </div>
          <label>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} placeholder="Min 6 characters" />
          {authError && <div className="authError">{authError}</div>}
          <button onClick={register} disabled={loading}>{loading ? "Loading..." : "Sign Up"}</button>
          <button onClick={login} disabled={loading} style={{ marginTop: 8, background: "#2f2f2f", color: "#ececec", border: "1px solid rgba(255,255,255,0.12)" }}>
            {loading ? "Loading..." : "Sign In"}
          </button>
          <p className="hint" style={{ marginTop: 16 }}>Free tier: 5 questions per week. No credit card needed.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brandRow" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="brand">
            <div className="brandIcon">K</div>
            <div><h1>Kutara AI</h1><p>{user?.email || "User"}</p></div>
          </div>
        </div>
        <button className="newChat" onClick={newChat}>+ New Chat</button>
        <div className="sideTitle">Chat History</div>
        <div style={{ flex: 1, overflow: "auto", display: "grid", gap: 2 }}>
          {chats.map(chat => (
            <button key={chat.id} onClick={() => loadChat(chat.id)}
              style={{ border: 0, borderRadius: 8, background: "transparent", color: "#d8d8d8", textAlign: "left", padding: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {chat.title || "Untitled"}
            </button>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span className={`tierBadge ${user?.tier || "free"}`}>{getTierLabel()}</span>
          </div>
          {(user?.tier === "free") ? (
            <button onClick={handleUpgrade} disabled={upgradeLoading}
              style={{ border: 0, background: "linear-gradient(145deg, #f6ca72, #b97422)", color: "#111", borderRadius: 8, padding: 10, width: "100%", textAlign: "left", fontWeight: 600, marginBottom: 8 }}>
              {upgradeLoading ? "Loading..." : "⬆ Upgrade to Basic - €5/mo"}
            </button>
          ) : (user?.tier === "basic") ? (
            <button onClick={handleManageSubscription} disabled={upgradeLoading}
              style={{ border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#f6ca72", borderRadius: 8, padding: 10, width: "100%", textAlign: "left", marginBottom: 8 }}>
              {upgradeLoading ? "Loading..." : "⚙ Manage Subscription"}
            </button>
          ) : null}
          <button onClick={logout} style={{ border: 0, background: "rgba(255,80,80,0.08)", color: "#ffb4b4", borderRadius: 8, padding: 10, width: "100%", textAlign: "left" }}>Logout</button>
        </div>
        <div className="footer"><span>Code by</span><strong>CodeTiger.de</strong></div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div><h2>KAIM Chat</h2><p>{activeChat?.title || "New conversation"}</p></div>
          <div className="selectors">
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
              <option value="">Auto ({user?.tier === "pro" ? "Claude" : user?.tier === "basic" ? "Llama 70B" : "Llama 8B"})</option>
              {models.filter(m => m.tier === "free" || m.tier === user?.tier).map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.tier})</option>
              ))}
            </select>
          </div>
        </header>

        <section className="messages">
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: "#888" }}>
              <h2 style={{ margin: "0 0 8px" }}>Kutara AI</h2>
              <p>Ask anything. Free built-in AI models are active.</p>
              <div className="hint">Always responds in your language</div>
            </div>
          )}
          {messages.map((item, i) => (
            <div key={i} className={`message ${item.role}`}>
              <div className="messageInner">
                <div className="avatar">{item.role === "user" ? "U" : "K"}</div>
                <div className="messageBody">
                  <div className="meta">
                    <strong>{item.role === "user" ? "You" : "KAIM"}</strong>
                    {item.content === "..." && <span style={{ color: "#f6ca72" }}>thinking...</span>}
                  </div>
                  {item.content !== "..." && <MarkdownView content={item.content} />}
                  {item.content === "..." && <div style={{ color: "#888" }}>Generating response...</div>}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </section>

        <section className="quickBar">
          <button onClick={() => { setInput("Create a website blueprint"); }}>Website</button>
          <button onClick={() => { setInput("Create an SSH setup plan"); }}>SSH</button>
          <button onClick={() => { setInput("Create a Docker Compose template"); }}>Docker</button>
          <button onClick={() => { setInput("Explain DNS records"); }}>DNS</button>
        </section>

        <section className="composerWrap">
          <div className="composer">
            <textarea placeholder="Message KAIM..." value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <button onClick={sendMessage} disabled={sending || !input.trim()}>{sending ? "..." : "➤"}</button>
          </div>
          <p className="hint">Kutara AI v2 - Powered by open source AI models</p>
        </section>
      </section>
    </main>
  );
}
