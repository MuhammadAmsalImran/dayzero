"use client";

import { useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import {
  Area, ComposedChart, CartesianGrid, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  CATEGORY_LABELS, Category, EMPTY_SCENARIO, Profile, Scenario, dayZero, forecast, grade, healthScore,
  indicators, monthlyExpenses, monthlyIncome, profileFromCsv, summarize,
} from "@/lib/finance";
import { PROFILES } from "@/lib/profiles";
import BackgroundPaths from "@/components/ui/background-paths";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { MagicCard } from "@/components/ui/magic-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { SmoothScroll, scrollToId } from "@/components/smooth-scroll";

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

const CARD = { gradientFrom: "#ff2e88", gradientTo: "#22e6ff", gradientColor: "#1b1430", gradientSize: 260 };

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
  const gap = income - expenses;

  // Hero parallax: content lifts, shrinks and fades as you scroll into the dashboard.
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

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
      scrollToId("dashboard");
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

  const heroDz = dayZero(forecast(PROFILES[0]));

  return (
    <>
      <SmoothScroll />
      <ScrollProgress className="h-[2px] from-pink via-[#ff7ab8] to-cyan" />
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        hidden
        onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])}
      />

      {/* ───────── Hero ───────── */}
      <div ref={heroRef}>
        <BackgroundPaths className="min-h-[100svh] text-pink" count={54} spread={1.05} angle={-10} speed={0.9}>
          <motion.div
            style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}
            className="relative z-10 flex max-w-3xl flex-col items-center px-6 text-center text-white"
          >
            <BlurFade delay={0.1}>
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-ink/70 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-muted backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-pink pulse" /> HackUTD 2026 · Zero Day
              </span>
            </BlurFade>
            <BlurFade delay={0.25} offset={18}>
              <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
                Every budget has a
                <br />
                <span className="font-mono font-bold text-gradient">DAY ZERO.</span>
              </h1>
            </BlurFade>
            <BlurFade delay={0.45} offset={14}>
              <p className="mx-auto mt-6 max-w-xl text-lg text-[#c9c9dc] sm:text-xl">
                DayZero forecasts the exact day your money runs out, scores your financial health, and shows you how to
                push it back.
              </p>
            </BlurFade>
            <BlurFade delay={0.65} offset={14}>
              <div className="mt-8 rounded-2xl border border-line bg-ink/70 px-6 py-4 backdrop-blur">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Maya, sophomore</p>
                <p className="mt-1 text-lg">
                  Money runs out in{" "}
                  <NumberTicker value={heroDz?.day ?? 120} delay={0.9} className="font-mono text-3xl font-bold text-pink glow-pink" />{" "}
                  days
                </p>
              </div>
            </BlurFade>
            <BlurFade delay={0.85} offset={14}>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => scrollToId("dashboard")}
                  className="rounded-full bg-pink px-6 py-3 font-semibold text-white shadow-[0_0_30px_rgba(255,46,136,0.45)] transition hover:brightness-110"
                >
                  See the Day Zero ↓
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full border border-line bg-ink/70 px-6 py-3 font-semibold backdrop-blur transition hover:border-lime hover:text-lime"
                >
                  ⬆ Upload bank CSV
                </button>
              </div>
            </BlurFade>
          </motion.div>
          <button
            onClick={() => scrollToId("dashboard")}
            aria-label="Scroll to dashboard"
            className="nudge absolute bottom-8 left-1/2 z-10 -translate-x-1/2 font-mono text-xs uppercase tracking-[0.25em] text-muted"
          >
            scroll ↓
          </button>
        </BackgroundPaths>
      </div>

      {/* ───────── Dashboard ───────── */}
      <main id="dashboard" className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6">
        <BlurFade inView>
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-pink/40 bg-pink/10 font-mono text-lg font-bold text-pink glow-pink">
                0
              </div>
              <div>
                <h2 className="font-mono text-2xl font-bold tracking-tight">
                  DAY<span className="text-pink glow-pink">ZERO</span>
                </h2>
                <p className="text-xs text-muted">{p.tagline}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {profiles.map((x) => (
                <button
                  key={x.id}
                  onClick={() => switchProfile(x.id)}
                  className={`relative rounded-full border px-3 py-1.5 text-sm transition ${
                    x.id === pid ? "border-cyan text-cyan" : "border-line text-muted hover:border-cyan/50 hover:text-white"
                  }`}
                >
                  {x.id === pid && (
                    <motion.span layoutId="persona-pill" className="absolute inset-0 -z-10 rounded-full bg-cyan/10" />
                  )}
                  {x.name}
                </button>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-lime hover:text-lime"
              >
                ⬆ Upload bank CSV
              </button>
            </div>
          </header>
          {csvError && <p className="mb-4 text-sm text-pink">CSV error: {csvError}</p>}
        </BlurFade>

        {/* Hero row */}
        <section className="grid gap-4 lg:grid-cols-3">
          <BlurFade inView delay={0.05} offset={24}>
            <div className={`panel grid-bg relative h-full overflow-hidden p-6 ${simDz ? "border-pink/50" : "border-lime/40"}`}>
              <BorderBeam size={120} duration={7} colorFrom="#ff2e88" colorTo="#22e6ff" borderWidth={1.5} />
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Your Day Zero</p>
              {simDz ? (
                <>
                  <div className="mt-2 flex items-end gap-3">
                    <NumberTicker value={simDz.day} startValue={0} className="font-mono text-7xl font-bold text-pink glow-pink" />
                    <span className="mb-3 text-lg text-muted">days</span>
                  </div>
                  <p className="text-lg">
                    Money runs out on <span className="font-semibold text-pink">{simDz.date}</span>
                  </p>
                </>
              ) : (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}>
                  <div className="mt-2 font-mono text-5xl font-bold text-lime glow-lime">120+ days</div>
                  <p className="mt-2 text-lg">No Day Zero ahead. You&apos;re in the clear.</p>
                </motion.div>
              )}
              {dzDelta && (
                <motion.p
                  key={dzDelta}
                  initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  className="mt-3 inline-block rounded-full bg-cyan/10 px-3 py-1 font-mono text-sm text-cyan"
                >
                  {dzDelta}
                </motion.p>
              )}
            </div>
          </BlurFade>

          <BlurFade inView delay={0.15} offset={24}>
            <MagicCard {...CARD} className="h-full rounded-[18px]">
              <div className="flex h-full items-center gap-6 p-6">
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
            </MagicCard>
          </BlurFade>

          <BlurFade inView delay={0.25} offset={24}>
            <MagicCard {...CARD} className="h-full rounded-[18px]">
              <div className="grid grid-cols-2 gap-4 p-6">
                <Stat label="Checking" value={p.balance} />
                <Stat label="Savings" value={p.savings} />
                <Stat label="Income / mo" value={income} tone="good" />
                <Stat label="Spending / mo" value={expenses} tone={expenses > income ? "bad" : undefined} />
                <div className="col-span-2 border-t border-line pt-3">
                  <Stat label="Monthly gap" value={gap} signed tone={gap >= 0 ? "good" : "bad"} />
                </div>
              </div>
            </MagicCard>
          </BlurFade>
        </section>

        {/* Forecast chart */}
        <BlurFade inView offset={30} delay={0.05}>
          <section className="panel mt-4 p-6">
            <SectionLabel n="01" title="120-day balance forecast" />
            <div className="mb-4 flex flex-wrap items-center justify-end gap-4 font-mono text-xs text-muted">
              <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-5 bg-cyan" /> {scenarioActive ? "With your what-ifs" : "Projected"}</span>
              {scenarioActive && <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-5 border-t border-dashed border-muted" /> Today&apos;s path</span>}
              <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-5 bg-pink" /> $0 line</span>
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
                  <Area type="monotone" dataKey="balance" stroke="#22e6ff" strokeWidth={2.5} fill="url(#fillCyan)" animationDuration={900} />
                  {simDz && <ReferenceDot x={simDz.date} y={simDz.balance} r={6} fill="#ff2e88" stroke="#fff" />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
        </BlurFade>

        {/* Indicators */}
        <section className="mt-4">
          <BlurFade inView offset={20}>
            <SectionLabel n="02" title="Health indicators" className="px-1" />
          </BlurFade>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {inds.map((ind, i) => (
              <BlurFade key={ind.key} inView delay={0.08 * i} offset={28}>
                <MagicCard {...CARD} className="h-full rounded-[18px]">
                  <div className="p-5">
                    <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted">{ind.label}</p>
                    <p className={`mt-1 font-mono text-3xl font-bold ${toneText[ind.status]}`}>{ind.value}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                      <motion.div
                        className={`h-full rounded-full ${toneBg[ind.status]}`}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${ind.score}%` }}
                        animate={{ width: `${ind.score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <p className="mt-3 text-xs text-muted">{ind.hint}</p>
                  </div>
                </MagicCard>
              </BlurFade>
            ))}
          </div>
        </section>

        {/* Simulator + Coach */}
        <section className="mt-4 grid gap-4 lg:grid-cols-5">
          <BlurFade inView offset={30} className="lg:col-span-3">
            <div className="panel h-full p-6">
              <div className="mb-4 flex items-center justify-between">
                <SectionLabel n="03" title="What-if simulator" className="mb-0" />
                {scenarioActive && (
                  <button onClick={() => setSc(EMPTY_SCENARIO)} className="font-mono text-xs text-muted hover:text-pink">
                    ↺ reset
                  </button>
                )}
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {PRESETS.map((pr) => (
                  <motion.button
                    key={pr.label}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setSc(pr.apply)}
                    className="rounded-full border border-line bg-white/[0.02] px-3 py-1.5 text-sm hover:border-cyan hover:text-cyan"
                  >
                    {pr.label}
                  </motion.button>
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
          </BlurFade>

          <BlurFade inView offset={30} delay={0.12} className="lg:col-span-2">
            <Coach key={p.id} profile={p} scenario={sc} />
          </BlurFade>
        </section>

        <footer className="mt-10 text-center font-mono text-xs text-muted">
          DayZero · Built solo at HackUTD 2026: Zero Day · Not financial advice
        </footer>
      </main>
    </>
  );
}

function SectionLabel({ n, title, className = "" }: { n: string; title: string; className?: string }) {
  return (
    <div className={`mb-4 flex items-baseline gap-3 ${className}`}>
      <span className="font-mono text-xs text-pink">{n}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function Stat({ label, value, tone, signed }: { label: string; value: number; tone?: "good" | "bad"; signed?: boolean }) {
  const sign = value < 0 ? "-" : signed ? "+" : "";
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className={`font-mono text-xl font-semibold ${tone ? toneText[tone] : ""}`}>
        {sign}$<NumberTicker value={Math.abs(Math.round(value))} />
      </p>
    </div>
  );
}

function ScoreRing({ score, tone }: { score: number; tone: "good" | "warn" | "bad" }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const color = { good: "#b6ff3b", warn: "#ffb020", bad: "#ff2e88" }[tone];
  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} stroke="#23233a" strokeWidth="10" fill="none" />
        <motion.circle
          cx="60" cy="60" r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
          transform="rotate(-90 60 60)"
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke .3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <NumberTicker value={score} className="font-mono text-3xl font-bold leading-none text-white" />
        <span className="mt-1 font-mono text-[11px] text-muted">/ 100</span>
      </div>
    </div>
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
  const listRef = useRef<HTMLDivElement>(null);

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
      // Scroll the chat list only, never the page.
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="panel flex h-[540px] flex-col p-6">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel n="04" title="AI coach" className="mb-0" />
        <span className="font-mono text-[11px] text-muted">
          {source === "gemini" ? "● Gemini" : source === "offline" ? "● offline mode" : "● ready"}
        </span>
      </div>
      <div ref={listRef} data-lenis-prevent className="flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.35 }}
            className={`flex ${m.role === "user" ? "justify-end" : ""}`}
          >
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user" ? "bg-cyan/15 text-white" : "border border-line bg-white/[0.03]"
              }`}
            >
              {m.text.replace(/\*\*(.*?)\*\*/g, "$1")}
            </div>
          </motion.div>
        ))}
        {busy && (
          <div className="flex gap-1.5 px-1 py-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-pink"
                animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
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
