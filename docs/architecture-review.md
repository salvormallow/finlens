# Architecture Review: FinLens Advisor Product Spec

## Overview

This review evaluates the product spec against the existing FinLens codebase, identifying architectural flaws, gaps, and risks. Recommendations are prioritized by severity and build-phase impact.

---

## Critical Flaws (Must Fix Before Building)

### 1. The Webhook Endpoint Can't Use NextAuth — Auth Model Is Broken

**Severity: CRITICAL**

The entire existing API layer authenticates via `session = await auth()`, which reads a JWT from browser cookies set by NextAuth. Telegram webhook requests come from Telegram's servers — they have no cookies, no session, no JWT.

The spec says "bot as thin client to the existing FinLens API" but the existing API **cannot be called without a browser session**. Every single route (`/api/chat`, `/api/documents/upload`, `/api/dashboard`, `/api/memory`) starts with:

```typescript
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**What breaks:** The Telegram webhook handler can't just forward requests to these endpoints. It would need to either:

**Recommendation:** Create a separate auth path for Telegram. The webhook handler validates the request came from Telegram (via secret token in the webhook URL), looks up the FinLens user ID from the `telegram_id` stored in the database, and then calls the underlying business logic functions directly — NOT the HTTP API routes. Extract the core logic (chat processing, document upload, dashboard data) into shared service functions that both the API routes and the Telegram handler can call with a `userId` parameter.

---

### 2. No Cron Infrastructure Exists — Daily Briefing Has Nowhere to Run

**Severity: CRITICAL**

The spec calls for daily morning briefings and real-time alerts, both requiring cron jobs. The current app is a Next.js serverless deployment on Vercel. There is:

- No cron job framework
- No background worker system
- No task queue
- No scheduled function infrastructure
- `maxDuration` is set to 30 seconds on API routes — generating briefings for all users would exceed this easily

Vercel does offer Vercel Cron Jobs (via `vercel.json`) that trigger API routes on a schedule, but:
- They have a **10-second timeout on the Hobby plan**, 60 seconds on Pro
- They can't iterate over all users and generate personalized Claude-powered briefings in one invocation
- They're HTTP-triggered, which means one request per cron tick — not one per user

**Recommendation:** The daily briefing needs a different architecture. Options:
- **Fan-out pattern:** Cron triggers a dispatcher route that enqueues individual user briefings into a queue (Vercel KV, Upstash Redis, or a database queue table). A separate endpoint processes one user at a time, triggered in parallel.
- **External cron + worker:** Use an external service (Inngest, Trigger.dev, or a simple AWS Lambda on EventBridge) that can run longer and iterate over users.
- **Simplest v1:** Vercel Cron triggers an endpoint that processes users in batches, sending up to N briefings per invocation, with a cursor to resume on the next tick.

This is a Phase 1 blocker and needs to be designed upfront.

---

### 3. Document Upload Pipeline Assumes Browser FormData + Pre-Selected Document Type

**Severity: CRITICAL**

The current upload flow (`/api/documents/upload`) expects:
- A `multipart/form-data` POST with a `file` field and a `documentType` field
- The user explicitly selects the document type (bank_statement, w2, etc.) from a dropdown before uploading
- Only `application/pdf`, `text/plain`, `text/csv` MIME types are allowed

From Telegram:
- Files arrive as binary attachments with no document type selection
- Photos arrive as compressed JPEG (not in ALLOWED_TYPES)
- The user doesn't classify the document — the advisor needs to auto-detect it
- Screenshots of banking apps are images, not PDFs

**What breaks:** The entire upload validation and the requirement for `documentType` from the user.

**Recommendation:** Build a new document ingestion path for Telegram that:
1. Accepts any file type (PDF, JPEG, PNG, CSV)
2. Passes the file to Claude with a "classify and extract" prompt (Claude already does extraction — add classification)
3. Auto-detects the document type instead of requiring user input
4. The existing `extractFinancialData` function takes parsed PDF text — it needs to also accept raw image bytes for Claude's vision API

---

### 4. The Onboarding Flow Has a Chicken-and-Egg Problem

**Severity: HIGH**

The spec says:
1. User starts conversation on Telegram (no account yet)
2. Advisor chats, builds rapport, asks for documents
3. User sends a document → advisor processes it
4. **Then** the advisor asks user to create an account at finlens.app/signup
5. User links their Telegram

**The problem:** Steps 1-3 happen before the user has an account. But the entire database schema requires a `user_id` foreign key on everything — `financial_data`, `chat_history`, `advisor_memory_notes`, `documents`. Where does the data from steps 1-3 go?

**Options:**
- (a) Create a "shadow account" automatically on first Telegram contact, convert to full account when they sign up
- (b) Hold pre-signup data in a temporary store (Redis, in-memory), migrate on account creation
- (c) Require account creation before the first conversation (kills the onboarding flow)

**Recommendation:** Option (a) — create an anonymous account keyed by Telegram ID on first contact. When the user signs up on the web and links their Telegram, merge the shadow account into their real account. This preserves the onboarding flow but adds migration logic.

---

## Significant Gaps (Must Address During Build)

### 5. Chat Route Streams NDJSON — Telegram Needs a Complete Response

**Severity: HIGH**

The current chat route uses NDJSON streaming — it sends text chunks, chart events, and memory events as a continuous stream. The web frontend parses this in real-time.

Telegram doesn't work this way. You call `sendMessage` once with a complete response. You can't stream chunks to a Telegram chat.

**Impact:** The "bot as thin client" can't just proxy to `/api/chat`. It needs to:
1. Call Claude, collect the full response (including tool use loops)
2. Collect all memory events
3. Send the final text as a Telegram message
4. Send any charts as separate photo messages
5. Send memory notifications as separate messages or inline

**Recommendation:** Extract the chat logic into a non-streaming service function that returns `{ text: string, charts: ChartConfig[], memoryEvents: MemoryToolResult[] }`. Both the web streaming route and the Telegram handler call this shared function. The web route wraps it in NDJSON streaming; the Telegram handler sends discrete messages.

---

### 6. No Rate Limiting or Abuse Protection

**Severity: HIGH**

There is zero rate limiting anywhere in the codebase. Every API route is unprotected. With a Telegram bot:
- Anyone can spam the bot with messages, each triggering a Claude API call ($$$)
- Document processing uses Claude with `max_tokens: 16384` — expensive
- A daily briefing for all users runs Claude once per user per day — costs scale linearly

At $75-100/month per user, the Claude API costs per user need to be well under that.

**Recommendation:**
- Add per-user rate limiting (X messages per hour, Y document uploads per day)
- Track API costs per user (log token usage from Claude responses)
- Set up cost alerting
- Consider a message queue between the Telegram webhook and Claude calls to control concurrency

---

### 7. Telegram Webhook Security Is Not Addressed

**Severity: HIGH**

The spec doesn't mention how to verify that incoming webhook requests actually come from Telegram. Without validation, anyone who discovers the webhook URL can forge requests and trigger Claude calls, access user data, or manipulate the system.

**Recommendation:** Telegram supports a `secret_token` parameter when setting the webhook. Include this token in the `X-Telegram-Bot-Api-Secret-Token` header and validate it on every request. Also validate the `update` structure before processing.

---

### 8. Magic Link Dashboard Auth Doesn't Exist

**Severity: MEDIUM**

The spec calls for authenticated magic links ("Here's your dashboard: finlens.app/d/abc123"). The current auth system is username/password via NextAuth with JWT sessions. There's no:
- Magic link token generation
- Token-to-session conversion
- Token expiry/revocation
- Route that accepts a token and creates a session

**Recommendation:** Create a `magic_links` table (`token`, `user_id`, `expires_at`, `used_at`). New API endpoint generates a short-lived token (15-30 minutes). A `/d/[token]` route validates the token, creates a NextAuth session, and redirects to the dashboard.

---

### 9. Memory Notes Aren't Encrypted — But Financial Amounts Are

**Severity: MEDIUM**

The `advisor_memory_notes` table stores `content` as plain TEXT. The existing codebase encrypts all financial amounts at rest using AES-256-GCM (`src/lib/db/encryption.ts`). Memory notes could contain sensitive information ("Client plans to buy a house in Portland for around $600k", "Partner earns approximately $85k").

This is an inconsistency in the security model. If someone gains database access, they can read all memory notes in plain text while financial amounts are encrypted.

**Recommendation:** Encrypt the `content` field using the existing `encrypt`/`decrypt` functions. The query layer already handles this pattern for financial_data.

---

### 10. Vercel Blob Storage for Telegram Files

**Severity: MEDIUM**

The current upload pipeline stores files in Vercel Blob Storage. Telegram file downloads work differently — you get a `file_id`, call `getFile` to get a temporary URL, then download the binary. This needs to be piped into Vercel Blob.

Also: Telegram compresses photos. A high-quality bank statement photo might lose detail. The bot should request the original file when available (Telegram sends an array of `PhotoSize` objects — use the largest one).

**Recommendation:** Build a Telegram file download utility that fetches the file via the Bot API, uploads it to Vercel Blob, and feeds it into the existing processing pipeline. For photos, always use the highest resolution available.

---

## Design Risks (Address in Planning)

### 11. Claude API Costs Could Exceed Revenue at Scale

**Severity: HIGH (business risk)**

Per-user Claude costs, rough estimate:
- Daily briefing: ~2000 input tokens (context) + ~500 output tokens = ~$0.02/day = **$0.60/month**
- Chat messages (assuming 15/month): ~2000 input + ~500 output each = ~$0.30/month
- Document extraction (2 docs/month): ~8000 input + ~4000 output each = ~$0.20/month
- Real-time alerts (4/month): ~$0.08/month
- Memory tool calls: ~$0.05/month

**Total: ~$1.25/month per user** on Sonnet. Comfortable margin at $75-100/month.

**But:** If users send many documents, have long chat sessions, or the briefing prompt grows large with memory context, costs can 3-5x. The tip engine in Phase 3-4 adds additional daily Claude calls for analysis.

**Recommendation:** Instrument token usage tracking from day one. Log input/output tokens per user per call type. Set up alerts if per-user costs exceed $5/month.

---

### 12. The "Conversation First" Onboarding May Lose Users

**Severity: MEDIUM (product risk)**

The spec has 7 steps before the paywall. Steps 2-5 require multiple user interactions across potentially hours or days (waiting for the first daily briefing). High-intent users who clicked "Connect on Telegram" from a landing page might drop off if they don't see a clear path to value quickly.

**Recommendation:** Compress the pre-value journey. Consider: conversation (2 messages max) → document → immediate insight → "Want to see this every morning? Create your account" → account creation → next-morning briefing → paywall. The conversation shouldn't last more than 5 minutes before the first document ask.

---

### 13. The Existing `chat_history` Table Mixes Web and Telegram Messages

**Severity: LOW**

The `chat_history` table stores all messages with `role` and `content`. If the user chats on both web and Telegram, messages from both channels are interleaved. This is mostly fine (unified history is a feature), but:
- Telegram messages may include inline keyboard callback data
- The web chat loads the last 50 messages — Telegram messages might not render correctly in the web UI (if the web chat still exists for the dashboard)

**Recommendation:** Add a `channel` column to `chat_history` (`web`, `telegram`). Spec says web chat is being removed, so this is low priority, but useful for analytics.

---

### 14. No Subscription State Management

**Severity: HIGH**

The spec says payments happen via Telegram Payments API with Stripe, and there's a money-back guarantee. But the codebase has no concept of:
- Subscription status (active, cancelled, trial, refund_pending)
- Payment history
- Feature gating based on subscription
- Webhook handling for Stripe events (payment failed, subscription cancelled)

**Recommendation:** Add a `subscriptions` table (`user_id`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `created_at`). Build middleware that checks subscription status before processing Telegram messages (after the free onboarding window).

---

## Prioritized Recommendations

### Must Do Before Phase 1 Code

| # | Issue | Action |
|---|---|---|
| 1 | Auth model broken for webhooks | Extract business logic from API routes into shared service functions |
| 2 | No cron infrastructure | Design fan-out briefing architecture, choose queue mechanism |
| 3 | Upload pipeline assumes browser | Build Telegram-native document ingestion with auto-classification |
| 4 | Onboarding chicken-and-egg | Design shadow account system with merge-on-signup |
| 7 | Webhook security | Implement secret token validation |

### Must Do During Phase 1

| # | Issue | Action |
|---|---|---|
| 5 | Streaming chat incompatible | Extract chat into non-streaming service function |
| 6 | No rate limiting | Add per-user rate limits and cost tracking |
| 10 | Telegram file handling | Build file download + Blob upload utility |

### Must Do Before Phase 2 (Payments)

| # | Issue | Action |
|---|---|---|
| 14 | No subscription management | Build subscriptions table, Stripe webhook handler, feature gating |
| 8 | Magic links don't exist | Build token generation, validation, session creation |

### Should Do (Improves Quality)

| # | Issue | Action |
|---|---|---|
| 9 | Memory notes not encrypted | Encrypt note content at rest |
| 11 | API cost monitoring | Instrument token usage tracking per user |
| 12 | Onboarding too long | Compress to 5-minute pre-value journey |
| 13 | Channel tracking | Add channel column to chat_history |

---

## Summary

The spec describes a compelling product, but the existing codebase was built as a **browser-first web app**. The four critical issues (auth, cron, upload, onboarding identity) represent fundamental architectural assumptions that need to change. The good news: the business logic (AI prompting, memory system, financial context building, document extraction) is sound and reusable. The work is in building a new **entry point layer** (Telegram webhook → service functions → database) parallel to the existing web entry point (Next.js routes → service functions → database).

The recommended approach: **extract a service layer first**, then build Telegram on top of it. This also future-proofs for additional channels.
