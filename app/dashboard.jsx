import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Busting: T.amber, Shitpost: T.red, AI: T.cyan, growth: T.green,
  market: T.blue, lifestyle: T.purple, busting: T.amber,
  shitposting: T.red, ai: T.cyan,
});

const CATEGORIES = ["growth", "market", "lifestyle", "busting", "shitposting"];
const CATEGORIES_HENRYK = ["market", "busting", "shitposting", "growth", "ai", "lifestyle"];

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
// DAILY RESEARCH — Complete research-to-post pipeline
// ═══════════════════════════════════════════════════════════════

const RESEARCH_SK = "djangocmd_research_v2";

function DailyResearch({ account, apiKey, twitterApiKey, supa, allPosts, setAllPosts }) {
  const [research, setResearch] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RESEARCH_SK) || "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [aiLoading, setAiLoading] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualForm, setManualForm] = useState({ originalUrl: "", author: "", originalPost: "", headline: "", description: "" });
  const [fetchLoading, setFetchLoading] = useState(null); // which prompt is loading
  const [fetchStatus, setFetchStatus] = useState("");

  // ─── 4 Research Prompt Definitions ───
  const RESEARCH_PROMPTS = [
    {
      id: "crypto",
      label: "Crypto",
      icon: "₿",
      color: T.amber,
      queries: [
        { q: "crypto news min_faves:500", label: "Crypto News" },
        { q: "crypto scam OR rug OR hack min_faves:200", label: "Scams & Rugs" },
        { q: "crypto drama OR controversy min_faves:300", label: "CT Drama" },
        { q: "new token launch OR airdrop crypto min_faves:200", label: "New Trends" },
      ],
    },
    {
      id: "marketing",
      label: "Marketing",
      icon: "📈",
      color: T.green,
      queries: [
        { q: "marketing strategy OR growth hack min_faves:500", label: "Growth Strategies" },
        { q: "personal branding OR content creation min_faves:300", label: "Personal Brand" },
        { q: "viral campaign OR case study marketing min_faves:300", label: "Viral Campaigns" },
        { q: "audience building OR creator economy min_faves:200", label: "Creator Economy" },
      ],
    },
    {
      id: "trading",
      label: "Trading",
      icon: "📊",
      color: T.cyan,
      queries: [
        { q: "from:robert_ruszala OR from:IncomeSharks OR from:omzcharts", label: "Trading Accounts" },
        { q: "bitcoin technical analysis min_faves:300", label: "BTC Analysis" },
        { q: "crypto trade setup OR risk management min_faves:200", label: "Trade Setups" },
        { q: "market structure OR support resistance crypto min_faves:200", label: "Market Structure" },
      ],
    },
    {
      id: "controversy",
      label: "Controversy",
      icon: "🔥",
      color: T.red,
      queries: [
        { q: "controversial take OR hot take min_faves:1000", label: "Hot Takes" },
        { q: "drama OR scandal viral min_faves:2000", label: "Viral Drama" },
        { q: "unpopular opinion min_faves:500", label: "Unpopular Opinions" },
        { q: "ratio OR call out min_faves:1000", label: "Ratio & Callouts" },
      ],
    },
  ];

  const PC = PILLAR_COLORS_FN();
  const sel = { background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", cursor: "pointer" };

  // ─── Fetch tweets from TwitterAPI.io ───
  const fetchFromTwitterAPI = async (prompt) => {
    if (!twitterApiKey) { alert("Add TwitterAPI.io key in Settings (⚙)"); return; }
    setFetchLoading(prompt.id);
    setFetchStatus(`Fetching ${prompt.label}...`);
    const allTweets = [];
    try {
      for (const q of prompt.queries) {
        setFetchStatus(`Fetching: ${q.label}...`);
        const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(q.q)}&queryType=Top`;
        const res = await fetch(url, { headers: { "X-API-Key": twitterApiKey } });
        if (!res.ok) { console.error(`TwitterAPI error: ${res.status}`); continue; }
        const data = await res.json();
        if (data.tweets && data.tweets.length > 0) {
          // Take top 5 per query, filter duplicates
          const top = data.tweets.slice(0, 5).filter(t => !allTweets.some(ex => ex.id === t.id));
          allTweets.push(...top);
        }
        // Small delay between calls
        await new Promise(r => setTimeout(r, 300));
      }

      if (allTweets.length === 0) {
        setFetchStatus("No tweets found — try different queries");
        setFetchLoading(null);
        return;
      }

      // Convert tweets to research items
      const newItems = allTweets.map((tweet, i) => ({
        id: Date.now() + i,
        date: new Date().toISOString().slice(0, 10),
        originalUrl: tweet.url || `https://x.com/${tweet.author?.userName}/status/${tweet.id}`,
        author: tweet.author?.userName || "",
        originalPost: tweet.text || "",
        headline: (tweet.text || "").slice(0, 100).replace(/\n/g, " "),
        description: `${(tweet.viewCount || 0).toLocaleString()} views · ${(tweet.likeCount || 0).toLocaleString()} likes · ${(tweet.replyCount || 0).toLocaleString()} replies · ${(tweet.retweetCount || 0).toLocaleString()} RTs`,
        variants: [],
        status: "inbox",
        account,
        source: prompt.id,
        engagement: {
          views: tweet.viewCount || 0,
          likes: tweet.likeCount || 0,
          replies: tweet.replyCount || 0,
          retweets: tweet.retweetCount || 0,
        },
      }));

      setResearch(prev => [...newItems, ...prev]);
      setFetchStatus(`${newItems.length} tweets added to Inbox from ${prompt.label}`);
    } catch (err) {
      setFetchStatus(`Error: ${err.message}`);
    }
    setFetchLoading(null);
  };

  // Persist
  useEffect(() => {
    try { localStorage.setItem(RESEARCH_SK, JSON.stringify(research)); } catch {}
  }, [research]);

  // Sync to Supabase when items change (future)
  // useEffect(() => { if (supa) syncToSupabase(); }, [research]);

  // ─── Parse Grok output ───
  const parseGrokInput = () => {
    if (!input.trim()) return;
    const blocks = input.split(/(?=^\d+[\.\)]\s)/m).filter(b => b.trim().length > 10);
    const items = blocks.length > 1 ? blocks : input.split("\n\n").filter(b => b.trim().length > 10);

    const newItems = items.map((block, i) => {
      const lines = block.trim().split("\n");
      const headlineRaw = lines[0].replace(/^\d+[\.\)]\s*/, "").trim();
      const bodyLines = lines.slice(1);
      // Try to extract URL
      const urlMatch = block.match(/https?:\/\/[^\s\)]+/);
      // Try to extract author from "Source: Name" or "@handle"
      const authorMatch = block.match(/(?:Source|Author|By):\s*([^\n\(]+)/i) || block.match(/@(\w+)/);

      return {
        id: Date.now() + i,
        date: new Date().toISOString().slice(0, 10),
        originalUrl: urlMatch ? urlMatch[0] : "",
        author: authorMatch ? authorMatch[1].trim() : "",
        originalPost: bodyLines.join("\n").trim(),
        headline: headlineRaw,
        description: "",
        variants: [],
        status: "inbox", // inbox | processed | moved_draft | moved_bad | deleted
        account,
      };
    });
    setResearch(prev => [...newItems, ...prev]);
    setInput("");
  };

  // ─── Add manual item ───
  const addManualItem = () => {
    if (!manualForm.headline.trim() && !manualForm.originalPost.trim()) return;
    const newItem = {
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      originalUrl: manualForm.originalUrl.trim(),
      author: manualForm.author.trim(),
      originalPost: manualForm.originalPost.trim(),
      headline: manualForm.headline.trim() || manualForm.originalPost.trim().slice(0, 80),
      description: manualForm.description.trim(),
      variants: [],
      status: "inbox",
      account,
    };
    setResearch(prev => [newItem, ...prev]);
    setManualForm({ originalUrl: "", author: "", originalPost: "", headline: "", description: "" });
    setShowAddManual(false);
  };

  // ─── Generate 4 variants via Claude ───
  const generateVariants = async (item) => {
    if (!apiKey) { alert("Add Claude API key in Settings"); return; }
    setAiLoading(item.id);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 3000,
          system: `You are django_xbt — crypto trader, AI enthusiast, personal brand builder on Twitter/X.

VOICE RULES:
- always lowercase (never caps except proper nouns)
- no dots at end of sentences
- no emojis, no hashtags, no em dashes
- use ">" for bullet points in lists
- use "fam" sparingly - max 1 in 5 posts, never forced
- short punchy sentences, mix with longer explanations
- sound human and authentic, NOT like AI
- be specific, opinionated, direct
- share personal experience ("i did X") rather than generic advice ("you should X")

EXAMPLE DJANGO POSTS (match this tone):
[growth] "next time someone tells you stealing a post is a thing - do yourself a favor and mute this fella. if you want to be average - sure, go for it"
[market] "not catching falling knives. we're not there yet. no fomo approach whatsoever. zen is my second name. stay safe fam"
[shitpost] "crypto vocabulary update: > DYOR - reading one tweet and going all in > long term hold - i'm down 80% and can't sell > community - 47 bots and a dog"
[busting] "bro, 15 hours ago you were calling 'the crypto bottom'. something changed? can you decide what's your statement?"

CONTENT PILLARS: growth, market, lifestyle, busting, shitposting

ADVISOR SYSTEM (apply invisibly):
- GROWTH: use frameworks like Volume Negates Luck, How I vs How To, Give Secrets Sell Implementation, Nail It Then Scale It. NEVER name frameworks
- MARKET: embed trading psychology — Sniper Not Machine Gun, Losses = Tax, Wealth Flows Impatient→Patient, Casino Manager Mindset, Probability Mindset
- SHITPOSTING: can use humor structures like List That Breaks, Expectation Reversal, Dictionary Redefinition, X vs Y Self-Deprecating, Fact→Absurd Conclusion
- BUSTING: direct, evidence-based, sheriff energy. call out without punching down

POST STRUCTURES: Hook-Body-Conclusion, Problem-Solution, Listicle, Before-After, Controversy/Hot Take, Story/Narrative, Question-Answer, Myth Busting, Comparison/VS, Single Insight, Framework/System, Observation-Pattern, Contrarian View, Mindset Shift, Mistake-Lesson, Breakdown/Analysis, Prediction/Forecast

SCORING: 9-10 viral/screenshot-worthy, 7-8 solid engagement, 5-6 generic, 1-4 weak`,
          messages: [{ role: "user", content: `Create 4 different post variants based on this research item. Each variant should take a DIFFERENT angle, use a DIFFERENT post structure, and vary in length.

RESEARCH ITEM:
Headline: ${item.headline}
${item.originalPost ? `Original content: ${item.originalPost.slice(0, 500)}` : ""}
${item.author ? `Author: ${item.author}` : ""}
${item.description ? `Context: ${item.description}` : ""}

VARIANT REQUIREMENTS:
- V1: Short & punchy (under 280 chars) — hot take or observation
- V2: Medium (300-500 chars) — more context, story, or breakdown
- V3: Contrarian angle — opposite or unexpected perspective
- V4: Educational/actionable — teach something from this

Each must feel like a different post, not rephrased versions of the same idea.

Respond ONLY with valid JSON array, no markdown:
[{"post":"text","category":"growth|market|lifestyle|busting|shitposting","structure":"Structure Name","score":7}]` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const variants = JSON.parse(clean);

      setResearch(prev => prev.map(r => {
        if (r.id !== item.id) return r;
        return {
          ...r,
          variants: variants.map((v, i) => ({
            id: `${item.id}-v${i}`,
            post: v.post || "",
            category: v.category || "growth",
            structure: v.structure || "",
            score: v.score || 0,
          })),
          status: "processed",
        };
      }));
      setExpandedId(item.id);
    } catch (err) { alert("API error: " + err.message); }
    setAiLoading(null);
  };

  // ─── Bulk generate for all inbox items ───
  const bulkGenerate = async () => {
    if (!apiKey) { alert("Add Claude API key in Settings"); return; }
    const inboxItems = research.filter(r => r.status === "inbox" && r.account === account);
    if (inboxItems.length === 0) { alert("No items in inbox"); return; }
    setBulkLoading(true);
    let done = 0;
    for (const item of inboxItems.slice(0, 10)) {
      setBulkProgress(`Processing ${++done}/${Math.min(10, inboxItems.length)}: ${item.headline.slice(0, 40)}...`);
      await generateVariants(item);
      // Small delay between API calls
      await new Promise(r => setTimeout(r, 500));
    }
    setBulkProgress(`done — ${done} items processed`);
    setBulkLoading(false);
  };

  // ─── Move variant to Draft ───
  const moveVariantToDraft = (item, variant) => {
    if (!allPosts || !setAllPosts) return;
    const maxId = allPosts.length > 0 ? Math.max(0, ...allPosts.map(p => p.id)) + 1 : 1;
    const newPost = {
      id: maxId, tab: "DRAFT", category: variant.category || "growth", structure: variant.structure || "",
      post: variant.post, notes: `from research: ${item.headline.slice(0, 60)}`, score: String(variant.score || ""),
      howToFix: "", day: "", account: account, postLink: "", impressions: "", likes: "", engagements: "",
      bookmarks: "", replies: "", reposts: "", profileVisits: "", newFollows: "", urlClicks: "",
    };
    setAllPosts(prev => [...(prev || []), newPost]);
    if (supa) {
      const row = {
        tab: "DRAFT", category: newPost.category, structure: newPost.structure, post: newPost.post,
        notes: newPost.notes, score: newPost.score, how_to_fix: "", day: "", account: account || "@django_crypto",
      };
      supa.post("posts", [row]).catch(() => {});
    }
    // Mark parent item as moved
    setResearch(prev => prev.map(r => r.id === item.id ? { ...r, status: "moved_draft" } : r));
  };

  // ─── Move item to Bad ───
  const moveToBad = (item) => {
    setResearch(prev => prev.map(r => r.id === item.id ? { ...r, status: "moved_bad" } : r));
  };

  // ─── Delete item ───
  const deleteItem = (id) => {
    setResearch(prev => prev.filter(r => r.id !== id));
  };

  // ─── Edit variant inline ───
  const updateVariant = (itemId, variantIdx, field, value) => {
    setResearch(prev => prev.map(r => {
      if (r.id !== itemId) return r;
      const newVariants = [...r.variants];
      newVariants[variantIdx] = { ...newVariants[variantIdx], [field]: value };
      return { ...r, variants: newVariants };
    }));
  };

  // ─── Update item field ───
  const updateItem = (id, field, value) => {
    setResearch(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // ─── Filtering ───
  const activeItems = research.filter(r => r.account === account);
  const inboxItems = activeItems.filter(r => r.status === "inbox");
  const processedItems = activeItems.filter(r => r.status === "processed");
  const movedItems = activeItems.filter(r => r.status === "moved_draft" || r.status === "moved_bad");

  const counts = {
    inbox: inboxItems.length,
    processed: processedItems.length,
    moved: movedItems.length,
    total: activeItems.length,
  };

  // What to show
  const [viewTab, setViewTab] = useState("inbox");
  const displayItems = viewTab === "inbox" ? inboxItems
    : viewTab === "processed" ? processedItems
    : movedItems;

  const tabDefs = [
    { key: "inbox", label: "Inbox", icon: "📥", color: T.cyan, count: counts.inbox },
    { key: "processed", label: "Processed", icon: "🤖", color: T.green, count: counts.processed },
    { key: "moved", label: "Moved", icon: "📤", color: T.textDim, count: counts.moved },
  ];

  // ─── Variant card component ───
  const VariantCard = ({ item, variant, idx }) => {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(variant.post);
    const charCount = (variant.post || "").length;

    return (
      <div style={{
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14,
        position: "relative", transition: "border-color .12s",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = (PC[variant.category] || T.green) + "60"}
        onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>

        {/* Variant header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.textSoft }}>V{idx + 1}</span>
            <Badge color={PC[variant.category] || T.textSoft}>{variant.category}</Badge>
            {variant.structure && <Badge color={T.textDim}>{variant.structure}</Badge>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Badge color={variant.score >= 8 ? T.green : variant.score >= 6 ? T.amber : T.red}>
              {"★"} {variant.score}/10
            </Badge>
            <span style={{ fontSize: 10, color: charCount > 280 ? T.amber : T.textDim }}>{charCount}c</span>
          </div>
        </div>

        {/* Variant content */}
        {editing ? (
          <div>
            <textarea value={editVal} onChange={e => setEditVal(e.target.value)}
              style={{ width: "100%", minHeight: 80, background: T.surface, border: `1px solid ${T.green}40`, borderRadius: 6, padding: 10, color: T.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical", lineHeight: 1.6, outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <Btn small color={T.green} onClick={() => { updateVariant(item.id, idx, "post", editVal); setEditing(false); }}>Save</Btn>
              <Btn small outline onClick={() => { setEditVal(variant.post); setEditing(false); }}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.65, whiteSpace: "pre-wrap", cursor: "pointer" }}
            onClick={() => { setEditing(true); setEditVal(variant.post); }}>
            {variant.post || <span style={{ color: T.textDim, fontStyle: "italic" }}>empty variant</span>}
          </div>
        )}

        {/* Variant actions */}
        {!editing && item.status === "processed" && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
            <Btn small color={T.green} onClick={() => moveVariantToDraft(item, variant)}>→ Draft</Btn>
            <select value={variant.category} onChange={e => updateVariant(item.id, idx, "category", e.target.value)}
              style={{ ...sel, fontSize: 10, padding: "3px 6px" }}>
              {(account === "@henryk0x" ? CATEGORIES_HENRYK : CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={variant.structure} onChange={e => updateVariant(item.id, idx, "structure", e.target.value)}
              style={{ ...sel, fontSize: 10, padding: "3px 6px" }}>
              <option value="">Structure</option>
              {STRUCTURES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>
    );
  };

  // ─── Research item card ───
  const ResearchCard = ({ item }) => {
    const isExpanded = expandedId === item.id;
    const hasVariants = item.variants && item.variants.length > 0;
    const statusColors = { inbox: T.cyan, processed: T.green, moved_draft: T.textDim, moved_bad: T.red };
    const statusLabels = { inbox: "inbox", processed: "processed", moved_draft: "→ draft", moved_bad: "→ bad" };

    return (
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
        overflow: "hidden", transition: "all .12s",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = (statusColors[item.status] || T.green) + "40"}
        onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>

        {/* Main header — always visible */}
        <div style={{ padding: "14px 16px", cursor: "pointer" }}
          onClick={() => setExpandedId(isExpanded ? null : item.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.5 }}>
                {item.headline || "untitled research item"}
              </div>
              {item.description && (
                <div style={{ fontSize: 11, color: T.textSoft, marginTop: 4, lineHeight: 1.5 }}>
                  {item.description}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                {item.author && <span style={{ fontSize: 10, color: T.cyan }}>@{item.author.replace("@", "")}</span>}
                <span style={{ fontSize: 10, color: T.textDim }}>{item.date}</span>
                {item.originalUrl && <span style={{ fontSize: 10, color: T.textDim }}>🔗</span>}
                {hasVariants && <Badge color={T.green}>{item.variants.length} variants</Badge>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
              <Badge color={statusColors[item.status]}>{statusLabels[item.status]}</Badge>
              <span style={{ fontSize: 16, color: T.textDim, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
            </div>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${T.border}` }}>

            {/* Original post content */}
            {item.originalPost && (
              <div style={{ marginTop: 12, padding: 12, background: T.bg2, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", marginBottom: 6 }}>Original Post</div>
                <div style={{ fontSize: 12, color: T.textSoft, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
                  {item.originalPost}
                </div>
              </div>
            )}

            {/* URL */}
            {item.originalUrl && (
              <div style={{ marginTop: 8, fontSize: 11 }}>
                <a href={item.originalUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: T.cyan, textDecoration: "none" }}>
                  {item.originalUrl.length > 60 ? item.originalUrl.slice(0, 60) + "..." : item.originalUrl}
                </a>
              </div>
            )}

            {/* Variants */}
            {hasVariants && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", marginBottom: 8 }}>
                  Variants ({item.variants.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {item.variants.map((v, idx) => (
                    <VariantCard key={v.id || idx} item={item} variant={v} idx={idx} />
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
              {item.status === "inbox" && (
                <Btn color={T.green} small disabled={aiLoading === item.id} onClick={() => generateVariants(item)}>
                  {aiLoading === item.id ? "generating..." : "🤖 Generate 4 Variants"}
                </Btn>
              )}
              {item.status === "processed" && (
                <Btn color={T.green} small disabled={aiLoading === item.id} onClick={() => generateVariants(item)}>
                  {aiLoading === item.id ? "regenerating..." : "🔄 Regenerate"}
                </Btn>
              )}
              {item.status !== "moved_bad" && item.status !== "moved_draft" && (
                <Btn color={T.red} small outline onClick={() => moveToBad(item)}>✕ → Bad</Btn>
              )}
              <Btn small outline onClick={() => deleteItem(item.id)} style={{ color: T.red }}>🗑 Delete</Btn>

              {/* Inline edit headline */}
              <div style={{ flex: 1 }} />
              {item.originalUrl && (
                <a href={item.originalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: T.cyan, textDecoration: "none" }}>
                  Open Source ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <div>
      {/* ─── 4 Research Prompt Buttons ─── */}
      <Card style={{ marginBottom: 16 }}>
        <Heading icon="🔍" right={
          <div style={{ display: "flex", gap: 6 }}>
            {twitterApiKey && <Badge color={T.cyan}>API connected</Badge>}
            {!twitterApiKey && <Badge color={T.red}>add TwitterAPI key in Settings</Badge>}
          </div>
        }>Fetch Research from X</Heading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
          {RESEARCH_PROMPTS.map(p => (
            <button key={p.id} disabled={fetchLoading !== null || !twitterApiKey}
              onClick={() => fetchFromTwitterAPI(p)}
              style={{
                background: fetchLoading === p.id ? `${p.color}15` : T.bg2,
                border: `1px solid ${fetchLoading === p.id ? p.color : T.border}`,
                borderRadius: 10, padding: "16px 12px", cursor: twitterApiKey ? "pointer" : "not-allowed",
                opacity: (fetchLoading !== null && fetchLoading !== p.id) ? 0.4 : 1,
                transition: "all .15s", textAlign: "center",
              }}
              onMouseEnter={e => { if (!fetchLoading) e.currentTarget.style.borderColor = p.color; }}
              onMouseLeave={e => { if (fetchLoading !== p.id) e.currentTarget.style.borderColor = T.border; }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{p.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.color, fontFamily: "'Satoshi', sans-serif" }}>
                {fetchLoading === p.id ? "Fetching..." : p.label}
              </div>
              <div style={{ fontSize: 9, color: T.textDim, marginTop: 4 }}>
                {p.queries.length} queries
              </div>
            </button>
          ))}
        </div>
        {fetchStatus && (
          <div style={{ fontSize: 11, color: fetchLoading ? T.textSoft : fetchStatus.includes("Error") ? T.red : T.green, padding: "6px 0", fontFamily: "'IBM Plex Mono', monospace" }}>
            {fetchStatus}
          </div>
        )}
      </Card>

      {/* ─── Manual input / Paste section ─── */}
      <Card style={{ marginBottom: 16 }}>
        <Heading icon="📋" right={
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small outline onClick={() => setShowAddManual(!showAddManual)}>
              {showAddManual ? "Cancel" : "+ Manual"}
            </Btn>
          </div>
        }>Add Research (Manual / Paste)</Heading>

        {showAddManual ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", marginBottom: 4 }}>Headline *</div>
                <input value={manualForm.headline} onChange={e => setManualForm(p => ({ ...p, headline: e.target.value }))}
                  placeholder="your headline for this item"
                  style={{ width: "100%", padding: "8px 10px", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", marginBottom: 4 }}>Author</div>
                <input value={manualForm.author} onChange={e => setManualForm(p => ({ ...p, author: e.target.value }))}
                  placeholder="@handle or name"
                  style={{ width: "100%", padding: "8px 10px", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", marginBottom: 4 }}>Original URL</div>
              <input value={manualForm.originalUrl} onChange={e => setManualForm(p => ({ ...p, originalUrl: e.target.value }))}
                placeholder="https://x.com/..."
                style={{ width: "100%", padding: "8px 10px", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", marginBottom: 4 }}>Original Post Content</div>
              <textarea value={manualForm.originalPost} onChange={e => setManualForm(p => ({ ...p, originalPost: e.target.value }))}
                placeholder="paste the original post content here..."
                style={{ width: "100%", minHeight: 80, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical", lineHeight: 1.5, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", marginBottom: 4 }}>Description (your summary)</div>
              <textarea value={manualForm.description} onChange={e => setManualForm(p => ({ ...p, description: e.target.value }))}
                placeholder="brief description of what this is about and why it matters..."
                style={{ width: "100%", minHeight: 50, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical", lineHeight: 1.5, outline: "none", boxSizing: "border-box" }} />
            </div>
            <Btn color={T.green} onClick={addManualItem}>+ Add to Inbox</Btn>
          </div>
        ) : (
          <div>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder={"Paste Grok research output here...\nNumbered items (1. 2. 3.) will be split automatically.\nURLs and @authors will be extracted."}
              style={{
                width: "100%", minHeight: 80, background: T.bg2, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: 14, color: T.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace",
                resize: "vertical", lineHeight: 1.6, outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = T.cyan}
              onBlur={e => e.target.style.borderColor = T.border} />
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <Btn onClick={parseGrokInput} color={T.cyan}>📥 Add to Inbox</Btn>
              {bulkProgress && !bulkLoading && (
                <span style={{ fontSize: 11, color: bulkProgress.startsWith("done") ? T.green : T.textSoft }}>{bulkProgress}</span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ─── Bulk Generate ─── */}
      {counts.inbox > 0 && (
        <div style={{ marginBottom: 16, textAlign: "center" }}>
          <Btn color={T.green} disabled={bulkLoading || !apiKey} onClick={bulkGenerate}>
            {bulkLoading ? `⏳ ${bulkProgress}` : `🤖 Generate Variants for All Inbox Items (${counts.inbox})`}
          </Btn>
          {!apiKey && <div style={{ marginTop: 6, fontSize: 10, color: T.amber }}>add Claude API key in Settings first</div>}
        </div>
      )}

      {/* ─── Tabs + Stats ─── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        {tabDefs.map(td => (
          <TabBtn key={td.key} label={`${td.icon} ${td.label}`} active={viewTab === td.key}
            onClick={() => setViewTab(td.key)} color={td.color} count={td.count} />
        ))}
        <div style={{ flex: 1 }} />
        {displayItems.length > 0 && (
          <Btn small color={T.red} outline onClick={() => {
            if (!confirm(`Delete all ${viewTab} items?`)) return;
            const statuses = viewTab === "moved" ? ["moved_draft", "moved_bad"] : [viewTab];
            setResearch(prev => prev.filter(r => !(r.account === account && statuses.includes(r.status))));
          }}>🗑 Clear</Btn>
        )}
      </div>

      {/* ─── Stats bar ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        {tabDefs.map(td => (
          <div key={td.key} style={{
            background: viewTab === td.key ? `${td.color}10` : T.surface,
            border: `1px solid ${viewTab === td.key ? `${td.color}30` : T.border}`,
            borderRadius: 8, padding: "10px 12px", textAlign: "center", cursor: "pointer",
          }} onClick={() => setViewTab(td.key)}>
            <div style={{ fontSize: 20, fontWeight: 700, color: td.color, fontFamily: "'Satoshi', sans-serif" }}>{td.count}</div>
            <div style={{ fontSize: 9, color: T.textSoft, textTransform: "uppercase" }}>{td.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Items list ─── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {displayItems.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: T.textDim, fontSize: 13 }}>
            {viewTab === "inbox" ? "No research items yet — paste Grok output or add manually above"
              : viewTab === "processed" ? "No processed items — generate variants from Inbox"
              : "No moved items yet"}
          </div>
        )}
        {displayItems.map(item => (
          <ResearchCard key={item.id} item={item} />
        ))}
      </div>

      {/* ─── Footer ─── */}
      <div style={{ marginTop: 20, padding: 14, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, color: T.textSoft, lineHeight: 1.6 }}>
        <strong>Workflow:</strong> Click prompt button (Crypto/Marketing/Trading/Controversy) → tweets fetched to Inbox → Generate 4 variants per item → Review & edit → Best variant → Draft
      </div>
    </div>
  );
}

function WeeklyContent({ sheetData, loading, onRefresh, apiKey, supa, allPosts, setAllPosts, account, brandVoice, setBrandVoice, goalTarget, setGoalTarget, goalCurrent, setGoalCurrent, goalDeadline, supaLoaded, weeklyNotes, setWeeklyNotes, lastAnalysis, setLastAnalysis }) {
  const [activeTab, setActiveTab] = useState("DRAFT");
  const [sortBy, setSortBy] = useState("mine-first");
  const [newPostText, setNewPostText] = useState("");
  const [newPostImage, setNewPostImage] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null);

  const uploadImage = async (file) => {
    if (!supa) { alert("Connect Supabase first"); return null; }
    if (!file) return null;
    setImageUploading(true);
    try {
      const ext = file.name?.split(".").pop() || "png";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await supa.uploadImage(file, filename);
      setNewPostImage(url);
      return url;
    } catch (err) {
      console.error("Upload error:", err);
      alert("Image upload failed. Make sure 'post-images' bucket exists in Supabase Storage (public).");
      return null;
    } finally { setImageUploading(false); }
  };

  const handleImagePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        uploadImage(item.getAsFile());
        return;
      }
    }
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = T.border;
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith("image/")) uploadImage(file);
  };

  const handleImageFile = (file) => {
    if (file?.type.startsWith("image/")) uploadImage(file);
  };

  // Upload image for existing post
  const postImageRef = useRef(null);
  const [imageTargetId, setImageTargetId] = useState(null);

  const uploadImageForPost = async (file, postId) => {
    if (!supa || !file) return;
    try {
      const ext = file.name?.split(".").pop() || "png";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await supa.uploadImage(file, filename);
      setAllPosts(prev => (prev || []).map(p => p.id === postId ? { ...p, image_url: url } : p));
      const post = (allPosts || []).find(p => p.id === postId);
      if (post?._supaId) supa.patch("posts", `id=eq.${post._supaId}`, { image_url: url });
    } catch (err) {
      alert("Image upload failed. Check 'post-images' bucket in Supabase.");
    }
  };
  const [newPostCat, setNewPostCat] = useState("growth");
  const [newPostStructure, setNewPostStructure] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [aiLoading, setAiLoading] = useState(null);
  const [aiResults, setAiResults] = useState({});
  const [showGen, setShowGen] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [weeklyNotesSaving, setWeeklyNotesSaving] = useState(false);
  const weeklyNotesTimer = useRef(null);
  const [genProgress, setGenProgress] = useState("");
  const [rewriteId, setRewriteId] = useState(null);
  const [rewriteFeedback, setRewriteFeedback] = useState("");
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [fixLoading, setFixLoading] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translateLoading, setTranslateLoading] = useState(null);
  const TC = TABS_CONFIG_FN();
  const PC = PILLAR_COLORS_FN();

  // Translate post to other account's language and add as DRAFT
  const translatePost = async (post) => {
    if (!apiKey) { alert("Add Claude API key in Settings"); return; }
    setTranslateLoading(post.id);
    const targetAccount = account === "@django_crypto" ? "@henryk0x" : "@django_crypto";
    const isToPolish = targetAccount === "@henryk0x";
    const targetCats = isToPolish ? CATEGORIES_HENRYK : CATEGORIES;
    const mappedCategory = targetCats.includes(post.category) ? post.category : targetCats[0];

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 800,
          messages: [{ role: "user", content: isToPolish
            ? `Przetłumacz ten post z angielskiego na polski. Dostosuj do głosu @henryk0x:
- zawsze małe litery, bez kropek na końcu, bez emoji, bez hashtagów
- ">" jako bullet point
- NIGDY nie używaj "fam" — to fraza Django
- ton: casualowy ale merytoryczny, po polsku
- terminy crypto/AI zostaw po angielsku jeśli nie mają dobrego polskiego odpowiednika
- nie tłumacz dosłownie — adaptuj naturalnie do polskiego X

POST DO PRZETŁUMACZENIA:
"${post.post}"

ODPOWIEDZ TYLKO JSON: {"post": "przetłumaczony tekst", "category": "${mappedCategory}"}`
            : `Translate this post from Polish to English. Adapt to @django_xbt voice:
- always lowercase, no dots at end, no emoji, no hashtags
- ">" for bullet points
- use "fam" sparingly (only if it fits naturally)
- tone: casual mentor, crypto twitter native
- keep crypto/AI terms as-is
- don't translate literally — adapt naturally for English CT

POST TO TRANSLATE:
"${post.post}"

RESPOND ONLY with JSON: {"post": "translated text", "category": "${mappedCategory}"}` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "{}";
      const result = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (result.post) {
        const maxId = allPosts ? Math.max(0, ...allPosts.map(p => p.id)) + 1 : 1;
        const newPost = {
          id: maxId, tab: "DRAFT", category: result.category || mappedCategory,
          structure: post.structure || "", post: result.post,
          notes: `translated from ${account}`, score: "", howToFix: "", day: "",
          account: targetAccount, source: "translated", image_url: post.image_url || "",
          postLink: "", impressions: "", likes: "", engagements: "", bookmarks: "",
          replies: "", reposts: "", profileVisits: "", newFollows: "", urlClicks: "",
        };
        setAllPosts(prev => [...(prev || []), newPost]);
        if (supa) savePostsToSupa([newPost]);
        // Auto-score the translated post
        if (apiKey) setTimeout(() => autoScore(newPost.post, newPost.id, newPost.category, newPost.image_url), 500);
      }
    } catch (err) { alert("Translation error: " + err.message); }
    setTranslateLoading(null);
  };

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

  // Filtered + sorted posts — scoped to active account
  const accountPosts = allPosts ? allPosts.filter(p => (p.account || "@django_crypto") === account) : [];
  const tabPosts = accountPosts.filter(p => p.tab === activeTab);
  let sorted = [...tabPosts];
  if (sortBy === "mine-first") {
    sorted.sort((a, b) => {
      const aIsManual = a.source === "manual" ? 0 : 1;
      const bIsManual = b.source === "manual" ? 0 : 1;
      const aIsRewrite = (a.notes || "").startsWith("rewrite") ? 0 : 1;
      const bIsRewrite = (b.notes || "").startsWith("rewrite") ? 0 : 1;
      const aPri = Math.min(aIsManual, aIsRewrite);
      const bPri = Math.min(bIsManual, bIsRewrite);
      if (aPri !== bPri) return aPri - bPri;
      return parseFloat(b.score || 0) - parseFloat(a.score || 0);
    });
  }
  else if (sortBy === "category") sorted.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
  else if (sortBy === "score-desc") sorted.sort((a, b) => parseFloat(b.score || 0) - parseFloat(a.score || 0));
  else if (sortBy === "score-asc") sorted.sort((a, b) => parseFloat(a.score || 0) - parseFloat(b.score || 0));
  else if (sortBy === "impressions") sorted.sort((a, b) => parseInt(b.impressions || 0) - parseInt(a.impressions || 0));
  else if (sortBy === "day") {
    const D = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    sorted.sort((a, b) => (D.indexOf(a.day) < 0 ? 99 : D.indexOf(a.day)) - (D.indexOf(b.day) < 0 ? 99 : D.indexOf(b.day)));
  }

  const counts = {};
  STATUS_ORDER.forEach(t => { counts[t] = accountPosts.filter(p => p.tab === t).length; });

  const isUsed = activeTab === "USED", isBad = activeTab === "BAD",
    isPost = activeTab === "POST", isDraft = activeTab === "DRAFT", isDb = activeTab === "DATABASE";

  // Actions
  const movePost = (id, to) => {
    const post = (allPosts || []).find(x => x.id === id);
    setAllPosts(p => p.map(x => x.id === id ? { ...x, tab: to } : x));
    if (supa && post?._supaId) {
      supa.patch("posts", `id=eq.${post._supaId}`, { tab: to });
    } else if (supa && post?.post) {
      // Fallback: search by text
      supa.get("posts", `post=eq.${encodeURIComponent(post.post.slice(0, 80))}&limit=1`).then(rows => {
        if (rows?.[0]?.id) {
          supa.patch("posts", `id=eq.${rows[0].id}`, { tab: to });
          // Update local _supaId
          setAllPosts(p => p.map(x => x.id === id ? { ...x, _supaId: rows[0].id } : x));
        }
      }).catch(() => {});
    }
  };
  const delPost = (id) => {
    const post = (allPosts || []).find(x => x.id === id);
    setAllPosts(p => p.filter(x => x.id !== id));
    if (supa && post?._supaId) supa.del("posts", `id=eq.${post._supaId}`);
  };
  const deleteAllInTab = (tab) => {
    if (!confirm(`Delete ALL posts in ${tab}? This can't be undone.`)) return;
    setAllPosts(p => p.filter(x => x.tab !== tab));
    if (supa) supa.del("posts", `tab=eq.${tab}`);
  };
  const saveGoal = async (target, current) => {
    const t = Number(target) || 0, c = Number(current) || 0;
    setGoalTarget(t); setGoalCurrent(c);
    if (supa) {
      try {
        console.log(`🎯 Saving goal for ${account}: target=${t}, current=${c}`);
        const result = await supa.patch("goal", `account=eq.${account}`, { target_followers: t, current_followers: c, deadline: goalDeadline });
        console.log(`🎯 Goal patch result:`, result);
        // patch returns empty array if no rows matched — need to insert
        if (!result || (Array.isArray(result) && result.length === 0)) {
          console.log(`🎯 No existing goal row, inserting new...`);
          const ins = await supa.post("goal", [{ account, target_followers: t, current_followers: c, deadline: goalDeadline }]);
          console.log(`🎯 Goal insert result:`, ins);
        }
      } catch (err) {
        console.error(`🎯 Goal save error:`, err);
        try { await supa.post("goal", [{ account, target_followers: t, current_followers: c, deadline: goalDeadline }]); } catch {}
      }
    }
  };

  // Save weekly notes per account
  const saveWeeklyNotes = (text) => {
    setWeeklyNotes(text);
    const acctSlug = account.replace("@", "");
    if (supa) supa.upsert("settings", { key: `weekly_notes_${acctSlug}`, value: text }).catch(() => {});
  };

  // Save new posts to Supabase
  const savePostsToSupa = async (posts) => {
    if (!supa || !posts.length) return;
    try {
      const rows = posts.map(p => ({
        tab: p.tab, category: p.category, structure: p.structure, post: p.post,
        notes: p.notes, score: p.score, how_to_fix: p.howToFix || "", day: p.day || "",
        source: p.source || "", image_url: p.image_url || "",
        post_link: p.postLink || "", impressions: p.impressions || "", likes: p.likes || "",
        engagements: p.engagements || "", bookmarks: p.bookmarks || "", replies: p.replies || "",
        reposts: p.reposts || "", profile_visits: p.profileVisits || "", new_follows: p.newFollows || "",
        url_clicks: p.urlClicks || "", account: p.account || account,
      }));
      console.log(`💾 Saving ${rows.length} posts to Supabase (account: ${rows[0]?.account})...`);
      const saved = await supa.post("posts", rows);
      console.log(`💾 Supabase response:`, Array.isArray(saved) ? `${saved.length} rows` : saved);
      if (Array.isArray(saved)) {
        setAllPosts(prev => {
          const updated = [...(prev || [])];
          saved.forEach((s, i) => {
            const localPost = posts[i];
            const idx = updated.findIndex(p => p.id === localPost.id);
            if (idx >= 0) updated[idx] = { ...updated[idx], _supaId: s.id, id: s.id };
          });
          return updated;
        });
      }
    } catch (err) { console.error("Save error:", err); }
  };

  // Save ALL current posts to Supabase (initial import from Sheets)
  const saveAllToSupa = async () => {
    if (!supa || !allPosts) return;
    if (!confirm(`Import ${allPosts.length} posts to Supabase? This will replace any existing data.`)) return;
    setSaving(true);
    try {
      await supa.del("posts", "id=gt.0");
      const rows = allPosts.map(p => ({
        tab: p.tab, category: p.category, structure: p.structure, post: p.post,
        notes: p.notes, score: p.score, how_to_fix: p.howToFix || "", day: p.day || "",
        source: p.source || "", image_url: p.image_url || "",
        post_link: p.postLink || "", impressions: p.impressions || "", likes: p.likes || "",
        engagements: p.engagements || "", bookmarks: p.bookmarks || "", replies: p.replies || "",
        reposts: p.reposts || "", profile_visits: p.profileVisits || "", new_follows: p.newFollows || "",
        url_clicks: p.urlClicks || "", account: p.account || account,
      }));
      for (let i = 0; i < rows.length; i += 50) {
        const saved = await supa.post("posts", rows.slice(i, i + 50));
        if (Array.isArray(saved)) {
          setAllPosts(prev => {
            const updated = [...(prev || [])];
            saved.forEach((s, j) => { if (updated[i + j]) updated[i + j] = { ...updated[i + j], _supaId: s.id, id: s.id }; });
            return updated;
          });
        }
      }
      alert(`✅ ${rows.length} posts saved to Supabase!`);
    } catch (err) { alert("Error: " + err.message); }
    setSaving(false);
  };
  const setDay = (id, day) => {
    const post = (allPosts || []).find(x => x.id === id);
    setAllPosts(p => p.map(x => x.id === id ? { ...x, day } : x));
    if (supa && post?._supaId) supa.patch("posts", `id=eq.${post._supaId}`, { day });
  };
  const moveToBad = (id) => {
    const reason = prompt("Why is this post bad? (will be saved as feedback)");
    if (reason === null) return;
    const post = (allPosts || []).find(x => x.id === id);
    setAllPosts(p => p.map(x => x.id === id ? { ...x, tab: "BAD", notes: reason || "", howToFix: "" } : x));
    if (supa && post?._supaId) supa.patch("posts", `id=eq.${post._supaId}`, { tab: "BAD", notes: reason || "", how_to_fix: "" });
  };

  const addPost = async () => {
    if (!newPostText.trim()) return;
    const newId = allPosts ? Math.max(0, ...allPosts.map(p => p.id)) + 1 : 1;
    const newPost = {
      id: newId, tab: "DRAFT", category: newPostCat, structure: newPostStructure,
      post: newPostText.trim(), notes: "", score: "", howToFix: "", day: "",
      source: "manual", image_url: newPostImage.trim() || "", account: account,
      postLink: "", impressions: "", likes: "", engagements: "", bookmarks: "",
      replies: "", reposts: "", profileVisits: "", newFollows: "", urlClicks: "",
    };
    setAllPosts(p => [...(p || []), newPost]);
    setNewPostText(""); setNewPostCat(account === "@henryk0x" ? "market" : "growth"); setNewPostStructure(""); setNewPostImage(""); setShowAdd(false);
    // Save to Supabase and get real ID
    let supaId = null;
    if (supa) {
      try {
        const saved = await savePostsToSupa([newPost]);
        // savePostsToSupa updates state with _supaId internally
      } catch {}
    }
    // Auto-score - use small delay to let state update with _supaId
    if (apiKey) setTimeout(() => autoScore(newPost.post, newPost.id, newPost.category, newPost.image_url), 500);
  };

  // AI - auto score (runs automatically, saves score to post badge)
  const autoScore = async (text, pid, category, imageUrl) => {
    if (!apiKey || !text) return;
    try {
      // Build message content - text + optional image
      const promptText = `Score this django_xbt post 1-10 and explain briefly.

Post: "${text}"
Category: ${category || "unknown"}
${imageUrl ? "This post includes an attached image (shown above). Consider the image's quality, relevance, humor, and engagement potential in your scoring." : ""}

CRITERIA: voice authenticity, specificity, engagement potential, framework invisibility, pillar fit.
${imageUrl ? "VISUAL CRITERIA: image relevance to post, meme quality, visual engagement potential, screenshot value." : ""}
9-10: viral. 7-8: solid. 5-6: generic. 1-4: weak/AI.

Respond ONLY in JSON: {"score": 7.5, "notes": "subtopic: X · One sentence why this score + one concrete improvement suggestion"}`;

      let messageContent;
      if (imageUrl) {
        // Fetch image and convert to base64
        try {
          const imgRes = await fetch(imageUrl);
          const blob = await imgRes.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(",")[1]);
            reader.readAsDataURL(blob);
          });
          const mediaType = blob.type || "image/png";
          messageContent = [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: promptText }
          ];
        } catch {
          // If image fetch fails, score text only
          messageContent = promptText;
        }
      } else {
        messageContent = promptText;
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 300,
          messages: [{ role: "user", content: messageContent }],
        }),
      });
      const data = await res.json();
      const t = data.content?.[0]?.text || "";
      try {
        const parsed = JSON.parse(t.replace(/```json|```/g, "").trim());
        const scoreStr = String(parsed.score);
        const notesStr = parsed.notes || "";
        // Find post by text match (prefer unscored post with same text)
        setAllPosts(prev => {
          let idx = prev.findIndex(p => p.post === text && !p.score);
          if (idx < 0) idx = prev.findIndex(p => p.post === text);
          if (idx < 0) return prev;
          const post = prev[idx];
          // Save to Supabase
          if (supa && post._supaId) {
            supa.patch("posts", `id=eq.${post._supaId}`, { score: scoreStr, notes: notesStr });
          }
          const updated = [...prev];
          updated[idx] = { ...post, score: scoreStr, notes: notesStr };
          return updated;
        });
      } catch {}
    } catch (err) { console.error("AutoScore error:", err); }
  };

  // AI - explain post (triggered by Claude button, shows explanation)
  const askClaude = async (text, pid, category, imageUrl) => {
    if (!apiKey) { alert("Add Claude API key in Settings (⚙)"); return; }
    setAiLoading(pid);
    try {
      const promptText = `You are django_xbt's content strategist. Explain this post — why it works (or doesn't), what makes it strong, and one specific suggestion to improve it.

Post: "${text}"
Category: ${category || "unknown"}
${imageUrl ? "This post includes an attached image. Consider the image context in your analysis — how does it complement the text? Does the visual add engagement value?" : ""}

Be specific and constructive. Reference what's good about the voice, angle, or hook. If something feels off, say what and why. Keep it concise — 2-4 sentences max.

Respond ONLY in JSON: {"notes": "Your explanation here"}`;

      // Build message content — text only or text + image
      let content;
      if (imageUrl) {
        try {
          const imgRes = await fetch(imageUrl);
          const blob = await imgRes.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(",")[1]);
            reader.readAsDataURL(blob);
          });
          content = [
            { type: "image", source: { type: "base64", media_type: blob.type || "image/png", data: base64 } },
            { type: "text", text: promptText }
          ];
        } catch {
          content = promptText;
        }
      } else {
        content = promptText;
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 400,
          messages: [{ role: "user", content }],
        }),
      });
      const data = await res.json();
      const t = data.content?.[0]?.text || "";
      try { setAiResults(prev => ({ ...prev, [pid]: JSON.parse(t.replace(/```json|```/g, "").trim()) })); }
      catch { setAiResults(prev => ({ ...prev, [pid]: { notes: t } })); }
    } catch (err) { setAiResults(prev => ({ ...prev, [pid]: { notes: err.message } })); }
    finally { setAiLoading(null); }
  };

  // Rewrite post with user feedback
  const rewritePost = async (post) => {
    if (!apiKey) { alert("Add Claude API key in Settings"); return; }
    if (!rewriteFeedback.trim()) { alert("Write your feedback first"); return; }
    setRewriteLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 600,
          messages: [{ role: "user", content: `You are django_xbt. Rewrite this post based on the feedback below.

ORIGINAL POST:
"${post.post}"

CATEGORY: ${post.category}
STRUCTURE: ${post.structure}

USER FEEDBACK:
${rewriteFeedback}

VOICE RULES:
- always lowercase, no dots at end, no emojis, no hashtags, no em dashes
- use ">" for bullet points
- use "fam" sparingly and naturally (not every post needs it)
- sound like django, not AI
- be specific, opinionated, authentic

Keep the same category and general topic but apply the feedback. Write an improved version that stays close to the original intent.

Respond ONLY with JSON: {"post": "rewritten text", "structure": "Structure Name"}` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "{}";
      const version = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (version.post) {
        const maxId = allPosts ? Math.max(0, ...allPosts.map(p => p.id)) + 1 : 1;
        const newPost = {
          id: maxId, tab: "DRAFT", category: post.category,
          structure: version.structure || post.structure, post: version.post || "",
          notes: `rewrite of #${post.id}: "${rewriteFeedback.slice(0, 60)}"`,
          score: "", howToFix: "", day: "", account: account,
          postLink: "", impressions: "", likes: "", engagements: "", bookmarks: "",
          replies: "", reposts: "", profileVisits: "", newFollows: "", urlClicks: "",
        };
        setAllPosts(prev => {
          // Remove original post, add rewrite
          const filtered = (prev || []).filter(p => p.id !== post.id);
          return [newPost, ...filtered];
        });
        // Delete original from Supabase
        if (supa && post._supaId) supa.del("posts", `id=eq.${post._supaId}`);
        if (supa) savePostsToSupa([newPost]);
        // Auto-score rewrite
        await new Promise(r => setTimeout(r, 1500));
        autoScore(newPost.post, newPost.id, newPost.category);
      }
      setRewriteId(null);
      setRewriteFeedback("");
    } catch (err) { alert("Error: " + err.message); }
    setRewriteLoading(false);
  };

  // Fix post - grammar, style, translate to English, Django voice
  const fixPost = async (post) => {
    if (!apiKey) { alert("Add Claude API key in Settings"); return; }
    setFixLoading(post.id);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 800,
          messages: [{ role: "user", content: `You are django_xbt. Fix this post.

ORIGINAL POST:
"${post.post}"

CATEGORY: ${post.category}

INSTRUCTIONS:
- fix grammar and stylistic errors
- translate to English if needed — make it sound natural and logical in English
- use Django's voice: lowercase, no dots at end, no emojis, no hashtags, no em dashes, use ">" for bullets, "fam" sparingly - max 1 in 5 posts
- only make minor improvements UNLESS you think a better hook or engagement trick would significantly improve it
- if adding a hook or twist, keep the original message intact
- keep the same length roughly — don't expand unnecessarily
- the fixed version should feel like a polished version of the original, not a rewrite

Respond ONLY with JSON: {"post": "fixed text", "changes": "brief note what you changed (1 sentence)"}` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (parsed.post) {
        // Replace the post text directly
        setAllPosts(prev => (prev || []).map(p => p.id === post.id ? { ...p, post: parsed.post, notes: (p.notes ? p.notes + " | " : "") + "fixed: " + (parsed.changes || "").slice(0, 80) } : p));
        if (supa && post._supaId) {
          supa.patch("posts", `id=eq.${post._supaId}`, { post: parsed.post, notes: (post.notes ? post.notes + " | " : "") + "fixed: " + (parsed.changes || "").slice(0, 80) });
        }
        // Re-score
        setTimeout(() => autoScore(parsed.post, post.id, post.category), 300);
      }
    } catch (err) { alert("Fix error: " + err.message); }
    setFixLoading(null);
  };

  const saveEdit = (pid, newText) => {
    setAllPosts(prev => (prev || []).map(p => p.id === pid ? { ...p, post: newText } : p));
    if (supa) {
      const post = (allPosts || []).find(p => p.id === pid);
      if (post) savePostsToSupa([{ ...post, post: newText }]);
    }
    setEditingId(null);
    setEditText("");
  };

  // Brand voice upload
  const handleBrandVoice = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setBrandVoice(text);
      const acctSlug = account.replace("@", "");
      if (supa) supa.upsert("settings", { key: `brand_voice_${acctSlug}`, value: text });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Generate weekly content
  const generateWeekly = async () => {
    if (!apiKey) { alert("Add Claude API key in Settings (⚙)"); return; }
    if (!brandVoice) { alert("Upload brand voice .txt first"); return; }
    setGenLoading(true);

    // Collect BAD tab feedback
    const badPosts = accountPosts.filter(p => p.tab === "BAD");
    const badFeedback = badPosts.slice(0, 10).map(p => `POST: "${p.post.slice(0, 100)}"\nWHY BAD: ${p.notes}`).join("\n---\n");

    // Trim brand voice
    const bvTrimmed = brandVoice.slice(0, 6000);

    // ═══════════════════════════════════════
    // CONDENSED ADVISOR KNOWLEDGE BASES
    // ═══════════════════════════════════════

    const isHenryk = account === "@henryk0x";

    const EXAMPLE_POSTS = isHenryk ? `PRZYKŁADOWE POSTY HENRYKA (studiuj ton, długość, słownictwo — WSZYSTKO PO POLSKU):

[growth] "ile da się zarobić na prowadzeniu portali społecznościowych? najlepszym dowodem będzie twój personalny profil. na podstawowe stanowiska wynagrodzenie to około 1200-1500 USD na miesiąc. bez publiki nawet najlepszy produkt jest mało warty"
[market] "krypto zmieniło się nieodwracalnie. kapitał jest rozlany. potrzebna jest bardzo duża, bezpośrednia presja zakupowa. tylko nowe narracje, które dostają zastrzyk kapitału spekulacyjnego. hype na narrację trwa zwykle 1-4 tygodnie i koniec"
[market] "większość ludzi nie traci pieniędzy, bo są głupi. tracą je, bo mają słabą głowę. lęk, nadmiar myśli, uzależnienie od dopaminy, zero kontroli nad emocjami. napraw głowę, zanim dotkniesz kapitału"
[shitpost] "lista terminów z którymi musisz się zapoznać żeby przetrwać 26: > atl - all time low > scam - crypto > fiat - nie lambo > bottom - jeszcze nie > 9to5 - twoja nowa rutyna"
[busting] "bracie, 15 godzin temu wołałeś dno crypto. coś się zmieniło? możesz się zdecydować jaki jest twój statement? czy może nie masz pojęcia i po prostu farmujesz uwagę?"
[lifestyle] "chodzenie na siłownię to kwintesencja kapitalizmu. nikt ci nie da wyniku za darmo. nie ma drogi na skróty. ból to jedyna waluta którą kupujesz wynik"
[ai] "panuje kompletna ignorancja co do AI. w dwie osoby są w stanie wykonywać zadania które wykonywało 10 osób. myślę że do 2-3 lat stracę całkowicie biznes. nie widzę innego rozwiązania"
[lifestyle] "w polsce naprawdę mamy się bardzo dobrze. na tle europy, często wręcz świetnie. narzekamy na wszystko. a jednocześnie doganiamy zachód szybciej, niż zachód się rozwija"` : `EXAMPLE DJANGO POSTS (study tone, length, vocabulary):

[growth] "next time someone tells you stealing a post is a thing - do yourself a favor and mute this fella. if you want to be average - sure, go for it. but if you are here to play a long term game - you should avoid being like everyone else at all costs"
[growth] "locked in more than ever. time for a deep clean of inactive accounts that won't make it (quitoooors). i'm putting together a list of true onchain, web3 independent thinkers over the weekend. who wants in? drop your handle below"
[market] "not catching falling knives. we're not there yet - let's wipe out the leveraged traders first. then i'll consider longs around 74-76k. no fomo approach whatsoever. zen is my second name. stay safe fam"
[market] "hot take: bear market is awesome. people feel frustrated now, but when you think about it - these crashes are a gift. thanks to them, you get a chance to buy coins cheap and sell them high. isn't that why we're all here?"
[shitpost] "the list of 8 things you can do now instead of writing infofi slop: > read a book about estonia > reply gm 500 times > visit tallinn > write an article no one will care about > learn estonian > write an article in estonian > watch curling > make up your own #8"
[shitpost] "crypto vocabulary update: > DYOR - reading one tweet and going all in > long term hold - i'm down 80% and can't sell > community - 47 bots and a dog > alpha - information that was alpha 3 weeks ago > not financial advice - financial advice"
[busting] "bro, 15 hours ago you were calling 'the crypto bottom'. something changed? can you decide what's your statement? or maybe you have no idea and you're just farming attention by posting whatever comes to your mind?"
[lifestyle] "100 days ago i chose freedom and stopped smoking. quitting the worst addiction i've ever had turned out to be the best investment i made last year. no return from this point, django is a free man now!"
[gm] "gm and happy wednesday to everyone except: 1) those who don't say gm back 2) those who spam others' dms with 'let's connect' 3) kickz. see you on the timeline, xoxo"`;

    const GROWTH_ADVISOR = `GROWTH ADVISOR (apply 1-2 frameworks per post, INVISIBLY - never name them):
- Volume Negates Luck: the gap isn't 2x, it's 100x. 7 posts/week vs 80. 50 replies vs 2200
- More→Better→New: first do MORE of what works, then optimize, only then try new. 90% existing, 10% new
- Give Away Secrets, Sell Implementation: free content better than competitors' paid. reciprocity forces returns
- How I vs How To: "here's what I did" > "you should do X". authority from DOING not teaching
- Value Equation: Value = Dream Outcome × Likelihood / Time × Effort. increase top, decrease bottom
- Nail It Then Scale It: 1 product, 1 avatar, 1 channel first. most try to scale what isn't nailed
- Optimize Front to Back: 80% effort on first 5 seconds / headline / hook. 10x effort on hook, 1x rest
- Rule of 100: 100 primary actions/day. most people think they're grinding at 2%
- State Facts, Tell Truth: track results → state them truthfully. data = unshakable. no data = noise
- Do Epic Stuff, Talk About It: step 1 = do interesting things, step 2 = talk about them. most skip step 1

WEB3 MARKETING (Leon Abboud):
- Three Buyer Personas: X-Collector (follows influencers), Finney (smart money, patient), Z-Money (degen, flip fast)
- Finney's 4 Signals: qualified team + sustainable model + social proof + profit potential
- Bear Market = Build Market: show innovation, publish research, be transparent. survivors win`;

    const TRADING_ADVISOR = `TRADING ADVISOR (Xpreay psychology - embed in ALL market posts):
- Strategy = 10%, Psychology = 90%. free strategies exist everywhere. WHO uses it matters, not WHICH
- Losses Are Tax, Not Failure. cost of business. hunter doesn't find game every day, still goes out
- Sniper, Not Machine Gun: right location, right conditions, one shot. patience + selectivity = edge
- Wealth Flows from Impatient to Patient. applies to day trading AND long-term
- Adapt Market to You: wait for YOUR setup. if it doesn't appear, do nothing. market owes you nothing today
- Casino Manager Mindset: trade like casino, not gambler. edge over 10,000 hands, not single outcome
- One Loss = Stop for Day: after one loss, chances drop dramatically. fresh mindset = 90% of success
- Treat Wins and Losses Same: emotional neutrality = consistency. flat emotional line → better decisions
- Perfectionism = Trading Killer: moving stop losses, not taking profits, forcing trades
- Probability Mindset: trying to predict future from chaos. being right 25% on EUR/USD = impressive`;

    const HUMOR_ADVISOR = `HUMOR STRUCTURES (use 1 random structure for 2 out of 7 shitposts, score 1-10):
1. Fact→Absurd Conclusion: real fact, logically sound but unexpected conclusion
2. X vs Y Self-Deprecating: impressive thing vs how we/CT/retail actually does it
3. Escalation/Spiral: mild observation → each point goes further → absurdly far at end
4. List That Breaks: normal list, last item is absurd but written in same serious tone
5. False Authority/Expert Parody: deadly serious advice that's painfully obvious or useless
6. Expectation Reversal: build sentence in one direction, swerve completely at end
7. Dictionary/Redefinition: well-known term + cynical "real" definition
8. Analogy from Absurd Source: explain crypto using completely unrelated field
9. Fake Story/Bait-and-Switch: credible story setup → punchline undermines everything
10. Exaggerated Precision: unnecessarily precise number where nobody expects it
11. Meta-Humor: comment on the post itself or process of writing it
12. Callback: reference something said earlier in same post with new funny meaning

RULES: humor must be lowercase, casual, self-deprecating > mocking others, smart > vulgar. if joke needs explanation, kill it`;

    const MARKETING_KB = `MARKETING FRAMEWORKS (use naturally in growth posts):
- Blue Ocean: stop competing, create uncontested space. Four Actions: Eliminate, Reduce, Raise, Create
- Cialdini 7: Reciprocity, Commitment/Consistency, Social Proof, Authority, Liking, Scarcity, Unity
- Purple Cow (Godin): being safe = invisible. remarkable = survival. "fitting in is failing"
- StoryBrand: customer = hero, you = guide. sell internal problem not external
- Contagious (STEPPS): Social Currency, Triggers, Emotion, Public, Practical Value, Stories
- 22 Laws: be first > be better. own a word in mind. law of opposite. law of hype = opposite true
- Hook-Story-Offer (Brunson): attention → connection → conversion. attractive character has flaws
- Godfather Offer (Hormozi): so good they feel stupid saying no. Value = Dream×Likelihood / Time×Effort`;

    // ═══════════════════════════════════════
    // BATCH DEFINITIONS WITH SUBTOPICS
    // ═══════════════════════════════════════

    const batches = isHenryk ? [
      {
        category: "market", count: 13,
        subtopics: ["analiza rynku crypto", "tłumaczenie zagranicznych newsów", "mentalność tradera", "dlaczego projekty upadają", "scamy i manipulacje", "no fomo approach", "cierpliwość", "nowe narracje i trendy", "porównanie crypto vs tradycyjne aktywa", "komentarz do wydarzeń rynkowych", "czym różni się ten cykl", "płynność i struktura rynku"],
        structures: ["Hook → Body → Conclusion", "Breakdown / Analysis", "Contrarian View", "Single Insight", "Observation → Pattern", "Comparison / VS", "Question → Answer"],
        advisor: `MARKET: tłumacz i komentuj międzynarodowe newsy crypto dla polskiej publiki. bądź racjonalny, bez hype, punktuj scamy. NIE robimy analizy technicznej ani trade setupów - komentujemy newsy, trendy, mentalność.`,
      },
      {
        category: "busting", count: 6,
        subtopics: ["scamy i fałszywe projekty", "fałszywi prorocy i flip-floperzy", "ludzka głupota w internecie", "AI slop i złe treści", "polityka i absurdy świata"],
        structures: ["Controversy / Hot Take", "Breakdown / Analysis", "Contrarian View", "Observation → Pattern", "Myth Busting"],
        advisor: "BUSTING: punktuj głupotę, scamy, fałszywych proroków. bezpośrednio, z dowodami. agresywny ton, ale oparty na faktach. 'doktor rehabilitowany kryptografii' energy.",
      },
      {
        category: "shitposting", count: 6,
        subtopics: ["reakcje na bieżące wydarzenia", "obserwacje ze świata", "żarty z internetu i kultury", "komentarze do polityki (lekkie)", "absurdy codzienności"],
        structures: ["Controversy / Hot Take", "Single Insight", "Observation → Pattern", "Comparison / VS", "Myth Busting"],
        advisor: `${HUMOR_ADVISOR}\n\nAPPLY: 2 out of 6 posts MUST use a humor structure (randomly pick). lekki ton, zabawne obserwacje. NIE agresywne jak busting — tu się bawimy.`,
      },
      {
        category: "growth", count: 6,
        subtopics: ["rozwój profilu na X", "budowanie marki osobistej", "strategie replying", "storytelling i hooki", "zarabianie w web3", "marketing i pozycjonowanie"],
        structures: ["Problem → Solution", "Story / Narrative", "Listicle", "Framework / System", "Mindset Shift", "Contrarian View"],
        advisor: `${GROWTH_ADVISOR}\n\n${MARKETING_KB}\n\nAPPLY: ~40% of posts should use a framework INVISIBLY. NIGDY nie nazywaj frameworka.`,
      },
      {
        category: "ai", count: 6,
        subtopics: ["AI zastępuje pracowników", "praktyczne narzędzia AI", "przyszłość marketingu z AI", "zagrożenia AI dla biznesu", "jak przygotować się na AI", "AI monopolizacja platform"],
        structures: ["Hook → Body → Conclusion", "Story / Narrative", "Contrarian View", "Single Insight", "Breakdown / Analysis", "Prediction / Forecast"],
        advisor: "AI: pokazuj praktyczne zastosowania, dyskutuj wpływ na rynek pracy. balansuj ekscytację z realistycznymi obawami. ton preppersa - 'przygotuj się teraz, zanim będzie za późno'.",
      },
      {
        category: "lifestyle", count: 5,
        subtopics: ["biohacking i sen", "sport i siłownia", "motywacja i mindset", "polska jest piękna", "zdrowie jako priorytet"],
        structures: ["Story / Narrative", "Single Insight", "Observation → Pattern", "Mindset Shift"],
        advisor: "LIFESTYLE: osobisty, autentyczny, praktyczny. nie wymuszony optymizm. pokaż pasje, zdrowy tryb życia, dumę z Polski.",
      },
    ] : [
      {
        category: "growth", count: 17,
        subtopics: ["growing X account", "X analytics progress", "X algorithm tips", "marketing frameworks", "building personal brand", "importance of visuals", "replying strategies", "storytelling", "making money in web3", "writing/copywriting", "AI and automation", "cold reach and BD", "productivity hacks", "learning tips", "importance of uniqueness"],
        structures: ["Problem → Solution", "Tutorial / How-to", "Listicle", "Framework / System", "Hook → Body → Conclusion", "Story / Narrative", "Before → After", "Mindset Shift", "Mistake → Lesson", "Question → Answer", "Case Study", "Contrarian View", "Single Insight"],
        advisor: `${GROWTH_ADVISOR}\n\n${MARKETING_KB}\n\nAPPLY: ~40% of posts should use a framework INVISIBLY. mix Hormozi (general) and Abboud (web3). NEVER name the framework.`,
      },
      {
        category: "market", count: 6,
        subtopics: ["market analysis", "potential trade setups", "trading mentality", "winner mentality", "technical analysis simplified", "long-term game", "risk management", "no fomo approach", "patience"],
        structures: ["Hook → Body → Conclusion", "Data Dump / Research", "Framework / System", "Prediction / Forecast", "Breakdown / Analysis", "Contrarian View", "Single Insight", "Observation → Pattern"],
        advisor: `${TRADING_ADVISOR}\n\nAPPLY: ALL market posts must embed Xpreay trading psychology as backbone. show genuine market understanding. balance conviction with humility (probability mindset). NEVER sound like a trading course.`,
      },
      {
        category: "lifestyle", count: 6,
        subtopics: ["healthy food/carnivore/keto", "mentality of a winner", "sports (running/gym/tennis)", "passion (travel/music/groundhopping)", "quitting smoking milestones", "yerba mate lifestyle", "travel tips", "learning Spanish"],
        structures: ["Story / Narrative", "Question → Answer", "Mistake → Lesson", "Single Insight", "Before → After", "Mindset Shift"],
        advisor: "LIFESTYLE: show personality, help audience identify with django. showcase healthy lifestyle, passions, beauty of life. motivational but real, not fake positivity.",
      },
      {
        category: "busting", count: 6,
        subtopics: ["bad content and AI slop", "scam profiles and shillers", "attention whores", "false prophets who flip-flop", "scam projects and rugs"],
        structures: ["Myth Busting", "Controversy / Hot Take", "Data Dump / Research", "Contrarian View", "Observation → Pattern", "Breakdown / Analysis"],
        advisor: "BUSTING: point out bad content, catch liars, showcase human stupidity. be direct, controversial, honest. use evidence. 'volunteer sheriff's deputy' energy. never punch down on small accounts.",
      },
      {
        category: "shitposting", count: 7,
        subtopics: ["reactions to crypto news", "teasing CT culture", "smart observations", "jokes using humor structures", "random vibes/internet culture"],
        structures: ["Controversy / Hot Take", "Myth Busting", "Single Insight", "Observation → Pattern", "Comparison / VS"],
        advisor: `${HUMOR_ADVISOR}\n\nAPPLY: 2 out of 7 posts MUST use a humor structure (randomly pick). tag which structure used. other 5 are standard hot takes/observations. score each humor post 1-10, if below 7 mark for rewrite.`,
      },
    ];

    const newPosts = [];
    const maxId = allPosts ? Math.max(0, ...allPosts.map(p => p.id)) : 0;
    let idCounter = maxId + 1;

    for (const batch of batches) {
      setGenProgress(`Generating ${batch.category}... (${batch.count} posts)`);

      const subtopicList = batch.subtopics.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const structList = batch.structures.map((s, i) => `${i + 1}. ${s}`).join("\n");

      const prompt = isHenryk ? `Jesteś henryk0x — ekspert od marketingu, entuzjasta AI, twórca na polskim X.

TWÓJ BRAND VOICE:
${bvTrimmed}

${EXAMPLE_POSTS}

═══ KATEGORIA: ${batch.category.toUpperCase()} ═══

SUBTOPIKI (ROTUJ — każdy post inny subtopic):
${subtopicList}

DOSTĘPNE STRUKTURY POSTÓW (różnicuj):
${structList}

═══ ADVISOR SYSTEM ═══
${batch.advisor}

${badFeedback ? `═══ POSTY KTÓRE NIE ZADZIAŁAŁY (unikaj tych wzorców) ═══\n${badFeedback}\n` : ""}
${weeklyNotes ? `═══ NOTATKI TYGODNIOWE OD HENRYKA (stosuj się) ═══\n${weeklyNotes}\n` : ""}
${lastAnalysis ? `═══ ANALIZA AI Z OSTATNIEGO TYGODNIA (zastosuj wnioski) ═══\n${lastAnalysis.slice(0, 1500)}\n` : ""}

═══ ZADANIE ═══
Wygeneruj dokładnie ${batch.count} oryginalnych postów dla filaru "${batch.category}".

KRYTYCZNE ZASADY:
- ZAWSZE PISZ PO POLSKU (wyjątek: crypto/AI terminy bez polskiego odpowiednika)
- zawsze małe litery (nigdy caps, chyba że celowo)
- bez kropek na końcu zdań, bez em dashes, bez emoji, bez hashtagów
- ">" jako bullet point w listach
- NIGDY nie używaj "fam" — to fraza Django, nie Henryka
- sporadycznie używaj "kłaniam się nisko" jako zakończenie (max 1 na 10 postów)
- ROTUJ subtopiki — każdy post INNY subtopic
- ZMIENIAJ struktury — nie powtarzaj tej samej dwa razy z rzędu
- ROZKŁAD DŁUGOŚCI: dokładnie 50% postów MUSI być poniżej 280 znaków (krótkie). reszta 300-700 znaków
- brzmi jak henryk napisał to o 2 w nocy, nie jak AI to wygenerowało
- bądź konkretny, stanowczy, bezpośredni — żadnych generycznych porad
- dziel się osobistym doświadczeniem gdy pasuje

ODPOWIEDZ TYLKO poprawnym JSON:
[{"post": "treść posta po polsku", "structure": "Nazwa struktury", "subtopic": "użyty subtopic"${batch.category === "shitposting" ? ', "humor_structure": "name or null", "humor_score": 0' : ""}}]`
      : `You are django_xbt — crypto trader, AI enthusiast, personal brand builder on Twitter/X.

YOUR BRAND VOICE:
${bvTrimmed}

${EXAMPLE_POSTS}

═══ CATEGORY: ${batch.category.toUpperCase()} ═══

SUBTOPICS (ROTATE across all — each post different subtopic):
${subtopicList}

AVAILABLE POST STRUCTURES (vary across posts):
${structList}

═══ ADVISOR SYSTEM ═══
${batch.advisor}

${badFeedback ? `═══ POSTS THAT FAILED (avoid these patterns) ═══\n${badFeedback}\n` : ""}
${weeklyNotes ? `═══ WEEKLY NOTES FROM DJANGO (follow these directions) ═══\n${weeklyNotes}\n` : ""}
${lastAnalysis ? `═══ LAST WEEK'S AI ANALYSIS (apply these insights) ═══\n${lastAnalysis.slice(0, 1500)}\n` : ""}

═══ TASK ═══
Generate exactly ${batch.count} original posts for the "${batch.category}" pillar.

CRITICAL RULES:
- always lowercase (never caps except proper nouns or intentional emphasis)
- no dots at end of sentences, no em dashes, no emojis, no hashtags
- use ">" for bullet points in lists
- use "fam" sparingly - max 1 in 5 posts, never forced, not forced
- ROTATE subtopics — each post DIFFERENT subtopic (no repeats)
- VARY structures — don't use same structure twice in a row
- LENGTH DISTRIBUTION: exactly 50% of posts MUST be under 280 characters (short, punchy). the other 50% should be 300-700 characters (detailed breakdowns, stories, lists). alternate between short and long
- FAM USAGE: use "fam" in maximum 20% of posts (about 8 out of 42). most posts should NOT contain "fam". it's a signature, not a crutch
- sound like django wrote this at 2am, not like AI generated it
- be specific, opinionated, direct — no generic advice
- share personal experience when relevant ("i did X" not "you should X")
- if using a framework/advisor, it must be INVISIBLE — never name it

RESPOND ONLY with valid JSON array:
[{"post": "the actual post text", "structure": "Structure Name", "subtopic": "subtopic used"${batch.category === "shitposting" ? ', "humor_structure": "name or null", "humor_score": 0' : ""}}]`;

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || "[]";
        try {
          const posts = JSON.parse(text.replace(/```json|```/g, "").trim());
          for (const p of posts) {
            const humorNote = p.humor_structure ? `humor: ${p.humor_structure} (${p.humor_score}/10)` : "";
            newPosts.push({
              id: idCounter++, tab: "DRAFT", category: batch.category,
              structure: p.structure || "", post: p.post || "",
              notes: humorNote || `subtopic: ${p.subtopic || ""}`,
              score: p.humor_score ? String(p.humor_score) : "", howToFix: "", day: "",
              account: account,
              postLink: "", impressions: "", likes: "", engagements: "", bookmarks: "",
              replies: "", reposts: "", profileVisits: "", newFollows: "", urlClicks: "",
            });
          }
        } catch { setGenProgress(`Error parsing ${batch.category} response`); }
      } catch (err) { setGenProgress(`Error generating ${batch.category}: ${err.message}`); }
    }

    if (newPosts.length > 0) {
      setGenProgress(`${newPosts.length} posts generated. Scoring...`);

      // Score in batches of 10
      for (let i = 0; i < newPosts.length; i += 10) {
        const scoreBatch = newPosts.slice(i, i + 10);
        const postsText = scoreBatch.map((p, j) => `${i + j + 1}. [${p.category}/${p.notes}] "${p.post.slice(0, 200)}"`).join("\n");
        setGenProgress(`Scoring ${i + 1}-${Math.min(i + 10, newPosts.length)}...`);

        try {
          const res2 = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514", max_tokens: 2000,
              messages: [{ role: "user", content: isHenryk ? `Jesteś strategiem treści henryk0x. Oceń te posty.

KRYTERIA:
- Czy brzmi jak henryk napisał to? (autentyczność głosu, PO POLSKU)
- Czy jest konkretny i stanowczy? (nie generyczne porady)
- Czy zaangażuje polską publiczność na X? (potencjał viralowy)
- Czy framework jest niewidzialny? (naturalny)
- Dla shitpostów z humor structures: czy jest naprawdę śmieszny?

SKALA:
- 9-10: wyjątkowy, do screenshotowania
- 7-8: solidne zaangażowanie, mocny take
- 5-6: okej ale mógłby być czyikolwiek postem
- 1-4: generyczny, brzmi jak AI

POSTY:
${postsText}

ODPOWIEDZ TYLKO JSON:
[{"score": 7.5, "feedback": "krótki feedback po polsku + sugestia poprawy"}]`
              : `You are django_xbt's content strategist and honest critic. Score these posts.

SCORING CRITERIA:
- Does it sound like django actually wrote this? (voice authenticity)
- Is it specific and opinionated? (not generic advice anyone could write)
- Would it get engagement on crypto Twitter? (viral potential)
- Is the framework/advisor thinking invisible? (should feel natural)
- For shitposts with humor structures: is it actually funny? would someone screenshot this?

SCORE:
- 9-10: exceptional, screenshot-worthy, would go viral
- 7-8: solid engagement, strong authentic take
- 5-6: decent but could be anyone's post, needs more django personality
- 1-4: generic, sounds like AI, or misses the voice entirely

POSTS:
${postsText}

RESPOND ONLY with JSON array, one per post in order:
[{"score": 7.5, "feedback": "brief specific feedback + improvement suggestion"}]` }],
            }),
          });
          const data2 = await res2.json();
          const text2 = data2.content?.[0]?.text || "[]";
          try {
            const scores = JSON.parse(text2.replace(/```json|```/g, "").trim());
            scores.forEach((s, j) => {
              if (scoreBatch[j]) {
                scoreBatch[j].score = String(s.score || "");
                scoreBatch[j].notes = (scoreBatch[j].notes ? scoreBatch[j].notes + " · " : "") + (s.feedback || "");
              }
            });
          } catch {}
        } catch {}
      }

      setAllPosts(prev => [...(prev || []), ...newPosts]);
      setGenProgress(`done — ${newPosts.length} posts generated & scored → DRAFT`);
      setActiveTab("DRAFT");
      setSortBy("score-desc");
      if (supa) {
        try { await savePostsToSupa(newPosts); console.log(`✅ ${newPosts.length} posts saved to Supabase`); }
        catch (err) { console.error("❌ Failed to save posts:", err); setGenProgress(`⚠ ${newPosts.length} posts generated but Supabase save failed`); }
      }
    } else {
      setGenProgress("no posts generated — check API key and try again");
    }
    setGenLoading(false);
  };

  const sortOpts = isUsed
    ? [{ v: "default", l: "Default" }, { v: "impressions", l: "Impressions ↓" }]
    : isPost
    ? [{ v: "default", l: "Default" }, { v: "day", l: "Day of Week" }, { v: "category", l: "Category" }, { v: "score-desc", l: "Score ↓" }]
    : [{ v: "mine-first", l: "✍ Mine First" }, { v: "default", l: "Default" }, { v: "category", l: "Category" }, { v: "score-desc", l: "Score ↓" }, { v: "score-asc", l: "Score ↑" }];

  const sel = { background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", cursor: "pointer" };

  if (!allPosts) return <div style={{ textAlign: "center", padding: 60 }}><LoadingDots /></div>;

  return (
    <div>
      {/* Top bar + GOAL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>{accountPosts.length} posts · {account} · {supa ? "supabase" : "local mode"}</div>
          {supa && <Dot color={T.green} pulse />}
          {saving && <Badge color={T.amber}>saving...</Badge>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
            {sortOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          {supa && <Btn small color={T.purple} onClick={saveAllToSupa} disabled={saving}>💾 Save All to Supabase</Btn>}
          <Btn small color={T.cyan} onClick={reloadFromSheets} disabled={loading}>↻ Reload Sheets</Btn>
        </div>
      </div>

      {/* Weekly Notes + Generator + GOAL row */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📋</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Weekly Notes</span>
            <span style={{ fontSize: 10, color: T.textDim }}>feedback & direction for next batch</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {weeklyNotesSaving && <span style={{ fontSize: 10, color: T.green }}>✓ saved</span>}
            <Btn small outline onClick={() => { if (confirm("Clear weekly notes?")) { setWeeklyNotes(""); const acctSlug = account.replace("@", ""); if (supa) supa.patch("settings", `key=eq.weekly_notes_${acctSlug}`, { value: "" }); } }}>Clear</Btn>
          </div>
        </div>
        <textarea value={weeklyNotes} onChange={e => { setWeeklyNotes(e.target.value); weeklyNotesTimer.current && clearTimeout(weeklyNotesTimer.current); weeklyNotesTimer.current = setTimeout(() => { const acctSlug = account.replace("@", ""); if (supa) { supa.upsert("settings", { key: `weekly_notes_${acctSlug}`, value: e.target.value }).then(() => { setWeeklyNotesSaving(true); setTimeout(() => setWeeklyNotesSaving(false), 2000); }); } }, 1000); }}
          placeholder="what worked last week? what didn't? what topics to focus on? any specific direction for next batch..."
          style={{ width: "100%", minHeight: 70, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical", lineHeight: 1.6, outline: "none", boxSizing: "border-box" }}
          onFocus={e => e.target.style.borderColor = T.amber} onBlur={e => e.target.style.borderColor = T.border} />
        {lastAnalysis && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: T.textDim, cursor: "pointer" }}>📊 Last AI Analysis (auto-attached to generation)</summary>
            <div style={{ fontSize: 11, color: T.textSoft, lineHeight: 1.5, marginTop: 6, padding: 8, background: T.bg2, borderRadius: 6, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>{lastAnalysis}</div>
          </details>
        )}
      </Card>

      {/* Generator + GOAL row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-start" }}>
        {/* Generator */}
        <Card style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>🤖</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Weekly Content Generator</span>
              {brandVoice && <Badge color={T.green}>Brand voice loaded</Badge>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {!brandVoice && (
                <label style={{ cursor: "pointer" }}>
                  <input type="file" accept=".txt" onChange={handleBrandVoice} style={{ display: "none" }} />
                  <Btn small color={T.cyan} style={{ pointerEvents: "none" }}>📄 Upload Brand Voice .txt</Btn>
                </label>
              )}
              {brandVoice && (
                <label style={{ cursor: "pointer" }}>
                  <input type="file" accept=".txt" onChange={handleBrandVoice} style={{ display: "none" }} />
                  <Btn small outline style={{ pointerEvents: "none" }}>↻ Update Voice</Btn>
                </label>
              )}
              <Btn small color={T.green} disabled={genLoading || !brandVoice || !apiKey} onClick={generateWeekly}>
                {genLoading ? "⏳ Generating..." : "⚡ Generate 42 Posts"}
              </Btn>
            </div>
          </div>
          {genProgress && <div style={{ marginTop: 8, fontSize: 11, color: genProgress.startsWith("✅") ? T.green : genProgress.startsWith("❌") ? T.red : T.textSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{genProgress}</div>}
          {!apiKey && <div style={{ marginTop: 6, fontSize: 10, color: T.amber }}>⚠ Add Claude API key in Settings first</div>}
        </Card>

        {/* GOAL Card — square, top-right */}
        <Card style={{ width: 240, minHeight: 150, flexShrink: 0, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontFamily: "'Satoshi', sans-serif", letterSpacing: "-.02em" }}>🎯 GOAL</div>
              <div style={{ fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>jan 1, 2027</div>
            </div>
            <Btn small outline onClick={() => setShowGoalEdit(!showGoalEdit)}>✎</Btn>
          </div>
          {showGoalEdit ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 9, color: T.textSoft, marginBottom: 2 }}>CURRENT</div>
                <input type="number" value={goalCurrent} onChange={e => saveGoal(goalTarget, parseInt(e.target.value) || 0)}
                  style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 6px", color: T.text, fontSize: 11, width: 80, fontFamily: "'IBM Plex Mono', monospace", outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: T.textSoft, marginBottom: 2 }}>TARGET</div>
                <input type="number" value={goalTarget} onChange={e => saveGoal(parseInt(e.target.value) || 20000, goalCurrent)}
                  style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 6px", color: T.text, fontSize: 11, width: 80, fontFamily: "'IBM Plex Mono', monospace", outline: "none" }} />
              </div>
              <Btn small color={T.green} onClick={() => setShowGoalEdit(false)}>✓</Btn>
            </div>
          ) : (() => {
            const pct = goalTarget > 0 ? Math.min(100, (goalCurrent / goalTarget) * 100) : 0;
            const remaining = Math.max(0, goalTarget - goalCurrent);
            const now = new Date();
            const end = new Date(goalDeadline);
            const daysLeft = Math.max(1, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
            const perDay = remaining > 0 ? Math.ceil(remaining / daysLeft) : 0;
            const perWeek = perDay * 7;
            const onTrack = perDay <= 30;
            return (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: T.cyan, fontFamily: "'Satoshi', sans-serif" }}>{remaining.toLocaleString()}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textSoft }}>LEFT</span>
                </div>
                <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8 }}>
                  {goalCurrent.toLocaleString()} / {goalTarget.toLocaleString()} · {pct.toFixed(1)}%
                </div>
                <div style={{ height: 5, background: T.bg2, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${T.green}, ${T.cyan})`, borderRadius: 3, transition: "width .3s" }} />
                </div>
                <div style={{ fontSize: 10, color: T.textSoft, lineHeight: 1.6 }}>
                  {daysLeft} days · <strong style={{ color: T.text }}>+{perDay}/day</strong> · <strong style={{ color: T.text }}>+{perWeek}/wk</strong>
                  <Badge color={onTrack ? T.green : T.amber} style={{ marginLeft: 6 }}>{onTrack ? "✓" : "⚠"}</Badge>
                </div>
                {goalCurrent === 0 && <div style={{ marginTop: 6, fontSize: 10, color: T.amber }}>Click ✎ to set followers</div>}
              </div>
            );
          })()}
        </Card>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUS_ORDER.map(tab => (
          <TabBtn key={tab} label={`${TC[tab].icon} ${TC[tab].label}`}
            active={activeTab === tab} onClick={() => { setActiveTab(tab); setSortBy(tab === "DRAFT" ? "mine-first" : "default"); }}
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

      {/* Delete All */}
      {counts[activeTab] > 0 && (
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <Btn small color={T.red} outline onClick={() => deleteAllInTab(activeTab)}>🗑 Delete All {activeTab} ({counts[activeTab]})</Btn>
        </div>
      )}

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
                    {(account === "@henryk0x" ? CATEGORIES_HENRYK : CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
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
              <textarea value={newPostText} onChange={e => setNewPostText(e.target.value)} placeholder="write your post..."
                style={{ width: "100%", minHeight: 80, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, color: T.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical", lineHeight: 1.5, outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = T.green} onBlur={e => e.target.style.borderColor = T.border} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <div
                  style={{ flex: 1, border: `1px dashed ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: T.textDim, cursor: "pointer", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }}
                  onClick={() => imageInputRef.current?.click()}
                  onPaste={handleImagePaste}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.cyan; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = T.border; }}
                  onDrop={handleImageDrop}
                  tabIndex={0}
                >
                  {imageUploading ? "⏳ uploading..." : newPostImage ? "✓ image attached" : "📎 paste, drop, or click to add image"}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImageFile(e.target.files?.[0])} />
                {newPostImage && <Btn small outline onClick={() => setNewPostImage("")}>✕</Btn>}
              </div>
              {newPostImage && <img src={newPostImage} alt="preview" style={{ maxWidth: 200, maxHeight: 120, borderRadius: 6, marginTop: 6, objectFit: "cover", border: `1px solid ${T.border}` }} />}
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
        <input ref={postImageRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0] && imageTargetId) { uploadImageForPost(e.target.files[0], imageTargetId); } e.target.value = ""; }} />
        {sorted.map(p => {
          const ai = aiResults[p.id];
          return (
            <div key={p.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, transition: "all .12s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = (TC[activeTab]?.color || T.green) + "40"}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>

              {/* Header: post text left, badges right */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === p.id ? (
                    <div>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)}
                        autoFocus
                        style={{ width: "100%", minHeight: 80, background: T.bg2, border: `1px solid ${T.cyan}`, borderRadius: 6, padding: 10, color: T.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical", lineHeight: 1.6, outline: "none", boxSizing: "border-box" }}
                        onKeyDown={e => { if (e.key === "Escape") { setEditingId(null); setEditText(""); } if (e.key === "Enter" && e.ctrlKey) saveEdit(p.id, editText); }} />
                      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                        <Btn small color={T.cyan} onClick={() => saveEdit(p.id, editText)}>Save</Btn>
                        <Btn small outline onClick={() => { setEditingId(null); setEditText(""); }}>Cancel</Btn>
                        <span style={{ fontSize: 10, color: T.textDim, marginLeft: "auto" }}>{editText.length} chars · Ctrl+Enter to save · Esc to cancel</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap", cursor: "pointer", borderRadius: 6, padding: "2px 4px", margin: "-2px -4px", transition: "background .15s" }}
                      onClick={() => { setEditingId(p.id); setEditText(p.post || ""); }}
                      onMouseEnter={e => e.currentTarget.style.background = `${T.cyan}08`}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      title="Click to edit">
                      {p.post || <span style={{ color: T.textDim, fontStyle: "italic" }}>Empty — click to edit</span>}
                      {p.image_url && <div style={{ marginTop: 8 }}><img src={p.image_url} alt="" style={{ maxWidth: 160, maxHeight: 100, borderRadius: 6, objectFit: "cover", border: `1px solid ${T.border}` }} onError={e => e.target.style.display = "none"} /></div>}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                  {p.source === "manual" && <Badge color={T.cyan}>✍ Manual</Badge>}
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
                  <Btn small outline onClick={() => delPost(p.id)}>🗑</Btn>
                </>}
                {isPost && <>
                  <select value={p.day} onChange={e => setDay(p.id, e.target.value)} style={{ ...sel, fontSize: 11, padding: "4px 8px" }}>
                    <option value="">📅 Day</option>
                    {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <Btn small color={T.green} onClick={() => movePost(p.id, "USED")}>✓ → Used</Btn>
                  <Btn small color={T.blue} outline onClick={() => movePost(p.id, "DRAFT")}>✎ → Draft</Btn>
                  <Btn small color={T.red} outline onClick={() => moveToBad(p.id)}>✕ → Bad</Btn>
                  <Btn small outline onClick={() => delPost(p.id)}>🗑</Btn>
                </>}
                {isDb && <>
                  <Btn small color={T.blue} onClick={() => movePost(p.id, "DRAFT")}>✎ → Draft</Btn>
                  <Btn small color={T.green} outline onClick={() => movePost(p.id, "POST")}>◉ → Post</Btn>
                  <Btn small color={T.red} outline onClick={() => moveToBad(p.id)}>✕ → Bad</Btn>
                  <Btn small outline onClick={() => delPost(p.id)}>🗑</Btn>
                </>}
                {isBad && <>
                  <Btn small color={T.blue} onClick={() => movePost(p.id, "DRAFT")}>✎ → Draft</Btn>
                  <Btn small color={T.red} outline onClick={() => delPost(p.id)}>🗑 Delete</Btn>
                </>}
                {isUsed && <>
                  <Btn small color={T.blue} outline onClick={() => movePost(p.id, "DRAFT")}>✎ → Draft</Btn>
                  <Btn small outline onClick={() => delPost(p.id)}>🗑</Btn>
                </>}

                {!isUsed && <>
                  <Btn small color={T.purple} disabled={aiLoading === p.id || !p.post} onClick={() => askClaude(p.post, p.id, p.category, p.image_url)}>
                    {aiLoading === p.id ? "⏳..." : "🤖 Claude"}
                  </Btn>
                  {isDraft && <Btn small color={T.cyan} outline onClick={() => { setRewriteId(rewriteId === p.id ? null : p.id); setRewriteFeedback(""); }}>
                    {rewriteId === p.id ? "Cancel" : "✎ Rewrite"}
                  </Btn>}
                  {isDraft && <Btn small color={T.amber} outline disabled={fixLoading === p.id} onClick={() => fixPost(p)}>
                    {fixLoading === p.id ? "⏳..." : "🔧 Fix"}
                  </Btn>}
                  {(isDraft || isPost) && <Btn small color={account === "@django_crypto" ? "#3d8bfd" : "#00e87b"} outline disabled={translateLoading === p.id} onClick={() => translatePost(p)}>
                    {translateLoading === p.id ? "⏳..." : account === "@django_crypto" ? "🇵🇱 → Henryk" : "🇬🇧 → Django"}
                  </Btn>}
                  {(isDraft || isPost) && <Btn small outline onClick={() => { setImageTargetId(p.id); postImageRef.current?.click(); }}>📎</Btn>}
                </>}
              </div>

              {/* Rewrite input */}
              {rewriteId === p.id && (
                <div style={{ marginTop: 8, background: T.cyanDim || `${T.cyan}10`, border: `1px solid ${T.cyan}30`, padding: "12px 14px", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: T.cyan, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>✎ Rewrite with feedback</div>
                  <textarea value={rewriteFeedback} onChange={e => setRewriteFeedback(e.target.value)}
                    placeholder="what should change? e.g. 'make it shorter and more punchy' or 'add a contrarian angle' or 'too generic, needs specific example'"
                    style={{ width: "100%", minHeight: 60, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 6, padding: 10, color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", resize: "vertical", lineHeight: 1.5, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = T.cyan} onBlur={e => e.target.style.borderColor = T.border} />
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <Btn small color={T.cyan} disabled={rewriteLoading || !rewriteFeedback.trim()} onClick={() => rewritePost(p)}>
                      {rewriteLoading ? "⏳ Rewriting..." : "Generate Rewrite"}
                    </Btn>
                    <Btn small outline onClick={() => { setRewriteId(null); setRewriteFeedback(""); }}>Cancel</Btn>
                  </div>
                </div>
              )}

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
// ═══════════════════════════════════════════════════════════════
// ANALYTICS v4.2 — supabase matching, planned vs spontaneous
// ═══════════════════════════════════════════════════════════════

const ANALYTICS_SK = "djangocmd_analytics_v4";
const PILLAR_MAP = {
  growth: { label: "Growth", color: () => T.green, bg: () => T.greenDim },
  market: { label: "Market", color: () => T.blue, bg: () => T.blueDim },
  lifestyle: { label: "Lifestyle", color: () => T.purple, bg: () => T.purpleDim },
  busting: { label: "Myth Busting", color: () => T.amber, bg: () => T.amberDim },
  shitpost: { label: "Shitpost", color: () => T.red, bg: () => T.redDim },
  ai: { label: "AI", color: () => T.cyan, bg: () => T.cyanDim },
};
const STRUCT_LABELS = {
  framework:"Framework", contrarian:"Contrarian", personal:"Personal", thread:"Thread",
  observation:"Observation", question:"Question", callout:"Callout",
  "observation → pattern":"Obs → Pattern", "problem → solution":"Prob → Solution",
  "story → lesson":"Story → Lesson", "contrarian take":"Contrarian Take",
};

// CSV Date parser (handles X export format: "Thu, Feb 12, 2026")
function parseXDate(raw) {
  if (!raw) return null;
  const c = raw.replace(/^["']|["']$/g, "").trim();
  const m1 = c.match(/^[A-Z][a-z]{2},\s+([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/);
  if (m1) { const d = new Date(m1[1]+" "+m1[2]+", "+m1[3]); if (!isNaN(d)) return d; }
  const m2 = c.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/);
  if (m2) { const d = new Date(m2[1]+" "+m2[2]+", "+m2[3]); if (!isNaN(d)) return d; }
  const m3 = c.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m3) return new Date(parseInt(m3[1]), parseInt(m3[2])-1, parseInt(m3[3]));
  const d = new Date(c); return isNaN(d) ? null : d;
}
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const n = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - n);
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return d.getUTCFullYear()+"-W"+String(Math.ceil((((d-y)/86400000)+1)/7)).padStart(2,"0");
}
function detectWeek(rows) {
  for (const r of rows) { const d = parseXDate(r["Date"]||r["date"]||""); if (d) return getISOWeek(d); }
  return "upload-"+Date.now();
}
function parseAnalyticsCSV(text) {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const h = aCSVLine(lines[0]);
  return lines.slice(1).map(l => {
    const v = aCSVLine(l); if (v.length < 2) return null;
    const r = {}; h.forEach((k,i) => { r[k.trim()] = (v[i]||"").trim(); }); return r;
  }).filter(Boolean);
}
function aCSVLine(line) {
  const r = []; let c = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i+1] === '"') { c += '"'; i++; } else q = !q; }
    else if (ch === "," && !q) { r.push(c); c = ""; } else c += ch;
  }
  r.push(c); return r;
}
function anum(v) { return parseInt(v||"0",10)||0; }

// Text matching for CSV ↔ Supabase
function normText(text, len) {
  return (text||"").toLowerCase().replace(/https?:\/\/\S+/g,"").replace(/[^\w\s]/g,"").replace(/\s+/g," ").trim().slice(0, len||60);
}
function findMatch(csvText, spPosts) {
  const n = normText(csvText); if (!n || n.length < 10) return null;
  let best = null, bestS = 0;
  for (const sp of spPosts) {
    const sn = normText(sp.post); if (!sn || sn.length < 10) continue;
    const short = n.length < sn.length ? n : sn, long = n.length < sn.length ? sn : n;
    if (long.startsWith(short) || short.startsWith(long.slice(0, short.length))) {
      const s = short.length / Math.max(long.length, 1);
      if (s > bestS && s > 0.5) { bestS = s; best = sp; }
    }
    const cl = Math.min(n.length, sn.length, 50);
    if (cl >= 15) { let m = 0; for (let i = 0; i < cl; i++) { if (n[i] === sn[i]) m++; }
      const ov = m/cl; if (ov > bestS && ov > 0.75) { bestS = ov; best = sp; } }
  }
  return best;
}

// Fetch posts from Supabase for matching
async function fetchMatchPosts(supa) {
  if (!supa?.url || !supa?.key) return [];
  try {
    const r = await fetch(supa.url+"/rest/v1/posts?select=post,category,structure,score,tab&or=(tab.eq.USED,tab.eq.DATABASE,tab.eq.POST)&order=created_at.desc&limit=500",
      { headers: { apikey: supa.key, Authorization: "Bearer "+supa.key } });
    return r.ok ? await r.json() : [];
  } catch(e) { console.error("Supabase:", e); return []; }
}

// AI classify spontaneous posts
async function aiClassifyPosts(posts, apiKey) {
  if (!apiKey || !posts.length) return posts;
  const texts = posts.map((p,i) => "["+i+'] "'+p.text.slice(0,150)+'"').join("\n");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000,
        messages: [{ role: "user", content: "Classify these @django_xbt posts.\nFor each: pillar (growth|market|lifestyle|busting|shitpost), structure (framework|contrarian|personal|thread|observation|question|callout), score (1-10).\n\nPosts:\n"+texts+'\n\nJSON array only: [{"idx":0,"pillar":"growth","structure":"framework","score":7}]' }] }),
    });
    const d = await r.json();
    const parsed = JSON.parse((d.content?.map(c=>c.text||"").join("")||"").replace(/```json|```/g,"").trim());
    return posts.map((p,i) => { const c = parsed.find(x=>x.idx===i); return c ? {...p, pillar:c.pillar, structure:c.structure, aiScore:c.score} : p; });
  } catch(e) { console.error("AI classify:", e); return posts; }
}

// Sub-components
const PillTag = ({ pillar }) => {
  const k = (pillar||"").toLowerCase(); const p = PILLAR_MAP[k];
  if (!p) return <span style={{ fontSize: 10, color: T.textDim, padding: "2px 6px", background: T.surfaceAlt, borderRadius: 4 }}>untagged</span>;
  return <span style={{ fontSize: 10, fontWeight: 600, color: p.color(), padding: "2px 8px", background: p.bg(), borderRadius: 4 }}>{p.label}</span>;
};
const StructTag = ({ structure }) => {
  const k = (structure||"").toLowerCase(); const s = STRUCT_LABELS[k];
  return (s||structure) ? <span style={{ fontSize: 10, color: T.textSoft, padding: "2px 6px", background: T.surfaceAlt, borderRadius: 4 }}>{s||structure}</span> : null;
};
const SrcTag = ({ source }) => (
  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: source==="planned"?T.green:T.cyan, padding: "2px 6px", borderRadius: 4, background: source==="planned"?T.greenDim:T.cyanDim, textTransform: "uppercase" }}>{source}</span>
);
const AChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (<div style={{ background: T.card, border: "1px solid "+T.border, borderRadius: 8, padding: 10, fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}>
    <div style={{ color: T.textSoft, marginBottom: 4 }}>{label}</div>
    {payload.map((p,i) => <div key={i} style={{ color: p.color||T.text, marginBottom: 2 }}>{p.name}: <strong>{typeof p.value==="number"?p.value.toLocaleString():p.value}</strong></div>)}
  </div>);
};

function WeeklyAnalytics({ sheetData, loading, apiKey, supa, setLastAnalysis }) {
  const [history, setHistory] = useState(() => { try { return JSON.parse(sessionStorage.getItem(ANALYTICS_SK)||"{}"); } catch { return {}; } });
  const [selWeek, setSelWeek] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState("");
  const [repLoad, setRepLoad] = useState(false);
  const [view, setView] = useState("pillars");

  useEffect(() => { try { sessionStorage.setItem(ANALYTICS_SK, JSON.stringify(history)); } catch {} }, [history]);

  const weeks = Object.keys(history).sort();
  const curWeek = selWeek || weeks[weeks.length-1];
  const wd = curWeek ? history[curWeek] : null;

  // UPLOAD CONTENT CSV + MATCH
  const uploadContent = useCallback(async (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    setBusy(true); setStatus("parsing...");
    const text = await file.text();
    const rows = parseAnalyticsCSV(text);
    if (!rows.length) { setStatus("error: empty CSV"); setBusy(false); return; }
    const wk = detectWeek(rows);
    const originals = rows.filter(r => {
      const t = r["Post text"]||r["Tweet text"]||"";
      return !t.startsWith("@") && anum(r["Impressions"]||r["impressions"]) > 0;
    }).map(r => ({
      id: r["Post id"]||"", date: r["Date"]||"", text: r["Post text"]||r["Tweet text"]||"",
      link: r["Post Link"]||"", impressions: anum(r["Impressions"]||r["impressions"]),
      likes: anum(r["Likes"]||r["likes"]), engagements: anum(r["Engagements"]||r["engagements"]),
      bookmarks: anum(r["Bookmarks"]||r["bookmarks"]), reposts: anum(r["Reposts"]||r["Retweets"]||r["reposts"]),
      replies: anum(r["Replies"]||r["replies"]), follows: anum(r["New follows"]),
      pillar: null, structure: null, aiScore: null, source: "spontaneous",
    }));
    const repCount = rows.length - originals.length;
    // Match with Supabase
    let matched = 0; const unmatched = [];
    if (supa?.url && supa?.key) {
      setStatus("matching with supabase...");
      const sp = await fetchMatchPosts(supa);
      if (sp.length > 0) {
        for (const o of originals) {
          const m = findMatch(o.text, sp);
          if (m) { o.pillar=(m.category||"").toLowerCase(); o.structure=(m.structure||"").toLowerCase(); o.aiScore=parseInt(m.score)||null; o.source="planned"; matched++; }
          else unmatched.push(o);
        }
      } else originals.forEach(o => unmatched.push(o));
    } else originals.forEach(o => unmatched.push(o));
    // AI classify spontaneous
    if (unmatched.length > 0 && apiKey) {
      setStatus(matched+" planned | classifying "+unmatched.length+" spontaneous...");
      const cls = await aiClassifyPosts(unmatched, apiKey);
      for (const cp of cls) { const o = originals.find(x=>x.id===cp.id); if (o) { o.pillar=cp.pillar||o.pillar; o.structure=cp.structure||o.structure; o.aiScore=cp.aiScore||o.aiScore; } }
    }
    setHistory(p => ({...p, [wk]: {...p[wk], originals, totalPosts: rows.length, replyCount: repCount, matchedCount: matched, spontCount: unmatched.length}}));
    setSelWeek(wk); setBusy(false);
    setStatus("✓ "+wk+" · "+matched+" planned · "+(originals.length-matched)+" spontaneous · "+repCount+" replies filtered");
  }, [supa, apiKey]);

  const uploadOverview = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseAnalyticsCSV(ev.target.result);
      if (!rows.length) return;
      const wk = detectWeek(rows);
      const daily = rows.map(r => ({ date: r["Date"]||"", impressions: anum(r["Impressions"]), likes: anum(r["Likes"]), engagements: anum(r["Engagements"]), newFollows: anum(r["New follows"]), unfollows: anum(r["Unfollows"]) }));
      setHistory(p => ({...p, [wk]: {...p[wk], daily}})); setSelWeek(wk);
      setStatus("✓ overview → "+wk+" · "+daily.length+" days");
    }; reader.readAsText(file);
  }, []);

  const reMatch = async () => {
    if (!wd?.originals || !supa?.url) return; setBusy(true);
    const sp = await fetchMatchPosts(supa); let matched = 0; const unm = [];
    const upd = wd.originals.map(o => {
      const m = findMatch(o.text, sp);
      if (m) { matched++; return {...o, pillar:(m.category||"").toLowerCase(), structure:(m.structure||"").toLowerCase(), aiScore:parseInt(m.score)||o.aiScore, source:"planned"}; }
      unm.push(o); return {...o, source:"spontaneous"};
    });
    if (unm.length > 0 && apiKey) { const cls = await aiClassifyPosts(unm, apiKey); for (const cp of cls) { const u = upd.find(x=>x.id===cp.id); if (u&&u.source==="spontaneous") { u.pillar=cp.pillar||u.pillar; u.structure=cp.structure||u.structure; u.aiScore=cp.aiScore||u.aiScore; } } }
    setHistory(p => ({...p, [curWeek]: {...p[curWeek], originals: upd}}));
    setStatus("✓ "+matched+" planned, "+unm.length+" spontaneous"); setBusy(false);
  };

  const genReport = async () => {
    if (!apiKey) return; setRepLoad(true); setReport("");
    const o = wd?.originals||[]; const d = wd?.daily||[];
    const tImp = d.reduce((s,x)=>s+x.impressions,0)||o.reduce((s,x)=>s+x.impressions,0);
    const pl = o.filter(p=>p.source==="planned"), sp = o.filter(p=>p.source==="spontaneous");
    const ps = {}; o.filter(p=>p.pillar).forEach(p => { if(!ps[p.pillar]) ps[p.pillar]={n:0,imp:0,eng:0}; ps[p.pillar].n++; ps[p.pillar].imp+=p.impressions; ps[p.pillar].eng+=p.engagements; });
    const maxI = Math.max(...o.map(x=>x.impressions),1);
    const prompt = "You are Django's (@django_xbt) content strategist.\n\nWEEK: "+curWeek+"\nImpressions: "+tImp.toLocaleString()+" | Posts: "+o.length+" ("+pl.length+" planned, "+sp.length+" spontaneous)\nPlanned avg: "+(pl.length?Math.round(pl.reduce((s,p)=>s+p.impressions,0)/pl.length):0)+" | Spont avg: "+(sp.length?Math.round(sp.reduce((s,p)=>s+p.impressions,0)/sp.length):0)+"\n\nPillars:\n"+Object.entries(ps).map(([k,v])=>k+": "+v.n+"x, avg "+Math.round(v.imp/v.n)+" imp").join("\n")+"\n\nTop 10:\n"+[...o].sort((a,b)=>b.impressions-a.impressions).slice(0,10).map((p,i)=>(i+1)+". ["+p.impressions+"imp "+p.likes+"L] "+p.source+"/"+p.pillar+' "'+p.text.slice(0,100)+'"').join("\n")+"\n\nGive: 1)TL;DR 2)Planned vs Spontaneous 3)Pillar Performance 4)Structure Analysis 5)Scoring Check 6)Top Insight 7)3 Action Items. Direct, lowercase, no fluff.";
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]}) });
      const data = await r.json(); const reportText = data.content?.map(c=>c.text||"").join("")||"no response"; setReport(reportText);
      // Auto-save to lastAnalysis for weekly generation
      if (setLastAnalysis && reportText && !reportText.startsWith("error")) {
        setLastAnalysis(reportText);
        try { localStorage.setItem("djangocmd_last_analysis", reportText); } catch {}
        if (supa) supa.upsert("settings", { key: "last_analysis", value: reportText }).catch(() => {});
      }
    } catch(e) { setReport("error: "+e.message); }
    setRepLoad(false);
  };

  const exportH = () => { const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(history,null,2)],{type:"application/json"})); a.download="djangocmd-analytics.json"; a.click(); };
  const importH = (e) => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=(ev)=>{try{setHistory(JSON.parse(ev.target.result));setStatus("✓ imported");}catch{setStatus("error");}}; r.readAsText(f); };

  // Computed
  const originals = wd?.originals||[];
  const daily = wd?.daily||[];
  const topPosts = [...originals].sort((a,b)=>b.impressions-a.impressions);
  const hasClass = originals.some(p=>p.pillar);
  const hasScores = originals.some(p=>p.aiScore);
  const planned = originals.filter(p=>p.source==="planned");
  const spont = originals.filter(p=>p.source==="spontaneous");
  const totalImp = daily.reduce((s,d)=>s+d.impressions,0)||originals.reduce((s,p)=>s+p.impressions,0);
  const totalEng = daily.reduce((s,d)=>s+d.engagements,0)||originals.reduce((s,p)=>s+p.engagements,0);
  const engRate = totalImp>0?((totalEng/totalImp)*100).toFixed(2):"0";

  const pillarData = {};
  originals.filter(p=>p.pillar).forEach(p => { const k=p.pillar; if(!pillarData[k]) pillarData[k]={posts:0,imp:0,likes:0,eng:0,topImp:0,pl:0,sp:0}; const d=pillarData[k]; d.posts++; d.imp+=p.impressions; d.likes+=p.likes; d.eng+=p.engagements; d.topImp=Math.max(d.topImp,p.impressions); if(p.source==="planned") d.pl++; else d.sp++; });
  const pillarChart = Object.entries(pillarData).map(([k,v])=>({ name:PILLAR_MAP[k]?.label||k, key:k, posts:v.posts, avgImp:Math.round(v.imp/v.posts), avgLikes:Math.round(v.likes/v.posts), engRate:v.imp>0?((v.eng/v.imp)*100).toFixed(1):"0", topImp:v.topImp, pl:v.pl, sp:v.sp })).sort((a,b)=>b.avgImp-a.avgImp);

  const structData = {};
  originals.filter(p=>p.structure).forEach(p => { const k=p.structure; if(!structData[k]) structData[k]={posts:0,imp:0,eng:0}; structData[k].posts++; structData[k].imp+=p.impressions; structData[k].eng+=p.engagements; });
  const structChart = Object.entries(structData).map(([k,v])=>({ name:STRUCT_LABELS[k.toLowerCase()]||k, posts:v.posts, avgImp:Math.round(v.imp/v.posts), engRate:v.imp>0?((v.eng/v.imp)*100).toFixed(1):"0" })).sort((a,b)=>b.avgImp-a.avgImp);

  const maxImp = Math.max(...originals.map(p=>p.impressions),1);
  const scoreComp = originals.filter(p=>p.aiScore).map(p => ({ text:p.text.slice(0,45)+"...", full:p.text, ai:p.aiScore, real:Math.max(1,Math.min(10,Math.round((p.impressions/maxImp)*10))), diff:p.aiScore-Math.max(1,Math.min(10,Math.round((p.impressions/maxImp)*10))), imp:p.impressions, pillar:p.pillar, src:p.source })).sort((a,b)=>b.imp-a.imp);
  const avgDiff = scoreComp.length?(scoreComp.reduce((s,c)=>s+Math.abs(c.diff),0)/scoreComp.length).toFixed(1):null;

  const plAvg = planned.length?Math.round(planned.reduce((s,p)=>s+p.impressions,0)/planned.length):0;
  const spAvg = spont.length?Math.round(spont.reduce((s,p)=>s+p.impressions,0)/spont.length):0;

  const prevWk = weeks.length>=2&&curWeek===weeks[weeks.length-1]?weeks[weeks.length-2]:null;
  const prevImp = prevWk?(history[prevWk]?.daily||[]).reduce((s,d)=>s+d.impressions,0):0;
  const wowImp = prevImp>0?(((totalImp-prevImp)/prevImp)*100).toFixed(1):null;

  const pillarTrend = weeks.map(w => { const cls=(history[w]?.originals||[]).filter(p=>p.pillar); const by={}; cls.forEach(p=>{if(!by[p.pillar])by[p.pillar]={imp:0,n:0};by[p.pillar].imp+=p.impressions;by[p.pillar].n++;}); const e={week:w.replace(/^\d{4}-/,"")}; Object.keys(PILLAR_MAP).forEach(k=>{e[k]=by[k]?Math.round(by[k].imp/by[k].n):0;}); return e; });

  return (
    <div>
      {/* Upload */}
      <Card style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ background: T.greenDim, color: T.green, border: "1px solid "+T.greenMid, borderRadius: 8, padding: "7px 14px", fontSize: 11, fontWeight: 600, cursor: busy?"wait":"pointer", opacity: busy?0.6:1 }}>
            {busy ? "⏳ processing..." : "📄 Content CSV"}
            <input type="file" accept=".csv" onChange={uploadContent} disabled={busy} style={{ display: "none" }} />
          </label>
          <label style={{ background: T.blueDim, color: T.blue, border: "1px solid rgba(61,139,253,.3)", borderRadius: 8, padding: "7px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            📊 Overview CSV
            <input type="file" accept=".csv" onChange={uploadOverview} style={{ display: "none" }} />
          </label>
          {wd && supa?.url && <Btn small color={T.cyan} outline onClick={reMatch} disabled={busy}>{busy?"⏳":"🔄 Re-match"}</Btn>}
          {weeks.length > 0 && <select value={curWeek||""} onChange={e=>setSelWeek(e.target.value)} style={{ background: T.card, color: T.text, border: "1px solid "+T.border, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
            {weeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>}
          <div style={{ flex: 1 }} />
          <Btn small color={T.textSoft} outline onClick={exportH}>↓ Export</Btn>
          <label><Btn small color={T.textSoft} outline onClick={()=>{}}>↑ Import</Btn><input type="file" accept=".json" onChange={importH} style={{ display: "none" }} /></label>
          {weeks.length > 0 && <Btn small color={T.red} outline onClick={()=>{if(confirm("Clear ALL analytics?")) { setHistory({}); setSelWeek(null); }}}>🗑</Btn>}
        </div>
        {status && <div style={{ fontSize: 10, marginTop: 6, fontFamily: "'IBM Plex Mono', monospace", color: status.startsWith("✓")?T.green:status.startsWith("error")?T.red:T.textSoft }}>{status}</div>}
      </Card>

      {!wd && <div style={{ textAlign: "center", padding: 60, color: T.textDim }}>
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>📈</div>
        <div style={{ fontSize: 13 }}>upload X analytics CSVs to start</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>content CSV auto-matches with supabase posts → pillar + structure + AI score</div>
      </div>}

      {wd && (<>
        {/* Quick Stats */}
        <Card style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div><div style={{ fontSize: 10, color: T.textSoft, textTransform: "uppercase", letterSpacing: .5 }}>Impressions</div><div style={{ fontSize: 24, fontWeight: 700, color: T.green, fontFamily: "'IBM Plex Mono'" }}>{totalImp.toLocaleString()}</div>{wowImp && <div style={{ fontSize: 10, color: T.textDim }}>{parseFloat(wowImp)>=0?"↑":"↓"}{Math.abs(wowImp)}% wow</div>}</div>
            <div><div style={{ fontSize: 10, color: T.textSoft, textTransform: "uppercase", letterSpacing: .5 }}>Eng Rate</div><div style={{ fontSize: 24, fontWeight: 700, color: T.amber, fontFamily: "'IBM Plex Mono'" }}>{engRate}%</div></div>
            <div><div style={{ fontSize: 10, color: T.textSoft, textTransform: "uppercase", letterSpacing: .5 }}>Posts</div><div style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono'" }}>{originals.length}</div><div style={{ fontSize: 10, color: T.textDim }}>{planned.length} planned · {spont.length} spontaneous</div></div>
            {hasScores && <div><div style={{ fontSize: 10, color: T.textSoft, textTransform: "uppercase", letterSpacing: .5 }}>AI Accuracy</div><div style={{ fontSize: 24, fontWeight: 700, color: parseFloat(avgDiff)<2?T.green:T.amber, fontFamily: "'IBM Plex Mono'" }}>±{avgDiff}</div></div>}
          </div>
        </Card>

        {/* Planned vs Spontaneous */}
        {planned.length > 0 && spont.length > 0 && <Card style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 10 }}>⚡ Planned vs Spontaneous</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, background: T.greenDim, borderRadius: 10, border: "1px solid "+T.greenMid }}>
              <div style={{ fontSize: 10, color: T.green, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>PLANNED ({planned.length})</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono'" }}>{plAvg.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: T.textSoft }}>avg impressions</div>
            </div>
            <div style={{ padding: 12, background: T.cyanDim, borderRadius: 10, border: "1px solid "+T.cyan+"30" }}>
              <div style={{ fontSize: 10, color: T.cyan, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>SPONTANEOUS ({spont.length})</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: "'IBM Plex Mono'" }}>{spAvg.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: T.textSoft }}>avg impressions</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: T.textSoft, marginTop: 8, textAlign: "center" }}>
            {plAvg>spAvg?"planned outperform by "+Math.round(((plAvg-spAvg)/Math.max(spAvg,1))*100)+"%":"spontaneous outperform by "+Math.round(((spAvg-plAvg)/Math.max(plAvg,1))*100)+"%"}
          </div>
        </Card>}

        {/* View Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[{id:"pillars",l:"📊 Content Pillars"},{id:"scoring",l:"🎯 AI Scoring"},{id:"summary",l:"📋 Weekly Summary"}].map(t => (
            <Btn key={t.id} small color={view===t.id?T.green:T.textSoft} outline={view!==t.id} onClick={()=>setView(t.id)} style={view===t.id?{background:T.greenDim,borderColor:T.greenMid}:undefined}>{t.l}</Btn>
          ))}
        </div>

        {/* PILLARS */}
        {view==="pillars" && (<>
          {!hasClass ? <Card><div style={{ textAlign: "center", padding: 40, color: T.textDim }}>🤖 Upload content CSV — posts auto-match with supabase</div></Card> : (<>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Pillar Performance — Avg Impressions</div>
              <ResponsiveContainer width="100%" height={Math.max(160,pillarChart.length*44)}>
                <BarChart data={pillarChart} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: T.textDim }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: T.textSoft }} axisLine={false} width={90} />
                  <Tooltip content={<AChartTip />} />
                  <Bar dataKey="avgImp" radius={[0,6,6,0]} name="Avg Impressions">
                    {pillarChart.map((e,i) => <Cell key={i} fill={PILLAR_MAP[e.key]?.color()||T.textDim} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
              {pillarChart.map(p => <Card key={p.key} style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><PillTag pillar={p.key} /><span style={{ fontSize: 10, color: T.textDim }}>{p.pl}P·{p.sp}S</span></div>
                <div style={{ fontSize: 20, fontWeight: 700, color: PILLAR_MAP[p.key]?.color()||T.text, fontFamily: "'IBM Plex Mono'", marginBottom: 2 }}>{p.avgImp.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: T.textSoft }}>avg imp · {p.engRate}% eng · {p.posts} posts</div>
              </Card>)}
            </div>
            {structChart.length > 0 && <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Post Structure Performance</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={structChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.textSoft }} axisLine={{ stroke: T.border }} />
                  <YAxis tick={{ fontSize: 10, fill: T.textDim }} axisLine={false} tickLine={false} />
                  <Tooltip content={<AChartTip />} />
                  <Bar dataKey="avgImp" fill={T.blue} radius={[4,4,0,0]} name="Avg Impressions" />
                </BarChart>
              </ResponsiveContainer>
            </Card>}
            {weeks.length >= 2 && <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Pillar Trend Over Time</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={pillarTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: T.textSoft }} />
                  <YAxis tick={{ fontSize: 10, fill: T.textDim }} axisLine={false} tickLine={false} />
                  <Tooltip content={<AChartTip />} />
                  {Object.entries(PILLAR_MAP).map(([k,v]) => <Line key={k} type="monotone" dataKey={k} stroke={v.color()} strokeWidth={2} dot={{ fill: v.color(), r: 3 }} name={v.label} />)}
                </LineChart>
              </ResponsiveContainer>
            </Card>}
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginTop: 16 }}>Top Posts</div>
            {topPosts.slice(0,10).map((p,i) => <Card key={p.id||i} hover style={{ marginBottom: 6, padding: 12, cursor: p.link?"pointer":"default" }} onClick={()=>p.link&&window.open(p.link,"_blank")}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: i===0?T.green:i<3?T.blue:T.textDim, fontFamily: "'IBM Plex Mono'", minWidth: 26 }}>#{i+1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5, marginBottom: 6 }}>{p.text.length>160?p.text.slice(0,160)+"...":p.text}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.green, fontFamily: "'IBM Plex Mono'" }}>{p.impressions.toLocaleString()} imp</span>
                    <span style={{ fontSize: 10, color: T.blue }}>♥ {p.likes}</span>
                    <span style={{ fontSize: 10, color: T.purple }}>{p.engagements} eng</span>
                    {p.aiScore && <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: p.aiScore>=7?T.greenDim:p.aiScore>=5?T.amberDim:T.redDim, color: p.aiScore>=7?T.green:p.aiScore>=5?T.amber:T.red }}>AI:{p.aiScore}/10</span>}
                    <PillTag pillar={p.pillar} />
                    <StructTag structure={p.structure} />
                    <SrcTag source={p.source} />
                  </div>
                </div>
              </div>
            </Card>)}
          </>)}
        </>)}

        {/* SCORING */}
        {view==="scoring" && (<>
          {!hasScores ? <Card><div style={{ textAlign: "center", padding: 40, color: T.textDim }}>🎯 No AI scores yet — upload content CSV to match with supabase scores</div></Card> : (<>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>AI Predicted vs Real Performance</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={scoreComp}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="text" tick={{ fontSize: 9, fill: T.textDim }} angle={-15} textAnchor="end" height={55} />
                  <YAxis domain={[0,10]} tick={{ fontSize: 10, fill: T.textDim }} axisLine={false} tickLine={false} />
                  <Tooltip content={({active,payload})=>{if(!active||!payload?.length)return null;const d=payload[0]?.payload;return <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:10,fontSize:11,maxWidth:280}}><div style={{color:T.text,marginBottom:4}}>{d?.full?.slice(0,100)}</div><div style={{color:T.purple}}>AI: {d?.ai}/10</div><div style={{color:T.green}}>Real: {d?.real}/10</div><div style={{color:T.textDim}}>{d?.imp?.toLocaleString()} imp · {d?.src}</div></div>;}} />
                  <Bar dataKey="ai" fill={T.purple} radius={[3,3,0,0]} name="AI" />
                  <Bar dataKey="real" fill={T.green} radius={[3,3,0,0]} name="Real" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            {scoreComp.map((sc,i) => { const ad=Math.abs(sc.diff); const acc=ad<=1?"spot on":ad<=2?"close":"off"; const ac=ad<=1?T.green:ad<=2?T.amber:T.red;
              return <Card key={i} style={{ marginBottom: 6, padding: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ minWidth: 44, textAlign: "center" }}><div style={{ fontSize: 9, color: T.textDim }}>AI</div><div style={{ fontSize: 18, fontWeight: 700, color: T.purple, fontFamily: "'IBM Plex Mono'" }}>{sc.ai}</div></div>
                  <div style={{ color: T.textDim }}>→</div>
                  <div style={{ minWidth: 44, textAlign: "center" }}><div style={{ fontSize: 9, color: T.textDim }}>Real</div><div style={{ fontSize: 18, fontWeight: 700, color: T.green, fontFamily: "'IBM Plex Mono'" }}>{sc.real}</div></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: T.text, lineHeight: 1.4, marginBottom: 3 }}>{sc.full.slice(0,100)}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: T.textDim }}>{sc.imp.toLocaleString()} imp</span>
                      <PillTag pillar={sc.pillar} /><SrcTag source={sc.src} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: ac, padding: "1px 5px", background: ad<=1?T.greenDim:ad<=2?T.amberDim:T.redDim, borderRadius: 4 }}>{acc}</span>
                    </div>
                  </div>
                </div>
              </Card>; })}
          </>)}
        </>)}

        {/* SUMMARY */}
        {view==="summary" && (<>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: report?14:0 }}>
              <Btn small color={T.green} onClick={genReport} disabled={repLoad}>{repLoad?"⏳ analyzing...":"🤖 Generate Weekly Report"}</Btn>
              {!apiKey && <span style={{ fontSize: 10, color: T.red }}>set Claude API key in ⚙ settings</span>}
            </div>
            {report && <div style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.7, color: T.text, padding: 14, background: T.surfaceAlt, borderRadius: 8, border: "1px solid "+T.border }}>{report}</div>}
          </Card>
          {hasClass && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: T.textSoft }}>BEST PILLAR</div><div style={{ fontSize: 14, fontWeight: 600 }}>{pillarChart[0]?.name||"—"}</div><div style={{ fontSize: 10, color: T.textDim }}>{pillarChart[0]?.avgImp?.toLocaleString()||0} avg imp</div></Card>
            <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: T.textSoft }}>BEST STRUCTURE</div><div style={{ fontSize: 14, fontWeight: 600 }}>{structChart[0]?.name||"—"}</div><div style={{ fontSize: 10, color: T.textDim }}>{structChart[0]?.avgImp?.toLocaleString()||0} avg imp</div></Card>
            <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: T.textSoft }}>PLANNED vs SPONT</div><div style={{ fontSize: 14, fontWeight: 600, color: plAvg>spAvg?T.green:T.cyan }}>{plAvg>spAvg?"Planned wins":"Spontaneous wins"}</div><div style={{ fontSize: 10, color: T.textDim }}>{plAvg.toLocaleString()} vs {spAvg.toLocaleString()}</div></Card>
            {hasScores && <Card style={{ padding: 12 }}><div style={{ fontSize: 10, color: T.textSoft }}>AI ACCURACY</div><div style={{ fontSize: 18, fontWeight: 700, color: parseFloat(avgDiff)<2?T.green:T.amber, fontFamily: "'IBM Plex Mono'" }}>±{avgDiff}</div></Card>}
          </div>}
        </>)}
      </>)}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TWITTER PANEL
// ═══════════════════════════════════════════════════════════════

function TwitterPanel({ apiKey, supa }) {
  const [account, setAccount] = useState("@django_crypto");
  const [subTab, setSubTab] = useState("content");
  const { data: sheetData, loading, error, refetch, lastFetch } = useSheetData();

  // Persistent state — lives here so tab switches don't lose data
  const [allPosts, setAllPosts] = useState(null);

  // Per-account state: brand voice, weekly notes, last analysis, goal
  const acctKey = (k) => `${k}_${account.replace("@", "")}`;
  const [brandVoiceMap, setBrandVoiceMap] = useState({});
  const [weeklyNotesMap, setWeeklyNotesMap] = useState({});
  const [lastAnalysisMap, setLastAnalysisMap] = useState({});
  const [goalMap, setGoalMap] = useState({});

  // Derived per-account values
  const brandVoice = brandVoiceMap[account] || "";
  const setBrandVoice = (v) => setBrandVoiceMap(prev => ({ ...prev, [account]: v }));
  const weeklyNotes = weeklyNotesMap[account] || "";
  const setWeeklyNotes = (v) => setWeeklyNotesMap(prev => ({ ...prev, [account]: v }));
  const lastAnalysis = lastAnalysisMap[account] || "";
  const setLastAnalysis = (v) => setLastAnalysisMap(prev => ({ ...prev, [account]: v }));
  const goalTarget = goalMap[account]?.target || 20000;
  const goalCurrent = goalMap[account]?.current || 0;
  const setGoalTarget = (v) => setGoalMap(prev => ({ ...prev, [account]: { ...prev[account], target: v } }));
  const setGoalCurrent = (v) => setGoalMap(prev => ({ ...prev, [account]: { ...prev[account], current: v } }));
  const [goalDeadline] = useState("2027-01-01");
  const [supaLoaded, setSupaLoaded] = useState(false);

  // Load from Supabase once
  useEffect(() => {
    if (!supa || supaLoaded) return;
    (async () => {
      try {
        const posts = await supa.get("posts", "order=created_at.asc&limit=5000");
        console.log(`📦 Loaded ${Array.isArray(posts) ? posts.length : 0} posts from Supabase`);
        if (Array.isArray(posts) && posts.length > 0) {
          setAllPosts(posts.map(p => ({
            id: p.id, tab: p.tab, category: p.category, structure: p.structure,
            post: p.post, notes: p.notes, score: p.score, howToFix: p.how_to_fix,
            source: p.source || "", image_url: p.image_url || "",
            day: p.day, postLink: p.post_link, impressions: p.impressions,
            likes: p.likes, engagements: p.engagements, bookmarks: p.bookmarks,
            replies: p.replies, reposts: p.reposts, profileVisits: p.profile_visits,
            newFollows: p.new_follows, urlClicks: p.url_clicks, _supaId: p.id,
            account: p.account || "@django_crypto",
          })));
        }
        // Load per-account data for BOTH accounts
        for (const acct of ["@django_crypto", "@henryk0x"]) {
          const acctSlug = acct.replace("@", "");
          const goals = await supa.get("goal", `account=eq.${acct}`);
          if (Array.isArray(goals) && goals[0]) {
            const g = goals[0];
            setGoalMap(prev => ({ ...prev, [acct]: { target: Number(g.target_followers) || 20000, current: Number(g.current_followers) || 0 } }));
          }
          const bv = await supa.get("settings", `key=eq.brand_voice_${acctSlug}`);
          if (Array.isArray(bv) && bv[0]?.value) setBrandVoiceMap(prev => ({ ...prev, [acct]: bv[0].value }));
          const wn = await supa.get("settings", `key=eq.weekly_notes_${acctSlug}`);
          if (Array.isArray(wn) && wn[0]?.value) setWeeklyNotesMap(prev => ({ ...prev, [acct]: wn[0].value }));
          const la = await supa.get("settings", `key=eq.last_analysis_${acctSlug}`);
          if (Array.isArray(la) && la[0]?.value) setLastAnalysisMap(prev => ({ ...prev, [acct]: la[0].value }));
        }
        // Migrate old non-scoped keys to django_crypto
        try {
          const oldBv = await supa.get("settings", "key=eq.brand_voice");
          if (Array.isArray(oldBv) && oldBv[0]?.value) setBrandVoiceMap(prev => prev["@django_crypto"] ? prev : { ...prev, "@django_crypto": oldBv[0].value });
          const oldWn = await supa.get("settings", "key=eq.weekly_notes");
          if (Array.isArray(oldWn) && oldWn[0]?.value) setWeeklyNotesMap(prev => prev["@django_crypto"] ? prev : { ...prev, "@django_crypto": oldWn[0].value });
          const oldLa = await supa.get("settings", "key=eq.last_analysis");
          if (Array.isArray(oldLa) && oldLa[0]?.value) setLastAnalysisMap(prev => prev["@django_crypto"] ? prev : { ...prev, "@django_crypto": oldLa[0].value });
        } catch {}
        try {
          const localKey = localStorage.getItem("djangocmd_claude_key") || "";
          if (!localKey) {
            const ck = await supa.get("settings", "key=eq.claude_api_key");
            if (Array.isArray(ck) && ck[0]?.value) { try { localStorage.setItem("djangocmd_claude_key", ck[0].value); } catch {} }
          }
        } catch {}
        setSupaLoaded(true);
      } catch (err) { console.error("Supabase load:", err); setSupaLoaded(true); }
    })();
  }, [supa, supaLoaded]);

  return (
    <div>
      {/* Account Selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        {ACCOUNTS.map(a => (
          <AccountPill key={a.handle} account={a.handle} active={account === a.handle} onClick={() => setAccount(a.handle)} />
        ))}
      </div>

      {/* Henryk notice */}
      {account === "@henryk0x" && (
        <div style={{ background: `${T.cyan}15`, border: `1px solid ${T.cyan}30`, borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: T.cyan }}>
          🇵🇱 Henryk mode — posty po polsku · Market 30% · Busting 15% · Shitposting 15% · Growth 15% · AI 15% · Lifestyle 10%
        </div>
      )}

      <>
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

        {subTab === "research" && <DailyResearch account={account} apiKey={apiKey} twitterApiKey={twitterApiKey} supa={supa} allPosts={allPosts} setAllPosts={setAllPosts} />}
        {subTab === "content" && <WeeklyContent sheetData={sheetData} loading={loading} onRefresh={refetch} apiKey={apiKey} supa={supa}
          allPosts={allPosts} setAllPosts={setAllPosts} account={account}
          brandVoice={brandVoice} setBrandVoice={setBrandVoice}
          goalTarget={goalTarget} setGoalTarget={setGoalTarget}
          goalCurrent={goalCurrent} setGoalCurrent={setGoalCurrent}
          goalDeadline={goalDeadline} supaLoaded={supaLoaded}
          weeklyNotes={weeklyNotes} setWeeklyNotes={setWeeklyNotes}
          lastAnalysis={lastAnalysis} setLastAnalysis={setLastAnalysis}
        />}
        {subTab === "analytics" && <WeeklyAnalytics sheetData={sheetData} loading={loading} apiKey={apiKey} supa={supa} setLastAnalysis={setLastAnalysis} />}
      </>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLACEHOLDER PANELS
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// MOCK DATA — replace with Coros API data later
// ═══════════════════════════════════════════════════════════════

const todayMetrics = {
  steps: 8432, stepsGoal: 10000,
  calories: 2150, caloriesGoal: 2500,
  water: 2.1, waterGoal: 3.0,
  sleep: 7.2, sleepGoal: 8.0,
  heartRate: 64, hrMin: 52, hrMax: 142,
  activeMinutes: 47, activeGoal: 60,
};

const weeklyWorkout = [
  { day: "Mon", type: "Push", muscles: "Chest · Shoulders · Triceps", exercises: ["Bench Press 4×8", "Incline DB Press 3×10", "OHP 3×8", "Lateral Raises 4×15", "Tricep Pushdown 3×12", "Overhead Ext. 3×12"], duration: 65, done: true, calories: 520 },
  { day: "Tue", type: "Pull", muscles: "Back · Biceps · Rear Delts", exercises: ["Deadlift 4×5", "Barbell Rows 4×8", "Lat Pulldown 3×10", "Face Pulls 4×15", "Barbell Curls 3×10", "Hammer Curls 3×12"], duration: 60, done: true, calories: 490 },
  { day: "Wed", type: "Legs", muscles: "Quads · Hamstrings · Glutes · Calves", exercises: ["Squats 4×8", "RDL 3×10", "Leg Press 3×12", "Walking Lunges 3×12", "Leg Curl 3×12", "Calf Raises 4×15"], duration: 70, done: true, calories: 580 },
  { day: "Thu", type: "Rest", muscles: "Active Recovery", exercises: ["Stretching 20min", "Light Walk 30min", "Foam Rolling 15min"], duration: 45, done: true, calories: 180 },
  { day: "Fri", type: "Push", muscles: "Chest · Shoulders · Triceps", exercises: ["Incline Bench 4×8", "Cable Flyes 3×12", "Arnold Press 3×10", "Lateral Raises 4×15", "Dips 3×max", "Skull Crushers 3×12"], duration: 55, done: false, calories: 0 },
  { day: "Sat", type: "Pull", muscles: "Back · Biceps · Rear Delts", exercises: ["Chin-ups 4×max", "Cable Rows 4×10", "T-Bar Row 3×8", "Reverse Flyes 3×15", "Incline Curls 3×10", "Concentration Curls 3×12"], duration: 0, done: false, calories: 0 },
  { day: "Sun", type: "Rest", muscles: "Full Rest", exercises: ["Yoga/Mobility 30min", "Meditation 15min"], duration: 0, done: false, calories: 0 },
];

const weightHistory = [
  { week: "W1", weight: 84.1, bf: 18.2 }, { week: "W2", weight: 83.6, bf: 17.9 },
  { week: "W3", weight: 83.2, bf: 17.5 }, { week: "W4", weight: 82.9, bf: 17.2 },
  { week: "W5", weight: 82.7, bf: 16.9 }, { week: "W6", weight: 82.4, bf: 16.7 },
  { week: "W7", weight: 82.1, bf: 16.4 }, { week: "W8", weight: 81.8, bf: 16.1 },
];

const hrHistory = [
  { time: "00:00", hr: 56 }, { time: "02:00", hr: 52 }, { time: "04:00", hr: 54 },
  { time: "06:00", hr: 58 }, { time: "08:00", hr: 72 }, { time: "10:00", hr: 85 },
  { time: "12:00", hr: 78 }, { time: "14:00", hr: 95 }, { time: "16:00", hr: 142 },
  { time: "18:00", hr: 88 }, { time: "20:00", hr: 72 }, { time: "22:00", hr: 64 },
];

const dailyMacros = {
  current: { protein: 168, carbs: 220, fat: 72, fiber: 28 },
  target: { protein: 180, carbs: 250, fat: 75, fiber: 30 },
};

const mealPlan = [
  { meal: "Breakfast", time: "7:30", items: "4 eggs scrambled, 2 toast whole grain, avocado, coffee", kcal: 620, protein: 38 },
  { meal: "Snack", time: "10:00", items: "Greek yogurt, handful almonds, blueberries", kcal: 280, protein: 22 },
  { meal: "Lunch", time: "13:00", items: "Chicken breast 200g, brown rice, broccoli, olive oil", kcal: 650, protein: 52 },
  { meal: "Pre-workout", time: "15:30", items: "Banana, whey shake, oats", kcal: 350, protein: 30 },
  { meal: "Dinner", time: "19:00", items: "Salmon 180g, sweet potato, mixed salad, lemon dressing", kcal: 580, protein: 42 },
  { meal: "Evening", time: "21:00", items: "Casein shake, peanut butter on rice cake", kcal: 270, protein: 28 },
];

const groceryList = [
  { category: "🥩 Protein", items: ["Chicken breast 1.5kg", "Salmon fillets 600g", "Eggs (30)", "Greek yogurt 1kg", "Whey protein 1 bag", "Casein powder"] },
  { category: "🥦 Vegetables", items: ["Broccoli 1kg", "Mixed salad 3 bags", "Sweet potatoes 1kg", "Avocados (5)", "Cherry tomatoes 500g"] },
  { category: "🍚 Carbs", items: ["Brown rice 1kg", "Whole grain bread", "Oats 500g", "Rice cakes", "Bananas (7)"] },
  { category: "🥜 Fats & Snacks", items: ["Almonds 200g", "Peanut butter", "Olive oil", "Blueberries 500g", "Lemons (4)"] },
  { category: "☕ Other", items: ["Coffee beans", "Green tea", "Electrolytes", "Multivitamin"] },
];

const bodyMeasurements = [
  { part: "Chest", current: 102, prev: 101, unit: "cm" },
  { part: "Waist", current: 82, prev: 84, unit: "cm" },
  { part: "Arms", current: 37, prev: 36.5, unit: "cm" },
  { part: "Thighs", current: 59, prev: 58, unit: "cm" },
  { part: "Shoulders", current: 118, prev: 117, unit: "cm" },
];

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════

const HCard = ({ children, style, T }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, ...style }}>{children}</div>
);

const HSectionTitle = ({ icon, children, right, T }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "'Satoshi', sans-serif", letterSpacing: "-.01em" }}>{children}</span>
    </div>
    {right}
  </div>
);

const HBadge = ({ color, children }) => (
  <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "15", padding: "3px 8px", borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: ".04em" }}>{children}</span>
);

const HMono = ({ children, color, size = 13, style, T }) => (
  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: size, color: color || T?.text, fontWeight: 600, ...style }}>{children}</span>
);

const ProgressRing = ({ value, max, size = 90, strokeWidth = 6, color, label, sublabel, T }) => {
  const pct = Math.min(value / max, 1);
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div style={{ textAlign: "center", marginTop: -size / 2 - 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>
          {typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : value.toLocaleString()}
        </div>
        <div style={{ fontSize: 9, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace", marginTop: 1 }}>
          / {typeof max === "number" && max % 1 !== 0 ? max.toFixed(1) : max.toLocaleString()}
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: size / 2 - 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{label}</div>
        {sublabel && <div style={{ fontSize: 9, color: T.textDim }}>{sublabel}</div>}
      </div>
    </div>
  );
};

const MacroBar = ({ label, current, target, color, unit = "g", T }) => {
  const pct = Math.min(current / target * 100, 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{label}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: pct >= 90 ? T.green : T.textSoft, fontWeight: 600 }}>{current}{unit} / {target}{unit}</span>
      </div>
      <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ T }) {
  const m = todayMetrics;
  const doneCount = weeklyWorkout.filter(w => w.done).length;
  const weekCals = weeklyWorkout.reduce((s, w) => s + w.calories, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Daily Rings */}
      <HCard T={T}>
        <HSectionTitle T={T} icon="⚡" right={
          <HBadge color={T.green}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</HBadge>
        }>Today's Vitals</HSectionTitle>
        <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 20, padding: "10px 0" }}>
          <ProgressRing T={T} value={m.steps} max={m.stepsGoal} color={T.green} label="Steps" sublabel="daily" />
          <ProgressRing T={T} value={m.calories} max={m.caloriesGoal} color={T.amber} label="Calories" sublabel="intake" />
          <ProgressRing T={T} value={m.water} max={m.waterGoal} color={T.blue} label="Water" sublabel="liters" />
          <ProgressRing T={T} value={m.sleep} max={m.sleepGoal} color={T.purple} label="Sleep" sublabel="hours" />
          <ProgressRing T={T} value={m.activeMinutes} max={m.activeGoal} color={T.cyan} label="Active" sublabel="minutes" />
        </div>
      </HCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Heart Rate */}
        <HCard T={T}>
          <HSectionTitle T={T} icon="❤️" right={<span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.red, fontWeight: 600 }}>{m.heartRate} BPM</span>}>Heart Rate</HSectionTitle>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={hrHistory}>
              <defs>
                <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.red} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={T.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="time" stroke={T.textDim} fontSize={9} tick={{ fontFamily: "'IBM Plex Mono', monospace" }} />
              <YAxis stroke={T.textDim} fontSize={9} domain={[40, 160]} tick={{ fontFamily: "'IBM Plex Mono', monospace" }} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} />
              <Area type="monotone" dataKey="hr" stroke={T.red} strokeWidth={2} fill="url(#hrGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 8 }}>
            {[{ label: "Resting", val: m.hrMin, c: T.green }, { label: "Average", val: m.heartRate, c: T.amber }, { label: "Peak", val: m.hrMax, c: T.red }].map((h, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: T.textDim }}>{h.label}</div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: h.c, fontWeight: 600 }}>{h.val}</span>
              </div>
            ))}
          </div>
        </HCard>

        {/* Week Summary */}
        <HCard T={T}>
          <HSectionTitle T={T} icon="📅">Week at a Glance</HSectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Workouts Done", val: doneCount, sub: `/ ${weeklyWorkout.length}`, c: T.green },
              { label: "Calories Burned", val: weekCals.toLocaleString(), sub: " kcal", c: T.amber },
              { label: "Current Weight", val: weightHistory[weightHistory.length - 1].weight, sub: " kg", c: T.text },
              { label: "Gym Streak", val: "14", sub: " days", c: T.cyan },
            ].map((s, i) => (
              <div key={i} style={{ background: T.surface, borderRadius: 10, padding: 14, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>{s.label}</div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, color: s.c, fontWeight: 600 }}>{s.val}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.textDim, fontWeight: 600 }}>{s.sub}</span>
              </div>
            ))}
          </div>
        </HCard>
      </div>

      {/* AI Health Advisor */}
      <HCard T={T}>
        <HSectionTitle T={T} icon="🧠" right={<HBadge color={T.cyan}>COROS CONNECTED</HBadge>}>AI Health Advisor</HSectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { title: "Training", tip: "Solid push week fam. Volume tracking well — keep progressive overload on bench. Consider adding a drop set on lateral raises to break through the shoulder plateau.", color: T.green },
            { title: "Recovery", tip: "Sleep was 7.2h — decent but consistently under 8h target. Cut screen time 30min earlier. Resting HR at 52 is excellent — recovery capacity strong.", color: T.purple },
            { title: "Nutrition", tip: "12g short on protein today. Add a scoop of whey to evening snack. Water needs to hit 3L — at 2.1L. Hydration affects everything, don't slack fam.", color: T.amber },
          ].map((a, i) => (
            <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, borderLeft: `3px solid ${a.color}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: a.color, marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: ".06em" }}>{a.title}</div>
              <div style={{ fontSize: 12, color: T.textSoft, lineHeight: 1.6 }}>{a.tip}</div>
            </div>
          ))}
        </div>
      </HCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRAINING TAB
// ═══════════════════════════════════════════════════════════════

function TrainingTab({ T }) {
  const [expandedDay, setExpandedDay] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <HCard T={T}>
        <HSectionTitle T={T} icon="📋" right={<HBadge color={T.cyan}>PUSH / PULL / LEGS</HBadge>}>Weekly Training Plan</HSectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {weeklyWorkout.map((w, i) => {
            const isExpanded = expandedDay === i;
            const isRest = w.type === "Rest";
            const typeColor = isRest ? T.textDim : w.type === "Push" ? T.green : w.type === "Pull" ? T.blue : T.amber;
            return (
              <div key={i}>
                <div onClick={() => setExpandedDay(isExpanded ? null : i)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  background: w.done ? T.greenDim : T.surface, border: `1px solid ${w.done ? T.green + "30" : T.border}`,
                  borderRadius: isExpanded ? "10px 10px 0 0" : 10, cursor: "pointer", transition: "all .2s",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                    background: w.done ? T.green : T.border, color: w.done ? T.bg : T.textDim,
                    fontSize: 14, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace",
                  }}>{w.done ? "✓" : w.day[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{w.day}</span>
                      <span style={{ fontSize: 10, color: typeColor, background: typeColor + "18", padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{w.type}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{w.muscles}</div>
                  </div>
                  {w.duration > 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.textSoft, fontWeight: 600 }}>{w.duration}min</span>}
                  {w.calories > 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.amber, fontWeight: 600 }}>{w.calories}kcal</span>}
                  <span style={{ fontSize: 12, color: T.textDim, transition: "transform .2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                </div>
                {isExpanded && (
                  <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 14px 14px 58px" }}>
                    {w.exercises.map((ex, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: j < w.exercises.length - 1 ? `1px solid ${T.border}50` : "none" }}>
                        <span style={{ width: 20, fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>{j + 1}.</span>
                        <span style={{ fontSize: 12, color: T.text }}>{ex}</span>
                      </div>
                    ))}
                    {!w.done && !isRest && (
                      <button style={{ marginTop: 10, background: T.green, color: T.bg, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Satoshi', sans-serif" }}>✓ Mark as Done</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </HCard>

      <HCard T={T}>
        <HSectionTitle T={T} icon="📊">Weekly Volume</HSectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyWorkout.filter(w => w.type !== "Rest")}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="day" stroke={T.textDim} fontSize={10} tick={{ fontFamily: "'IBM Plex Mono', monospace" }} />
            <YAxis stroke={T.textDim} fontSize={10} tick={{ fontFamily: "'IBM Plex Mono', monospace" }} />
            <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="duration" fill={T.cyan} radius={[4, 4, 0, 0]} name="Duration (min)" />
            <Bar dataKey="calories" fill={T.amber + "80"} radius={[4, 4, 0, 0]} name="Calories" />
          </BarChart>
        </ResponsiveContainer>
      </HCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NUTRITION TAB
// ═══════════════════════════════════════════════════════════════

function NutritionTab({ T }) {
  const [showGrocery, setShowGrocery] = useState(false);
  const mc = dailyMacros.current;
  const mt = dailyMacros.target;
  const totalCal = mealPlan.reduce((s, m) => s + m.kcal, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Macros */}
        <HCard T={T}>
          <HSectionTitle T={T} icon="🎯" right={<span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.green, fontWeight: 600 }}>{totalCal} / {todayMetrics.caloriesGoal} kcal</span>}>Daily Macros</HSectionTitle>
          <MacroBar T={T} label="Protein" current={mc.protein} target={mt.protein} color={T.red} />
          <MacroBar T={T} label="Carbs" current={mc.carbs} target={mt.carbs} color={T.amber} />
          <MacroBar T={T} label="Fat" current={mc.fat} target={mt.fat} color={T.blue} />
          <MacroBar T={T} label="Fiber" current={mc.fiber} target={mt.fiber} color={T.green} />
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-around" }}>
            {[
              { label: "Protein", pct: Math.round(mc.protein * 4 / totalCal * 100), color: T.red },
              { label: "Carbs", pct: Math.round(mc.carbs * 4 / totalCal * 100), color: T.amber },
              { label: "Fat", pct: Math.round(mc.fat * 9 / totalCal * 100), color: T.blue },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: m.color, fontFamily: "'IBM Plex Mono', monospace" }}>{m.pct}%</div>
                <div style={{ fontSize: 9, color: T.textDim }}>{m.label}</div>
              </div>
            ))}
          </div>
        </HCard>

        {/* Meals */}
        <HCard T={T}>
          <HSectionTitle T={T} icon="🍽️">Today's Meal Plan</HSectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {mealPlan.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.textDim, fontWeight: 600, width: 40, flexShrink: 0, paddingTop: 2 }}>{m.time}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>{m.meal}</div>
                  <div style={{ fontSize: 11, color: T.textSoft, lineHeight: 1.5 }}>{m.items}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.amber, fontWeight: 600 }}>{m.kcal}</span>
                  <div style={{ fontSize: 9, color: T.textDim }}>{m.protein}g prot</div>
                </div>
              </div>
            ))}
          </div>
        </HCard>
      </div>

      {/* Grocery */}
      <HCard T={T}>
        <HSectionTitle T={T} icon="🛒" right={
          <button onClick={() => setShowGrocery(!showGrocery)} style={{
            background: T.greenDim, color: T.green, border: `1px solid ${T.green}30`,
            borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Satoshi', sans-serif",
          }}>{showGrocery ? "Hide" : "Show"} Grocery List</button>
        }>Weekly Grocery List</HSectionTitle>
        {showGrocery && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginTop: 4 }}>
            {groceryList.map((cat, i) => (
              <div key={i} style={{ background: T.surface, borderRadius: 10, padding: 14, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>{cat.category}</div>
                {cat.items.map((item, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: j < cat.items.length - 1 ? `1px solid ${T.border}40` : "none" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${T.border}`, cursor: "pointer", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: T.textSoft }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </HCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROGRESS TAB
// ═══════════════════════════════════════════════════════════════

function ProgressTab({ T }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Weight */}
        <HCard T={T}>
          <HSectionTitle T={T} icon="⚖️" right={
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.green, fontWeight: 600 }}>↓ {(weightHistory[0].weight - weightHistory[weightHistory.length - 1].weight).toFixed(1)}kg in {weightHistory.length} weeks</span>
          }>Weight Trend</HSectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightHistory}>
              <defs>
                <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.green} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={T.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="week" stroke={T.textDim} fontSize={10} tick={{ fontFamily: "'IBM Plex Mono', monospace" }} />
              <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} stroke={T.textDim} fontSize={10} tick={{ fontFamily: "'IBM Plex Mono', monospace" }} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="weight" stroke={T.green} strokeWidth={2.5} dot={{ fill: T.green, r: 4, strokeWidth: 0 }} name="Weight (kg)" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 12, padding: "10px 0", background: T.surface, borderRadius: 8 }}>
            {[{ l: "Start", v: weightHistory[0].weight, c: T.textSoft }, { l: "Current", v: weightHistory[weightHistory.length - 1].weight, c: T.green }, { l: "Goal", v: "78.0", c: T.amber }].map((x, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: T.textDim }}>{x.l}</div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: x.c, fontWeight: 600 }}>{x.v}</span>
              </div>
            ))}
          </div>
        </HCard>

        {/* Body Fat */}
        <HCard T={T}>
          <HSectionTitle T={T} icon="📉" right={
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.purple, fontWeight: 600 }}>↓ {(weightHistory[0].bf - weightHistory[weightHistory.length - 1].bf).toFixed(1)}% BF</span>
          }>Body Fat %</HSectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weightHistory}>
              <defs>
                <linearGradient id="bfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.purple} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={T.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="week" stroke={T.textDim} fontSize={10} tick={{ fontFamily: "'IBM Plex Mono', monospace" }} />
              <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} stroke={T.textDim} fontSize={10} tick={{ fontFamily: "'IBM Plex Mono', monospace" }} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="bf" stroke={T.purple} strokeWidth={2.5} fill="url(#bfGrad)" dot={{ fill: T.purple, r: 4, strokeWidth: 0 }} name="Body Fat %" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 12, padding: "10px 0", background: T.surface, borderRadius: 8 }}>
            {[{ l: "Start", v: weightHistory[0].bf + "%", c: T.textSoft }, { l: "Current", v: weightHistory[weightHistory.length - 1].bf + "%", c: T.purple }, { l: "Goal", v: "14.0%", c: T.amber }].map((x, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: T.textDim }}>{x.l}</div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: x.c, fontWeight: 600 }}>{x.v}</span>
              </div>
            ))}
          </div>
        </HCard>
      </div>

      {/* Body Measurements */}
      <HCard T={T}>
        <HSectionTitle T={T} icon="📏">Body Measurements</HSectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {bodyMeasurements.map((b, i) => {
            const diff = b.current - b.prev;
            const isGood = (b.part === "Waist" && diff < 0) || (b.part !== "Waist" && diff > 0);
            return (
              <div key={i} style={{ background: T.surface, borderRadius: 10, padding: 14, border: `1px solid ${T.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>{b.part}</div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, color: T.text, fontWeight: 600 }}>{b.current}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: T.textDim, fontWeight: 600 }}> {b.unit}</span>
                <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: isGood ? T.green : T.red }}>
                  {diff > 0 ? "+" : ""}{diff.toFixed(1)} {b.unit}
                </div>
              </div>
            );
          })}
        </div>
      </HCard>

      {/* AI Progress Report */}
      <HCard T={T} style={{ borderLeft: `3px solid ${T.green}` }}>
        <HSectionTitle T={T} icon="🧠">AI Progress Report</HSectionTitle>
        <div style={{ fontSize: 13, color: T.textSoft, lineHeight: 1.8 }}>
          8-week progress looking solid fam. You've dropped <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.green, fontWeight: 600 }}>2.3kg</span> at a healthy rate of ~0.3kg/week — no muscle wasting, pure fat loss.
          Body fat went from <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.textSoft, fontWeight: 600 }}>18.2%</span> to <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.purple, fontWeight: 600 }}>16.1%</span> — that's legit.
          Arms and chest are growing which means the recomp is working. Waist down 2cm confirms you're losing fat from the right places.
          <br /><br />
          <span style={{ color: T.amber, fontWeight: 600 }}>Next 4 weeks:</span> Keep the deficit at 300-400kcal. Increase protein to 185g on training days.
          Add one extra set per exercise on compound lifts — time to push the progressive overload harder.
          You're on track for 78kg at 14% BF by end of Q1. Don't rush it — patience is your edge, as always.
        </div>
      </HCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN HEALTH PANEL — exported for use in dashboard.jsx
