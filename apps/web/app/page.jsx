"use client";
import { useEffect, useState, useRef } from "react";

const API_BASE = "https://api.kutara.org/api";

function getToken() { try { return localStorage.getItem("kutara_token"); } catch { return null; } }
function setToken(t) { try { localStorage.setItem("kutara_token", t); } catch {} }
function clearToken() { try { localStorage.removeItem("kutara_token"); } catch {} }

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className="copyBtn" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ lang, code }) {
  return (
    <div className="codeBlock">
      <div className="codeHead">
        <span>{lang || "code"}</span>
        <CopyBtn text={code} />
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function MarkdownView({ content }) {
  const blocks = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) blocks.push({ t: "text", v: content.slice(last, m.index) });
    blocks.push({ t: "code", lang: m[1] || "", v: m[2].trim() });
    last = regex.lastIndex;
  }
  if (last < content.length) blocks.push({ t: "text", v: content.slice(last) });

  return (<div className="markdown">{
    blocks.map((b, i) => b.t === "code"
      ? <CodeBlock key={i} lang={b.lang} code={b.v} />
      : <div key={i} className="mdText">{
          b.v.split("\n").map((l, j) => {
            const line = l.trimEnd();
            if (!line.trim()) return <div key={j} className="mdSpacer" />;
            if (line.startsWith("### ")) return <h3 key={j}>{line.slice(4)}</h3>;
            if (line.startsWith("## ")) return <h2 key={j}>{line.slice(3)}</h2>;
            if (line.startsWith("# ")) return <h1 key={j}>{line.slice(2)}</h1>;
            if (line.startsWith("- ")) return <li key={j}>{line.slice(2)}</li>;
            if (/^\d+\.\s/.test(line)) return <li key={j}>{line.replace(/^\d+\.\s/, "")}</li>;
            return <p key={j}>{line}</p>;
          })
        }</div>)
  }</div>);
}

function ThinkingDots() {
  return (
    <span className="thinkingDots">
      <span className="dot" /><span className="dot" /><span className="dot" />
    </span>
  );
}

const suggestions = [
  "Write a Python script to sort files by date",
  "Explain how DNS works",
  "Create a Docker Compose for PostgreSQL",
  "Write a bash backup script"
];

