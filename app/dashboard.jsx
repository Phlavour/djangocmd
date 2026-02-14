import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// DjangoCMD ANALYTICS v4.2
// supabase matching - planned vs spontaneous - content intelligence

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
  shadow: "0 1px 3px rgba(0,0,0,.06)",
};
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
  shadow: "none",
};
let T = LIGHT;

const PM = {
  growth: { label: "Growth", color: () => T.green, bg: () => T.greenDim },
  market: { label: "Market", color: () => T.blue, bg: () => T.blueDim },
  lifestyle: { label: "Lifestyle", color: () => T.purple, bg: () => T.purpleDim },
  busting: { label: "Myth Busting", color: () => T.amber, bg: () => T.amberDim },
  shitpost: { label: "Shitpost", color: () => T.red, bg: () => T.redDim },
};
const SM = {
  framework: "Framework", contrarian: "Contrarian", personal: "Personal",
  thread: "Thread", observation: "Observation", question: "Question", callout: "Callout",
  "observation \u2192 pattern": "Observation \u2192 Pattern",
  "problem \u2192 solution": "Problem \u2192 Solution",
  "story \u2192 lesson": "Story \u2192 Lesson",
  "contrarian take": "Contrarian Take",
};
const SK = "djangocmd_analytics_v4";

// CSV PARSER
function parseXDate(raw) {
  if (!raw) return null;
  const c = raw.replace(/^["']|["']$/g, "").trim();
  const m1 = c.match(/^[A-Z][a-z]{2},\s+([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/);
  if (m1) { const d = new Date(m1[1]+" "+m1[2]+", "+m1[3]); if (!isNaN(d)) return d; }
  const m2 = c.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/);
  if (m2) { const d = new Date(m2[1]+" "+m2[2]+", "+m2[3]); if (!isNaN(d)) return d; }
  const m3 = c.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m3) { const d = new Date(parseInt(m3[1]), parseInt(m3[2])-1, parseInt(m3[3])); if (!isNaN(d)) return d; }
  const d = new Date(c); return isNaN(d) ? null : d;
}
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const n = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - n);
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const w = Math.ceil((((d - y) / 86400000) + 1) / 7);
  return d.getUTCFullYear()+"-W"+String(w).padStart(2, "0");
}
function detectWeek(rows) {
  for (const r of rows) { const d = parseXDate(r["Date"]||r["date"]||""); if (d) return getISOWeek(d); }
  return "upload-"+Date.now();
}
function parseCSV(text) {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const h = csvLine(lines[0]);
  return lines.slice(1).map(l => {
    const v = csvLine(l); if (v.length < 2) return null;
    const r = {}; h.forEach((k,i) => { r[k.trim()] = (v[i]||"").trim(); }); return r;
  }).filter(Boolean);
}
function csvLine(line) {
  const r = []; let c = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i+1] === '"') { c += '"'; i++; } else q = !q; }
    else if (ch === "," && !q) { r.push(c); c = ""; } else c += ch;
  }
  r.push(c); return r;
}
function num(v) { return parseInt(v||"0",10)||0; }

// TEXT MATCHING
function norm(text, len) {
  return (text||"").toLowerCase().replace(/https?:\/\/\S+/g,"").replace(/[^\w\s]/g,"").replace(/\s+/g," ").trim().slice(0, len||60);
}
function findMatch(csvText, spPosts) {
  const n = norm(csvText); if (!n || n.length < 10) return null;
  let best = null, bestS = 0;
  for (const sp of spPosts) {
    const sn = norm(sp.post); if (!sn || sn.length < 10) continue;
    const short = n.length < sn.length ? n : sn;
    const long = n.length < sn.length ? sn : n;
    if (long.startsWith(short) || short.startsWith(long.slice(0, short.length))) {
      const s = short.length / Math.max(long.length, 1);
      if (s > bestS && s > 0.5) { bestS = s; best = sp; }
    }
    const cl = Math.min(n.length, sn.length, 50);
    if (cl >= 15) {
      let m = 0; for (let i = 0; i < cl; i++) { if (n[i] === sn[i]) m++; }
      const ov = m / cl;
      if (ov > bestS && ov > 0.75) { bestS = ov; best = sp; }
    }
  }
  return best;
}

// SUPABASE
async function fetchSPosts(url, key) {
  if (!url || !key) return [];
  try {
    const r = await fetch(url+"/rest/v1/posts?select=post,category,structure,score,tab&or=(tab.eq.USED,tab.eq.DATABASE,tab.eq.POST)&order=created_at.desc&limit=500",
      { headers: { apikey: key, Authorization: "Bearer "+key } });
    if (!r.ok) throw new Error("HTTP "+r.status);
    return await r.json();
  } catch(e) { console.error("Supabase:", e); return []; }
}

