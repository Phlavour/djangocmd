import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import HealthPanel from './health';


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

// ═══════════════════════════════════════════════════════════════
// GOOGLE SHEETS CONFIG
// ═══════════════════════════════════════════════════════════════

const SHEET_ID = "15QxYvRiyV7FBgMvs9qlFTDH5erWTPYyZaoA6b-oZjGM";
const TABS = ["DRAFT", "POST", "DATABASE", "USED", "BAD"];

// Tab name → GID mapping (you may need to update these)
// To find GIDs: open each tab in browser, look at URL &gid=XXXXX
const TAB_GIDS = {
  DRAFT: 0,
  POST: null,
  DATABASE: null,
  USED: null,
  BAD: null,
};

function getSheetCSVUrl(tabName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
}

function parseCSV(text, tabName) {
  if (!text || !text.trim()) return { headers: [], rows: [] };

  // Proper CSV parser: handles newlines inside quoted fields
  const records = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { current.push(field.trim()); field = ""; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        current.push(field.trim());
        if (current.some(f => f.length > 0)) records.push(current);
        current = []; field = "";
      } else { field += ch; }
    }
  }
  current.push(field.trim());
  if (current.some(f => f.length > 0)) records.push(current);

  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0];
  const rows = records.slice(1).map(rec => {
    const row = {};
    headers.forEach((h, i) => { row[h] = rec[i] || ""; });
    return row;
  }).filter(row => {
    const post = (row["Post"] || row["Post text"] || "").trim();
    const cat = (row["Category"] || "").trim();
    return post.length > 2 || cat.length > 1;
  });

  return { headers, rows };
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const PILLAR_COLORS_FN = () => ({
  Growth: T.green, Market: T.blue, Lifestyle: T.purple,
  Busting: T.amber, Shitpost: T.red, growth: T.green,
  market: T.blue, lifestyle: T.purple, busting: T.amber,
  shitposting: T.red,
});

const CATEGORIES = ["growth", "market", "lifestyle", "busting", "shitposting"];

const STRUCTURES = [
  "Problem → Insight → Action",
  "Framework (3 steps)",
  "Contrarian take + reasoning",
  "Personal story + lesson",
  "Myth busting + truth",
  "Before/After transformation",
  "Tactical how-to",
  "Market observation + prediction",
  "Trend analysis + context",
  "Data + interpretation",
  "Mindset shift",
  "Discipline story",
  "Health/productivity tip",
  "One-liner / Hot take",
  "Meme / Relatable",
  "Thread opener",
];

const TABS_CONFIG_FN = () => ({
  DRAFT: { color: T.blue, icon: "✎", label: "Draft" },
  POST: { color: T.green, icon: "◉", label: "Post" },
  USED: { color: T.textDim, icon: "✓", label: "Used" },
  DATABASE: { color: T.purple, icon: "◈", label: "Database" },
  BAD: { color: T.red, icon: "✕", label: "Bad" },
});

const STATUS_ORDER = ["DRAFT", "POST", "USED", "DATABASE", "BAD"];

const ACCOUNTS = [
  { handle: "@django_crypto", name: "Django", avatar: "/pfp-django.jpg", gradient: ["#00e87b", "#00aa55"] },
  { handle: "@henryk0x", name: "Henryk", avatar: "/pfp-henryk.png", gradient: ["#3d8bfd", "#6644ff"] },
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
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = `${color}20`; } }}
    onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = outline ? T.border : `${color}40`; e.currentTarget.style.background = outline ? "transparent" : `${color}14`; } }}
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
    {sub && <div style={{ fontSize: 10, color: typeof sub === "string" && sub.startsWith("+") ? T.green : typeof sub === "string" && sub.startsWith("-") ? T.red : T.textSoft, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>{sub}</div>}
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

const LoadingDots = () => {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const i = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 400);
    return () => clearInterval(i);
  }, []);
  return <span style={{ color: T.green, fontFamily: "'IBM Plex Mono', monospace" }}>loading{dots}</span>;
};

// ═══════════════════════════════════════════════════════════════
// MAIN NAV
// ═══════════════════════════════════════════════════════════════

const NAV = [
  { id: "twitter", icon: "𝕏", label: "Twitter" },
  { id: "health", icon: "♥", label: "Health", disabled: false },
  { id: "bots", icon: "⬡", label: "Bots", disabled: false },
];

// ═══════════════════════════════════════════════════════════════
// DATA FETCHING HOOK
// ═══════════════════════════════════════════════════════════════

