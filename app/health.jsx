import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";

// ═══════════════════════════════════════════════════════════════
// THEME — uses same T object as dashboard.jsx (global)
// We read it dynamically so dark/light mode works automatically
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

// Detect theme from body background or default to dark
function getT() {
  if (typeof document !== "undefined") {
    const bg = getComputedStyle(document.body).backgroundColor;
    if (bg && (bg.includes("244") || bg.includes("255") || bg.includes("248"))) return LIGHT;
  }
  return DARK;
}

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

const Card = ({ children, style, T }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, ...style }}>{children}</div>
);

const SectionTitle = ({ icon, children, right, T }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "'Satoshi', sans-serif", letterSpacing: "-.01em" }}>{children}</span>
    </div>
    {right}
  </div>
);

const Badge = ({ color, children }) => (
  <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "15", padding: "3px 8px", borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: ".04em" }}>{children}</span>
);

const Mono = ({ children, color, size = 13, style, T }) => (
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
      <Card T={T}>
        <SectionTitle T={T} icon="⚡" right={
          <Badge color={T.green}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</Badge>
        }>Today's Vitals</SectionTitle>
        <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 20, padding: "10px 0" }}>
          <ProgressRing T={T} value={m.steps} max={m.stepsGoal} color={T.green} label="Steps" sublabel="daily" />
          <ProgressRing T={T} value={m.calories} max={m.caloriesGoal} color={T.amber} label="Calories" sublabel="intake" />
          <ProgressRing T={T} value={m.water} max={m.waterGoal} color={T.blue} label="Water" sublabel="liters" />
          <ProgressRing T={T} value={m.sleep} max={m.sleepGoal} color={T.purple} label="Sleep" sublabel="hours" />
          <ProgressRing T={T} value={m.activeMinutes} max={m.activeGoal} color={T.cyan} label="Active" sublabel="minutes" />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Heart Rate */}
        <Card T={T}>
          <SectionTitle T={T} icon="❤️" right={<span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.red, fontWeight: 600 }}>{m.heartRate} BPM</span>}>Heart Rate</SectionTitle>
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
        </Card>

        {/* Week Summary */}
        <Card T={T}>
          <SectionTitle T={T} icon="📅">Week at a Glance</SectionTitle>
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
        </Card>
      </div>

      {/* AI Health Advisor */}
      <Card T={T}>
        <SectionTitle T={T} icon="🧠" right={<Badge color={T.cyan}>COROS CONNECTED</Badge>}>AI Health Advisor</SectionTitle>
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
      </Card>
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
      <Card T={T}>
        <SectionTitle T={T} icon="📋" right={<Badge color={T.cyan}>PUSH / PULL / LEGS</Badge>}>Weekly Training Plan</SectionTitle>
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
      </Card>

      <Card T={T}>
        <SectionTitle T={T} icon="📊">Weekly Volume</SectionTitle>
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
      </Card>
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
        <Card T={T}>
          <SectionTitle T={T} icon="🎯" right={<span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.green, fontWeight: 600 }}>{totalCal} / {todayMetrics.caloriesGoal} kcal</span>}>Daily Macros</SectionTitle>
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
        </Card>

        {/* Meals */}
        <Card T={T}>
          <SectionTitle T={T} icon="🍽️">Today's Meal Plan</SectionTitle>
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
        </Card>
      </div>

      {/* Grocery */}
      <Card T={T}>
        <SectionTitle T={T} icon="🛒" right={
          <button onClick={() => setShowGrocery(!showGrocery)} style={{
            background: T.greenDim, color: T.green, border: `1px solid ${T.green}30`,
            borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Satoshi', sans-serif",
          }}>{showGrocery ? "Hide" : "Show"} Grocery List</button>
        }>Weekly Grocery List</SectionTitle>
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
      </Card>
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
        <Card T={T}>
          <SectionTitle T={T} icon="⚖️" right={
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.green, fontWeight: 600 }}>↓ {(weightHistory[0].weight - weightHistory[weightHistory.length - 1].weight).toFixed(1)}kg in {weightHistory.length} weeks</span>
          }>Weight Trend</SectionTitle>
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
        </Card>

        {/* Body Fat */}
        <Card T={T}>
          <SectionTitle T={T} icon="📉" right={
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.purple, fontWeight: 600 }}>↓ {(weightHistory[0].bf - weightHistory[weightHistory.length - 1].bf).toFixed(1)}% BF</span>
          }>Body Fat %</SectionTitle>
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
        </Card>
      </div>

      {/* Body Measurements */}
      <Card T={T}>
        <SectionTitle T={T} icon="📏">Body Measurements</SectionTitle>
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
      </Card>

      {/* AI Progress Report */}
      <Card T={T} style={{ borderLeft: `3px solid ${T.green}` }}>
        <SectionTitle T={T} icon="🧠">AI Progress Report</SectionTitle>
        <div style={{ fontSize: 13, color: T.textSoft, lineHeight: 1.8 }}>
          8-week progress looking solid fam. You've dropped <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.green, fontWeight: 600 }}>2.3kg</span> at a healthy rate of ~0.3kg/week — no muscle wasting, pure fat loss.
          Body fat went from <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.textSoft, fontWeight: 600 }}>18.2%</span> to <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.purple, fontWeight: 600 }}>16.1%</span> — that's legit.
          Arms and chest are growing which means the recomp is working. Waist down 2cm confirms you're losing fat from the right places.
          <br /><br />
          <span style={{ color: T.amber, fontWeight: 600 }}>Next 4 weeks:</span> Keep the deficit at 300-400kcal. Increase protein to 185g on training days.
          Add one extra set per exercise on compound lifts — time to push the progressive overload harder.
          You're on track for 78kg at 14% BF by end of Q1. Don't rush it — patience is your edge, as always.
        </div>
      </Card>
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

export default function HealthPanel() {
  const [tab, setTab] = useState("overview");

  // Read theme dynamically — works with dashboard's dark/light toggle
  const T = getT();

  // Also try reading from CSS custom property or fallback
  // This ensures theme sync even if dashboard uses a different method
  const isDarkBg = typeof document !== "undefined" && 
    document.querySelector("[style]")?.style?.backgroundColor?.includes("06060a");

  const theme = isDarkBg || (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? DARK : T;

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
          <Badge color={theme.cyan}>COROS PACE 3</Badge>
          <Badge color={theme.textDim}>MOCK DATA</Badge>
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