// AI CLASSIFY (spontaneous posts)
async function aiClassify(posts, apiKey) {
  if (!apiKey || !posts.length) return posts;
  const texts = posts.map((p,i) => "["+i+'] "'+p.text.slice(0,150)+'"').join("\n");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000,
        messages: [{ role: "user", content: "Classify these Twitter posts for @django_xbt (crypto trader, growth strategist).\nFor each: pillar (growth|market|lifestyle|busting|shitpost), structure (framework|contrarian|personal|thread|observation|question|callout), score (1-10).\n\nPosts:\n"+texts+"\n\nRespond ONLY JSON array: [{\"idx\":0,\"pillar\":\"growth\",\"structure\":\"framework\",\"score\":7}, ...]" }],
      }),
    });
    const d = await r.json();
    const t = d.content?.map(c => c.text||"").join("")||"";
    const parsed = JSON.parse(t.replace(/```json|```/g,"").trim());
    return posts.map((p,i) => { const c = parsed.find(x => x.idx===i); return c ? {...p, pillar:c.pillar, structure:c.structure, aiScore:c.score} : p; });
  } catch(e) { console.error("AI classify:", e); return posts; }
}

// UI COMPONENTS
const Card = ({ children, style: sx }) => (
  <div style={{ background: T.card, border: "1px solid "+T.border, borderRadius: 12, padding: 20, boxShadow: T.shadow, transition: "all .15s", ...sx }}>{children}</div>
);
const SH = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: T.textDim, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14, marginTop: 28 }}>{children}</div>
);
const Metric = ({ label, value, sub, color }) => (
  <div style={{ flex: 1, minWidth: 130 }}>
    <div style={{ fontSize: 10, color: T.textSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: color||T.text, fontFamily: "'JetBrains Mono', monospace" }}>{typeof value==="number"?value.toLocaleString():value}</div>
    {sub && <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{sub}</div>}
  </div>
);
const PillTag = ({ pillar }) => {
  const k = (pillar||"").toLowerCase(); const p = PM[k];
  if (!p) return <span style={{ fontSize: 10, color: T.textDim, padding: "2px 6px", background: T.surfaceAlt, borderRadius: 4 }}>untagged</span>;
  return <span style={{ fontSize: 10, fontWeight: 600, color: p.color(), padding: "2px 8px", background: p.bg(), borderRadius: 4 }}>{p.label}</span>;
};
const StructTag = ({ structure }) => {
  const k = (structure||"").toLowerCase(); const s = SM[k];
  if (!s && !structure) return null;
  return <span style={{ fontSize: 10, color: T.textSoft, padding: "2px 6px", background: T.surfaceAlt, borderRadius: 4 }}>{s||structure}</span>;
};
const SrcTag = ({ source }) => (
  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: source==="planned"?T.green:T.cyan, padding: "2px 6px", borderRadius: 4, background: source==="planned"?T.greenDim:T.cyanDim, textTransform: "uppercase" }}>{source}</span>
);
const Btn = ({ children, onClick, active, small, danger, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: active?T.greenDim:danger?T.redDim:"transparent",
    color: active?T.green:danger?T.red:T.textSoft,
    border: "1px solid "+(active?T.greenMid:danger?"rgba(224,51,78,.3)":T.border),
    borderRadius: 8, padding: small?"5px 10px":"8px 16px",
    fontSize: small?11:12, cursor: disabled?"not-allowed":"pointer",
    fontWeight: 500, opacity: disabled?0.5:1, transition: "all .15s",
  }}>{children}</button>
);
const Dot = ({ color }) => <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color }} />;
const CTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (<div style={{ background: T.card, border: "1px solid "+T.border, borderRadius: 8, padding: 10, fontSize: 11, boxShadow: T.shadow }}>
    <div style={{ color: T.textSoft, marginBottom: 4 }}>{label}</div>
    {payload.map((p,i) => <div key={i} style={{ color: p.color||T.text, marginBottom: 2 }}>{p.name}: <strong>{typeof p.value==="number"?p.value.toLocaleString():p.value}</strong></div>)}
  </div>);
};

function loadH() { try { return JSON.parse(sessionStorage.getItem(SK)||"{}"); } catch { return {}; } }
function saveH(h) { try { sessionStorage.setItem(SK, JSON.stringify(h)); } catch {} }

