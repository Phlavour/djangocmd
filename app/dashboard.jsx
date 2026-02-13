import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ═══════════════════════════════════════════════════════════════
// THEME & CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DARK = {
  bg: "#06060a", bg2: "#0c0c12", surface: "#101018", surfaceAlt: "#14141e",
  card: "#131320", cardHover: "#191930", border: "#1a1a2e", borderHi: "#252545",
  text: "#dfe0eb", textSoft: "#8888a4", textDim: "#4a4a65",
  green: "#00e87b", greenDim: "rgba(0,232,123,.08)", greenMid: "rgba(0,232,123,.18)",
  red: "#ff3b5c", redDim: "rgba(255,59,92,.08)",
  blue: "#3d8bfd", blueDim: "rgba(61,139,253,.08)",
  amber: "#f0a030", amberDim: "rgba(240,160,48,.08)",
  purple: "#9966ff", purpleDim: "rgba(153,102,255,.08)",
  cyan: "#00d4ff", cyanDim: "rgba(0,212,255,.08)",
};

const LIGHT = {
  bg: "#f4f5f7", bg2: "#edeef2", surface: "#ffffff", surfaceAlt: "#f8f8fb",
  card: "#ffffff", cardHover: "#f0f0f5", border: "#d8dae5", borderHi: "#c0c2d0",
  text: "#1a1a2e", textSoft: "#5c5c7a", textDim: "#9898b0",
  green: "#00b85e", greenDim: "rgba(0,184,94,.07)", greenMid: "rgba(0,184,94,.16)",
  red: "#e0334e", redDim: "rgba(224,51,78,.07)",
  blue: "#2d72e5", blueDim: "rgba(45,114,229,.07)",
  amber: "#d48c1a", amberDim: "rgba(212,140,26,.07)",
  purple: "#7744dd", purpleDim: "rgba(119,68,221,.07)",
  cyan: "#0099cc", cyanDim: "rgba(0,153,204,.07)",
};

let T = DARK;

const PILLAR_COLORS = {
  Growth: T.green, Market: T.blue, Lifestyle: T.purple,
  Busting: T.amber, Shitpost: T.red,
};

const TABS_CONFIG = {
  DRAFT: { color: T.blue, icon: "✎", label: "Draft" },
  POST: { color: T.green, icon: "◉", label: "Post" },
  USED: { color: T.textDim, icon: "✓", label: "Used" },
  DATABASE: { color: T.purple, icon: "◈", label: "Database" },
  BAD: { color: T.red, icon: "✕", label: "Bad" },
};

const STATUS_ORDER = ["DRAFT", "POST", "USED", "DATABASE", "BAD"];

// ═══════════════════════════════════════════════════════════════
// INITIAL DATA
// ═══════════════════════════════════════════════════════════════

const ACCOUNTS = [
  { handle: "@django_crypto", name: "Django", avatar: "/pfp-django.jpg", gradient: ["#00e87b", "#00a855"] },
  { handle: "@henryk0x", name: "Henryk", avatar: "/pfp-henryk.png", gradient: ["#3d8bfd", "#6644ff"] },
];

