# FinLens Advisor — Product Specification

## Vision

A Telegram-based AI financial advisor for established earners ($150k+ household income, ages 35-50) who want expert opinions on financial decisions and accountability toward their goals. The advisor shows up every morning, knows their financial history, remembers their plans, and proactively spots problems and opportunities.

**Positioning:** "It's like having a financial advisor on Telegram."

**Competitive frame:** Replaces a human financial advisor at 1/5th the cost. Not a budgeting app. Not a dashboard. A relationship.

---

## Target User

**Primary persona:** Established earner, 35-50, with financial complexity.

- Has multiple accounts, investments, mortgage, tax obligations
- Currently pays or has considered paying for a human financial advisor
- Wants expert *opinions* on specific decisions ("should I refinance?", "can I afford this car?")
- Wants accountability — someone tracking progress toward goals
- Does NOT want to learn personal finance theory
- Does NOT want to manually categorize transactions

**What they'll say to their partner:** "I cancelled my financial advisor and use this instead."

---

## Advisor Personality

**Tone:** Sharp friend who happens to be great with money. Casual, direct, motivational. Not corporate, not clinical.

**Opinionated but respectful:** Will push back on bad financial decisions with data, but acknowledges the user makes the final call. "Honestly, the numbers don't support that right now. Here's what I'd do instead — but it's your call."

**In-character always:** If a user sends a meme, the advisor stays in character with humor. "Ha — I'm flattered but I'm better with spreadsheets than selfies. Got any bank statements for me?"

**What the advisor refuses to do:** User-configurable. Initially no hard restrictions — the advisor will attempt to help with anything financial but will clearly disclaim when it's out of its depth ("I'm an AI, not a licensed CPA — for this specific tax situation you should get a professional opinion").

---

## Core Experience

### The Daily Morning Briefing

Sent every morning. The core engagement loop.

**Contents:**

| Component | Cadence | Example |
|---|---|---|
| **Notable transactions** | Daily | "$189 at West Elm — that's outside your usual pattern" |
| **Spending summary** | Daily | "Spent $287 across 6 transactions yesterday" |
| **Cash flow forecast** | Daily | "You've got $14,200 coming in and $4,830 going out this week" — upcoming bills, paychecks, and where the balance lands |
| **Upcoming irregular expenses** | As relevant | "Your quarterly estimated tax payment ($13,200) is due April 15" |
| **Portfolio update** | Daily | "Up +0.3% yesterday, +2.1% MTD" |
| **Actionable tip** | Daily (when available) | "That Adobe Creative Cloud family plan costs $127/month. The individual plan is $55. That's $864/year." |
| **Goal progress** | Weekly | "You're $1,200 closer to the house fund this month — 62% of target" |

**Interaction model:** Briefing ends with quick-reply options:

```
📊 Full breakdown  |  💡 More tips  |  ✅ Looks good
```

**Staleness handling:** If no new documents have been uploaded in 3+ weeks, the advisor proactively asks: "Hey, it's been a while since your last upload. Got a recent bank statement? The more current my data, the better I can help."

**Cadence adaptation:** When finances are simple or data is limited, tips become less frequent rather than repetitive. Briefing may reduce to every-other-day automatically per the "less to say, less frequent" principle.

### Real-Time Alerts

Separate from the daily briefing. Sent immediately when the advisor detects something urgent.

**Triggers:**
- Overdraft risk detected in cash flow forecast
- Unusually large transaction (2x+ normal for that category)
- Goal trajectory significantly off track
- Tax deadline approaching with action needed
- Major portfolio move (5%+ single-day swing)

**Tone:** Urgent but not panicked. "Heads up — your checking account is going to be tight this week. Mortgage and daycare both hit before your paycheck. You might want to move $1,200 from savings."

### Conversational Chat

Available anytime. User sends a message, gets a response. Uses the full financial context + memory system.