// MAIN COMPONENT
export default function AnalyticsDashboard() {
  const [isDark, setIsDark] = useState(false);
  const [history, setHistory] = useState(() => loadH());
  const [selWeek, setSelWeek] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState("");
  const [repLoad, setRepLoad] = useState(false);
  const [view, setView] = useState("pillars");
  const [apiKey, setApiKey] = useState(() => { try { return sessionStorage.getItem("djangocmd_apikey")||""; } catch { return ""; } });
  const [sUrl, setSUrl] = useState(() => { try { return sessionStorage.getItem("djangocmd_supa_url")||""; } catch { return ""; } });
  const [sKey, setSKey] = useState(() => { try { return sessionStorage.getItem("djangocmd_supa_key")||""; } catch { return ""; } });
  const [showSet, setShowSet] = useState(false);

  T = isDark ? DARK : LIGHT;
  useEffect(() => { saveH(history); }, [history]);

  const weeks = Object.keys(history).sort();
  const curWeek = selWeek || weeks[weeks.length-1];
  const wd = curWeek ? history[curWeek] : null;

  // UPLOAD CONTENT CSV + MATCH
  const uploadContent = useCallback(async (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    setBusy(true); setStatus("parsing...");
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) { setStatus("error: empty CSV"); setBusy(false); return; }
    const wk = detectWeek(rows);

    const originals = rows.filter(r => {
      const t = r["Post text"]||r["Tweet text"]||"";
      return !t.startsWith("@") && num(r["Impressions"]||r["impressions"]) > 0;
    }).map(r => ({
      id: r["Post id"]||"", date: r["Date"]||"",
      text: r["Post text"]||r["Tweet text"]||"",
      link: r["Post Link"]||"",
      impressions: num(r["Impressions"]||r["impressions"]),
      likes: num(r["Likes"]||r["likes"]),
      engagements: num(r["Engagements"]||r["engagements"]),
      bookmarks: num(r["Bookmarks"]||r["bookmarks"]),
      reposts: num(r["Reposts"]||r["Retweets"]||r["reposts"]),
      replies: num(r["Replies"]||r["replies"]),
      follows: num(r["New follows"]),
      pillar: null, structure: null, aiScore: null, source: "spontaneous",
    }));
    const repCount = rows.length - originals.length;
    setStatus(originals.length+" originals ("+repCount+" replies filtered). matching...");

    // Match with Supabase
    let matched = 0; const unmatched = [];
    if (sUrl && sKey) {
      setStatus("fetching supabase posts...");
      const sp = await fetchSPosts(sUrl, sKey);
      if (sp.length > 0) {
        for (const o of originals) {
          const m = findMatch(o.text, sp);
          if (m) {
            o.pillar = (m.category||"").toLowerCase();
            o.structure = (m.structure||"").toLowerCase();
            o.aiScore = parseInt(m.score)||null;
            o.source = "planned"; matched++;
          } else { unmatched.push(o); }
        }
        setStatus(matched+" planned matched, "+unmatched.length+" spontaneous");
      } else { originals.forEach(o => unmatched.push(o)); setStatus("no supabase posts found"); }
    } else { originals.forEach(o => unmatched.push(o)); setStatus("supabase not connected"); }

    // AI classify spontaneous
    if (unmatched.length > 0 && apiKey) {
      setStatus(s => s+" | classifying "+unmatched.length+" spontaneous...");
      const cls = await aiClassify(unmatched, apiKey);
      for (const cp of cls) {
        const o = originals.find(x => x.id===cp.id);
        if (o) { o.pillar = cp.pillar||o.pillar; o.structure = cp.structure||o.structure; o.aiScore = cp.aiScore||o.aiScore; }
      }
      setStatus("\u2713 "+wk+" | "+matched+" planned | "+unmatched.length+" spontaneous (classified)");
    } else if (unmatched.length > 0) {
      setStatus("\u2713 "+wk+" | "+matched+" planned | "+unmatched.length+" spontaneous (no API key)");
    } else {
      setStatus("\u2713 "+wk+" | "+matched+" planned | 0 spontaneous");
    }

    setHistory(p => ({...p, [wk]: {...p[wk], originals, totalPosts: rows.length, replyCount: repCount, matchedCount: matched, spontCount: unmatched.length}}));
    setSelWeek(wk); setBusy(false);
  }, [sUrl, sKey, apiKey]);

  // UPLOAD OVERVIEW CSV
  const uploadOverview = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (!rows.length) { setStatus("error: empty"); return; }
      const wk = detectWeek(rows);
      const daily = rows.map(r => ({ date: r["Date"]||"", impressions: num(r["Impressions"]), likes: num(r["Likes"]), engagements: num(r["Engagements"]), newFollows: num(r["New follows"]), unfollows: num(r["Unfollows"]) }));
      setHistory(p => ({...p, [wk]: {...p[wk], daily}}));
      setSelWeek(wk); setStatus("\u2713 overview \u2192 "+wk+" | "+daily.length+" days");
    };
    reader.readAsText(file);
  }, []);

  // RE-MATCH
  const reMatch = async () => {
    if (!wd?.originals || !sUrl || !sKey) return;
    setBusy(true); setStatus("re-matching...");
    const sp = await fetchSPosts(sUrl, sKey);
    let matched = 0; const unm = [];
    const upd = wd.originals.map(o => {
      const m = findMatch(o.text, sp);
      if (m) { matched++; return {...o, pillar:(m.category||"").toLowerCase(), structure:(m.structure||"").toLowerCase(), aiScore:parseInt(m.score)||o.aiScore, source:"planned"}; }
      unm.push(o); return {...o, source:"spontaneous"};
    });
    if (unm.length > 0 && apiKey) {
      const cls = await aiClassify(unm, apiKey);
      for (const cp of cls) { const u = upd.find(x=>x.id===cp.id); if (u && u.source==="spontaneous") { u.pillar=cp.pillar||u.pillar; u.structure=cp.structure||u.structure; u.aiScore=cp.aiScore||u.aiScore; } }
    }
    setHistory(p => ({...p, [curWeek]: {...p[curWeek], originals: upd, matchedCount: matched, spontCount: unm.length}}));
    setStatus("\u2713 "+matched+" planned, "+unm.length+" spontaneous"); setBusy(false);
  };

  // WEEKLY REPORT
  const genReport = async () => {
    if (!apiKey) { setShowSet(true); return; }
    setRepLoad(true); setReport("");
    const o = wd?.originals||[]; const d = wd?.daily||[];
    const tImp = d.reduce((s,x)=>s+x.impressions,0)||o.reduce((s,x)=>s+x.impressions,0);
    const pl = o.filter(p=>p.source==="planned"), sp = o.filter(p=>p.source==="spontaneous");
    const ps = {}; o.filter(p=>p.pillar).forEach(p => { if(!ps[p.pillar]) ps[p.pillar]={n:0,imp:0,eng:0}; ps[p.pillar].n++; ps[p.pillar].imp+=p.impressions; ps[p.pillar].eng+=p.engagements; });
    const maxI = Math.max(...o.map(x=>x.impressions),1);
    const prompt = "You are Django's (@django_xbt) content strategist. Sharp weekly analysis.\n\nWEEK: "+curWeek+"\nImpressions: "+tImp.toLocaleString()+" | Posts: "+o.length+" ("+pl.length+" planned, "+sp.length+" spontaneous)\n\nPLANNED avg imp: "+(pl.length?Math.round(pl.reduce((s,p)=>s+p.impressions,0)/pl.length):0)+"\nSPONTANEOUS avg imp: "+(sp.length?Math.round(sp.reduce((s,p)=>s+p.impressions,0)/sp.length):0)+"\n\nPILLARS:\n"+Object.entries(ps).map(([k,v])=>k+": "+v.n+" posts, avg "+Math.round(v.imp/v.n)+" imp").join("\n")+"\n\nTOP 10:\n"+o.sort((a,b)=>b.impressions-a.impressions).slice(0,10).map((p,i)=>(i+1)+". ["+p.impressions+" imp, "+p.likes+"L] "+p.source+"/"+p.pillar+"/"+p.structure+(p.aiScore?" AI:"+p.aiScore:"")+'\n   "'+p.text.slice(0,120)+'"').join("\n")+"\n\nSCORING:\n"+o.filter(p=>p.aiScore).map(p=>"AI:"+p.aiScore+" Real:"+Math.max(1,Math.min(10,Math.round((p.impressions/maxI)*10)))+" ("+p.impressions+" imp)").join(", ")+"\n\nGive WEEKLY REPORT:\n1. TL;DR (2 sentences)\n2. PLANNED vs SPONTANEOUS\n3. PILLAR PERFORMANCE\n4. STRUCTURE ANALYSIS\n5. SCORING CHECK\n6. TOP INSIGHT\n7. NEXT WEEK - 3 action items\n\nDirect, lowercase. No fluff.";
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]}) });
      const data = await r.json(); setReport(data.content?.map(c=>c.text||"").join("")||"no response");
    } catch(e) { setReport("error: "+e.message); }
    setRepLoad(false);
  };

  const clearH = () => { sessionStorage.removeItem(SK); setHistory({}); setSelWeek(null); setStatus("cleared"); };
  const exportH = () => { const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(history,null,2)],{type:"application/json"})); a.download="djangocmd-analytics-"+new Date().toISOString().slice(0,10)+".json"; a.click(); };
  const importH = (e) => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=(ev)=>{try{setHistory(JSON.parse(ev.target.result));setStatus("\u2713 imported");}catch{setStatus("error: bad JSON");}}; r.readAsText(f); };

  // COMPUTED DATA
  const originals = wd?.originals||[];
  const daily = wd?.daily||[];
  const topPosts = [...originals].sort((a,b) => b.impressions-a.impressions);
  const hasClass = originals.some(p => p.pillar);
  const hasScores = originals.some(p => p.aiScore);
  const planned = originals.filter(p => p.source==="planned");
  const spont = originals.filter(p => p.source==="spontaneous");

  const totalImp = daily.reduce((s,d)=>s+d.impressions,0)||originals.reduce((s,p)=>s+p.impressions,0);
  const totalEng = daily.reduce((s,d)=>s+d.engagements,0)||originals.reduce((s,p)=>s+p.engagements,0);
  const engRate = totalImp > 0 ? ((totalEng/totalImp)*100).toFixed(2) : "0";

  const pillarData = {};
  originals.filter(p=>p.pillar).forEach(p => {
    const k=p.pillar; if(!pillarData[k]) pillarData[k]={posts:0,imp:0,likes:0,eng:0,topImp:0,pl:0,sp:0};
    const d=pillarData[k]; d.posts++; d.imp+=p.impressions; d.likes+=p.likes; d.eng+=p.engagements;
    d.topImp=Math.max(d.topImp,p.impressions); if(p.source==="planned") d.pl++; else d.sp++;
  });
  const pillarChart = Object.entries(pillarData).map(([k,v])=>({
    name: PM[k]?.label||k, key: k, posts: v.posts, avgImp: Math.round(v.imp/v.posts),
    avgEng: Math.round(v.eng/v.posts), avgLikes: Math.round(v.likes/v.posts),
    engRate: v.imp>0?((v.eng/v.imp)*100).toFixed(1):"0", topImp: v.topImp, pl: v.pl, sp: v.sp,
  })).sort((a,b)=>b.avgImp-a.avgImp);

  const structData = {};
  originals.filter(p=>p.structure).forEach(p => {
    const k=p.structure; if(!structData[k]) structData[k]={posts:0,imp:0,eng:0};
    structData[k].posts++; structData[k].imp+=p.impressions; structData[k].eng+=p.engagements;
  });
  const structChart = Object.entries(structData).map(([k,v])=>({
    name: SM[k.toLowerCase()]||k, posts: v.posts, avgImp: Math.round(v.imp/v.posts),
    engRate: v.imp>0?((v.eng/v.imp)*100).toFixed(1):"0",
  })).sort((a,b)=>b.avgImp-a.avgImp);

  const maxImp = Math.max(...originals.map(p=>p.impressions),1);
  const scoreComp = originals.filter(p=>p.aiScore).map(p => {
    const real = Math.max(1,Math.min(10,Math.round((p.impressions/maxImp)*10)));
    return { text:p.text.slice(0,45)+"...", full:p.text, ai:p.aiScore, real, diff:p.aiScore-real, imp:p.impressions, pillar:p.pillar, src:p.source };
  }).sort((a,b)=>b.imp-a.imp);
  const avgDiff = scoreComp.length ? (scoreComp.reduce((s,c)=>s+Math.abs(c.diff),0)/scoreComp.length).toFixed(1) : null;

  const plAvgImp = planned.length ? Math.round(planned.reduce((s,p)=>s+p.impressions,0)/planned.length) : 0;
  const spAvgImp = spont.length ? Math.round(spont.reduce((s,p)=>s+p.impressions,0)/spont.length) : 0;
  const plAvgEng = planned.length ? Math.round(planned.reduce((s,p)=>s+p.engagements,0)/planned.length) : 0;
  const spAvgEng = spont.length ? Math.round(spont.reduce((s,p)=>s+p.engagements,0)/spont.length) : 0;

  const prevWk = weeks.length>=2 && curWeek===weeks[weeks.length-1] ? weeks[weeks.length-2] : null;
  const prevImp = prevWk ? (history[prevWk]?.daily||[]).reduce((s,d)=>s+d.impressions,0) : 0;
  const wowImp = prevImp>0 ? (((totalImp-prevImp)/prevImp)*100).toFixed(1) : null;

  const pillarTrend = weeks.map(w => {
    const cls = (history[w]?.originals||[]).filter(p=>p.pillar);
    const by = {}; cls.forEach(p => { if(!by[p.pillar]) by[p.pillar]={imp:0,n:0}; by[p.pillar].imp+=p.impressions; by[p.pillar].n++; });
    const e = { week: w.replace(/^\d{4}-/,"") };
    Object.keys(PM).forEach(k => { e[k] = by[k] ? Math.round(by[k].imp/by[k].n) : 0; });
    return e;
  });

  // RENDER
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", transition: "background .3s, color .3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        input[type="file"] { display: none; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: T.surface, borderBottom: "1px solid "+T.border, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100, boxShadow: isDark?"none":"0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.green, fontFamily: "'JetBrains Mono'" }}>DjangoCMD</span>
          <span style={{ fontSize: 10, color: T.textDim, padding: "2px 8px", background: T.greenDim, borderRadius: 4, border: "1px solid "+T.greenMid, fontFamily: "'JetBrains Mono'" }}>analytics</span>
          {sUrl && <span style={{ fontSize: 9, color: T.green }}>● supabase</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {weeks.length > 0 && <select value={curWeek||""} onChange={e=>setSelWeek(e.target.value)} style={{ background: T.card, color: T.text, border: "1px solid "+T.border, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontFamily: "'JetBrains Mono'", cursor: "pointer" }}>
            {weeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>}
          <button onClick={()=>setIsDark(d=>!d)} style={{ background: T.card, border: "1px solid "+T.border, borderRadius: 16, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: T.textSoft, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ transition: "transform .3s", transform: isDark?"rotate(180deg)":"", display: "inline-block" }}>{isDark?"\u263e":"\u2600"}</span>
            <span style={{ fontSize: 10 }}>{isDark?"nite":"day"}</span>
          </button>
          <Btn small onClick={()=>setShowSet(!showSet)}>{showSet?"\u2715":"\u2699"}</Btn>
        </div>
      </div>

      {/* SETTINGS */}
      {showSet && <div style={{ background: T.surface, borderBottom: "1px solid "+T.border, padding: "12px 24px" }}>
        {[["Supabase URL:", sUrl, v=>{setSUrl(v);try{sessionStorage.setItem("djangocmd_supa_url",v)}catch{}}, "https://xxx.supabase.co"],
          ["Supabase Key:", sKey, v=>{setSKey(v);try{sessionStorage.setItem("djangocmd_supa_key",v)}catch{}}, "sb_publishable_..."],
          ["Claude API:", apiKey, v=>{setApiKey(v);try{sessionStorage.setItem("djangocmd_apikey",v)}catch{}}, "sk-ant-..."]
        ].map(([label, val, set, ph], i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: T.textSoft, minWidth: 90 }}>{label}</span>
            <input type={i>0?"password":"text"} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
              style={{ background: T.card, color: T.text, border: "1px solid "+T.border, borderRadius: 6, padding: "5px 10px", fontSize: 11, width: 280, fontFamily: "'JetBrains Mono'" }} />
            {i===2 && <span style={{ fontSize: 10, color: val?T.green:T.red }}>{val?"\u2713":"\u2715"}</span>}
          </div>
        ))}
      </div>}

      <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
        {/* UPLOAD */}
        <Card style={{ marginBottom: 20, padding: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ background: T.greenDim, color: T.green, border: "1px solid "+T.greenMid, borderRadius: 8, padding: "7px 14px", fontSize: 11, fontWeight: 600, cursor: busy?"wait":"pointer", opacity: busy?0.6:1 }}>
              {busy?"\u23f3 processing...":"\ud83d\udcc4 Content CSV"}
              <input type="file" accept=".csv" onChange={uploadContent} disabled={busy} />
            </label>
            <label style={{ background: T.blueDim, color: T.blue, border: "1px solid rgba(45,114,229,.3)", borderRadius: 8, padding: "7px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              \ud83d\udcca Overview CSV
              <input type="file" accept=".csv" onChange={uploadOverview} />
            </label>
            {wd && sUrl && <Btn small onClick={reMatch} disabled={busy}>{busy?"\u23f3":"\ud83d\udd04 Re-match"}</Btn>}
            <div style={{ flex: 1 }} />
            <Btn small onClick={exportH}>\u2193 Export</Btn>
            <label><Btn small onClick={()=>{}}>\u2191 Import</Btn><input type="file" accept=".json" onChange={importH} /></label>
            <Btn small danger onClick={clearH}>\ud83d\uddd1</Btn>
          </div>
          {status && <div style={{ fontSize: 10, marginTop: 6, fontFamily: "'JetBrains Mono'", color: status.startsWith("\u2713")?T.green:status.startsWith("error")?T.red:T.textSoft }}>{status}</div>}
        </Card>

        {/* EMPTY */}
        {!wd && <div style={{ textAlign: "center", padding: 80, color: T.textDim }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>\ud83d\udcc8</div>
          <div style={{ fontSize: 13 }}>upload X analytics CSVs to start</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>content CSV auto-matches with supabase posts \u2192 pillar + structure + AI score</div>
        </div>}

        {wd && (<>
          {/* QUICK STATS */}
          <Card style={{ marginBottom: 20, padding: 16 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Metric label="Impressions" value={totalImp} sub={wowImp?(parseFloat(wowImp)>=0?"\u2191":"\u2193")+Math.abs(wowImp)+"% wow":null} color={T.green} />
              <Metric label="Eng Rate" value={engRate+"%"} color={T.amber} />
              <Metric label="Posts" value={originals.length} sub={planned.length+" planned \u00b7 "+spont.length+" spontaneous"} />
              {hasScores && <Metric label="AI Accuracy" value={"\u00b1"+avgDiff} color={parseFloat(avgDiff)<2?T.green:parseFloat(avgDiff)<3?T.amber:T.red} sub="avg score diff" />}
            </div>
          </Card>

          {/* PLANNED vs SPONTANEOUS */}
          {planned.length > 0 && spont.length > 0 && <Card style={{ marginBottom: 20, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><span>\u26a1</span> Planned vs Spontaneous</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ padding: 14, background: T.greenDim, borderRadius: 10, border: "1px solid "+T.greenMid }}>
                <div style={{ fontSize: 10, color: T.green, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>PLANNED ({planned.length})</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono'" }}>{plAvgImp.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: T.textSoft }}>avg impressions</div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>{plAvgEng} avg eng</div>
              </div>
              <div style={{ padding: 14, background: T.cyanDim, borderRadius: 10, border: "1px solid rgba(0,153,204,.2)" }}>
                <div style={{ fontSize: 10, color: T.cyan, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>SPONTANEOUS ({spont.length})</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono'" }}>{spAvgImp.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: T.textSoft }}>avg impressions</div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>{spAvgEng} avg eng</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.textSoft, marginTop: 10, textAlign: "center" }}>
              {plAvgImp>spAvgImp ? "planned posts outperform by "+Math.round(((plAvgImp-spAvgImp)/Math.max(spAvgImp,1))*100)+"%" : "spontaneous posts outperform by "+Math.round(((spAvgImp-plAvgImp)/Math.max(plAvgImp,1))*100)+"%"}
            </div>
          </Card>}

          {/* VIEW TABS */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {[{id:"pillars",label:"Content Pillars",ic:"\ud83d\udcca"},{id:"scoring",label:"AI Scoring",ic:"\ud83c\udfaf"},{id:"summary",label:"Weekly Summary",ic:"\ud83d\udccb"}].map(tab => (
              <button key={tab.id} onClick={()=>setView(tab.id)} style={{
                background: view===tab.id?T.greenDim:"transparent", color: view===tab.id?T.green:T.textSoft,
                border: "1px solid "+(view===tab.id?T.greenMid:T.border), borderRadius: 8, padding: "8px 16px",
                fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}><span>{tab.ic}</span> {tab.label}</button>
            ))}
          </div>

          {/* PILLARS VIEW */}
          {view==="pillars" && (<>
            {!hasClass ? <Card><div style={{ textAlign: "center", padding: 40, color: T.textDim }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>{"\ud83e\udd16"}</div>
              <div style={{ fontSize: 13 }}>{sUrl?"upload content CSV \u2014 posts auto-match with supabase":"connect supabase in \u2699 settings, then upload CSV"}</div>
            </div></Card> : (<>
              <SH>pillar performance \u2014 avg impressions</SH>
              <Card style={{ marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={Math.max(180, pillarChart.length*48)}>
                  <BarChart data={pillarChart} layout="vertical" barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: T.textDim }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: T.textSoft }} axisLine={false} width={100} />
                    <Tooltip content={<CTip />} />
                    <Bar dataKey="avgImp" radius={[0,6,6,0]} name="Avg Impressions">
                      {pillarChart.map((e,i) => <Cell key={i} fill={PM[e.key]?.color()||T.textDim} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 16 }}>
                {pillarChart.map(p => <Card key={p.key} style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <PillTag pillar={p.key} />
                    <span style={{ fontSize: 10, color: T.textDim }}>{p.pl}P \u00b7 {p.sp}S</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: PM[p.key]?.color()||T.text, fontFamily: "'JetBrains Mono'", marginBottom: 4 }}>{p.avgImp.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: T.textSoft }}>avg imp \u00b7 {p.engRate}% eng \u00b7 {p.posts} posts</div>
                </Card>)}
              </div>

              {structChart.length > 0 && (<>
                <SH>post structure performance</SH>
                <Card style={{ marginBottom: 16 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={structChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.textSoft }} axisLine={{ stroke: T.border }} />
                      <YAxis tick={{ fontSize: 10, fill: T.textDim }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CTip />} />
                      <Bar dataKey="avgImp" fill={T.blue} radius={[4,4,0,0]} name="Avg Impressions" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {structChart.map(s => <div key={s.name} style={{ background: T.surfaceAlt, borderRadius: 6, padding: "5px 9px", border: "1px solid "+T.border, fontSize: 10, color: T.textSoft }}>
                      {s.name}: <strong style={{ color: T.text }}>{s.avgImp.toLocaleString()}</strong> avg \u00b7 {s.engRate}% eng \u00b7 {s.posts}x
                    </div>)}
                  </div>
                </Card>
              </>)}

              {weeks.length >= 2 && (<>
                <SH>pillar trend over time</SH>
                <Card style={{ marginBottom: 16 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={pillarTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: T.textSoft }} />
                      <YAxis tick={{ fontSize: 10, fill: T.textDim }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CTip />} />
                      {Object.entries(PM).map(([k,v]) => <Line key={k} type="monotone" dataKey={k} stroke={v.color()} strokeWidth={2} dot={{ fill: v.color(), r: 3 }} name={v.label} />)}
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </>)}

              <SH>top posts</SH>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                {topPosts.slice(0,10).map((p,i) => <Card key={p.id||i} style={{ padding: 12, cursor: p.link?"pointer":"default" }} onClick={()=>p.link&&window.open(p.link,"_blank")}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: i===0?T.green:i<3?T.blue:T.textDim, fontFamily: "'JetBrains Mono'", minWidth: 28 }}>#{i+1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5, marginBottom: 6, wordBreak: "break-word" }}>{p.text.length>180?p.text.slice(0,180)+"...":p.text}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: T.green, fontFamily: "'JetBrains Mono'" }}>{p.impressions.toLocaleString()} imp</span>
                        <span style={{ fontSize: 10, color: T.blue }}>{"\u2665"} {p.likes}</span>
                        <span style={{ fontSize: 10, color: T.purple }}>{p.engagements} eng</span>
                        {p.aiScore && <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: p.aiScore>=7?T.greenDim:p.aiScore>=5?T.amberDim:T.redDim, color: p.aiScore>=7?T.green:p.aiScore>=5?T.amber:T.red }}>AI:{p.aiScore}/10</span>}
                        <PillTag pillar={p.pillar} />
                        <StructTag structure={p.structure} />
                        <SrcTag source={p.source} />
                      </div>
                    </div>
                  </div>
                </Card>)}
              </div>
            </>)}
          </>)}

          {/* SCORING VIEW */}
          {view==="scoring" && (<>
            {!hasScores ? <Card><div style={{ textAlign: "center", padding: 40, color: T.textDim }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>{"\ud83c\udfaf"}</div>
              <div style={{ fontSize: 13 }}>no AI scores yet \u2014 upload content CSV to match with supabase scores</div>
            </div></Card> : (<>
              <SH>ai predicted vs real performance</SH>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: T.textSoft, marginBottom: 12 }}>AI score from content tab vs real performance (1-10). Source tag shows planned vs spontaneous.</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={scoreComp}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="text" tick={{ fontSize: 9, fill: T.textDim }} angle={-15} textAnchor="end" height={60} />
                    <YAxis domain={[0,10]} tick={{ fontSize: 10, fill: T.textDim }} axisLine={false} tickLine={false} />
                    <Tooltip content={({active,payload})=>{
                      if(!active||!payload?.length) return null; const d=payload[0]?.payload;
                      return <div style={{ background: T.card, border: "1px solid "+T.border, borderRadius: 8, padding: 10, fontSize: 11, maxWidth: 300, boxShadow: T.shadow }}>
                        <div style={{ color: T.text, marginBottom: 4, lineHeight: 1.4 }}>{d?.full?.slice(0,120)}</div>
                        <div style={{ color: T.purple }}>AI: <strong>{d?.ai}/10</strong></div>
                        <div style={{ color: T.green }}>Real: <strong>{d?.real}/10</strong></div>
                        <div style={{ color: T.textDim }}>{d?.imp?.toLocaleString()} imp \u00b7 {d?.src}</div>
                      </div>;
                    }} />
                    <Bar dataKey="ai" fill={T.purple} radius={[3,3,0,0]} name="AI Predicted" />
                    <Bar dataKey="real" fill={T.green} radius={[3,3,0,0]} name="Real Performance" />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 10 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, color: T.textSoft }}><Dot color={T.purple} /> AI Predicted</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, color: T.textSoft }}><Dot color={T.green} /> Real</span>
                </div>
              </Card>

              <SH>score breakdown</SH>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                {scoreComp.map((sc,i) => { const ad=Math.abs(sc.diff); const acc=ad<=1?"spot on":ad<=2?"close":ad<=3?"off":"way off"; const ac=ad<=1?T.green:ad<=2?T.amber:T.red;
                  return <Card key={i} style={{ padding: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ minWidth: 50, textAlign: "center" }}><div style={{ fontSize: 10, color: T.textDim }}>AI</div><div style={{ fontSize: 20, fontWeight: 700, color: T.purple, fontFamily: "'JetBrains Mono'" }}>{sc.ai}</div></div>
                      <div style={{ fontSize: 16, color: T.textDim }}>{"\u2192"}</div>
                      <div style={{ minWidth: 50, textAlign: "center" }}><div style={{ fontSize: 10, color: T.textDim }}>Real</div><div style={{ fontSize: 20, fontWeight: 700, color: T.green, fontFamily: "'JetBrains Mono'" }}>{sc.real}</div></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: T.text, lineHeight: 1.4, marginBottom: 4 }}>{sc.full.slice(0,120)}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 10, color: T.textDim }}>{sc.imp.toLocaleString()} imp</span>
                          <PillTag pillar={sc.pillar} />
                          <SrcTag source={sc.src} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: ac, padding: "1px 6px", background: ad<=1?T.greenDim:ad<=2?T.amberDim:T.redDim, borderRadius: 4 }}>{acc} ({sc.diff>0?"+":""}{sc.diff})</span>
                        </div>
                      </div>
                    </div>
                  </Card>; })}
              </div>
            </>)}
          </>)}

          {/* SUMMARY VIEW */}
          {view==="summary" && (<>
            <SH>ai weekly report</SH>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: report?16:0 }}>
                <Btn active onClick={genReport} disabled={repLoad}>{repLoad?"\u23f3 analyzing...":"\ud83e\udd16 Generate Weekly Report"}</Btn>
                {!apiKey && <span style={{ fontSize: 10, color: T.red }}>set Claude API key in \u2699</span>}
              </div>
              {report && <div style={{ whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.8, color: T.text, padding: 16, background: T.surfaceAlt, borderRadius: 8, border: "1px solid "+T.border }}>{report}</div>}
            </Card>

            {hasClass && (<>
              <SH>quick stats</SH>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
                <Card style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, marginBottom: 4 }}>BEST PILLAR</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{pillarChart[0]?.name||"\u2014"}</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>{pillarChart[0]?.avgImp?.toLocaleString()||0} avg imp</div>
                </Card>
                <Card style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, marginBottom: 4 }}>BEST STRUCTURE</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{structChart[0]?.name||"\u2014"}</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>{structChart[0]?.avgImp?.toLocaleString()||0} avg imp</div>
                </Card>
                <Card style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, marginBottom: 4 }}>PLANNED vs SPONT</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: plAvgImp>spAvgImp?T.green:T.cyan }}>{plAvgImp>spAvgImp?"Planned wins":"Spontaneous wins"}</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>{plAvgImp.toLocaleString()} vs {spAvgImp.toLocaleString()}</div>
                </Card>
                {hasScores && <Card style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, color: T.textSoft, marginBottom: 4 }}>AI ACCURACY</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: parseFloat(avgDiff)<2?T.green:T.amber, fontFamily: "'JetBrains Mono'" }}>{"\u00b1"}{avgDiff}</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>avg score diff</div>
                </Card>}
              </div>
            </>)}
          </>)}
        </>)}

        <div style={{ textAlign: "center", padding: "28px 0 12px", fontSize: 10, color: T.textDim, fontFamily: "'JetBrains Mono'" }}>
          DjangoCMD v4.2 \u00b7 supabase matching \u00b7 planned vs spontaneous \u00b7 see you on the timeline, xoxo
        </div>
      </div>
    </div>
  );
}
