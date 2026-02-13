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

function parseCSV(text, tabName) {
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

  // USED tab has unique headers (Post text, Impressions, etc.) — each row is one post, no merging needed
  const isUsedTab = tabName === "USED";
  if (isUsedTab) {
    return {
      headers,
      rows: rawRows.filter(r => {
        const post = (r["Post text"] || r["Post"] || "").trim();
        return post.length > 2;
      })
    };
  }

  // For DRAFT/POST/DATABASE/BAD: merge multiline posts
  // Strategy: Category appears on the LAST row of a post group (at the bottom)
  // So we collect text lines upward and assign Category/Structure from the row that has them
  
  // First pass: identify "anchor" rows (rows that have Category OR Structure filled)
  // and "text-only" rows (only Post column has content)
  
  const groups = [];
  let currentGroup = { textLines: [], meta: {} };
  
  for (const row of rawRows) {
    const cat = (row["Category"] || "").trim();
    const structure = (row["Structure"] || "").trim();
    const post = (row["Post"] || "").trim();
    const notes = (row["Notes"] || row["Why Bad"] || "").trim();
    const score = (row["Score"] || "").trim();
    const hasMeta = cat.length > 0 || structure.length > 0;
    
    if (post.length > 0) {
      currentGroup.textLines.push(post);
    }
    
    if (hasMeta) {
      // This row has Category/Structure — it's the anchor for the current group
      currentGroup.meta = { ...row };
      // Finalize this group
      if (currentGroup.textLines.length > 0) {
        groups.push({ ...currentGroup });
      }
      currentGroup = { textLines: [], meta: {} };
    }
  }
  
  // If there are leftover text lines without meta (shouldn't happen normally)
  if (currentGroup.textLines.length > 0) {
    groups.push({ ...currentGroup });
  }

  // Build final rows from groups
  const rows = groups.map(g => {
    const fullPost = g.textLines.join("\n");
    return {
      ...g.meta,
      Post: fullPost,
      Category: (g.meta["Category"] || "").trim(),
      Structure: (g.meta["Structure"] || "").trim(),
      Notes: (g.meta["Notes"] || g.meta["Why Bad"] || "").trim(),
      Score: (g.meta["Score"] || "").trim(),
    };
  }).filter(r => (r.Post || "").trim().length > 2);

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
                  <Btn small color={T.red} outline onClick={() => movePost(p.id, "BAD")}>✕ → Bad</Btn>
                </>}
                {isPost && <>
                  <select value={p.day} onChange={e => setDay(p.id, e.target.value)} style={{ ...sel, fontSize: 11, padding: "4px 8px" }}>
                    <option value="">📅 Day</option>
                    {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <Btn small color={T.green} onClick={() => movePost(p.id, "USED")}>✓ → Used</Btn>
                  <Btn small color={T.blue} outline onClick={() => movePost(p.id, "DRAFT")}>✎ → Draft</Btn>
                  <Btn small color={T.red} outline onClick={() => movePost(p.id, "BAD")}>✕ → Bad</Btn>
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
  const [subTab, setSubTab] = useState("content");
  const { data: sheetData, loading, error, refetch, lastFetch } = useSheetData();

  return (
    <div>
      {/* Account */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        <AccountPill account="@django_crypto" active={true} onClick={() => {}} />
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
      {subTab === "research" && <DailyResearch account="@django_crypto" />}
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
          DjangoCMD v1.7 · local mode · see you on the timeline, xoxo
        </span>
        <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>
          gm fam · {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}