**Examples of what users ask:**
- "Can I afford to take a $5k vacation in June?"
- "Should I pay off my car loan early or invest the money?"
- "What would happen if I maxed out my 401k?"
- "Where can I cut $500/month?"
- "Run the numbers on refinancing at 5.2%"

### Chart Sharing

**Phase 1:** Text-based charts in Telegram messages.

```
Spending by Category (March 2026)
Rent         $3,200  ████████████████████ 45%
Dining         $850  █████ 12%
Groceries      $640  ████ 9%
Transport      $420  ███ 6%
Utilities      $340  ██ 5%
Other        $1,650  █████████ 23%
```

**Phase 2:** Server-side rendered chart images sent as Telegram photo messages.

### Dashboard Handoff

When the user wants to deep-dive, the bot sends an authenticated magic link:

"Here's your full dashboard: https://finlens.app/d/abc123"

Short-lived token, no login required. Opens the web dashboard directly.

---

## Tip Engine

The advisor's intelligence comes from layered insight sources, unlocked progressively as more data is uploaded.

### Tier 1 — Available Immediately (bank/credit card statements)

| Source | Example |
|---|---|
| **Spending trend analysis** | "Dining is up 35% over 3 months" |
| **Subscription audit** | "You have 7 subscriptions totaling $187/month — you used 2 of them last quarter" |
| **Irregular expense prediction** | "Last December you spent $2,400 on gifts. Worth budgeting $400/month now." |
| **Cross-account pattern detection** | "You're paying insurance from both checking and credit card — possible double charge" |

### Tier 2 — After Tax/Loan Documents Uploaded

| Source | Example |
|---|---|
| **Goal gap analysis** | "At your current savings rate, the house fund hits target in 14 months, not 11" |
| **Tax optimization** | "You're on track to under-withhold by ~$3k this year" |
| **Debt optimization** | "Paying an extra $200/month on the car loan saves you $1,800 in interest" |

### Tier 3 — After Portfolio Statements + Trust Established

| Source | Example |
|---|---|
| **Investment rebalancing** | "Your portfolio drifted to 78% equities — your target was 70/30" |
| **Income optimization** | "Your bonus pushed you into a new bracket — consider maxing your 401k" |
| **Life event planning** | "If you're buying in Q3 2027, here's a month-by-month savings schedule" |

### Tip Freshness Strategy

- **Vary the depth** — some days surface-level, some days deep analysis
- **Seasonal/calendar awareness** — tax tips in Q1, holiday budgeting in October, open enrollment reminders in November, irregular expense predictions based on prior-year patterns
- **Reduce cadence when thin** — if finances are simple or data is limited, fewer tips rather than repetitive ones

### The "Aha" Moment

The moment the user realizes this isn't a chatbot — it's an advisor. This happens when the advisor **notices something the user hasn't asked about:**

"I've been looking at your tax situation and I think you're leaving money on the table with your current withholding setup. Want me to walk through it?"

This is the moment that justifies $100/month. The advisor is doing work on the user's behalf when they're not looking.

---

## Memory System

Two-table architecture, already built.

### Client Profile (structured, one row per user)
- Risk tolerance, financial literacy, communication preference, life stage
- Household info (family size, dependents, partner income context)
- Updated organically — advisor proposes changes in conversation, user confirms

### Memory Notes (append-only, semantic)
- Categories: life_event, financial_plan, correction, preference, follow_up, pattern
- Advisor writes notes during conversation, checks for duplicates before saving
- Overwrites notes when facts change
- User can view, edit, and delete from the web dashboard

### Periodic Check-in
- Time-based (every 90 days)
- Advisor confirms stored information is still accurate
- "It's been a while — are you still planning to buy a house in 2027? And is Lisa still at the same company?"

### What the Advisor Never Memorizes
- Account numbers, SSNs, passwords
- Exact dollar amounts (those live in financial_data)
- Emotional states

---

## Document Ingestion

### Supported Formats
- PDF (bank statements, tax forms, portfolio statements)
- Photos of paper statements (Claude vision handles OCR)
- Screenshots of banking apps (Claude vision interprets)
- CSV exports