export default function Home() {
  const [view, setView] = useState("auth");
  const [authMode, setAuthMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [models, setModels] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatSearch, setChatSearch] = useState("");
  const [editingTitle, setEditingTitle] = useState(null);
  const [editTitleVal, setEditTitleVal] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  const filteredChats = chats.filter(c =>
    (c.title || "").toLowerCase().includes(chatSearch.toLowerCase())
  );

  useEffect(() => {
    const checkAuth = async () => {
      const t = getToken();
      if (t) {
        try {
          const r = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
          const d = await r.json();
          if (d.ok) {
            setUser(d.user);
            loadChats();
          }
        } catch (e) { console.error("Auth check failed:", e); }
        if (!user) clearToken();
      }
      setView("chat");
    };
    checkAuth();

    fetch(`${API_BASE}/models`).then(r => r.json()).then(d => {
      if (d.models) setModels(d.models);
    }).catch(() => {});
    fetch(`${API_BASE}/stripe/demo-status`).then(r => r.json()).then(d => {
      if (d.demo !== undefined) setDemoMode(d.demo);
    }).catch(() => {});

    const handleClick = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (view === "chat") setTimeout(() => inputRef.current?.focus(), 100); }, [view]);

  async function loadChats() {
    const t = getToken(); if (!t) return;
    try {
      const r = await fetch(`${API_BASE}/chat`, { headers: { Authorization: `Bearer ${t}` } });
      const d = await r.json();
      if (d.ok) setChats(d.chats || []);
    } catch {}
  }

  async function doAuth(mode) {
    setAuthError(""); setAuthLoading(true);
    try {
      const ep = mode === "login" ? "login" : "register";
      const r = await fetch(`${API_BASE}/auth/${ep}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const d = await r.json();
      if (!d.ok) { setAuthError(d.error || "Failed"); setAuthLoading(false); return; }
      setToken(d.accessToken);
      setUser(d.user);
      setAuthLoading(false);
      setView("chat");
      loadChats();
    } catch (e) {
      setAuthError("Connection error");
      setAuthLoading(false);
      console.error("Auth error:", e);
    }
  }

  function logout() {
    clearToken();
    setView("auth");
    setUser(null);
    setMessages([]);
    setChats([]);
    setActiveChat(null);
    setSidebarOpen(true);
    setUserMenuOpen(false);
  }

  async function handleUpgrade() {
    setUpgradeLoading(true);
    try {
      const t = getToken();
      const r = await fetch(`${API_BASE}/stripe/create-checkout-session`, {
        method: "POST", headers: { Authorization: `Bearer ${t}` }
      });
      const d = await r.json();
      if (d.ok && d.url) { window.location.href = d.url; }
      else { alert(d.error || "Upgrade failed"); }
    } catch { alert("Connection error"); }
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
      if (d.ok && d.url) { window.location.href = d.url; }
      else { alert("No subscription found"); }
    } catch { alert("Connection error"); }
    setUpgradeLoading(false);
  }

  async function sendMessage() {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput(""); setSending(true);
    const userMsg = { role: "user", content: msg };
    const pendingMsg = { role: "assistant", content: null, thinking: true };
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
        if (d.lockout) setTimeout(() => setUser(prev => ({ ...prev, questions_remaining: 0 })), 100);
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

  function newChat() {
    setMessages([]);
    setActiveChat(null);
    setChatSearch("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function loadChat(id) {
    const t = getToken(); if (!t) return;
    try {
      const r = await fetch(`${API_BASE}/chat/${id}`, { headers: { Authorization: `Bearer ${t}` } });
      const d = await r.json();
      if (d.ok && d.chat) {
        setActiveChat({ id: d.chat.id, title: d.chat.title });
        setMessages(d.chat.messages || []);
      }
    } catch {}
  }

  async function deleteChat(id) {
    const t = getToken(); if (!t) return;
    try {
      await fetch(`${API_BASE}/chat/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } });
      if (activeChat?.id === id) { setMessages([]); setActiveChat(null); }
      loadChats();
    } catch {}
  }

  async function renameChat(id) {
    if (!editTitleVal.trim()) { setEditingTitle(null); return; }
    const t = getToken(); if (!t) return;
    try {
      const r = await fetch(`${API_BASE}/chat/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ title: editTitleVal.trim() })
      });
      const d = await r.json();
      if (d.ok && activeChat?.id === id) setActiveChat(prev => ({ ...prev, title: editTitleVal.trim() }));
      loadChats();
    } catch {}
    setEditingTitle(null);
  }

  function getTierLabel() {
    if (!user) return "";
    if (user.tier === "pro") return "Pro";
    if (user.tier === "basic") return "Basic";
    return `Free (${user.questions_remaining || 0})`;
  }

  if (view === "auth") {
    return (
      <main className="authPage">
        <div className="authGlow" />
        <div className="authCard">
          <div className="authLogo">
            <div className="authIcon">K</div>
          </div>
          <h1 className="authTitle">Kutara AI</h1>
          <p className="authSub">{authMode === "login" ? "Welcome back" : "Create your account"}</p>

          <div className="authFields">
            <div className="authField">
              <label>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" />
            </div>
            <div className="authField">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && doAuth(authMode)} placeholder="Min 6 characters" />
            </div>
          </div>

          {authError && <div className="authError">{authError}</div>}

          <button className="authBtn" onClick={() => doAuth(authMode)} disabled={authLoading || !email || !password}>
            {authLoading ? <span className="btnSpinner" /> : authMode === "login" ? "Sign In" : "Create Account"}
          </button>

          <div className="authHint">
            {authMode === "login" ? (
              <>Don't have an account? <button onClick={() => { setAuthMode("register"); setAuthError(""); }}>Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => { setAuthMode("login"); setAuthError(""); }}>Sign in</button></>
            )}
          </div>

          <div className="authFooter">
            Free tier: 5 questions/week. No credit card needed.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="chatShell">
      <aside className={`chatSidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebarHeader">
          <div className="sidebarBrand">
            <div className="sidebarIcon">K</div>
            <div className="sidebarBrandText">
              <strong>Kutara AI</strong>
              <span>{demoMode ? "DEMO" : "v2.0"}</span>
            </div>
          </div>
          <button className="sidebarCloseBtn" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        <button className="newChatBtn" onClick={newChat}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          New Chat
        </button>

        <div className="sidebarSearch">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input value={chatSearch} onChange={e => setChatSearch(e.target.value)} placeholder="Search chats..." />
        </div>

        <div className="sidebarChats">
          {filteredChats.length === 0 && (
            <div className="sidebarEmpty">
              {chatSearch ? "No matching chats" : "No chats yet"}
            </div>
          )}
          {filteredChats.map(chat => (
            <div key={chat.id}
              className={`sidebarChatItem ${activeChat?.id === chat.id ? "active" : ""}`}
              onClick={() => loadChat(chat.id)}>
              <div className="sidebarChatTitle">
                {editingTitle === chat.id ? (
                  <input className="renameInput" value={editTitleVal}
                    onChange={e => setEditTitleVal(e.target.value)}
                    onBlur={() => renameChat(chat.id)}
                    onKeyDown={e => { if (e.key === "Enter") renameChat(chat.id); if (e.key === "Escape") setEditingTitle(null); }}
                    onClick={e => e.stopPropagation()} autoFocus />
                ) : (
                  <span>{chat.title || "Untitled"}</span>
                )}
              </div>
              <div className="sidebarChatActions">
                <button className="chatActionBtn" title="Rename" onClick={e => { e.stopPropagation(); setEditingTitle(chat.id); setEditTitleVal(chat.title || ""); }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
                <button className="chatActionBtn" title="Delete" onClick={e => { e.stopPropagation(); deleteChat(chat.id); }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {user ? (
          <div className="sidebarUser" ref={menuRef}>
            <div className="sidebarUserInfo" onClick={() => setUserMenuOpen(!userMenuOpen)}>
              <div className="sidebarUserAvatar">{user?.email?.[0]?.toUpperCase() || "U"}</div>
              <div className="sidebarUserText">
                <span className="sidebarUserName">{user?.email || "User"}</span>
                <span className={`sidebarTier tier-${user?.tier || "free"}`}>{getTierLabel()}</span>
              </div>
              <svg className={`sidebarChevron ${userMenuOpen ? "open" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            {userMenuOpen && (
              <div className="userMenu">
                <div className="userMenuItem" onClick={() => { setUserMenuOpen(false); logout(); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                  Log out
                </div>
                <div className="userMenuDivider" />
                <div className="userMenuItem muted">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  {demoMode ? "DEMO Mode" : "Production"}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="sidebarUser">
            <button className="newChatBtn" onClick={() => { setView("auth"); setAuthMode("register"); setAuthError(""); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
              Sign In / Register
            </button>
          </div>
        )}
      </aside>

      {sidebarOpen && <div className="sidebarOverlay" onClick={() => setSidebarOpen(false)} />}

      <section className="chatMain">
        <header className="chatTopbar">
          <div className="topbarLeft">
            <button className="menuBtn" onClick={() => setSidebarOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <div className="topbarTitle">
              <h2>{activeChat?.title || "New conversation"}</h2>
            </div>
          </div>
          <div className="topbarRight">
            {!user && <span className="anonBadge">Anonymous</span>}
            <select className="modelSelect" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
              <option value="">Auto ({user?.tier === "pro" ? "Claude" : user?.tier === "basic" ? "Llama 70B" : "Llama 8B"})</option>
              {models.filter(m => m.tier === "free" || m.tier === user?.tier || !user).map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.tier})</option>
              ))}
            </select>
            {user?.tier === "free" && (
              <button className="upgradeBtn" onClick={handleUpgrade} disabled={upgradeLoading}>
                {demoMode ? "Upgrade (DEMO)" : "Upgrade"}
              </button>
            )}
            {user?.tier === "basic" && (
              <button className="upgradeBtn outline" onClick={handleManageSubscription} disabled={upgradeLoading}>
                {demoMode ? "Manage (DEMO)" : "Manage"}
              </button>
            )}
            {!user && (
              <button className="upgradeBtn" onClick={() => { setView("auth"); setAuthMode("register"); setAuthError(""); }}>
                Sign Up Free
              </button>
            )}
          </div>
        </header>

        <div className="chatMessages">
          {messages.length === 0 ? (
            <div className="chatEmpty">
              <div className="chatEmptyIcon">K</div>
              <h2 className="chatEmptyTitle">How can I help you today?</h2>
              <div className="chatEmptyGrid">
                {suggestions.map((s, i) => (
                  <button key={i} className="suggestionChip" onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z"/><path d="M5 12h2M17 12h2M12 17v4"/></svg>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((item, i) => (
                <div key={i} className={`msgRow ${item.role}`}>
                  <div className="msgAvatar">
                    {item.role === "user"
                      ? (user?.email?.[0]?.toUpperCase() || "U")
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z"/><path d="M5 12h2M17 12h2M12 17v4"/></svg>
                    }
                  </div>
                  <div className="msgContent">
                    {item.role === "user" ? (
                      <div className="msgUserText">{item.content}</div>
                    ) : item.thinking ? (
                      <div className="msgThinking">
                        <ThinkingDots />
                        <span>Thinking...</span>
                      </div>
                    ) : (
                      <div className="msgAssistant">
                        <MarkdownView content={item.content} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          <div ref={endRef} />
        </div>

        <div className="chatBottom">
          <div className="composerWrap">
            <div className="composer">
              <textarea ref={inputRef} placeholder="Message Kutara..." value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                rows={1} />
              <button className="sendBtn" onClick={sendMessage} disabled={sending || !input.trim()}>
                {sending ? <span className="btnSpinner" /> : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                )}
              </button>
            </div>
            <p className="composerHint">
              Kutara AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