// ═══════════════════════════════════════════════════════════════

const HEALTH_TABS = [
  { id: "overview", label: "📊 Overview" },
  { id: "training", label: "🏋️ Training" },
  { id: "nutrition", label: "🍎 Nutrition" },
  { id: "progress", label: "📈 Progress" },
];

function HealthPanel({ T: theme }) {
  const [tab, setTab] = useState("overview");

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {HEALTH_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? theme.surfaceAlt : "transparent",
            border: `1px solid ${tab === t.id ? theme.border : "transparent"}`,
            borderBottom: tab === t.id ? `2px solid ${theme.green}` : "2px solid transparent",
            borderRadius: "8px 8px 0 0", padding: "10px 18px", cursor: "pointer",
            fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? theme.text : theme.textSoft,
            fontFamily: "'Satoshi', sans-serif", transition: "all .15s",
          }}>{t.label}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <HBadge color={theme.cyan}>COROS PACE 3</HBadge>
          <HBadge color={theme.textDim}>MOCK DATA</HBadge>
        </div>
      </div>

      {/* Content */}
      {tab === "overview" && <OverviewTab T={theme} />}
      {tab === "training" && <TrainingTab T={theme} />}
      {tab === "nutrition" && <NutritionTab T={theme} />}
      {tab === "progress" && <ProgressTab T={theme} />}
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
    try { return window.localStorage.getItem("djangocmd_claude_key") || ""; } catch { return ""; }
  });
  const [supaUrl, setSupaUrl] = useState(() => {
    try { return window.localStorage.getItem("supa_url") || ""; } catch { return ""; }
  });
  const [supaKey, setSupaKey] = useState(() => {
    try { return window.localStorage.getItem("supa_key") || ""; } catch { return ""; }
  });
  const [twitterApiKey, setTwitterApiKey] = useState(() => {
    try { return window.localStorage.getItem("djangocmd_twitter_api_key") || ""; } catch { return ""; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [supaUrlInput, setSupaUrlInput] = useState("");
  const [supaKeyInput, setSupaKeyInput] = useState("");
  const [twitterKeyInput, setTwitterKeyInput] = useState("");

  T = isDark ? DARK : LIGHT;

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const saveKey = () => {
    setApiKey(keyInput);
    setSupaUrl(supaUrlInput);
    setSupaKey(supaKeyInput);
    setTwitterApiKey(twitterKeyInput);
    try { window.localStorage.setItem("djangocmd_claude_key", keyInput); } catch {}
    try { window.localStorage.setItem("supa_url", supaUrlInput); window.localStorage.setItem("supa_key", supaKeyInput); } catch {}
    try { window.localStorage.setItem("djangocmd_twitter_api_key", twitterKeyInput); } catch {}
    // Save Claude API key to Supabase settings (so it persists across devices)
    if (supaUrlInput && supaKeyInput) {
      const h = { "apikey": supaKeyInput, "Authorization": `Bearer ${supaKeyInput}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=representation" };
      if (keyInput) fetch(`${supaUrlInput}/rest/v1/settings`, { method: "POST", headers: h, body: JSON.stringify({ key: "claude_api_key", value: keyInput }) }).catch(() => {});
    }
    setShowSettings(false);
  };

  // Supabase helper
  const supa = (supaUrl && supaKey) ? {
    url: supaUrl, key: supaKey,
    headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}`, "Content-Type": "application/json", "Prefer": "return=representation" },
    async get(table, params = "") { const r = await fetch(`${supaUrl}/rest/v1/${table}?${params}`, { headers: this.headers }); return r.json(); },
    async post(table, data) { const r = await fetch(`${supaUrl}/rest/v1/${table}`, { method: "POST", headers: this.headers, body: JSON.stringify(data) }); return r.json(); },
    async patch(table, params, data) { const r = await fetch(`${supaUrl}/rest/v1/${table}?${params}`, { method: "PATCH", headers: this.headers, body: JSON.stringify(data) }); return r.json(); },
    async del(table, params) { await fetch(`${supaUrl}/rest/v1/${table}?${params}`, { method: "DELETE", headers: this.headers }); },
    async upsert(table, data) {
      // Try patch first (update existing), if no match insert new
      const key = data.key;
      if (key) {
        const existing = await this.get(table, `key=eq.${encodeURIComponent(key)}&limit=1`);
        if (Array.isArray(existing) && existing.length > 0) {
          return this.patch(table, `key=eq.${encodeURIComponent(key)}`, data);
        }
      }
      return this.post(table, [data]);
    },
    async uploadImage(file, filename) {
      const r = await fetch(`${supaUrl}/storage/v1/object/post-images/${filename}`, {
        method: "POST",
        headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}`, "Content-Type": file.type || "image/png", "x-upsert": "true" },
        body: file,
      });
      if (!r.ok) throw new Error("Upload failed: " + r.status);
      return `${supaUrl}/storage/v1/object/public/post-images/${filename}`;
    },
  } : null;

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
            <span style={{ fontSize: 10, color: T.textSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{supa ? "supabase" : "sheets"} connected</span>
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
          <button onClick={() => { setKeyInput(apiKey); setSupaUrlInput(supaUrl); setSupaKeyInput(supaKey); setTwitterKeyInput(twitterApiKey); setShowSettings(true); }} style={{
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
        {nav === "twitter" && <TwitterPanel apiKey={apiKey} supa={supa} />}
        {nav === "health" && <HealthPanel T={T} />}
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
              <div style={{ fontSize: 12, color: T.text, fontWeight: 600, marginBottom: 6 }}>Supabase URL</div>
              <input value={supaUrlInput} onChange={e => setSupaUrlInput(e.target.value)} placeholder="https://xxxxx.supabase.co"
                style={{ width: "100%", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                onFocus={e => e.target.style.borderColor = T.green} onBlur={e => e.target.style.borderColor = T.border} />
              <div style={{ fontSize: 12, color: T.text, fontWeight: 600, marginBottom: 6 }}>Supabase Anon Key</div>
              <input type="password" value={supaKeyInput} onChange={e => setSupaKeyInput(e.target.value)} placeholder="eyJhb..."
                style={{ width: "100%", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = T.green} onBlur={e => e.target.style.borderColor = T.border} />
              {supaUrl && supaKey && <div style={{ marginTop: 6, fontSize: 11, color: T.green, display: "flex", alignItems: "center", gap: 4 }}><Dot color={T.green} pulse /> Supabase connected</div>}
            </div>
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
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 600, marginBottom: 6 }}>TwitterAPI.io Key</div>
              <div style={{ fontSize: 11, color: T.textSoft, marginBottom: 8, lineHeight: 1.5 }}>
                For Daily Research — fetches real tweets from X. Get your key at twitterapi.io
              </div>
              <input
                type="password"
                value={twitterKeyInput}
                onChange={e => setTwitterKeyInput(e.target.value)}
                placeholder="your-twitterapi-io-key..."
                style={{
                  width: "100%", background: T.bg2, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 13,
                  fontFamily: "'IBM Plex Mono', monospace", outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = T.cyan}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              {twitterApiKey && <div style={{ marginTop: 6, fontSize: 11, color: T.cyan, display: "flex", alignItems: "center", gap: 4 }}><Dot color={T.cyan} pulse /> TwitterAPI connected</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn color={T.green} onClick={saveKey}>Save</Btn>
              {apiKey && <Btn color={T.red} outline onClick={() => { setApiKey(""); setKeyInput(""); try { window.localStorage.removeItem("djangocmd_claude_key"); } catch {} if (supa) supa.del("settings", "key=eq.claude_api_key").catch(() => {}); }}>Remove Key</Btn>}
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
          DjangoCMD v3.2 · TwitterAPI.io integrated · see you on the timeline, xoxo
        </span>
        <span style={{ fontSize: 10, color: T.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>
          gm fam · {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}
