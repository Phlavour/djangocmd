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

function parseCSV(text) {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const parseLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rawRows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });

  // Merge multiline posts: if a row has no Category AND no Structure,
  // it's a continuation of the previous post's text
  const merged = [];
  for (const row of rawRows) {
    const cat = (row["Category"] || "").trim();
    const structure = (row["Structure"] || "").trim();
    const post = (row["Post"] || row["Post text"] || "").trim();
    
    // Check if this row has substantial identifying info (Category or Structure)
    const isNewPost = cat.length > 0 || structure.length > 0;
    
    if (isNewPost || merged.length === 0) {
      // New post entry
      merged.push({ ...row });
    } else if (post.length > 0 && merged.length > 0) {
      // Continuation of previous post - append text
      const prev = merged[merged.length - 1];
      const prevPostKey = prev["Post"] !== undefined ? "Post" : "Post text";
      const prevPost = (prev[prevPostKey] || "").trim();
      prev[prevPostKey] = prevPost + (prevPost ? "\n" : "") + post;
      
      // Also merge any other filled fields
      for (const h of headers) {
        if (h !== "Post" && h !== "Post text" && h !== "Category" && h !== "Structure") {
          const val = (row[h] || "").trim();
          if (val && !(prev[h] || "").trim()) {
            prev[h] = val;
          }
        }
      }
    }
  }

  // Filter out rows that have no real content
  const rows = merged.filter(row => {
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
  { handle: "@django_crypto", name: "Django", avatar: "/pfp-django.jpg", gradient: ["#00e87b", "#00a855"] },
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
  { id: "health", icon: "♥", label: "Health", disabled: true },
  { id: "bots", icon: "⬡", label: "Bots", disabled: true },
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
        const parsed = parseCSV(text);
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
// WEEKLY CONTENT — reads from Google Sheets
// ═══════════════════════════════════════════════════════════════

function WeeklyContent({ sheetData, loading, onRefresh, apiKey }) {
  const [activeTab, setActiveTab] = useState("DRAFT");
  const [sortBy, setSortBy] = useState("default");
  const [newPostText, setNewPostText] = useState("");
  const [newPostCat, setNewPostCat] = useState("growth");
  const [newPostStructure, setNewPostStructure] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [localPosts, setLocalPosts] = useState([]);
  const [aiLoading, setAiLoading] = useState(null); // post index being scored
  const [aiResults, setAiResults] = useState({}); // idx -> {notes, score}
  const TC = TABS_CONFIG_FN();

  const tabData = sheetData[activeTab];
  let rows = tabData?.rows || [];

  if (activeTab === "DRAFT") {
    rows = [...rows, ...localPosts];
  }

  // Sorting
  if (sortBy === "category") {
    rows = [...rows].sort((a, b) => (a["Category"] || "").localeCompare(b["Category"] || ""));
  } else if (sortBy === "score-desc") {
    rows = [...rows].sort((a, b) => parseFloat(b["Score"] || 0) - parseFloat(a["Score"] || 0));
  } else if (sortBy === "score-asc") {
    rows = [...rows].sort((a, b) => parseFloat(a["Score"] || 0) - parseFloat(b["Score"] || 0));
  } else if (sortBy === "impressions") {
    rows = [...rows].sort((a, b) => parseInt(b["Impressions"] || 0) - parseInt(a["Impressions"] || 0));
  } else if (sortBy === "engagement") {
    rows = [...rows].sort((a, b) => parseInt(b["Engagements"] || 0) - parseInt(a["Engagements"] || 0));
  }

  const counts = {};
  STATUS_ORDER.forEach(t => {
    let c = (sheetData[t]?.rows || []).length;
    if (t === "DRAFT") c += localPosts.length;
    counts[t] = c;
  });

  const isUsedTab = activeTab === "USED";
  const isBadTab = activeTab === "BAD";

  const addLocalPost = () => {
    if (!newPostText.trim()) return;
    setLocalPosts(prev => [...prev, {
      Category: newPostCat, Structure: newPostStructure, Post: newPostText.trim(),
      Notes: "", Score: "", _local: true,
    }]);
    setNewPostText("");
    setNewPostCat("growth");
    setNewPostStructure("");
    setShowAdd(false);
  };

  const removeLocalPost = (idx) => {
    setLocalPosts(prev => prev.filter((_, i) => i !== idx));
  };

  // AI Scoring
  const askClaude = async (postText, idx) => {
    if (!apiKey) {
      alert("Add your Claude API key in Settings (⚙️ icon in top bar)");
      return;
    }
    setAiLoading(idx);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [{ role: "user", content: `You are a crypto Twitter content strategist. Rate this post for viral potential on crypto Twitter.

Post: "${postText}"

Respond ONLY in this exact JSON format, nothing else:
{"score": 7.5, "notes": "Brief explanation why this score, what makes it good or bad, and one suggestion to improve it"}

Score should be 1-10 where:
- 9-10: Exceptional viral potential, strong hook, unique insight
- 7-8: Good post, solid engagement potential
- 5-6: Average, needs work
- 1-4: Weak, needs major revision

Be honest and critical. Consider: hook strength, uniqueness, relatability, engagement potential, authenticity.` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      try {
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        setAiResults(prev => ({ ...prev, [idx]: parsed }));
      } catch {
        setAiResults(prev => ({ ...prev, [idx]: { score: "?", notes: text } }));
      }
    } catch (err) {
      setAiResults(prev => ({ ...prev, [idx]: { score: "!", notes: "Error: " + err.message } }));
    } finally {
      setAiLoading(null);
    }
  };

  const sortOptions = isUsedTab
    ? [{ value: "default", label: "Default" }, { value: "impressions", label: "Impressions ↓" }, { value: "engagement", label: "Engagement ↓" }]
    : [{ value: "default", label: "Default" }, { value: "category", label: "Category A-Z" }, { value: "score-desc", label: "Score ↓" }, { value: "score-asc", label: "Score ↑" }];

  const selectStyle = {
    background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px",
    color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", cursor: "pointer",
  };

  return (
    <div>
      {/* Refresh + Sort */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>
          {loading ? <LoadingDots /> : `Live data from Google Sheets`}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px",
            color: T.text, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", outline: "none", cursor: "pointer",
          }}>
            {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Btn small color={T.cyan} onClick={onRefresh} disabled={loading}>↻ Refresh</Btn>
        </div>
      </div>

      {/* Content Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUS_ORDER.map(tab => (
          <TabBtn key={tab} label={`${TC[tab].icon} ${TC[tab].label}`}
            active={activeTab === tab} onClick={() => { setActiveTab(tab); setSortBy("default"); }}
            color={TC[tab].color} count={counts[tab]}
          />
        ))}
      </div>

      {/* Content Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
        {STATUS_ORDER.map(tab => (
          <div key={tab} style={{
            background: activeTab === tab ? `${TC[tab].color}10` : T.surface,
            border: `1px solid ${activeTab === tab ? `${TC[tab].color}30` : T.border}`,
            borderRadius: 8, padding: "10px 12px", textAlign: "center", cursor: "pointer",
          }} onClick={() => setActiveTab(tab)}>
            <div style={{ fontSize: 20, fontWeight: 700, color: TC[tab].color, fontFamily: "'Satoshi', sans-serif" }}>
              {counts[tab]}
            </div>
            <div style={{ fontSize: 9, color: T.textSoft, textTransform: "uppercase", letterSpacing: ".08em" }}>{tab}</div>
          </div>
        ))}
      </div>

      {/* Add Post (DRAFT only) */}
      {activeTab === "DRAFT" && (
        <div style={{ marginBottom: 16 }}>
          {showAdd ? (
            <Card>
              <Heading icon="✎">New Draft Post</Heading>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, marginBottom: 4, textTransform: "uppercase" }}>Category</div>
                  <select value={newPostCat} onChange={e => setNewPostCat(e.target.value)} style={selectStyle}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, marginBottom: 4, textTransform: "uppercase" }}>Structure</div>
                  <select value={newPostStructure} onChange={e => setNewPostStructure(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
                    <option value="">-- select structure --</option>
                    {STRUCTURES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <textarea value={newPostText} onChange={e => setNewPostText(e.target.value)}
                placeholder="write your post fam..."
                style={{
                  width: "100%", minHeight: 80, background: T.bg2, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: 12, color: T.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace",
                  resize: "vertical", lineHeight: 1.5, outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = T.green}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn color={T.green} onClick={addLocalPost}>Add to Draft</Btn>
                <Btn outline onClick={() => { setShowAdd(false); setNewPostText(""); }}>Cancel</Btn>
              </div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 8 }}>
                💡 Posts added here are local. Copy them to Google Sheets to make permanent.
              </div>
            </Card>
          ) : (
            <div style={{ textAlign: "center" }}>
              <Btn color={T.green} onClick={() => setShowAdd(true)}>+ Add New Post</Btn>
            </div>
          )}
        </div>
      )}

      {/* Posts List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><LoadingDots /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: T.textDim, fontSize: 13 }}>
              No posts in {TC[activeTab]?.label || activeTab}. Data is loaded from Google Sheets.
            </div>
          )}
          {rows.map((row, idx) => {
            const PC = PILLAR_COLORS_FN();
            const cat = row["Category"] || row["category"] || "";
            const post = row["Post"] || row["Post text"] || "";
            const structure = row["Structure"] || "";
            const notes = isBadTab ? (row["Why Bad"] || "") : (row["Notes"] || "");
            const howToFix = isBadTab ? (row["How to Fix"] || "") : "";
            const score = row["Score"] || "";
            const scheduled = row["Scheduled"] || "";
            const status = row["Status"] || "";
            const isLocal = row._local;

            // USED tab analytics fields
            const impressions = row["Impressions"] || "";
            const likes = row["Likes"] || "";
            const engagements = row["Engagements"] || "";
            const bookmarks = row["Bookmarks"] || "";
            const replies = row["Replies"] || "";
            const reposts = row["Reposts"] || "";
            const profileVisits = row["Profile visits"] || "";
            const urlClicks = row["URL Clicks"] || "";
            const postLink = row["Post Link"] || row["Post link"] || "";
            const newFollows = row["New follows"] || "";

            return (
              <div key={idx} style={{
                background: isLocal ? `${T.green}08` : T.surface,
                border: `1px solid ${isLocal ? T.greenMid : T.border}`,
                borderRadius: 10, padding: 16, transition: "all .12s",
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = (TC[activeTab]?.color || T.green) + "40"}
                onMouseLeave={e => e.currentTarget.style.borderColor = isLocal ? T.greenMid : T.border}
              >
                {/* Post text */}
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap" }}>
                  {post || <span style={{ color: T.textDim, fontStyle: "italic" }}>Empty post</span>}
                </div>

                {/* POST tab: day selector + move to USED */}
                {activeTab === "POST" && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                    <select defaultValue={scheduled || ""} style={{
                      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px",
                      color: T.text, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", outline: "none",
                    }}>
                      <option value="">📅 Pick day</option>
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <Btn small color={T.green}>✓ Mark as Posted → USED</Btn>
                    <Btn small color={T.red} outline>✕ → BAD</Btn>
                    <Btn small color={T.purple} outline>◈ → DATABASE</Btn>
                  </div>
                )}

                {/* Tags row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {cat && <Badge color={PC[cat] || PC[cat.charAt(0).toUpperCase() + cat.slice(1)] || T.textSoft}>{cat}</Badge>}
                    {structure && <Badge color={T.textDim}>{structure}</Badge>}
                    {score && <Badge color={parseFloat(score) >= 8.5 ? T.green : parseFloat(score) >= 7 ? T.amber : T.textSoft}>Score {score}</Badge>}
                    {scheduled && <Badge color={T.cyan}>📅 {scheduled}</Badge>}
                    {status && <Badge color={status === "Posted" ? T.green : T.amber}>{status}</Badge>}
                    {isLocal && <Badge color={T.green}>📌 Local Draft</Badge>}
                    {postLink && (
                      <a href={postLink} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.cyan, textDecoration: "none" }}>
                        🔗 View on X
                      </a>
                    )}
                  </div>
                </div>

                {/* USED tab: analytics metrics row */}
                {isUsedTab && impressions && (
                  <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                    {[
                      { label: "Impressions", val: impressions, color: T.green },
                      { label: "Likes", val: likes, color: T.red },
                      { label: "Engagements", val: engagements, color: T.blue },
                      { label: "Bookmarks", val: bookmarks, color: T.amber },
                      { label: "Replies", val: replies, color: T.cyan },
                      { label: "Reposts", val: reposts, color: T.purple },
                      { label: "Profile Visits", val: profileVisits, color: T.textSoft },
                      { label: "New Follows", val: newFollows, color: T.green },
                      { label: "URL Clicks", val: urlClicks, color: T.cyan },
                    ].filter(m => m.val && m.val !== "0").map((m, mi) => (
                      <div key={mi} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase" }}>{m.label}:</span>
                        <span style={{ fontSize: 12, color: m.color, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {parseInt(m.val).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {notes && !isUsedTab && (
                  <div style={{ marginTop: 8, fontSize: 11, color: T.textSoft }}>
                    💡 {notes}
                  </div>
                )}

                {/* BAD tab: how to fix */}
                {isBadTab && howToFix && (
                  <div style={{ marginTop: 8, fontSize: 11, color: T.amber, background: T.amberDim, padding: "6px 10px", borderRadius: 6 }}>
                    🔧 Fix: {howToFix}
                  </div>
                )}

                {/* Remove button for local posts */}
                {isLocal && (
                  <div style={{ marginTop: 8 }}>
                    <Btn small color={T.red} outline onClick={() => removeLocalPost(localPosts.indexOf(row))}>✕ Remove</Btn>
                  </div>
                )}

                {/* AI Score button */}
                {!isUsedTab && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <Btn small color={T.purple}
                      disabled={aiLoading === idx || !post}
                      onClick={() => askClaude(post, idx)}>
                      {aiLoading === idx ? "⏳ Scoring..." : "🤖 Ask Claude"}
                    </Btn>
                    {aiResults[idx] && (
                      <Badge color={
                        parseFloat(aiResults[idx].score) >= 8.5 ? T.green :
                        parseFloat(aiResults[idx].score) >= 7 ? T.amber :
                        parseFloat(aiResults[idx].score) >= 5 ? T.blue : T.red
                      }>
                        AI Score: {aiResults[idx].score}
                      </Badge>
                    )}
                  </div>
                )}

                {/* AI Result */}
                {aiResults[idx] && aiResults[idx].notes && (
                  <div style={{
                    marginTop: 8, fontSize: 12, color: T.text, background: T.purpleDim,
                    border: `1px solid ${T.purple}30`, padding: "10px 14px", borderRadius: 8, lineHeight: 1.6,
                  }}>
                    <span style={{ fontSize: 10, color: T.purple, fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 4 }}>🤖 Claude's Analysis</span>
                    {aiResults[idx].notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info note */}
      <div style={{ marginTop: 20, padding: 14, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, color: T.textSoft, lineHeight: 1.6 }}>
        💡 Data loaded live from <a href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}`} target="_blank" rel="noreferrer" style={{ color: T.cyan }}>Google Sheets</a>.
        To move posts between tabs, edit directly in Sheets — changes appear here after refresh.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WEEKLY ANALYTICS — reads USED tab + CSV upload
// ═══════════════════════════════════════════════════════════════

function WeeklyAnalytics({ sheetData, loading }) {
  const [metric, setMetric] = useState("Impressions");
  const [extraAnalytics, setExtraAnalytics] = useState(null);

  // Parse USED tab data (real X analytics)
  const usedRows = sheetData["USED"]?.rows || [];

  // Build analytics from USED tab
  const analyticsData = usedRows.map((row, i) => ({
    post: (row["Post text"] || row["Post"] || "").slice(0, 40) + "...",
    fullPost: row["Post text"] || row["Post"] || "",
    link: row["Post Link"] || row["Post link"] || "",
    impressions: parseInt(row["Impressions"] || 0) || 0,
    likes: parseInt(row["Likes"] || 0) || 0,
    engagements: parseInt(row["Engagements"] || 0) || 0,
    bookmarks: parseInt(row["Bookmarks"] || 0) || 0,
    shares: parseInt(row["Shares"] || 0) || 0,
    newFollows: parseInt(row["New follows"] || 0) || 0,
    replies: parseInt(row["Replies"] || 0) || 0,
    reposts: parseInt(row["Reposts"] || 0) || 0,
    profileVisits: parseInt(row["Profile visits"] || 0) || 0,
    detailExpands: parseInt(row["Detail Expands"] || 0) || 0,
    urlClicks: parseInt(row["URL Clicks"] || 0) || 0,
    engRate: parseInt(row["Impressions"] || 0) > 0
      ? ((parseInt(row["Engagements"] || 0) / parseInt(row["Impressions"] || 1)) * 100).toFixed(1)
      : "0",
    idx: i,
  })).filter(r => r.impressions > 0);

  // Sort by impressions for top posts
  const sortedByImpressions = [...analyticsData].sort((a, b) => b.impressions - a.impressions);
  const sortedByEngRate = [...analyticsData].sort((a, b) => parseFloat(b.engRate) - parseFloat(a.engRate));

  // Aggregate stats
  const totalImpressions = analyticsData.reduce((s, d) => s + d.impressions, 0);
  const totalLikes = analyticsData.reduce((s, d) => s + d.likes, 0);
  const totalEngagements = analyticsData.reduce((s, d) => s + d.engagements, 0);
  const totalReplies = analyticsData.reduce((s, d) => s + d.replies, 0);
  const totalReposts = analyticsData.reduce((s, d) => s + d.reposts, 0);
  const avgEngRate = analyticsData.length > 0
    ? (analyticsData.reduce((s, d) => s + parseFloat(d.engRate), 0) / analyticsData.length).toFixed(1)
    : "0";
  const totalProfileVisits = analyticsData.reduce((s, d) => s + d.profileVisits, 0);
  const totalNewFollows = analyticsData.reduce((s, d) => s + d.newFollows, 0);

  // Chart data — top 15 posts by impressions
  const chartData = sortedByImpressions.slice(0, 15).map((d, i) => ({
    name: `#${i + 1}`,
    Impressions: d.impressions,
    Likes: d.likes,
    Engagements: d.engagements,
    Replies: d.replies,
    fullPost: d.fullPost,
  }));

  // Engagement distribution pie
  const engDistribution = [
    { name: "Likes", value: totalLikes, color: T.green },
    { name: "Replies", value: totalReplies, color: T.blue },
    { name: "Reposts", value: totalReposts, color: T.purple },
    { name: "Bookmarks", value: analyticsData.reduce((s, d) => s + d.bookmarks, 0), color: T.amber },
    { name: "URL Clicks", value: analyticsData.reduce((s, d) => s + d.urlClicks, 0), color: T.cyan },
  ].filter(d => d.value > 0);

  // CSV upload for additional analytics
  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      setExtraAnalytics(parsed);
    };
    reader.readAsText(file);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 60 }}><LoadingDots /></div>;

  if (analyticsData.length === 0) {
    return (
      <div>
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, color: T.text, fontWeight: 600, marginBottom: 8 }}>No analytics data yet</div>
          <div style={{ fontSize: 13, color: T.textSoft, marginBottom: 16, lineHeight: 1.6 }}>
            Export your analytics CSV from X and paste it into the USED tab in Google Sheets.
            <br />Columns: Post text, Post Link, Impressions, Likes, Engagements, Bookmarks, Shares, New follows, Replies, Reposts, Profile visits, Detail Expands, URL Clicks
          </div>
          <label style={{ cursor: "pointer" }}>
            <input type="file" accept=".csv" onChange={handleCSV} style={{ display: "none" }} />
            <Btn color={T.cyan} style={{ pointerEvents: "none" }}>Or upload CSV directly</Btn>
          </label>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Key Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <Stat label="Total Impressions" value={totalImpressions} color={T.green} />
        <Stat label="Avg Engagement Rate" value={avgEngRate} suffix="%" color={T.blue} />
        <Stat label="Total Likes" value={totalLikes} color={T.red} />
        <Stat label="Total Posts Tracked" value={analyticsData.length} color={T.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <Stat label="Total Engagements" value={totalEngagements} color={T.cyan} />
        <Stat label="Total Replies" value={totalReplies} color={T.blue} />
        <Stat label="Profile Visits" value={totalProfileVisits} color={T.amber} />
        <Stat label="New Follows" value={totalNewFollows} color={T.green} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Main Chart — Top Posts */}
        <Card>
          <Heading icon="📈" right={
            <div style={{ display: "flex", gap: 4 }}>
              {["Impressions", "Likes", "Engagements", "Replies"].map(m => (
                <TabBtn key={m} label={m.slice(0, 4)} active={metric === m} onClick={() => setMetric(m)} color={T.green} />
              ))}
            </div>
          }>Top 15 Posts</Heading>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="name" stroke={T.textDim} fontSize={10} />
              <YAxis stroke={T.textDim} fontSize={10} />
              <Tooltip
                contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", maxWidth: 300 }}
                formatter={(val, name) => [val.toLocaleString(), name]}
                labelFormatter={(label) => {
                  const item = chartData.find(d => d.name === label);
                  return item ? item.fullPost.slice(0, 80) + "..." : label;
                }}
              />
              <Bar dataKey={metric} fill={T.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Engagement Distribution */}
        <Card>
          <Heading icon="🎯">Engagement Breakdown</Heading>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={engDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                  {engDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {engDistribution.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                <span style={{ color: T.textSoft, flex: 1 }}>{d.name}</span>
                <span style={{ color: T.text, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top Posts Table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <Heading icon="🏆">Top Posts by Impressions</Heading>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortedByImpressions.slice(0, 8).map((d, i) => (
              <div key={i} style={{
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px",
                display: "flex", gap: 10, alignItems: "center",
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? T.green : T.textDim, fontFamily: "'Satoshi', sans-serif", minWidth: 24 }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.fullPost}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{d.impressions.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: T.textDim }}>imp</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Heading icon="🔥">Top Posts by Engagement Rate</Heading>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sortedByEngRate.slice(0, 8).map((d, i) => (
              <div key={i} style={{
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px",
                display: "flex", gap: 10, alignItems: "center",
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? T.amber : T.textDim, fontFamily: "'Satoshi', sans-serif", minWidth: 24 }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.fullPost}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.amber, fontFamily: "'IBM Plex Mono', monospace" }}>{d.engRate}%</div>
                  <div style={{ fontSize: 9, color: T.textDim }}>eng rate</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Likes vs Replies scatter */}
      <Card style={{ marginTop: 16 }}>
        <Heading icon="📊">Impressions vs Engagement per Post</Heading>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sortedByImpressions.slice(0, 20)}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="post" stroke={T.textDim} fontSize={9} angle={-20} textAnchor="end" height={50} />
            <YAxis stroke={T.textDim} fontSize={10} />
            <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="likes" fill={T.green} radius={[3, 3, 0, 0]} name="Likes" />
            <Bar dataKey="replies" fill={T.blue} radius={[3, 3, 0, 0]} name="Replies" />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 10, color: T.textSoft }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot color={T.green} /> Likes</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot color={T.blue} /> Replies</span>
        </div>
      </Card>
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
        <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", marginRight: 4 }}>ACCOUNT:</span>
        {ACCOUNTS.map(a => (
          <AccountPill key={a.handle} account={a.handle} active={account === a.handle} onClick={() => setAccount(a.handle)} />
        ))}
        <Btn small outline color={T.textDim} style={{ borderStyle: "dashed", marginLeft: 4 }}>+ Add Account</Btn>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: T.red }}>
          ⚠️ Error loading sheets: {error}. Check if sheet is shared as "Anyone with the link".
        </div>
      )}

      {/* Sub Navigation */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, alignItems: "center" }}>
        <TabBtn label="🔍 Daily Research" active={subTab === "research"} onClick={() => setSubTab("research")} color={T.cyan} />
        <TabBtn label="✍️ Weekly Content" active={subTab === "content"} onClick={() => setSubTab("content")} color={T.green}
          count={sheetData?.DRAFT?.rows?.length}
        />
        <TabBtn label="📊 Analytics" active={subTab === "analytics"} onClick={() => setSubTab("analytics")} color={T.purple}
          count={sheetData?.USED?.rows?.length}
        />
        {lastFetch && (
          <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", marginLeft: "auto" }}>
            Last sync: {lastFetch.toLocaleTimeString("en-GB", { hour12: false })}
          </span>
        )}
      </div>

      {/* Sub Panel Content */}
      {subTab === "research" && <DailyResearch account={account} />}
      {subTab === "content" && <WeeklyContent sheetData={sheetData} loading={loading} onRefresh={refetch} apiKey={apiKey} />}
      {subTab === "analytics" && <WeeklyAnalytics sheetData={sheetData} loading={loading} />}
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
      <Badge color={T.amber}>COMING SOON</Badge>
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
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  T = isDark ? DARK : LIGHT;

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const saveKey = () => {
    setApiKey(keyInput);
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
        {nav === "health" && <HealthPlaceholder />}
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
              {apiKey && <Btn color={T.red} outline onClick={() => { setApiKey(""); setKeyInput(""); }}>Remove Key</Btn>}
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
          DjangoCMD v1.1 · live google sheets · see you on the timeline, xoxo
        </span>
        <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>
          gm fam · {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}
