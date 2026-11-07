"use client";

import { useMemo, useRef, useState } from "react";
import {
  Area, ComposedChart, CartesianGrid, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  CATEGORY_LABELS, Category, EMPTY_SCENARIO, Profile, Scenario, dayZero, forecast, grade, healthScore,
  indicators, monthlyExpenses, monthlyIncome, profileFromCsv, summarize,
} from "@/lib/finance";
import { PROFILES } from "@/lib/profiles";

const money = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString();
const toneText = { good: "text-lime", warn: "text-amber", bad: "text-pink" } as const;
const toneBg = { good: "bg-lime", warn: "bg-amber", bad: "bg-pink" } as const;

type Msg = { role: "user" | "coach"; text: string };

const PRESETS: { label: string; apply: (s: Scenario) => Scenario }[] = [
  { label: "🍔 Delivery detox (−50% dining)", apply: (s) => ({ ...s, cuts: { ...s.cuts, dining: 0.5 } }) },
  { label: "⏱ +8 hrs/week at $15", apply: (s) => ({ ...s, extraWeekly: 120 }) },
  { label: "🌴 Spring Break trip ($600)", apply: (s) => ({ ...s, purchase: 600, purchaseDay: 14 }) },
  { label: "🛍 Shopping freeze (−80%)", apply: (s) => ({ ...s, cuts: { ...s.cuts, shopping: 0.8 } }) },
];