const INITIAL_POSTS = [
  { id: 1, text: "most people chase pumps. the real ones accumulate during silence. your patience is your edge, fam", pillar: "Growth", tab: "DRAFT", score: 8.4, account: "@django_crypto", created: "2026-02-13" },
  { id: 2, text: "btc holding 97k support like a champ. if this level flips resistance we're looking at 105k easy", pillar: "Market", tab: "DRAFT", score: 7.1, account: "@django_crypto", created: "2026-02-13" },
  { id: 3, text: "woke up at 5am, hit the gym, researched 3 alts before breakfast. discipline > motivation", pillar: "Lifestyle", tab: "POST", score: 9.2, account: "@django_crypto", created: "2026-02-12" },
  { id: 4, text: "'this altcoin will 100x' - said every bagholder about their -90% coin. dyor fam", pillar: "Busting", tab: "DRAFT", score: 8.7, account: "@django_crypto", created: "2026-02-13" },
  { id: 5, text: "me explaining to my gf why i need 4 monitors to watch charts that all look the same", pillar: "Shitpost", tab: "DRAFT", score: 7.8, account: "@django_crypto", created: "2026-02-13" },
  { id: 6, text: "the difference between you and a whale? they bought when you were scared", pillar: "Growth", tab: "POST", score: 8.9, account: "@django_crypto", created: "2026-02-12" },
  { id: 7, text: "stop asking 'when alt season' and start asking 'am i positioned for alt season'", pillar: "Growth", tab: "USED", score: 9.1, account: "@django_crypto", created: "2026-02-10" },
  { id: 8, text: "bull markets make you money. bear markets make you rich. if you understand this you're already ahead", pillar: "Growth", tab: "DATABASE", score: 8.8, account: "@django_crypto", created: "2026-02-08" },
  { id: 9, text: "polymarket is the crystal ball wall street wishes it had", pillar: "Market", tab: "DRAFT", score: 7.5, account: "@henryk0x", created: "2026-02-13" },
  { id: 10, text: "building in public means showing the ugly parts too. here's what went wrong this week", pillar: "Growth", tab: "DRAFT", score: 8.2, account: "@henryk0x", created: "2026-02-13" },
];

const INITIAL_RESEARCH = [
  { id: 1, headline: "BTC breaks 98k resistance — institutional buying accelerates", source: "Grok Research", category: "crypto", date: "2026-02-13", saved: false, account: "@django_crypto" },
  { id: 2, headline: "Polymarket volume hits ATH on presidential approval markets", source: "Grok Research", category: "crypto", date: "2026-02-13", saved: true, account: "@django_crypto" },
  { id: 3, headline: "SEC signals softer stance on DeFi regulation", source: "Grok Research", category: "crypto", date: "2026-02-13", saved: false, account: "@django_crypto" },
  { id: 4, headline: "ETH/BTC ratio at 2-year low — rotation incoming?", source: "Grok Research", category: "trading", date: "2026-02-13", saved: true, account: "@django_crypto" },
  { id: 5, headline: "New meme coin meta: AI agents trading autonomously", source: "Grok Research", category: "viral", date: "2026-02-13", saved: false, account: "@henryk0x" },
];

const MOCK_ANALYTICS = [
  { date: "Feb 7", impressions: 18200, engagement: 3.8, followers: 2791, likes: 128, retweets: 34, replies: 41 },
  { date: "Feb 8", impressions: 22400, engagement: 4.2, followers: 2798, likes: 156, retweets: 42, replies: 52 },
  { date: "Feb 9", impressions: 19800, engagement: 3.9, followers: 2805, likes: 138, retweets: 36, replies: 44 },
  { date: "Feb 10", impressions: 31200, engagement: 5.1, followers: 2814, likes: 247, retweets: 67, replies: 71 },
  { date: "Feb 11", impressions: 26800, engagement: 4.6, followers: 2825, likes: 198, retweets: 55, replies: 58 },
  { date: "Feb 12", impressions: 29100, engagement: 5.3, followers: 2838, likes: 223, retweets: 61, replies: 63 },
  { date: "Feb 13", impressions: 35500, engagement: 5.8, followers: 2847, likes: 284, retweets: 78, replies: 82 },
];

// ═══════════════════════════════════════════════════════════════
// MICRO COMPONENTS
// ═══════════════════════════════════════════════════════════════

const Dot = ({ color = T.green, pulse }) => (
  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: pulse ? `0 0 8px ${color}` : "none" }} />
);

const Badge = ({ children, color = T.green, bg }) => (
  <span style={{ fontSize: 10, fontWeight: 600, color, background: bg || `${color}18`, padding: "2px 8px", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: ".02em" }}>{children}</span>
);

const Btn = ({ children, color = T.green, outline, small, onClick, disabled, style: sx }) => (
  <button disabled={disabled} onClick={onClick} style={{
    background: outline ? "transparent" : `${color}14`,
    border: `1px solid ${outline ? T.border : `${color}40`}`,
    borderRadius: 7, padding: small ? "4px 10px" : "8px 16px",
    color: disabled ? T.textDim : (outline ? T.textSoft : color),
    fontSize: small ? 10 : 12, fontWeight: 600, cursor: disabled ? "default" : "pointer",
    transition: "all .15s", fontFamily: "'IBM Plex Mono', monospace", opacity: disabled ? .4 : 1, ...sx,
  }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = `${color}20`; }}}
    onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = outline ? T.border : `${color}40`; e.currentTarget.style.background = outline ? "transparent" : `${color}14`; }}}
  >{children}</button>
);

