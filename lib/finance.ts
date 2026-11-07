// DayZero financial engine: profile model, daily cash-flow forecast, health indicators.

export type Bill = { name: string; amount: number; day: number }; // day of month
export type Category = "dining" | "groceries" | "shopping" | "transport" | "entertainment" | "subscriptions";

export type Profile = {
  id: string;
  name: string;
  tagline: string;
  balance: number; // checking balance today
  savings: number; // emergency fund
  paycheck: number; // net per paycheck
  payEveryDays: number; // 7 = weekly, 14 = biweekly
  nextPayInDays: number;
  bills: Bill[];
  spending: Record<Category, number>; // monthly variable spending
  debt: { name: string; balance: number; apr: number; minPayment: number }[];
  history: number[]; // total monthly spending, last 6 months (oldest first)
};

export type Scenario = {
  cuts: Partial<Record<Category, number>>; // 0..1 fraction cut
  extraWeekly: number; // added weekly income (side job)
  purchase: number; // one-time purchase
  purchaseDay: number; // days from today
  extraDebtPayment: number; // added monthly debt payment
};

export const EMPTY_SCENARIO: Scenario = { cuts: {}, extraWeekly: 0, purchase: 0, purchaseDay: 7, extraDebtPayment: 0 };

export const CATEGORY_LABELS: Record<Category, string> = {
  dining: "Dining out",
  groceries: "Groceries",
  shopping: "Shopping",
  transport: "Transport",
  entertainment: "Entertainment",
  subscriptions: "Subscriptions",
};

export type ForecastPoint = { day: number; date: string; balance: number; baseline?: number };

const HORIZON = 120;

export function monthlyIncome(p: Profile, s: Scenario = EMPTY_SCENARIO) {
  return (p.paycheck * 30) / p.payEveryDays + (s.extraWeekly * 30) / 7;
}

export function monthlyVariable(p: Profile, s: Scenario = EMPTY_SCENARIO) {
  return (Object.keys(p.spending) as Category[]).reduce(
    (sum, c) => sum + p.spending[c] * (1 - (s.cuts[c] ?? 0)),
    0
  );
}

export function monthlyBills(p: Profile) {
  return p.bills.reduce((s, b) => s + b.amount, 0);
}

export function monthlyDebtPayments(p: Profile, s: Scenario = EMPTY_SCENARIO) {
  return p.debt.reduce((sum, d) => sum + d.minPayment, 0) + s.extraDebtPayment;
}

