# DayZero

**Every budget has a Day Zero: the day your money runs out. DayZero shows you yours, and how to push it back.**

Built solo at HackUTD 2026: Zero Day.

## Features
- **Day Zero forecast**: a day-by-day 120-day cash-flow simulation (paychecks, bills, debt payments, daily spending) that finds the exact date your balance goes negative.
- **Financial health score**: four indicators (savings rate, emergency-fund months, debt-to-income, spending volatility) plus a cash-runway penalty, rolled into one score out of 100.
- **What-if simulator**: cut spending categories, add side income, plan a big purchase, or pay extra on debt, and watch the forecast, score, and Day Zero update live against today's path.
- **AI coach (Gemini)**: a chat that receives your actual numbers and answers questions like "Can I afford a $600 trip?" It falls back to a rule-based coach if no API key is set, so the demo never breaks.
- **Bank CSV import**: auto-categorizes transactions (`date,description,amount`). Try `public/sample-transactions.csv`.

## Run locally
```bash
npm install
cp .env.example .env.local   # then paste your Gemini key
npm run dev                  # open http://localhost:3000
```

## Deploy (Vercel)
1. Push to a public GitHub repo.
2. Import the repo at vercel.com/new.
3. Add the `GEMINI_API_KEY` environment variable, then deploy.

## Tech
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Recharts · Google Gemini API

_Not financial advice._