const Card = ({ children, style: sx, hover }) => {
  const isLight = T === LIGHT;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, transition: "all .15s", boxShadow: isLight ? "0 1px 3px rgba(0,0,0,.06)" : "none", ...sx }}
      onMouseEnter={hover ? e => { e.currentTarget.style.borderColor = T.borderHi; } : undefined}
      onMouseLeave={hover ? e => { e.currentTarget.style.borderColor = T.border; } : undefined}
    >{children}</div>
  );
};

const Heading = ({ children, icon, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.text, fontFamily: "'Satoshi', sans-serif", textTransform: "uppercase", letterSpacing: ".06em", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ opacity: .5 }}>{icon}</span>{children}
    </h3>
    {right}
  </div>
);

const Stat = ({ label, value, suffix, sub, color = T.green }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
    <div style={{ fontSize: 10, color: T.textSoft, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5, fontFamily: "'IBM Plex Mono', monospace" }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: "'Satoshi', sans-serif" }}>
      {typeof value === "number" ? value.toLocaleString() : value}
      {suffix && <span style={{ fontSize: 12, color: T.textSoft, marginLeft: 3 }}>{suffix}</span>}
    </div>
    {sub && <div style={{ fontSize: 10, color: sub.startsWith("+") ? T.green : sub.startsWith("-") ? T.red : T.textSoft, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>{sub}</div>}
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)`, opacity: .4 }} />
  </div>
);

const TabBtn = ({ label, active, onClick, color = T.green, count }) => (
  <button onClick={onClick} style={{
    background: active ? `${color}12` : "transparent", border: `1px solid ${active ? `${color}50` : T.border}`,
    borderRadius: 7, padding: "7px 14px", color: active ? color : T.textSoft, fontSize: 12, fontWeight: 600,
    cursor: "pointer", transition: "all .15s", fontFamily: "'IBM Plex Mono', monospace", display: "flex", alignItems: "center", gap: 6,
  }}>{label}{count !== undefined && <span style={{ background: active ? color : T.borderHi, color: active ? T.bg : T.textSoft, borderRadius: 8, padding: "1px 6px", fontSize: 9, fontWeight: 700 }}>{count}</span>}</button>
);

const AccountPill = ({ account, active, onClick }) => {
  const acc = ACCOUNTS.find(a => a.handle === account) || ACCOUNTS[0];
  const hasImage = acc.avatar.startsWith("/");
  return (
    <button onClick={onClick} style={{
      background: active ? T.surfaceAlt : "transparent", border: `1px solid ${active ? T.borderHi : T.border}`,
      borderRadius: 20, padding: "6px 14px 6px 6px", display: "flex", alignItems: "center", gap: 8,
      cursor: "pointer", transition: "all .15s",
    }}>
      {hasImage ? (
        <img src={acc.avatar} alt={acc.name} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", border: `2px solid ${active ? acc.gradient[0] : T.border}` }} />
      ) : (
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg,${acc.gradient[0]},${acc.gradient[1]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: T.bg }}>{acc.avatar}</div>
      )}
      <span style={{ fontSize: 12, color: active ? T.text : T.textSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{acc.handle}</span>
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN NAV TABS
// ═══════════════════════════════════════════════════════════════

const NAV = [
  { id: "twitter", icon: "𝕏", label: "Twitter" },
  { id: "health", icon: "♥", label: "Health", disabled: true },
  { id: "bots", icon: "⬡", label: "Bots", disabled: true },
];

// ═══════════════════════════════════════════════════════════════
// TWITTER SUB-PANELS
// ═══════════════════════════════════════════════════════════════

// ─── DAILY RESEARCH ────────────────────────────────────────────

function DailyResearch({ account, research, setResearch }) {
  const [input, setInput] = useState("");
  const items = research.filter(r => r.account === account);

  const addManual = () => {
    if (!input.trim()) return;
    const lines = input.split("\n").filter(l => l.trim());
    const newItems = lines.map((line, i) => ({
      id: Date.now() + i, headline: line.trim(), source: "Manual Input",
      category: "general", date: new Date().toISOString().slice(0, 10),
      saved: false, account,
    }));
    setResearch(prev => [...prev, ...newItems]);
    setInput("");
  };

  return (
    <div>
      {/* Input Area */}
      <Card style={{ marginBottom: 20 }}>
        <Heading icon="⌨">Add Research</Heading>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder="Paste Grok output here... (one item per line, or paste full text)"
          style={{
            width: "100%", minHeight: 100, background: T.bg2, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: 14, color: T.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace",
            resize: "vertical", lineHeight: 1.6, outline: "none", boxSizing: "border-box",
          }}
          onFocus={e => e.target.style.borderColor = T.green}
          onBlur={e => e.target.style.borderColor = T.border}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Btn onClick={addManual} color={T.green}>+ Add Items</Btn>
          <Btn outline color={T.textSoft}>Upload JSON</Btn>
          <Btn outline color={T.textSoft}>Upload CSV</Btn>
        </div>
      </Card>

      {/* Research Items */}
      <Heading icon="🔍" right={<Badge color={T.textSoft}>Today: {items.filter(r => r.date === "2026-02-13").length} items</Badge>}>
        Research Feed
      </Heading>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: T.textDim, fontSize: 13 }}>
            No research items yet. Paste Grok output above to get started.
          </div>
        )}
        {items.map(item => (
          <div key={item.id} style={{
            background: T.surface, border: `1px solid ${item.saved ? T.greenMid : T.border}`,
            borderRadius: 10, padding: "12px 16px", display: "flex", gap: 14, alignItems: "center",
            transition: "all .12s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.borderHi}
            onMouseLeave={e => e.currentTarget.style.borderColor = item.saved ? T.greenMid : T.border}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5, marginBottom: 6 }}>{item.headline}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Badge color={T.textSoft}>{item.category}</Badge>
                <Badge color={T.textDim}>{item.date}</Badge>
                <Badge color={T.textDim}>{item.source}</Badge>
              </div>
            </div>
            <Btn small color={item.saved ? T.green : T.textSoft}
              onClick={() => setResearch(prev => prev.map(r => r.id === item.id ? { ...r, saved: !r.saved } : r))}>
              {item.saved ? "★ Saved" : "☆ Save"}
            </Btn>
            <Btn small color={T.red} outline
              onClick={() => setResearch(prev => prev.filter(r => r.id !== item.id))}>
              ✕
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WEEKLY CONTENT ────────────────────────────────────────────

function WeeklyContent({ account, posts, setPosts }) {
  const [activeTab, setActiveTab] = useState("DRAFT");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  const accountPosts = posts.filter(p => p.account === account);
  const tabPosts = accountPosts.filter(p => p.tab === activeTab);

  const movePost = (id, newTab) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, tab: newTab } : p));
  };

  const startEdit = (post) => {
    setEditId(post.id);
    setEditText(post.text);
  };

  const saveEdit = () => {
    setPosts(prev => prev.map(p => p.id === editId ? { ...p, text: editText } : p));
    setEditId(null);
    setEditText("");
  };

  const getNextTabs = (currentTab) => {
    const idx = STATUS_ORDER.indexOf(currentTab);
    return STATUS_ORDER.filter((_, i) => i !== idx);
  };

  return (
    <div>
      {/* Content Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUS_ORDER.map(tab => (
          <TabBtn key={tab} label={`${TABS_CONFIG[tab].icon} ${TABS_CONFIG[tab].label}`}
            active={activeTab === tab} onClick={() => setActiveTab(tab)}
            color={TABS_CONFIG[tab].color}
            count={accountPosts.filter(p => p.tab === tab).length}
          />
        ))}
      </div>

      {/* Content Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
        {STATUS_ORDER.map(tab => (
          <div key={tab} style={{
            background: activeTab === tab ? `${TABS_CONFIG[tab].color}10` : T.surface,
            border: `1px solid ${activeTab === tab ? `${TABS_CONFIG[tab].color}30` : T.border}`,
            borderRadius: 8, padding: "10px 12px", textAlign: "center", cursor: "pointer",
            transition: "all .15s",
          }} onClick={() => setActiveTab(tab)}>
            <div style={{ fontSize: 20, fontWeight: 700, color: TABS_CONFIG[tab].color, fontFamily: "'Satoshi', sans-serif" }}>
              {accountPosts.filter(p => p.tab === tab).length}
            </div>
            <div style={{ fontSize: 9, color: T.textSoft, textTransform: "uppercase", letterSpacing: ".08em" }}>{tab}</div>
          </div>
        ))}
      </div>

      {/* Posts List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tabPosts.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: T.textDim, fontSize: 13 }}>
            No posts in {TABS_CONFIG[activeTab].label}
          </div>
        )}
        {tabPosts.map(post => (
          <div key={post.id} style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: 16, transition: "all .12s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = TABS_CONFIG[activeTab].color + "40"}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
          >
            {editId === post.id ? (
              <div>
                <textarea value={editText} onChange={e => setEditText(e.target.value)}
                  style={{ width: "100%", minHeight: 60, background: T.bg2, border: `1px solid ${T.borderHi}`, borderRadius: 8, padding: 12, color: T.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical", lineHeight: 1.5, outline: "none", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <Btn small color={T.green} onClick={saveEdit}>Save</Btn>
                  <Btn small outline onClick={() => setEditId(null)}>Cancel</Btn>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 10 }}>{post.text}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Badge color={PILLAR_COLORS[post.pillar] || T.textSoft}>{post.pillar}</Badge>
                    <Badge color={T.textDim}>{post.created}</Badge>
                    {post.score && <Badge color={post.score >= 8.5 ? T.green : post.score >= 7 ? T.amber : T.textSoft}>Score {post.score}</Badge>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Btn small outline onClick={() => startEdit(post)}>Edit</Btn>
                    {getNextTabs(activeTab).map(tab => (
                      <Btn key={tab} small color={TABS_CONFIG[tab].color}
                        onClick={() => movePost(post.id, tab)}>
                        → {TABS_CONFIG[tab].label}
                      </Btn>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add New Post */}
      <AddPostForm account={account} setPosts={setPosts} />
    </div>
  );
}

function AddPostForm({ account, setPosts }) {
  const [show, setShow] = useState(false);
  const [text, setText] = useState("");
  const [pillar, setPillar] = useState("Growth");

  const add = () => {
    if (!text.trim()) return;
    setPosts(prev => [...prev, {
      id: Date.now(), text: text.trim(), pillar, tab: "DRAFT",
      score: null, account, created: new Date().toISOString().slice(0, 10),
    }]);
    setText("");
    setShow(false);
  };

  if (!show) return (
    <div style={{ marginTop: 16, textAlign: "center" }}>
      <Btn color={T.green} onClick={() => setShow(true)}>+ Add New Post</Btn>
    </div>
  );

  return (
    <Card style={{ marginTop: 16 }}>
      <Heading icon="✎">New Post</Heading>
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder="write your post fam..."
        style={{ width: "100%", minHeight: 80, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, color: T.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical", lineHeight: 1.5, outline: "none", boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = T.green}
        onBlur={e => e.target.style.borderColor = T.border}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <select value={pillar} onChange={e => setPillar(e.target.value)} style={{
          background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 10px",
          color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none",
        }}>
          {Object.keys(PILLAR_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <Btn color={T.green} onClick={add}>Add to DRAFT</Btn>
        <Btn outline onClick={() => setShow(false)}>Cancel</Btn>
      </div>
    </Card>
  );
}

// ─── WEEKLY ANALYTICS ─────────────────────────────────────────

function WeeklyAnalytics({ account }) {
  const [data, setData] = useState(MOCK_ANALYTICS);
  const [metric, setMetric] = useState("impressions");

  const latest = data[data.length - 1] || {};
  const prev = data[data.length - 2] || {};
  const delta = (key) => {
    if (!prev[key]) return "";
    const d = ((latest[key] - prev[key]) / prev[key] * 100).toFixed(1);
    return d > 0 ? `+${d}%` : `${d}%`;
  };

  const totalImpressions = data.reduce((s, d) => s + d.impressions, 0);
  const avgEngagement = (data.reduce((s, d) => s + d.engagement, 0) / data.length).toFixed(1);
  const totalLikes = data.reduce((s, d) => s + d.likes, 0);
  const followerGrowth = data.length > 1 ? data[data.length - 1].followers - data[0].followers : 0;

  // Best posting day
  const bestDay = [...data].sort((a, b) => b.engagement - a.engagement)[0];

  // Pillar performance (mock)
  const pillarPerf = [
    { name: "Growth", engagement: 5.4, posts: 17, color: T.green },
    { name: "Market", engagement: 4.1, posts: 6, color: T.blue },
    { name: "Lifestyle", engagement: 4.8, posts: 6, color: T.purple },
    { name: "Busting", engagement: 5.1, posts: 6, color: T.amber },
    { name: "Shitpost", engagement: 3.9, posts: 7, color: T.red },
  ];

  // Hourly heatmap data (mock)
  const heatmapData = [];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = [8, 10, 12, 14, 16, 18, 20, 22];
  days.forEach(day => {
    hours.forEach(hour => {
      heatmapData.push({ day, hour, value: Math.random() * 10 });
    });
  });

  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.split("\n").filter(l => l.trim());
        if (lines.length < 2) return;
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        const parsed = lines.slice(1).map(line => {
          const vals = line.split(",");
          const row = {};
          headers.forEach((h, i) => {
            const v = vals[i]?.trim();
            row[h] = isNaN(v) ? v : parseFloat(v);
          });
          return row;
        }).filter(r => r.date);
        if (parsed.length > 0) setData(parsed);
      } catch (err) { /* silent fail */ }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      {/* CSV Upload */}
      <Card style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 4 }}>Import Analytics</div>
          <div style={{ fontSize: 11, color: T.textSoft }}>Upload CSV from X Analytics export. Columns: date, impressions, engagement, followers, likes, retweets, replies</div>
        </div>
        <label style={{ cursor: "pointer" }}>
          <input type="file" accept=".csv" onChange={handleCSV} style={{ display: "none" }} />
          <Btn color={T.cyan} style={{ pointerEvents: "none" }}>Upload CSV</Btn>
        </label>
      </Card>

      {/* Key Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <Stat label="Total Impressions" value={totalImpressions} sub={delta("impressions")} color={T.green} />
        <Stat label="Avg Engagement" value={avgEngagement} suffix="%" sub={delta("engagement")} color={T.blue} />
        <Stat label="Total Likes" value={totalLikes} sub={delta("likes")} color={T.red} />
        <Stat label="Follower Growth" value={`+${followerGrowth}`} sub={`→ ${latest.followers || "?"}`} color={T.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Main Chart */}
        <Card>
          <Heading icon="📈" right={
            <div style={{ display: "flex", gap: 4 }}>
              {["impressions", "engagement", "likes", "followers"].map(m => (
                <TabBtn key={m} label={m.charAt(0).toUpperCase() + m.slice(0, 3)} active={metric === m} onClick={() => setMetric(m)} color={T.green} />
              ))}
            </div>
          }>Trend</Heading>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.green} stopOpacity={.25} />
                  <stop offset="100%" stopColor={T.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="date" stroke={T.textDim} fontSize={10} />
              <YAxis stroke={T.textDim} fontSize={10} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} />
              <Area type="monotone" dataKey={metric} stroke={T.green} fill="url(#aGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Pillar Performance */}
        <Card>
          <Heading icon="🎯">Engagement by Pillar</Heading>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pillarPerf.sort((a, b) => b.engagement - a.engagement).map((p, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: T.text }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: p.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{p.engagement}%</span>
                </div>
                <div style={{ height: 6, background: T.bg2, borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${(p.engagement / 6) * 100}%`, background: p.color, borderRadius: 3, transition: "width .5s" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Best Posting Hours Heatmap */}
        <Card>
          <Heading icon="🕐">Best Posting Hours</Heading>
          <div style={{ display: "grid", gridTemplateColumns: "40px repeat(8,1fr)", gap: 3, fontSize: 10 }}>
            <div />
            {hours.map(h => <div key={h} style={{ textAlign: "center", color: T.textDim, padding: 4, fontFamily: "'IBM Plex Mono', monospace" }}>{h}:00</div>)}
            {days.map(day => (
              <>
                <div key={day} style={{ color: T.textSoft, display: "flex", alignItems: "center", fontFamily: "'IBM Plex Mono', monospace" }}>{day}</div>
                {hours.map(hour => {
                  const cell = heatmapData.find(c => c.day === day && c.hour === hour);
                  const intensity = cell ? cell.value / 10 : 0;
                  return (
                    <div key={`${day}-${hour}`} style={{
                      aspectRatio: "1", borderRadius: 3,
                      background: intensity > .7 ? T.green : intensity > .4 ? T.greenMid : intensity > .2 ? T.greenDim : T.bg2,
                      border: `1px solid ${T.border}`,
                    }} title={`${day} ${hour}:00 — ${(intensity * 10).toFixed(1)} avg engagement`} />
                  );
                })}
              </>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, justifyContent: "center", fontSize: 9, color: T.textDim }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: T.bg2, display: "inline-block" }} /> Low</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: T.greenDim, display: "inline-block" }} /> Medium</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: T.green, display: "inline-block" }} /> Hot</span>
          </div>
        </Card>

        {/* Likes vs Replies ratio */}
        <Card>
          <Heading icon="📊">Daily Likes vs Replies</Heading>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="date" stroke={T.textDim} fontSize={10} />
              <YAxis stroke={T.textDim} fontSize={10} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="likes" fill={T.green} radius={[3, 3, 0, 0]} />
              <Bar dataKey="replies" fill={T.blue} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 10, color: T.textSoft }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot color={T.green} /> Likes</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot color={T.blue} /> Replies</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TWITTER PANEL (PARENT)
