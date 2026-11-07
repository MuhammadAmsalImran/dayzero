import { NextResponse } from "next/server";

type Msg = { role: "user" | "coach"; text: string };

const SYSTEM = `You are DayZero Coach, a friendly, sharp financial coach for college students and young adults.
You receive the user's real numbers as JSON. Rules:
- Ground every answer in their actual numbers (balances, dates, Day Zero, indicators). Quote specific dollar amounts.
- Be concise: 2-5 short sentences or a tight bulleted list. No preamble.
- Give concrete, actionable moves ranked by impact (e.g. "Cut dining by $120/mo -> pushes Day Zero back ~3 weeks").
- If they ask "can I afford X", answer yes/no first, then why, then what would make it work.
- You are not a licensed financial advisor; never recommend specific stocks or crypto.`;

export async function POST(req: Request) {
  const { messages, context } = (await req.json()) as { messages: Msg[]; context: unknown };
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!key) {
    return NextResponse.json({ text: fallback(messages, context), source: "offline" });
  }

  try {
    const contents = messages.map((m, i) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [
        {
          text:
            i === messages.length - 1 && m.role === "user"
              ? `My current financial data:\n${JSON.stringify(context)}\n\nQuestion: ${m.text}`
              : m.text,
        },
      ],
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { temperature: 0.6, maxOutputTokens: 600 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Empty response");
    return NextResponse.json({ text, source: "gemini" });
  } catch (err) {
    console.error(err);
    // Never let the demo break: fall back to the rule-based coach.
    return NextResponse.json({ text: fallback(messages, context), source: "offline" });
  }
}

/** Rule-based answers used when no API key is set or the API fails. */
const usd = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString();

function fallback(messages: Msg[], ctx: any): string {
  const q = (messages[messages.length - 1]?.text ?? "").toLowerCase();
  const dz = typeof ctx?.dayZero === "object" ? ctx.dayZero : null;
  const spend = ctx?.variableSpending ?? {};
  const top = Object.entries(spend as Record<string, number>).sort((a, b) => b[1] - a[1])[0];
  const gap = (ctx?.monthlyIncome ?? 0) - (ctx?.monthlyExpenses ?? 0);
  const afford = q.match(/\$?(\d[\d,]*)/);

  if (afford && /afford|buy|spend|trip|break/.test(q)) {
    const amt = parseInt(afford[1].replace(/,/g, ""), 10);
    const in30 = ctx?.balanceIn30Days ?? 0;
    return in30 - amt > 200
      ? `Yes. After $${amt}, you'd still have about ${usd(in30 - amt)} in 30 days. Keep at least $200 as a buffer.`
      : `Not right now. In 30 days you're projected at ${usd(in30)}, so $${amt} would push you below a safe buffer. Try the What-If simulator: set the purchase to $${amt} and add cuts until Day Zero disappears.`;
  }
  if (dz) {
    return `Your Day Zero is ${dz.date}, ${dz.inDays} days away. You're short about ${usd(Math.abs(gap))}/month. Biggest lever: ${top?.[0]} at $${top?.[1]}/mo. Cutting it 40% saves ~$${Math.round((top?.[1] ?? 0) * 0.4)}/mo. Pair that with a few extra work hours a week and you can close the gap.`;
  }
  return `You're in good shape: no Day Zero in the next 120 days and about ${usd(gap)}/month left over. Next step: build your emergency fund toward 3 months of expenses (${usd((ctx?.monthlyExpenses ?? 0) * 3)}), then put extra toward your highest-APR debt.`;
}