export function monthlyExpenses(p: Profile, s: Scenario = EMPTY_SCENARIO) {
  return monthlyVariable(p, s) + monthlyBills(p) + monthlyDebtPayments(p, s);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Simulates checking balance day by day. Debt minimums are paid on the 15th. */
export function forecast(p: Profile, s: Scenario = EMPTY_SCENARIO, start = new Date()): ForecastPoint[] {
  const pts: ForecastPoint[] = [];
  let bal = p.balance;
  const dailyVar = monthlyVariable(p, s) / 30;
  const debtPay = monthlyDebtPayments(p, s);
  for (let i = 0; i <= HORIZON; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (i > 0) {
      const dom = d.getDate();
      if ((i - p.nextPayInDays) % p.payEveryDays === 0 && i >= p.nextPayInDays) bal += p.paycheck;
      if (s.extraWeekly > 0 && i % 7 === 0) bal += s.extraWeekly;
      for (const b of p.bills) if (b.day === dom) bal -= b.amount;
      if (dom === 15) bal -= debtPay;
      if (s.purchase > 0 && i === s.purchaseDay) bal -= s.purchase;
      bal -= dailyVar;
    }
    pts.push({ day: i, date: fmtDate(d), balance: Math.round(bal) });
  }
  return pts;
}

export function dayZero(points: ForecastPoint[]) {
  const hit = points.find((pt) => pt.balance < 0);
  return hit ?? null;
}

export type Indicator = {
  key: string;
  label: string;
  value: string;
  score: number; // 0..100
  status: "good" | "warn" | "bad";
  hint: string;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const status = (score: number): Indicator["status"] => (score >= 70 ? "good" : score >= 40 ? "warn" : "bad");

export function indicators(p: Profile, s: Scenario = EMPTY_SCENARIO): Indicator[] {
  const inc = monthlyIncome(p, s);
  const exp = monthlyExpenses(p, s);

  const savingsRate = inc > 0 ? (inc - exp) / inc : -1;
  const srScore = clamp(((savingsRate + 0.1) / 0.3) * 100); // -10% -> 0, +20% -> 100

  const efMonths = exp > 0 ? p.savings / exp : 0;
  const efScore = clamp((efMonths / 3) * 100); // 3 months = full marks

  const dti = inc > 0 ? monthlyDebtPayments(p, s) / inc : 1;
  const dtiScore = clamp(100 - ((dti - 0.05) / 0.3) * 100); // 5% -> 100, 35% -> 0

  const h = p.history;
  const mean = h.reduce((a, b) => a + b, 0) / h.length;
  const sd = Math.sqrt(h.reduce((a, b) => a + (b - mean) ** 2, 0) / h.length);
  const cv = mean > 0 ? sd / mean : 0;
  const volScore = clamp(100 - ((cv - 0.05) / 0.3) * 100); // 5% -> 100, 35% -> 0

  return [
    {
      key: "savings",
      label: "Savings rate",
      value: `${(savingsRate * 100).toFixed(0)}%`,
      score: Math.round(srScore),
      status: status(srScore),
      hint: savingsRate < 0 ? "You spend more than you earn each month." : "Share of income left after all spending.",
    },
    {
      key: "emergency",
      label: "Emergency fund",
      value: `${efMonths.toFixed(1)} mo`,
      score: Math.round(efScore),
      status: status(efScore),
      hint: "Months of expenses your savings can cover. Target: 3.",
    },
    {
      key: "dti",
      label: "Debt-to-income",
      value: `${(dti * 100).toFixed(0)}%`,
      score: Math.round(dtiScore),
      status: status(dtiScore),
      hint: "Monthly debt payments as a share of income. Under 15% is healthy.",
    },
    {
      key: "volatility",
      label: "Spending volatility",
      value: `±${(cv * 100).toFixed(0)}%`,
      score: Math.round(volScore),
      status: status(volScore),
      hint: "How much your monthly spending swings. Steadier is easier to plan.",
    },
  ];
}

export function healthScore(inds: Indicator[], dz: ForecastPoint | null) {
  const weights = [0.35, 0.25, 0.2, 0.2];
  let score = inds.reduce((s, ind, i) => s + ind.score * weights[i], 0);
  if (dz) score -= dz.day < 30 ? 20 : dz.day < 60 ? 10 : 5; // runway penalty
  return Math.round(clamp(score));
}

export function grade(score: number) {
  if (score >= 80) return { label: "Thriving", tone: "good" as const };
  if (score >= 60) return { label: "Stable", tone: "good" as const };
  if (score >= 40) return { label: "At risk", tone: "warn" as const };
  return { label: "Critical", tone: "bad" as const };
}

/** Compact summary the AI coach receives as context. */
export function summarize(p: Profile, s: Scenario) {
  const pts = forecast(p, s);
  const dz = dayZero(pts);
  const inds = indicators(p, s);
  return {
    name: p.name,
    checkingBalance: p.balance,
    emergencySavings: p.savings,
    monthlyIncome: Math.round(monthlyIncome(p, s)),
    monthlyExpenses: Math.round(monthlyExpenses(p, s)),
    bills: p.bills,
    variableSpending: Object.fromEntries(
      (Object.keys(p.spending) as Category[]).map((c) => [c, Math.round(p.spending[c] * (1 - (s.cuts[c] ?? 0)))])
    ),
    debt: p.debt,
    dayZero: dz ? { inDays: dz.day, date: dz.date } : "No Day Zero in the next 120 days",
    balanceIn30Days: pts[30].balance,
    balanceIn90Days: pts[90].balance,
    healthScore: healthScore(inds, dz),
    indicators: inds.map((i) => ({ label: i.label, value: i.value, status: i.status })),
    activeScenario: s,
  };
}

/** Parse a bank CSV with columns date, description, amount (negative = spending). */
export function profileFromCsv(text: string, base: Profile): Profile {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const di = header.findIndex((h) => h.includes("date"));
  const ti = header.findIndex((h) => h.includes("desc") || h.includes("name") || h.includes("merchant"));
  const ai = header.findIndex((h) => h.includes("amount"));
  if (di < 0 || ai < 0) throw new Error("CSV needs at least 'date' and 'amount' columns.");

  const rules: [Category, RegExp][] = [
    ["dining", /doordash|uber ?eats|chipotle|starbucks|mcdonald|restaurant|cafe|pizza|grubhub|taco|coffee|chick/i],
    ["groceries", /walmart|kroger|h-?e-?b|aldi|tom thumb|trader|whole foods|costco|grocery|target/i],
    ["transport", /uber|lyft|shell|exxon|chevron|qt|gas|dart|parking|fuel/i],
    ["subscriptions", /netflix|spotify|hulu|disney|apple\.com|youtube|prime|subscription|chatgpt|xbox|playstation/i],
    ["entertainment", /amc|cinema|steam|ticket|concert|bowling|game/i],
    ["shopping", /amazon|shein|nike|best buy|mall|store|shop/i],
  ];

  const spending: Record<Category, number> = { dining: 0, groceries: 0, shopping: 0, transport: 0, entertainment: 0, subscriptions: 0 };
  let income = 0;
  const dates: number[] = [];
  const byMonth: Record<string, number> = {};

  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const amt = parseFloat((cols[ai] ?? "").replace(/[$\s"]/g, ""));
    const date = new Date((cols[di] ?? "").replace(/"/g, ""));
    if (isNaN(amt) || isNaN(date.getTime())) continue;
    dates.push(date.getTime());
    const desc = ti >= 0 ? cols[ti] ?? "" : "";
    if (amt > 0) { income += amt; continue; }
    const spend = -amt;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    byMonth[key] = (byMonth[key] ?? 0) + spend;
    const cat = rules.find(([, re]) => re.test(desc))?.[0] ?? "shopping";
    spending[cat] += spend;
  }

  if (!dates.length) throw new Error("No valid rows found in CSV.");
  const months = Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30));
  (Object.keys(spending) as Category[]).forEach((c) => (spending[c] = Math.round(spending[c] / months)));
  const monthlyInc = income / months;
  const hist = Object.values(byMonth).slice(-6);

  return {
    ...base,
    id: "csv",
    name: "Your data",
    tagline: `Imported ${lines.length - 1} transactions`,
    bills: [], // CSV spending already includes bills, so don't double count
    debt: [],
    spending,
    paycheck: Math.round((monthlyInc * base.payEveryDays) / 30) || base.paycheck,
    history: hist.length >= 2 ? hist : base.history,
  };
}