// ═══════════════════════════════════════════════════════════════

function TwitterPanel() {
  const [account, setAccount] = useState("@django_crypto");
  const [subTab, setSubTab] = useState("research");
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [research, setResearch] = useState(INITIAL_RESEARCH);

  const accPosts = posts.filter(p => p.account === account);
  const accResearch = research.filter(r => r.account === account);

  return (
    <div>
      {/* Account Selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", marginRight: 4 }}>ACCOUNT:</span>
        {ACCOUNTS.map(a => (
          <AccountPill key={a.handle} account={a.handle} active={account === a.handle} onClick={() => setAccount(a.handle)} />
        ))}
        <Btn small outline color={T.textDim} style={{ borderStyle: "dashed", marginLeft: 4 }}>+ Add Account</Btn>
      </div>

      {/* Sub Navigation */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        <TabBtn label="🔍 Daily Research" active={subTab === "research"} onClick={() => setSubTab("research")} color={T.cyan} count={accResearch.length} />
        <TabBtn label="✍️ Weekly Content" active={subTab === "content"} onClick={() => setSubTab("content")} color={T.green} count={accPosts.length} />
        <TabBtn label="📊 Analytics" active={subTab === "analytics"} onClick={() => setSubTab("analytics")} color={T.purple} />
      </div>

      {/* Sub Panel Content */}
      {subTab === "research" && <DailyResearch account={account} research={research} setResearch={setResearch} />}
      {subTab === "content" && <WeeklyContent account={account} posts={posts} setPosts={setPosts} />}
      {subTab === "analytics" && <WeeklyAnalytics account={account} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLACEHOLDER PANELS
// ═══════════════════════════════════════════════════════════════

function HealthPlaceholder() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>♥</div>
      <div style={{ fontSize: 18, color: T.text, fontWeight: 600, fontFamily: "'Satoshi', sans-serif", marginBottom: 8 }}>Health Panel</div>
      <div style={{ fontSize: 13, color: T.textSoft, textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>
        Training plans, diet tracking, grocery lists & weekly progress monitoring. Coming soon fam.
      </div>
      <Badge color={T.amber} style={{ marginTop: 16 }}>COMING SOON</Badge>
    </div>
  );
}

function BotsPlaceholder() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⬡</div>
      <div style={{ fontSize: 18, color: T.text, fontWeight: 600, fontFamily: "'Satoshi', sans-serif", marginBottom: 8 }}>Bots Panel</div>
      <div style={{ fontSize: 13, color: T.textSoft, textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>
        Polymarket trading bot dashboard, P&L tracking, open positions & bot monitoring. Coming soon fam.
      </div>
      <Badge color={T.amber} style={{ marginTop: 16 }}>COMING SOON</Badge>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [nav, setNav] = useState("twitter");
  const [time, setTime] = useState(new Date());
  const [isDark, setIsDark] = useState(true);

  // Update global T when theme changes
  T = isDark ? DARK : LIGHT;

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Satoshi', 'Segoe UI', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Satoshi:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        ::selection { background: ${T.green}30; color: ${T.green}; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.borderHi}; }
        textarea::placeholder { color: ${T.textDim}; }
        select option { background: ${T.surface}; color: ${T.text}; }
        * { transition: background-color .25s, border-color .25s, color .15s; }
      `}</style>

      {/* ─── TOP BAR ─── */}
      <div style={{
        background: `${T.surface}ee`, borderBottom: `1px solid ${T.border}`,
        padding: "0 28px", height: 56, display: "flex", justifyContent: "space-between",
        alignItems: "center", position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 7,
            background: `linear-gradient(135deg,${T.green},#00aa55)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: T.bg,
            fontFamily: "'Satoshi', sans-serif",
          }}>D</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, fontFamily: "'Satoshi', sans-serif", letterSpacing: "-.02em" }}>
              DJANGO<span style={{ color: T.green }}>CMD</span>
            </div>
            <div style={{ fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: ".1em" }}>COMMAND CENTER</div>
          </div>
        </div>

        {/* Main Nav */}
        <div style={{ display: "flex", gap: 2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => !n.disabled && setNav(n.id)} style={{
              background: nav === n.id ? T.surfaceAlt : "transparent",
              border: "none", borderBottom: nav === n.id ? `2px solid ${T.green}` : "2px solid transparent",
              padding: "16px 20px", color: n.disabled ? T.textDim : (nav === n.id ? T.text : T.textSoft),
              fontSize: 13, fontWeight: 600, cursor: n.disabled ? "default" : "pointer",
              fontFamily: "'Satoshi', sans-serif", display: "flex", alignItems: "center", gap: 8,
              transition: "all .15s", opacity: n.disabled ? .4 : 1,
            }}>
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              {n.label}
              {n.disabled && <span style={{ fontSize: 8, color: T.amber, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: ".06em" }}>SOON</span>}
            </button>
          ))}
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Dot color={T.green} pulse />
            <span style={{ fontSize: 10, color: T.textSoft, fontFamily: "'IBM Plex Mono', monospace" }}>systems nominal</span>
          </div>
          {/* Theme Toggle */}
          <button onClick={() => setIsDark(d => !d)} style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 20,
            padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            transition: "all .2s", fontSize: 14,
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.green}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span style={{ transition: "all .3s", transform: isDark ? "rotate(0deg)" : "rotate(180deg)", display: "inline-block" }}>
              {isDark ? "☀" : "☾"}
            </span>
            <span style={{ fontSize: 10, color: T.textSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
              {isDark ? "day" : "nite"}
            </span>
          </button>
          <div style={{
            fontSize: 12, color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500,
            background: T.card, padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.border}`,
            letterSpacing: ".04em",
          }}>
            {time.toLocaleTimeString("en-GB", { hour12: false })}
          </div>
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ padding: "24px 28px", maxWidth: 1360, margin: "0 auto" }}>
        {nav === "twitter" && <TwitterPanel />}
        {nav === "health" && <HealthPlaceholder />}
        {nav === "bots" && <BotsPlaceholder />}
      </div>

      {/* ─── FOOTER ─── */}
      <div style={{
        borderTop: `1px solid ${T.border}`, padding: "12px 28px",
        display: "flex", justifyContent: "space-between", marginTop: 40,
      }}>
        <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>
          DjangoCMD v1.0 · built with claude · see you on the timeline, xoxo
        </span>
        <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>
          gm fam · {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}