All files sent as Telegram attachments. Passed directly to Claude API for extraction.

### Post-Processing Response
After every document:
1. **Summary** — "That's a Chase checking account statement for February. I see $4,200 in income and $3,100 in expenses."
2. **Insight** — "Your dining spending jumped 35% compared to last month."
3. **Next ask** — "This gives me a good picture of your checking. A recent credit card statement would round things out — got one handy?"

---

## Error Handling

### AI Mistakes
When the user corrects the advisor:
1. Advisor apologizes and corrects in conversation
2. Memory system logs the correction (category: "correction")
3. Incident is flagged for human review (logged with severity)
4. Memory prevents the same mistake from recurring

### Non-Financial Input
User sends something that isn't a document or financial question. Advisor stays in character:

"Ha — nice photo, but I'm more of a spreadsheet person. Got any financial docs to send my way?"

---

## Technical Architecture

### Platform
**Telegram Bot API** — official, free, no verification required, rich messaging support (inline keyboards, file attachments, photo messages).

No dependency on OpenClaw or any middleware. Direct integration.

### System Architecture

```
User's Telegram App
       ↕
Telegram Servers (official Bot API)
       ↕
FinLens API (/api/telegram/webhook)
       ↕
┌──────────────────────────────────────┐
│           FinLens Backend            │
│                                      │
│  ┌──────────┐  ┌──────────────────┐  │
│  │ Claude AI │  │ PostgreSQL       │  │
│  │ (chat,    │  │ (financial data, │  │
│  │  extract, │  │  memory, chat    │  │
│  │  insights)│  │  history, users) │  │
│  └──────────┘  └──────────────────┘  │
│                                      │
│  ┌──────────┐  ┌──────────────────┐  │
│  │ Cron jobs │  │ Chart renderer   │  │
│  │ (daily    │  │ (text → Phase 1, │  │
│  │  briefing,│  │  images → P2)    │  │
│  │  alerts)  │  │                  │  │
│  └──────────┘  └──────────────────┘  │
└──────────────────────────────────────┘
       ↕
┌──────────────────────────────────────┐
│         Web Dashboard                │
│  (deep-dive charts, settings,        │
│   memory management)                 │
└──────────────────────────────────────┘
```

### Bot as Thin Client
The Telegram webhook handler translates between Telegram's message format and the existing FinLens API. All financial logic, AI prompting, memory management, and data processing lives in the API layer — same code that powers the web dashboard.

### User Identity & Account Linking
1. User creates a FinLens account on the web (finlens.app/signup)
2. In settings, clicks "Link Telegram"
3. Bot sends a verification code
4. User enters code on the dashboard
5. Telegram ID is now linked to their FinLens account

All subsequent Telegram messages are authenticated via this link.

### Payments
Handled inside Telegram via the Telegram Payments API (Stripe as provider). No need to leave the chat to subscribe.

---

## Onboarding Flow

### Step 1: Discovery
User finds FinLens via landing page (primary channel). CTA: "Connect on Telegram."

### Step 2: First Conversation
Bot opens with rapport, not a form:

> "Hey! I'm your financial advisor. Before we get into the numbers — what's the main financial thing on your mind right now? Saving for something? Trying to get a handle on spending? Thinking about investing?"

User responds naturally. Advisor engages for 2-3 messages, building memory.

### Step 3: First Document
Advisor asks for the first upload based on what the user said:

> "That makes sense. To give you real numbers on that, I'd need to see a recent bank statement. Just drop a PDF or photo here — I'll break it down."

### Step 4: First Value Moment
Advisor processes the document and delivers summary + insight + next ask.

### Step 5: Account Creation
After the first value moment:

> "I want to remember everything we've talked about. Set up your account so I can keep your data secure and build your dashboard: finlens.app/signup"

### Step 6: First Daily Briefing
Next morning, the user gets their first daily briefing. This is the product.

### Step 7: Paywall
After the first daily briefing:

> "That was your first morning briefing. I'll keep doing this every day — tracking your spending, forecasting your cash flow, and spotting opportunities you'd miss on your own. To continue: $X/month. If I don't save you at least $X in 30 days, full refund."

Quick-reply: `✅ Subscribe | ❓ Tell me more`

---

## Pricing

**$75-100/month** (exact price TBD based on competitive testing).

**Positioning:** "Less than half what a human financial advisor charges. And I'm available 24/7."

**Money-back guarantee:** "If I don't save you at least [price] in the first 30 days, full refund." The tip engine (subscriptions, tax optimization, spending patterns) should easily clear this bar.

**Payment:** Via Telegram Payments API (Stripe). Subscribe without leaving the chat.

---

## Web Dashboard (Companion)

The web app survives in reduced form. These pages stay:

| Page | Purpose |
|---|---|
| **Dashboard** | Deep-dive charts, net worth trend, portfolio view, full spending breakdown |
| **Memory** | View, edit, delete advisor memory notes. Edit profile fields. |
| **Settings** | Account management, Telegram linking, subscription management, data export |

**Removed from web:**
- Chat (lives in Telegram now)
- Recommendations (delivered proactively by the advisor)
- Reports (replaced by daily briefings)
- Goals (managed conversationally, tracked in memory)
- Documents page (uploads happen via Telegram)

---

## Build Phases

### Phase 1: Core Telegram Advisor (3-4 weeks)
- Telegram bot webhook endpoint
- Account creation + Telegram linking flow
- Document ingestion via Telegram attachments (PDF, photos, screenshots, CSV)
- Conversational chat (reuse existing chat API + memory system)
- Text-based chart rendering
- Cron job: daily morning briefing
- Cron job: real-time alerts (cash flow risk, spending anomalies)
- Dashboard handoff with magic links
- Onboarding conversation flow

### Phase 2: Payments & Polish (2 weeks)
- Telegram Payments API integration (Stripe)
- Paywall flow after first daily briefing
- Money-back guarantee tracking
- Subscription management in web settings
- Landing page with "Connect on Telegram" CTA

### Phase 3: Rich Charts & Deep Tips (2-3 weeks)
- Server-side chart rendering (images sent in Telegram)
- Tier 2 insight sources (tax optimization, goal gap analysis, debt optimization)
- Seasonal/calendar-aware tip engine
- Stale data detection + re-engagement prompts

### Phase 4: Advanced Intelligence (ongoing)
- Tier 3 insight sources (investment rebalancing, income optimization, life event planning)
- Periodic profile check-ins (90-day cycle)
- Cadence adaptation (reduce frequency when less to say)
- Error incident logging + human review pipeline

---

## Success Metrics

| Metric | Target | Why it matters |
|---|---|---|
| **Daily briefing open rate** | >60% | Are users reading the briefings? |
| **Documents uploaded per user per month** | >2 | Are users feeding the system? |
| **Chat messages per user per week** | >3 | Are users engaging beyond the briefing? |
| **30-day retention** | >70% | Are users staying past the first month? |
| **Money-back guarantee claim rate** | <10% | Is the product delivering measurable value? |
| **Average savings identified per user per month** | >$150 | Does the tip engine justify the price? |

---

## Open Questions

1. **Branding** — "FinLens Advisor" is a working title. The name "FinLens" implies a viewing tool, not a relationship. May need a rebrand for the Telegram-first product.
2. **Exact price point** — $75 vs $100. Needs competitive testing.
3. **Plaid integration** — roadmap item. Eliminates the "send me documents" friction entirely. Transforms the advisor from "smart when you feed it" to "always watching." Complex to build, significant value.
4. **Human escalation** — should there be a path to a real human advisor for complex situations? Could be a premium tier.
5. **Regulatory** — at $75-100/month with opinionated financial advice, are there licensing or compliance requirements? Needs legal review.

---

*The agent isn't an integration — it's the product. The dashboard is the appendix.*