function useSheetData() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = {};
      for (const tab of TABS) {
        const url = getSheetCSVUrl(tab);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${tab}: ${res.status}`);
        const text = await res.text();
        const parsed = parseCSV(text, tab);
        results[tab] = parsed;
      }
      setData(results);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll, lastFetch };
}

// ═══════════════════════════════════════════════════════════════
// DAILY RESEARCH (unchanged - manual input)
// ═══════════════════════════════════════════════════════════════

function DailyResearch({ account }) {
  const [input, setInput] = useState("");
  const [research, setResearch] = useState([]);

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

  const items = research.filter(r => r.account === account);

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <Heading icon="⌨">Add Research</Heading>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder="Paste Grok output here... (one item per line)"
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
        </div>
      </Card>

      <Heading icon="🔍" right={<Badge color={T.textSoft}>Items: {items.length}</Badge>}>
        Research Feed
      </Heading>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: T.textDim, fontSize: 13 }}>
            No research items yet. Paste Grok output above.
          </div>
        )}
        {items.map(item => (
          <div key={item.id} style={{
            background: T.surface, border: `1px solid ${item.saved ? T.greenMid : T.border}`,
            borderRadius: 10, padding: "12px 16px", display: "flex", gap: 14, alignItems: "center",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5, marginBottom: 6 }}>{item.headline}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Badge color={T.textDim}>{item.date}</Badge>
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

// ═══════════════════════════════════════════════════════════════
// WEEKLY CONTENT — local state management + Google Sheets import
// ═══════════════════════════════════════════════════════════════

function WeeklyContent({ sheetData, loading, onRefresh, apiKey }) {
  const [activeTab, setActiveTab] = useState("DRAFT");
  const [sortBy, setSortBy] = useState("default");
  const [newPostText, setNewPostText] = useState("");
  const [newPostCat, setNewPostCat] = useState("growth");
  const [newPostStructure, setNewPostStructure] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [aiLoading, setAiLoading] = useState(null);
  const [aiResults, setAiResults] = useState({});
  const [allPosts, setAllPosts] = useState(null);
  const TC = TABS_CONFIG_FN();
  const PC = PILLAR_COLORS_FN();

  // Initialize from Sheets
  useEffect(() => {
    if (!loading && sheetData && allPosts === null) {
      const posts = [];
      let id = 1;
      for (const tab of STATUS_ORDER) {
        for (const row of (sheetData[tab]?.rows || [])) {
          posts.push({
            id: id++, tab,
            category: row["Category"] || "", structure: row["Structure"] || "",
            post: row["Post"] || row["Post text"] || "",
            notes: row["Notes"] || row["Why Bad"] || "", score: row["Score"] || "",
            howToFix: row["How to Fix"] || "", day: "",
            postLink: row["Post Link"] || row["Post link"] || "",
            impressions: row["Impressions"] || "", likes: row["Likes"] || "",
            engagements: row["Engagements"] || "", bookmarks: row["Bookmarks"] || "",
            replies: row["Replies"] || "", reposts: row["Reposts"] || "",
            profileVisits: row["Profile visits"] || "", newFollows: row["New follows"] || "",
            urlClicks: row["URL Clicks"] || "",
          });
        }
      }
      setAllPosts(posts);
    }
  }, [loading, sheetData, allPosts]);

  const reloadFromSheets = () => { setAllPosts(null); onRefresh(); };

  // Filtered + sorted posts
  const tabPosts = allPosts ? allPosts.filter(p => p.tab === activeTab) : [];
  let sorted = [...tabPosts];
  if (sortBy === "category") sorted.sort((a, b) => a.category.localeCompare(b.category));
  else if (sortBy === "score-desc") sorted.sort((a, b) => parseFloat(b.score || 0) - parseFloat(a.score || 0));
  else if (sortBy === "score-asc") sorted.sort((a, b) => parseFloat(a.score || 0) - parseFloat(b.score || 0));
  else if (sortBy === "impressions") sorted.sort((a, b) => parseInt(b.impressions || 0) - parseInt(a.impressions || 0));
  else if (sortBy === "day") {
    const D = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    sorted.sort((a, b) => (D.indexOf(a.day) < 0 ? 99 : D.indexOf(a.day)) - (D.indexOf(b.day) < 0 ? 99 : D.indexOf(b.day)));
  }

  const counts = {};
  STATUS_ORDER.forEach(t => { counts[t] = allPosts ? allPosts.filter(p => p.tab === t).length : 0; });

  const isUsed = activeTab === "USED", isBad = activeTab === "BAD",
    isPost = activeTab === "POST", isDraft = activeTab === "DRAFT", isDb = activeTab === "DATABASE";

  // Actions
  const movePost = (id, to) => setAllPosts(p => p.map(x => x.id === id ? { ...x, tab: to } : x));
  const delPost = (id) => setAllPosts(p => p.filter(x => x.id !== id));
  const setDay = (id, day) => setAllPosts(p => p.map(x => x.id === id ? { ...x, day } : x));
  const moveToBad = (id) => {
    const reason = prompt("Why is this post bad? (will be saved as feedback)");
    if (reason === null) return; // cancelled
    setAllPosts(p => p.map(x => x.id === id ? { ...x, tab: "BAD", notes: reason || "", howToFix: "" } : x));
  };

  const addPost = () => {
    if (!newPostText.trim()) return;
    const newId = allPosts ? Math.max(0, ...allPosts.map(p => p.id)) + 1 : 1;
    setAllPosts(p => [...(p || []), {
      id: newId, tab: "DRAFT", category: newPostCat, structure: newPostStructure,
      post: newPostText.trim(), notes: "", score: "", howToFix: "", day: "",
      postLink: "", impressions: "", likes: "", engagements: "", bookmarks: "",
      replies: "", reposts: "", profileVisits: "", newFollows: "", urlClicks: "",
    }]);
    setNewPostText(""); setNewPostCat("growth"); setNewPostStructure(""); setShowAdd(false);
  };

  // AI
  const askClaude = async (text, pid) => {
    if (!apiKey) { alert("Add Claude API key in Settings (⚙)"); return; }
    setAiLoading(pid);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 300,
          messages: [{ role: "user", content: `You are a crypto Twitter strategist. Rate this post for viral potential.\n\nPost: "${text}"\n\nRespond ONLY in JSON: {"score": 7.5, "notes": "Brief explanation + suggestion"}\nScore 1-10. Be honest and critical.` }],
        }),
      });
      const data = await res.json();
      const t = data.content?.[0]?.text || "";
      try { setAiResults(prev => ({ ...prev, [pid]: JSON.parse(t.replace(/```json|```/g, "").trim()) })); }
      catch { setAiResults(prev => ({ ...prev, [pid]: { score: "?", notes: t } })); }
    } catch (err) { setAiResults(prev => ({ ...prev, [pid]: { score: "!", notes: err.message } })); }
    finally { setAiLoading(null); }
  };

  const sortOpts = isUsed
    ? [{ v: "default", l: "Default" }, { v: "impressions", l: "Impressions ↓" }]
    : isPost
    ? [{ v: "default", l: "Default" }, { v: "day", l: "Day of Week" }, { v: "category", l: "Category" }, { v: "score-desc", l: "Score ↓" }]
    : [{ v: "default", l: "Default" }, { v: "category", l: "Category" }, { v: "score-desc", l: "Score ↓" }, { v: "score-asc", l: "Score ↑" }];

  const sel = { background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", cursor: "pointer" };

  if (!allPosts) return <div style={{ textAlign: "center", padding: 60 }}><LoadingDots /></div>;

  return (
    <div>
      {/* Top */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>{allPosts.length} posts · local mode</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
            {sortOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <Btn small color={T.cyan} onClick={reloadFromSheets} disabled={loading}>↻ Reload Sheets</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUS_ORDER.map(tab => (
          <TabBtn key={tab} label={`${TC[tab].icon} ${TC[tab].label}`}
            active={activeTab === tab} onClick={() => { setActiveTab(tab); setSortBy("default"); }}
            color={TC[tab].color} count={counts[tab]} />
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
        {STATUS_ORDER.map(tab => (
          <div key={tab} style={{
            background: activeTab === tab ? `${TC[tab].color}10` : T.surface,
            border: `1px solid ${activeTab === tab ? `${TC[tab].color}30` : T.border}`,
            borderRadius: 8, padding: "10px 12px", textAlign: "center", cursor: "pointer",
          }} onClick={() => setActiveTab(tab)}>
            <div style={{ fontSize: 20, fontWeight: 700, color: TC[tab].color, fontFamily: "'Satoshi', sans-serif" }}>{counts[tab]}</div>
            <div style={{ fontSize: 9, color: T.textSoft, textTransform: "uppercase" }}>{tab}</div>
          </div>
        ))}
      </div>

      {/* Add Post */}
      {isDraft && (
        <div style={{ marginBottom: 16 }}>
          {showAdd ? (
            <Card>
              <Heading icon="✎">New Draft</Heading>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, marginBottom: 4, textTransform: "uppercase" }}>Category</div>
                  <select value={newPostCat} onChange={e => setNewPostCat(e.target.value)} style={sel}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, marginBottom: 4, textTransform: "uppercase" }}>Structure</div>
                  <select value={newPostStructure} onChange={e => setNewPostStructure(e.target.value)} style={{ ...sel, width: "100%" }}>
                    <option value="">-- select --</option>
                    {STRUCTURES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <textarea value={newPostText} onChange={e => setNewPostText(e.target.value)} placeholder="write your post fam..."
                style={{ width: "100%", minHeight: 80, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, color: T.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical", lineHeight: 1.5, outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = T.green} onBlur={e => e.target.style.borderColor = T.border} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn color={T.green} onClick={addPost}>Add to Draft</Btn>
                <Btn outline onClick={() => { setShowAdd(false); setNewPostText(""); }}>Cancel</Btn>
              </div>
            </Card>
          ) : (
            <div style={{ textAlign: "center" }}><Btn color={T.green} onClick={() => setShowAdd(true)}>+ New Post</Btn></div>
          )}
        </div>
      )}

      {/* Posts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.length === 0 && <div style={{ textAlign: "center", padding: 40, color: T.textDim, fontSize: 13 }}>No posts in {TC[activeTab]?.label}</div>}
        {sorted.map(p => {
          const ai = aiResults[p.id];
          return (
            <div key={p.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, transition: "all .12s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = (TC[activeTab]?.color || T.green) + "40"}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>

              {/* Header: post text left, badges right */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {p.post || <span style={{ color: T.textDim, fontStyle: "italic" }}>Empty</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                  {p.category && <Badge color={PC[p.category] || PC[p.category.charAt(0).toUpperCase() + p.category.slice(1)] || T.textSoft}>{p.category}</Badge>}
                  {p.structure && <Badge color={T.textDim}>{p.structure}</Badge>}
                  {p.score && <Badge color={parseFloat(p.score) >= 8.5 ? T.green : parseFloat(p.score) >= 7 ? T.amber : T.textSoft}>⭐ {p.score}</Badge>}
                  {p.day && <Badge color={T.cyan}>📅 {p.day}</Badge>}
                </div>
              </div>

              {/* USED analytics */}
              {isUsed && p.impressions && (
                <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                  {[
                    { l: "Imp", v: p.impressions, c: T.green }, { l: "Likes", v: p.likes, c: T.red },
                    { l: "Eng", v: p.engagements, c: T.blue }, { l: "Bkm", v: p.bookmarks, c: T.amber },
                    { l: "Replies", v: p.replies, c: T.cyan }, { l: "RT", v: p.reposts, c: T.purple },
                  ].filter(m => m.v && m.v !== "0").map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 9, color: T.textDim }}>{m.l}:</span>
                      <span style={{ fontSize: 12, color: m.c, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{parseInt(m.v).toLocaleString()}</span>
                    </div>
                  ))}
                  {p.postLink && <a href={p.postLink} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.cyan }}>🔗 View</a>}
                </div>
              )}

              {/* Notes */}
              {p.notes && !isUsed && <div style={{ marginTop: 6, fontSize: 11, color: T.textSoft }}>💡 {p.notes}</div>}
              {isBad && p.howToFix && <div style={{ marginTop: 6, fontSize: 11, color: T.amber, background: T.amberDim, padding: "6px 10px", borderRadius: 6 }}>🔧 {p.howToFix}</div>}

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                {isDraft && <>
                  <Btn small color={T.green} onClick={() => movePost(p.id, "POST")}>◉ → Post</Btn>
                  <Btn small color={T.purple} outline onClick={() => movePost(p.id, "DATABASE")}>◈ → DB</Btn>
                  <Btn small color={T.red} outline onClick={() => moveToBad(p.id)}>✕ → Bad</Btn>
                </>}
                {isPost && <>
                  <select value={p.day} onChange={e => setDay(p.id, e.target.value)} style={{ ...sel, fontSize: 11, padding: "4px 8px" }}>
                    <option value="">📅 Day</option>
                    {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <Btn small color={T.green} onClick={() => movePost(p.id, "USED")}>✓ → Used</Btn>
                  <Btn small color={T.blue} outline onClick={() => movePost(p.id, "DRAFT")}>✎ → Draft</Btn>
                  <Btn small color={T.red} outline onClick={() => moveToBad(p.id)}>✕ → Bad</Btn>
                </>}
                {isDb && <>
                  <Btn small color={T.blue} onClick={() => movePost(p.id, "DRAFT")}>✎ → Draft</Btn>
                  <Btn small color={T.green} outline onClick={() => movePost(p.id, "POST")}>◉ → Post</Btn>
                </>}
                {isBad && <>
                  <Btn small color={T.blue} onClick={() => movePost(p.id, "DRAFT")}>✎ → Draft</Btn>
                  <Btn small color={T.red} outline onClick={() => delPost(p.id)}>🗑 Delete</Btn>
                </>}
                {isUsed && <>
                  <Btn small color={T.blue} outline onClick={() => movePost(p.id, "DRAFT")}>✎ → Draft</Btn>
                </>}

                {!isUsed && <>
                  <Btn small color={T.purple} disabled={aiLoading === p.id || !p.post} onClick={() => askClaude(p.post, p.id)}>
                    {aiLoading === p.id ? "⏳..." : "🤖 Claude"}
                  </Btn>
                  {ai && <Badge color={parseFloat(ai.score) >= 8.5 ? T.green : parseFloat(ai.score) >= 7 ? T.amber : parseFloat(ai.score) >= 5 ? T.blue : T.red}>AI: {ai.score}</Badge>}
                </>}
              </div>

              {/* AI result */}
              {ai?.notes && (
                <div style={{ marginTop: 8, fontSize: 12, color: T.text, background: T.purpleDim, border: `1px solid ${T.purple}30`, padding: "10px 14px", borderRadius: 8, lineHeight: 1.6 }}>
                  <span style={{ fontSize: 10, color: T.purple, fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 4 }}>🤖 Claude</span>
                  {ai.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20, padding: 14, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, color: T.textSoft, lineHeight: 1.6 }}>
        💡 Loaded from <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}`} target="_blank" rel="noreferrer" style={{ color: T.cyan }}>Sheets</a>.
        All moves are local. "↻ Reload" re-imports from Sheets.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY ANALYTICS — reads USED tab + CSV upload
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ANALYTICS DASHBOARD — unified, long-term tracking
// ═══════════════════════════════════════════════════════════════