export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>(PROFILES);
  const [pid, setPid] = useState(PROFILES[0].id);
  const [sc, setSc] = useState<Scenario>(EMPTY_SCENARIO);
  const [csvError, setCsvError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const p = profiles.find((x) => x.id === pid) ?? profiles[0];

  const base = useMemo(() => forecast(p), [p]);
  const sim = useMemo(() => forecast(p, sc), [p, sc]);
  const baseDz = dayZero(base);
  const simDz = dayZero(sim);
  const inds = useMemo(() => indicators(p, sc), [p, sc]);
  const score = healthScore(inds, simDz);
  const baseScore = healthScore(indicators(p), baseDz);
  const g = grade(score);
  const scenarioActive = JSON.stringify(sc) !== JSON.stringify(EMPTY_SCENARIO);

  const chartData = sim.map((pt, i) => ({ ...pt, baseline: base[i].balance }));

  const income = monthlyIncome(p, sc);
  const expenses = monthlyExpenses(p, sc);

  function switchProfile(id: string) {
    setPid(id);
    setSc(EMPTY_SCENARIO);
  }

  async function onCsv(file: File) {
    try {
      const text = await file.text();
      const np = profileFromCsv(text, profiles[0]);
      setProfiles((ps) => [...ps.filter((x) => x.id !== "csv"), np]);
      setPid("csv");
      setSc(EMPTY_SCENARIO);
      setCsvError("");
    } catch (e) {
      setCsvError((e as Error).message);
    }
  }

  let dzDelta: string | null = null;
  if (scenarioActive) {
    if (baseDz && !simDz) dzDelta = "Day Zero eliminated 🎉";
    else if (!baseDz && simDz) dzDelta = `This creates a Day Zero on ${simDz.date}`;
    else if (baseDz && simDz && simDz.day !== baseDz.day) {
      const d = simDz.day - baseDz.day;
      dzDelta = d > 0 ? `Pushed back ${d} days` : `Pulled in ${-d} days`;
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-pink/40 bg-pink/10 font-mono text-lg font-bold text-pink glow-pink">
            0
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-tight">
              DAY<span className="text-pink glow-pink">ZERO</span>
            </h1>
            <p className="text-xs text-muted">Know the day your money runs out. Then push it back.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profiles.map((x) => (
            <button
              key={x.id}
              onClick={() => switchProfile(x.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                x.id === pid ? "border-cyan bg-cyan/10 text-cyan" : "border-line text-muted hover:border-cyan/50 hover:text-white"
              }`}
            >
              {x.name}
            </button>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-lime hover:text-lime"
          >
            ⬆ Upload bank CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            hidden
            onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])}
          />
        </div>
      </header>
      {csvError && <p className="mb-4 text-sm text-pink">CSV error: {csvError}</p>}
      <p className="mb-5 text-sm text-muted">{p.tagline}</p>

      {/* Hero row */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className={`panel grid-bg relative overflow-hidden p-6 ${simDz ? "border-pink/50" : "border-lime/40"}`}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Your Day Zero</p>
          {simDz ? (
            <>
              <div className="mt-2 flex items-end gap-3">
                <span className="font-mono text-7xl font-bold text-pink glow-pink pulse">{simDz.day}</span>
                <span className="mb-3 text-lg text-muted">days</span>
              </div>
              <p className="text-lg">
                Money runs out on <span className="font-semibold text-pink">{simDz.date}</span>
              </p>
            </>
          ) : (
            <>
              <div className="mt-2 font-mono text-5xl font-bold text-lime glow-lime">120+ days</div>
              <p className="mt-2 text-lg">No Day Zero ahead. You&apos;re in the clear.</p>
            </>
          )}
          {dzDelta && (
            <p className="mt-3 inline-block rounded-full bg-cyan/10 px-3 py-1 font-mono text-sm text-cyan">{dzDelta}</p>
          )}
        </div>

        <div className="panel flex items-center gap-6 p-6">
          <ScoreRing score={score} tone={g.tone} />
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Financial health</p>
            <p className={`mt-1 text-3xl font-semibold ${toneText[g.tone]}`}>{g.label}</p>
            {scenarioActive && score !== baseScore && (
              <p className="mt-1 font-mono text-sm text-cyan">
                {score > baseScore ? "▲" : "▼"} {Math.abs(score - baseScore)} pts vs. today
              </p>
            )}
            <p className="mt-2 text-sm text-muted">Weighted from 4 indicators plus your cash runway.</p>
          </div>
        </div>

        <div className="panel grid grid-cols-2 gap-4 p-6">
          <Stat label="Checking" value={money(p.balance)} />
          <Stat label="Savings" value={money(p.savings)} />
          <Stat label="Income / mo" value={money(income)} tone="good" />
          <Stat label="Spending / mo" value={money(expenses)} tone={expenses > income ? "bad" : undefined} />
          <div className="col-span-2 border-t border-line pt-3">
            <Stat
              label="Monthly gap"
              value={(income - expenses >= 0 ? "+" : "") + money(income - expenses)}
              tone={income - expenses >= 0 ? "good" : "bad"}
            />
          </div>
        </div>
      </section>

      {/* Forecast chart */}
      <section className="panel mt-4 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">120-day balance forecast</h2>
          <div className="flex items-center gap-4 font-mono text-xs text-muted">
            <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-5 bg-cyan" /> {scenarioActive ? "With your what-ifs" : "Projected"}</span>
            {scenarioActive && <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-5 border-t border-dashed border-muted" /> Today&apos;s path</span>}
            <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-5 bg-pink" /> $0 line</span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22e6ff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22e6ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#23233a" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="#8b8ba7" tick={{ fontSize: 11 }} interval={14} tickLine={false} />
              <YAxis stroke="#8b8ba7" tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} width={70} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#0f0f1a", border: "1px solid #23233a", borderRadius: 12, fontFamily: "JetBrains Mono" }}
                labelStyle={{ color: "#8b8ba7" }}
                formatter={(v: number, n: string) => [money(v), n === "baseline" ? "Today's path" : "Balance"]}
              />
              <ReferenceLine y={0} stroke="#ff2e88" strokeWidth={1.5} />
              {scenarioActive && (
                <Line type="monotone" dataKey="baseline" stroke="#8b8ba7" strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
              )}
              <Area type="monotone" dataKey="balance" stroke="#22e6ff" strokeWidth={2.5} fill="url(#fillCyan)" />
              {simDz && <ReferenceDot x={simDz.date} y={simDz.balance} r={6} fill="#ff2e88" stroke="#fff" />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Indicators */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {inds.map((ind) => (
          <div key={ind.key} className="panel p-5">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted">{ind.label}</p>
            <p className={`mt-1 font-mono text-3xl font-bold ${toneText[ind.status]}`}>{ind.value}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
              <div className={`h-full rounded-full ${toneBg[ind.status]} transition-all duration-500`} style={{ width: `${ind.score}%` }} />
            </div>
            <p className="mt-3 text-xs text-muted">{ind.hint}</p>
          </div>
        ))}
      </section>

      {/* Simulator + Coach */}
      <section className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="panel p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">What-if simulator</h2>
            {scenarioActive && (
              <button onClick={() => setSc(EMPTY_SCENARIO)} className="font-mono text-xs text-muted hover:text-pink">
                ↺ reset
              </button>
            )}
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {PRESETS.map((pr) => (
              <button
                key={pr.label}
                onClick={() => setSc(pr.apply)}
                className="rounded-full border border-line bg-white/[0.02] px-3 py-1.5 text-sm hover:border-cyan hover:text-cyan"
              >
                {pr.label}
              </button>
            ))}
          </div>

          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {(Object.keys(p.spending) as Category[]).map((c) => {
              const cut = sc.cuts[c] ?? 0;
              return (
                <Slider
                  key={c}
                  label={`Cut ${CATEGORY_LABELS[c].toLowerCase()}`}
                  right={`${Math.round(cut * 100)}% · saves ${money(p.spending[c] * cut)}/mo`}
                  min={0} max={0.8} step={0.05} value={cut}
                  onChange={(v) => setSc((s) => ({ ...s, cuts: { ...s.cuts, [c]: v } }))}
                />
              );
            })}
            <Slider
              label="Extra weekly income"
              right={`${money(sc.extraWeekly)}/wk`}
              min={0} max={400} step={10} value={sc.extraWeekly}
              onChange={(v) => setSc((s) => ({ ...s, extraWeekly: v }))}
            />
            <Slider
              label="Extra debt payment"
              right={`${money(sc.extraDebtPayment)}/mo`}
              min={0} max={500} step={25} value={sc.extraDebtPayment}
              onChange={(v) => setSc((s) => ({ ...s, extraDebtPayment: v }))}
            />
            <Slider
              label="One-time purchase"
              right={money(sc.purchase)}
              min={0} max={3000} step={50} value={sc.purchase}
              onChange={(v) => setSc((s) => ({ ...s, purchase: v }))}
            />
            <Slider
              label="…bought in"
              right={`${sc.purchaseDay} days`}
              min={1} max={90} step={1} value={sc.purchaseDay}
              onChange={(v) => setSc((s) => ({ ...s, purchaseDay: v }))}
            />
          </div>
        </div>

        <Coach key={p.id} profile={p} scenario={sc} />
      </section>

      <footer className="mt-10 text-center font-mono text-xs text-muted">
        DayZero · Built solo at HackUTD 2026: Zero Day · Not financial advice
      </footer>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`font-mono text-xl font-semibold ${tone ? toneText[tone] : ""}`}>{value}</p>
    </div>
  );
}

function ScoreRing({ score, tone }: { score: number; tone: "good" | "warn" | "bad" }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const color = { good: "#b6ff3b", warn: "#ffb020", bad: "#ff2e88" }[tone];
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
      <circle cx="60" cy="60" r={r} stroke="#23233a" strokeWidth="10" fill="none" />
      <circle
        cx="60" cy="60" r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset .6s ease, stroke .3s", filter: `drop-shadow(0 0 8px ${color})` }}
      />
      <text x="60" y="58" textAnchor="middle" fill="#fff" fontSize="30" fontWeight="700" fontFamily="JetBrains Mono">{score}</text>
      <text x="60" y="78" textAnchor="middle" fill="#8b8ba7" fontSize="11" fontFamily="JetBrains Mono">/ 100</text>
    </svg>
  );
}

function Slider(props: { label: string; right: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex justify-between text-sm">
        <span>{props.label}</span>
        <span className="font-mono text-xs text-cyan">{props.right}</span>
      </div>
      <input
        type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

const SUGGESTIONS = [
  "Why is my Day Zero so soon?",
  "Can I afford a $600 Spring Break trip?",
  "What 3 moves help me most?",
  "Should I pay debt or build savings first?",
];

function Coach({ profile, scenario }: { profile: Profile; scenario: Scenario }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "coach", text: `Hey! I'm your DayZero coach. I can see ${profile.name.split(",")[0]}'s numbers. Ask me anything.` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<string>("");
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1), context: summarize(profile, scenario) }),
      });
      const data = await res.json();
      setSource(data.source);
      setMsgs((m) => [...m, { role: "coach", text: data.text }]);
    } catch {
      setMsgs((m) => [...m, { role: "coach", text: "I couldn't reach the server. Try again in a moment." }]);
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }

  return (
    <div className="panel flex h-[540px] flex-col p-6 lg:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI coach</h2>
        <span className="font-mono text-[11px] text-muted">
          {source === "gemini" ? "● Gemini" : source === "offline" ? "● offline mode" : "● ready"}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user" ? "bg-cyan/15 text-white" : "border border-line bg-white/[0.03]"
              }`}
            >
              {m.text.replace(/\*\*(.*?)\*\*/g, "$1")}
            </div>
          </div>
        ))}
        {busy && <p className="font-mono text-xs text-muted">coach is thinking…</p>}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-pink hover:text-pink">
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your money…"
          className="flex-1 rounded-xl border border-line bg-ink px-4 py-2.5 text-sm outline-none focus:border-cyan"
        />
        <button disabled={busy} className="rounded-xl bg-pink px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