const WEEK_STORAGE_KEY = "djangocmd_weekly_history";

function getWeekLabel(dateStr) {
  // "Thu, Feb 12, 2026" -> "2026-W07"
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    const oneJan = new Date(d.getFullYear(), 0, 1);
    const wk = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(wk).padStart(2, "0")}`;
  } catch { return null; }
}

function loadWeeklyHistory() {
  try { return JSON.parse(sessionStorage.getItem(WEEK_STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveWeeklyHistory(h) {
  try { sessionStorage.setItem(WEEK_STORAGE_KEY, JSON.stringify(h)); } catch {}
}

function WeeklyAnalytics({ sheetData, loading, apiKey }) {
  const [history, setHistory] = useState(() => loadWeeklyHistory());
  const [weeklyReportText, setWeeklyReportText] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  // Save history whenever it changes
  useEffect(() => { saveWeeklyHistory(history); }, [history]);

  // CSV Upload handlers
  const handleContentCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result, "CONTENT").rows;
      // Filter: originals only, with impressions
      const originals = rows.filter(r => {
        const text = r["Post text"] || r["Post"] || "";
        return !text.startsWith("@") && (parseInt(r["Impressions"] || 0) || 0) > 0;
      });
      // Detect week from first row date
      const firstDate = rows[0]?.["Date"] || "";
      const week = getWeekLabel(firstDate) || `upload-${Date.now()}`;
      setHistory(prev => {
        const next = { ...prev };
        if (!next[week]) next[week] = {};
        next[week].originals = originals;
        next[week].uploadDate = new Date().toISOString();
        return next;
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleOverviewCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result, "OVERVIEW").rows;
      const firstDate = rows[0]?.["Date"] || "";
      const week = getWeekLabel(firstDate) || `upload-${Date.now()}`;
      setHistory(prev => {
        const next = { ...prev };
        if (!next[week]) next[week] = {};
        next[week].daily = rows;
        return next;
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Get all weeks sorted
  const weeks = Object.keys(history).sort();
  const latestWeek = weeks[weeks.length - 1];
  const prevWeek = weeks.length > 1 ? weeks[weeks.length - 2] : null;

  // Process latest week data
  const processWeek = (wk) => {
    if (!wk || !history[wk]) return null;
    const h = history[wk];
    const originals = (h.originals || []).map(r => {
      const imp = parseInt(r["Impressions"] || 0) || 0;
      return {
        text: r["Post text"] || r["Post"] || "",
        imp, likes: parseInt(r["Likes"] || 0) || 0,
        eng: parseInt(r["Engagements"] || 0) || 0,
        bookmarks: parseInt(r["Bookmarks"] || 0) || 0,
        replies: parseInt(r["Replies"] || 0) || 0,
        reposts: parseInt(r["Reposts"] || 0) || 0,
        follows: parseInt(r["New follows"] || 0) || 0,
        link: r["Post Link"] || r["Post link"] || "",
        date: r["Date"] || "",
        engRate: imp > 0 ? (parseInt(r["Engagements"] || 0) || 0) / imp * 100 : 0,
      };
    });
    const daily = (h.daily || []).map(r => ({
      date: (r["Date"] || "").replace(/,\s*\d{4}$/, "").replace(/^\w+,\s*/, ""),
      imp: parseInt(r["Impressions"] || 0) || 0,
      likes: parseInt(r["Likes"] || 0) || 0,
      eng: parseInt(r["Engagements"] || 0) || 0,
      follows: parseInt(r["New follows"] || 0) || 0,
      unfollows: parseInt(r["Unfollows"] || 0) || 0,
    })).reverse();

    const totalImp = originals.reduce((s, p) => s + p.imp, 0);
    const totalLikes = originals.reduce((s, p) => s + p.likes, 0);
    const totalEng = originals.reduce((s, p) => s + p.eng, 0);
    const avgEngRate = originals.length > 0 ? originals.reduce((s, p) => s + p.engRate, 0) / originals.length : 0;
    const dailyImp = daily.reduce((s, d) => s + d.imp, 0);
    const netFollows = daily.reduce((s, d) => s + d.follows - d.unfollows, 0);
    const totalFollows = daily.reduce((s, d) => s + d.follows, 0);
    const totalUnfollows = daily.reduce((s, d) => s + d.unfollows, 0);

    return { originals, daily, totalImp, totalLikes, totalEng, avgEngRate, dailyImp, netFollows, totalFollows, totalUnfollows };
  };

  const current = processWeek(latestWeek);
  const prev = processWeek(prevWeek);

  // Match posts to categories from Database
  const dbPosts = [...(sheetData["DATABASE"]?.rows || []), ...(sheetData["DRAFT"]?.rows || []), ...(sheetData["POST"]?.rows || [])];
  const matchPost = (text) => {
    const clean = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().slice(0, 50);
    const target = clean(text);
    for (const db of dbPosts) {
      const dbText = clean(db["Post"] || "");
      if (dbText && target && (dbText.includes(target) || target.includes(dbText)))
        return { score: parseFloat(db["Score"] || 0) || 0, category: (db["Category"] || "").toLowerCase(), structure: db["Structure"] || "" };
    }
    return null;
  };

  // Enrich originals
  const enriched = current ? current.originals.map(p => {
    const m = matchPost(p.text);
    return { ...p, aiScore: m?.score || 0, category: m?.category || "", structure: m?.structure || "" };
  }) : [];

  // Pillar data
  const pillarMap = {};
  for (const p of enriched) {
    const cat = p.category || "uncategorized";
    if (!pillarMap[cat]) pillarMap[cat] = { posts: 0, imp: 0, likes: 0, eng: 0, engRateSum: 0 };
    pillarMap[cat].posts++; pillarMap[cat].imp += p.imp; pillarMap[cat].likes += p.likes;
    pillarMap[cat].eng += p.eng; pillarMap[cat].engRateSum += p.engRate;
  }
  const pillarData = Object.entries(pillarMap).map(([cat, d]) => ({
    name: cat, posts: d.posts, imp: d.imp, likes: d.likes,
    avgEngRate: d.posts > 0 ? d.engRateSum / d.posts : 0,
    avgImp: d.posts > 0 ? Math.round(d.imp / d.posts) : 0,
  })).filter(d => d.name !== "uncategorized").sort((a, b) => b.avgImp - a.avgImp);

  // Structure data
  const structMap = {};
  for (const p of enriched) {
    const st = p.structure || "unknown";
    if (st === "unknown") continue;
    if (!structMap[st]) structMap[st] = { posts: 0, imp: 0, engRateSum: 0 };
    structMap[st].posts++; structMap[st].imp += p.imp; structMap[st].engRateSum += p.engRate;
  }
  const structData = Object.entries(structMap).map(([st, d]) => ({
    name: st, posts: d.posts, avgImp: d.posts > 0 ? Math.round(d.imp / d.posts) : 0,
    avgEngRate: d.posts > 0 ? d.engRateSum / d.posts : 0,
  })).sort((a, b) => b.avgImp - a.avgImp);

  // Score vs reality
  const scored = enriched.filter(p => p.aiScore > 0);

  // WoW (week over week) changes
  const wow = current && prev ? {
    impChange: prev.dailyImp > 0 ? ((current.dailyImp - prev.dailyImp) / prev.dailyImp * 100) : null,
    engChange: prev.avgEngRate > 0 ? ((current.avgEngRate - prev.avgEngRate) / prev.avgEngRate * 100) : null,
    followChange: current.netFollows - prev.netFollows,
    postChange: current.originals.length - prev.originals.length,
  } : null;

  // Weekly trend (all weeks)
  const weeklyTrend = weeks.map(w => {
    const d = processWeek(w);
    return d ? { week: w.replace(/^\d{4}-/, ""), imp: d.dailyImp || d.totalImp, eng: d.avgEngRate, net: d.netFollows, posts: d.originals.length } : null;
  }).filter(Boolean);

  // Pillar trend across weeks
  const pillarTrend = weeks.map(w => {
    const h = history[w];
    if (!h?.originals) return null;
    const ors = h.originals.map(r => {
      const text = r["Post text"] || r["Post"] || "";
      const m = matchPost(text);
      const imp = parseInt(r["Impressions"] || 0) || 0;
      return { category: m?.category || "", imp };
    });
    const entry = { week: w.replace(/^\d{4}-/, "") };
    for (const cat of CATEGORIES) {
      const catPosts = ors.filter(p => p.category === cat);
      entry[cat] = catPosts.length > 0 ? Math.round(catPosts.reduce((s, p) => s + p.imp, 0) / catPosts.length) : 0;
    }
    return entry;
  }).filter(Boolean);

  const PC = PILLAR_COLORS_FN();
  const fmt = (n) => typeof n === "number" ? n.toLocaleString() : n;
  const pct = (n) => n > 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`;

  // Weekly Report Generator
  const generateReport = async () => {
    if (!apiKey) { alert("Add Claude API key in Settings"); return; }
    if (!current) return;
    setReportLoading(true);
    const topPosts = [...enriched].sort((a, b) => b.imp - a.imp).slice(0, 5).map(p => `"${p.text.slice(0, 100)}" — ${p.imp} imp, ${p.engRate.toFixed(1)}% eng, cat: ${p.category}`).join("\n");
    const pillarSummary = pillarData.map(p => `${p.name}: ${p.posts} posts, avg ${p.avgImp} imp, ${p.avgEngRate.toFixed(1)}% eng`).join("\n");
    const prompt = `You are a crypto Twitter growth strategist analyzing weekly performance for @django_crypto.

THIS WEEK DATA:
- ${current.originals.length} original posts published
- ${fmt(current.dailyImp || current.totalImp)} total impressions
- ${current.avgEngRate.toFixed(1)}% avg engagement rate
- ${current.netFollows >= 0 ? "+" : ""}${current.netFollows} net followers
${wow ? `\nVS LAST WEEK: impressions ${wow.impChange ? pct(wow.impChange) : "n/a"}, engagement ${wow.engChange ? pct(wow.engChange) : "n/a"}` : ""}

TOP POSTS:\n${topPosts}

PILLAR BREAKDOWN:\n${pillarSummary}

Write a concise weekly report (max 250 words) with:
1. What worked this week (specific posts/patterns)
2. What didn't work
3. 3 specific action items for next week
4. Which pillar to double down on and which to adjust

Tone: direct, no fluff, like a coach giving real talk. Use lowercase.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      setWeeklyReportText(data.content?.[0]?.text || "Error generating report");
    } catch (err) { setWeeklyReportText("Error: " + err.message); }
    finally { setReportLoading(false); }
  };

  // Export/Import history
  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "djangocmd-analytics-history.json"; a.click();
  };
  const importHistory = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { const h = JSON.parse(ev.target.result); setHistory(prev => ({ ...prev, ...h })); }
      catch { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 60 }}><LoadingDots /></div>;

  const hasData = current !== null;
  const sel = { background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 8px", color: T.text, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", outline: "none", cursor: "pointer" };

  return (
    <div>
      {/* ═══ UPLOAD BAR ═══ */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ cursor: "pointer" }}>
              <input type="file" accept=".csv" onChange={handleContentCSV} style={{ display: "none" }} />
              <Btn color={T.cyan} style={{ pointerEvents: "none" }}>📄 Upload Content CSV</Btn>
            </label>
            <label style={{ cursor: "pointer" }}>
              <input type="file" accept=".csv" onChange={handleOverviewCSV} style={{ display: "none" }} />
              <Btn color={T.cyan} outline style={{ pointerEvents: "none" }}>📊 Upload Overview CSV</Btn>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {weeks.length > 0 && <Badge color={T.green}>{weeks.length} week{weeks.length > 1 ? "s" : ""} tracked</Badge>}
            <Btn small outline onClick={exportHistory}>↓ Export</Btn>
            <label style={{ cursor: "pointer" }}>
              <input type="file" accept=".json" onChange={importHistory} style={{ display: "none" }} />
              <Btn small outline style={{ pointerEvents: "none" }}>↑ Import</Btn>
            </label>
          </div>
        </div>
        {!hasData && <div style={{ marginTop: 10, fontSize: 12, color: T.textSoft }}>Export CSVs from X → Analytics → Posts / Account Overview. Replies are auto-filtered.</div>}
      </Card>

      {!hasData && (
        <div style={{ textAlign: "center", padding: 60, color: T.textDim, fontSize: 13 }}>Upload your first week's CSV to start tracking.</div>
      )}

      {hasData && <>
        {/* ═══ KEY METRICS ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          <Stat label="Impressions" value={fmt(current.dailyImp || current.totalImp)} color={T.green}
            sub={wow?.impChange != null ? pct(wow.impChange) + " vs last week" : `${latestWeek}`} />
          <Stat label="Avg Engagement" value={current.avgEngRate.toFixed(1)} suffix="%" color={T.blue}
            sub={wow?.engChange != null ? pct(wow.engChange) + " vs last week" : ""} />
          <Stat label="Net Followers" value={current.netFollows >= 0 ? `+${current.netFollows}` : current.netFollows} color={current.netFollows >= 0 ? T.green : T.red}
            sub={`+${current.totalFollows} / -${current.totalUnfollows}`} />
          <Stat label="Originals Posted" value={current.originals.length} color={T.purple}
            sub={wow?.postChange != null ? `${wow.postChange >= 0 ? "+" : ""}${wow.postChange} vs last week` : ""} />
        </div>

        {/* ═══ DAILY CHART ═══ */}
        {current.daily.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Heading icon="📈">Daily Performance</Heading>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={current.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="date" stroke={T.textDim} fontSize={10} />
                <YAxis stroke={T.textDim} fontSize={10} />
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
                  formatter={(v) => [v.toLocaleString()]} />
                <Bar dataKey="imp" fill={T.green} radius={[4, 4, 0, 0]} name="Impressions" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* ═══ PILLAR PERFORMANCE ═══ */}
          <Card>
            <Heading icon="🎯">Content Pillars</Heading>
            {pillarData.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pillarData.map((d, i) => {
                  const color = PC[d.name] || PC[d.name.charAt(0).toUpperCase() + d.name.slice(1)] || T.textSoft;
                  return (
                    <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${color}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color, textTransform: "capitalize" }}>{d.name}</span>
                        <span style={{ fontSize: 10, color: T.textDim }}>{d.posts} posts</span>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div><span style={{ fontSize: 9, color: T.textDim }}>Avg Imp</span><div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'Satoshi'" }}>{fmt(d.avgImp)}</div></div>
                        <div><span style={{ fontSize: 9, color: T.textDim }}>Eng Rate</span><div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'Satoshi'" }}>{d.avgEngRate.toFixed(1)}%</div></div>
                        <div><span style={{ fontSize: 9, color: T.textDim }}>Likes</span><div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'Satoshi'" }}>{d.likes}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: T.textDim, padding: 16, textAlign: "center" }}>
                Assign categories to posts in Database to track pillar performance.
              </div>
            )}
          </Card>

          {/* ═══ STRUCTURE PERFORMANCE ═══ */}
          <Card>
            <Heading icon="🧱">Post Structures</Heading>
            {structData.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {structData.map((d, i) => (
                  <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{d.name}</span>
                      <span style={{ fontSize: 10, color: T.textDim }}>{d.posts} posts</span>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <Badge color={T.green}>{fmt(d.avgImp)} avg imp</Badge>
                      <Badge color={T.blue}>{d.avgEngRate.toFixed(1)}% eng</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: T.textDim, padding: 16, textAlign: "center" }}>
                Assign structures to posts to track which formats perform best.
              </div>
            )}
          </Card>
        </div>

        {/* ═══ SCORE VS REALITY ═══ */}
        {scored.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Heading icon="🤖">AI Score Accuracy</Heading>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scored.sort((a, b) => b.imp - a.imp).slice(0, 10).map(p => ({
                name: p.text.slice(0, 20) + "...",
                "AI Score": p.aiScore,
                "Real": Math.min(10, p.engRate / 3),
                text: p.text,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="name" stroke={T.textDim} fontSize={9} />
                <YAxis stroke={T.textDim} fontSize={10} domain={[0, 10]} />
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }}
                  labelFormatter={(l) => { const i = scored.find(s => s.text.slice(0, 20) + "..." === l); return i ? i.text.slice(0, 100) : l; }} />
                <Bar dataKey="AI Score" fill={T.purple} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Real" fill={T.green} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 6, fontSize: 10, color: T.textSoft }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot color={T.purple} /> AI Predicted</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot color={T.green} /> Real Performance</span>
            </div>
          </Card>
        )}

        {/* ═══ WEEKLY TREND (multi-week) ═══ */}
        {weeklyTrend.length > 1 && (
          <Card style={{ marginBottom: 16 }}>
            <Heading icon="📉">Week-over-Week Trend</Heading>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="week" stroke={T.textDim} fontSize={10} />
                <YAxis stroke={T.textDim} fontSize={10} />
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="imp" stroke={T.green} strokeWidth={2} dot={{ r: 4 }} name="Impressions" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* ═══ PILLAR TREND (multi-week) ═══ */}
        {pillarTrend.length > 1 && (
          <Card style={{ marginBottom: 16 }}>
            <Heading icon="📊">Pillar Trend Over Time</Heading>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={pillarTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="week" stroke={T.textDim} fontSize={10} />
                <YAxis stroke={T.textDim} fontSize={10} />
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} />
                {CATEGORIES.map(cat => (
                  <Line key={cat} type="monotone" dataKey={cat} stroke={PC[cat] || T.textSoft} strokeWidth={2} dot={{ r: 3 }} name={cat} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 6, fontSize: 10 }}>
              {CATEGORIES.map(cat => (
                <span key={cat} style={{ display: "flex", alignItems: "center", gap: 4, color: T.textSoft }}>
                  <Dot color={PC[cat] || T.textSoft} /> {cat}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* ═══ TOP POSTS ═══ */}
        <Card style={{ marginBottom: 16 }}>
          <Heading icon="🏆">Top Posts This Week</Heading>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...enriched].sort((a, b) => b.imp - a.imp).slice(0, 8).map((p, i) => (
              <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: i < 3 ? T.green : T.textDim, fontFamily: "'Satoshi'", minWidth: 28 }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5, marginBottom: 4 }}>{p.text.slice(0, 150)}{p.text.length > 150 ? "..." : ""}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Badge color={T.green}>{fmt(p.imp)} imp</Badge>
                    <Badge color={T.red}>{p.likes} likes</Badge>
                    <Badge color={T.blue}>{p.engRate.toFixed(1)}%</Badge>
                    {p.category && <Badge color={PC[p.category] || T.textSoft}>{p.category}</Badge>}
                    {p.aiScore > 0 && <Badge color={T.purple}>AI: {p.aiScore}</Badge>}
                    {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.cyan }}>🔗</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ═══ WEEKLY REPORT ═══ */}
        <Card>
          <Heading icon="📋" right={
            <Btn small color={T.cyan} onClick={generateReport} disabled={reportLoading}>
              {reportLoading ? "⏳ Generating..." : "🤖 Generate Weekly Report"}
            </Btn>
          }>Weekly Summary</Heading>

          {/* Auto stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", marginBottom: 4 }}>This Week</div>
              <div style={{ fontSize: 12, color: T.text, lineHeight: 1.8 }}>
                📊 {fmt(current.dailyImp || current.totalImp)} imp<br/>
                ❤️ {current.totalLikes} likes<br/>
                📈 {current.avgEngRate.toFixed(1)}% avg eng<br/>
                👥 {current.netFollows >= 0 ? "+" : ""}{current.netFollows} followers
              </div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", marginBottom: 4 }}>Consistency</div>
              <div style={{ fontSize: 12, color: T.text, lineHeight: 1.8 }}>
                ✍️ {current.originals.length} originals posted<br/>
                📅 {current.daily.length} active days<br/>
                🎯 {current.originals.length >= 7 ? <span style={{ color: T.green }}>On target</span> : <span style={{ color: T.amber }}>Below target (7/wk)</span>}
              </div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", marginBottom: 4 }}>Growth Rate</div>
              <div style={{ fontSize: 12, color: T.text, lineHeight: 1.8 }}>
                📈 {current.netFollows >= 0 ? "+" : ""}{current.netFollows}/week<br/>
                🗓️ ~{Math.round(current.netFollows * 52)}/year projected<br/>
                {current.netFollows > 0 ? <span style={{ color: T.green }}>Trending up</span> : <span style={{ color: T.red }}>Needs work</span>}
              </div>
            </div>
          </div>

          {/* AI Report */}
          {weeklyReportText && (
            <div style={{ background: T.purpleDim, border: `1px solid ${T.purple}30`, borderRadius: 10, padding: 16, fontSize: 13, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              <div style={{ fontSize: 10, color: T.purple, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>🤖 Claude's Weekly Analysis</div>
              {weeklyReportText}
            </div>
          )}
        </Card>
      </>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TWITTER PANEL
// ═══════════════════════════════════════════════════════════════

function TwitterPanel({ apiKey }) {
  const [account, setAccount] = useState("@django_crypto");
  const [subTab, setSubTab] = useState("content");
  const { data: sheetData, loading, error, refetch, lastFetch } = useSheetData();

  return (
    <div>
      {/* Account Selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        {ACCOUNTS.map(a => (
          <AccountPill key={a.handle} account={a.handle} active={account === a.handle} onClick={() => setAccount(a.handle)} />
        ))}
      </div>

      {/* Henryk placeholder */}
      {account === "@henryk0x" && (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🚧</div>
          <div style={{ fontSize: 15, color: T.text, fontWeight: 600, marginBottom: 8 }}>@henryk0x</div>
          <div style={{ fontSize: 13, color: T.textSoft, lineHeight: 1.6 }}>Content pipeline coming soon. Connect a Google Sheet to get started.</div>
          <Badge color={T.amber}>PLACEHOLDER</Badge>
        </Card>
      )}

      {account === "@django_crypto" && <>
        {/* Error banner */}
        {error && (
          <div style={{ background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: T.red }}>
            ⚠️ Error loading sheets: {error}
          </div>
        )}

        {/* Sub Navigation */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, alignItems: "center" }}>
          <TabBtn label="🔍 Research" active={subTab === "research"} onClick={() => setSubTab("research")} color={T.cyan} />
          <TabBtn label="✍️ Content" active={subTab === "content"} onClick={() => setSubTab("content")} color={T.green} />
          <TabBtn label="📊 Analytics" active={subTab === "analytics"} onClick={() => setSubTab("analytics")} color={T.purple} />
          {lastFetch && (
            <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", marginLeft: "auto" }}>
              Synced: {lastFetch.toLocaleTimeString("en-GB", { hour12: false })}
            </span>
          )}
        </div>

        {subTab === "research" && <DailyResearch account={account} />}
        {subTab === "content" && <WeeklyContent sheetData={sheetData} loading={loading} onRefresh={refetch} apiKey={apiKey} />}
        {subTab === "analytics" && <WeeklyAnalytics sheetData={sheetData} loading={loading} apiKey={apiKey} />}
      </>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLACEHOLDER PANELS
// ═══════════════════════════════════════════════════════════════

// HealthPanel imported from './health'

function BotsPlaceholder() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⬡</div>
      <div style={{ fontSize: 18, color: T.text, fontWeight: 600, fontFamily: "'Satoshi', sans-serif", marginBottom: 8 }}>Bots Panel</div>
      <div style={{ fontSize: 13, color: T.textSoft, textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>
        Polymarket trading bot dashboard, P&L tracking, open positions & bot monitoring. Coming soon fam.
      </div>
      <Badge color={T.amber}>COMING SOON</Badge>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [nav, setNav] = useState("twitter");
  const [time, setTime] = useState(new Date());
  const [isDark, setIsDark] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    try { return window.sessionStorage.getItem("claude_key") || ""; } catch { return ""; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  T = isDark ? DARK : LIGHT;

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const saveKey = () => {
    setApiKey(keyInput);
    try { window.sessionStorage.setItem("claude_key", keyInput); } catch {}
    setShowSettings(false);
  };

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

      {/* TOP BAR */}
      <div style={{
        background: `${T.surface}ee`, borderBottom: `1px solid ${T.border}`,
        padding: "0 28px", height: 56, display: "flex", justifyContent: "space-between",
        alignItems: "center", position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 7,
            background: `linear-gradient(135deg,${T.green},#00aa55)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: T.bg, fontFamily: "'Satoshi', sans-serif",
          }}>D</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, fontFamily: "'Satoshi', sans-serif", letterSpacing: "-.02em" }}>
              DJANGO<span style={{ color: T.green }}>CMD</span>
            </div>
            <div style={{ fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: ".1em" }}>COMMAND CENTER</div>
          </div>
        </div>

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
              {n.disabled && <span style={{ fontSize: 8, color: T.amber, fontFamily: "'IBM Plex Mono', monospace" }}>SOON</span>}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Dot color={T.green} pulse />
            <span style={{ fontSize: 10, color: T.textSoft, fontFamily: "'IBM Plex Mono', monospace" }}>sheets connected</span>
          </div>
          <button onClick={() => setIsDark(d => !d)} style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 20,
            padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            transition: "all .2s", fontSize: 14,
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.green}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
          >
            <span style={{ transition: "all .3s", transform: isDark ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}>
              {isDark ? "☾" : "☀"}
            </span>
            <span style={{ fontSize: 10, color: T.textSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
              {isDark ? "nite" : "day"}
            </span>
          </button>
          {/* Settings */}
          <button onClick={() => { setKeyInput(apiKey); setShowSettings(true); }} style={{
            background: apiKey ? T.greenDim : T.card, border: `1px solid ${apiKey ? T.greenMid : T.border}`,
            borderRadius: 20, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 14,
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.green}
            onMouseLeave={e => e.currentTarget.style.borderColor = apiKey ? T.greenMid : T.border}
          >
            ⚙
            <span style={{ fontSize: 10, color: apiKey ? T.green : T.textSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
              {apiKey ? "AI on" : "settings"}
            </span>
          </button>
          <div style={{
            fontSize: 12, color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500,
            background: T.card, padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.border}`,
          }}>
            {time.toLocaleTimeString("en-GB", { hour12: false })}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "24px 28px", maxWidth: 1360, margin: "0 auto" }}>
        {nav === "twitter" && <TwitterPanel apiKey={apiKey} />}
        {nav === "health" && <HealthPanel />}
        {nav === "bots" && <BotsPlaceholder />}
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, backdropFilter: "blur(4px)",
        }} onClick={() => setShowSettings(false)}>
          <div style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
            padding: 28, width: 440, maxWidth: "90vw",
          }} onClick={e => e.stopPropagation()}>
            <Heading icon="⚙">Settings</Heading>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 600, marginBottom: 6 }}>Claude API Key</div>
              <div style={{ fontSize: 11, color: T.textSoft, marginBottom: 8, lineHeight: 1.5 }}>
                Required for AI post scoring. Key is stored in memory only — never saved to disk or sent anywhere except Anthropic's API.
              </div>
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="sk-ant-api03-..."
                style={{
                  width: "100%", background: T.bg2, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13,
                  fontFamily: "'IBM Plex Mono', monospace", outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = T.green}
                onBlur={e => e.target.style.borderColor = T.border}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn color={T.green} onClick={saveKey}>Save</Btn>
              {apiKey && <Btn color={T.red} outline onClick={() => { setApiKey(""); setKeyInput(""); try { window.sessionStorage.removeItem("claude_key"); } catch {} }}>Remove Key</Btn>}
              <Btn outline onClick={() => setShowSettings(false)}>Cancel</Btn>
            </div>
            {apiKey && (
              <div style={{ marginTop: 12, fontSize: 11, color: T.green, display: "flex", alignItems: "center", gap: 4 }}>
                <Dot color={T.green} pulse /> API key active — AI scoring enabled
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 28px", display: "flex", justifyContent: "space-between", marginTop: 40 }}>
        <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>
          DjangoCMD v2.0 · health panel live · see you on the timeline, xoxo
        </span>
        <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>
          gm fam · {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}
