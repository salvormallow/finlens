# FinLens Advisor — Implementation Plan

## Overview

Rebuild FinLens from a browser-first web app into a Telegram-first AI financial advisor. The core business logic (AI prompting, memory system, financial context, document extraction) is reusable. The work is building a new entry point layer (Telegram webhook -> service functions -> database) parallel to the existing web entry point.

**Approach:** Extract a service layer first, then build Telegram on top of it.

---

## Phase 0: Service Layer Extraction (COMPLETED)

Extract business logic from Next.js API routes into shared service functions callable by both web routes and Telegram handlers.

### Files Created
| File | Purpose |
|---|---|
| `src/lib/services/chat.ts` | `processChat(userId, message)` -> `{text, charts[], memoryEvents[]}` |
| `src/lib/services/documents.ts` | `uploadDocument()`, `processDocument()`, `ingestDocument()` (auto-classify + vision) |
| `src/lib/services/dashboard.ts` | `getDashboard()`, `formatDashboardSummary()`, `renderTextChart()` |

### Files Modified
| File | Change |
|---|---|
| `src/middleware.ts` | Exempted `/api/telegram` and `/api/cron` from NextAuth |
| `src/app/api/chat/route.ts` | Refactored to use `processChat()` service |
| `src/app/api/documents/upload/route.ts` | Refactored to use `uploadDocument()` service |
| `src/app/api/documents/[id]/process/route.ts` | Refactored to use `processDocument()` service |
| `src/lib/db/schema.sql` | Added Telegram support tables |
| `src/lib/db/index.ts` | Added migrations for new tables |

### New Database Tables
- `rate_limits` — per-user rate limiting
- `magic_links` — dashboard handoff tokens
- `api_usage` — Claude token cost tracking per user
- `briefing_queue` — fan-out cron pattern for daily briefings
- `onboarding_state` — state machine for Telegram onboarding flow
- `subscriptions` — Stripe subscription management

### New Columns
- `users.telegram_id` — links Telegram user to FinLens account
- `users.is_shadow` — marks pre-signup shadow accounts
- `users.email` — for account creation
- `chat_history.channel` — tracks message source (web/telegram)

---

## Phase 1: Core Telegram Advisor (3-4 weeks)

### 1.1 Telegram Bot Foundation
- [ ] Create `src/lib/telegram/client.ts` — pure fetch wrapper for Telegram Bot API (sendMessage, sendPhoto, setWebhook, getFile)
- [ ] Create `src/lib/telegram/types.ts` — Telegram Update, Message, CallbackQuery types
- [ ] Create `src/lib/telegram/validate.ts` — webhook secret token validation
- [ ] Create `src/app/api/telegram/webhook/route.ts` — POST handler that validates and routes incoming updates

### 1.2 Message Router
- [ ] Create `src/lib/telegram/router.ts` — dispatches updates to handlers based on type:
  - Text message -> chat handler
  - Document/photo attachment -> document handler
  - Callback query -> callback handler
  - `/start` command -> onboarding handler

### 1.3 Shadow Account System
- [ ] Create `src/lib/db/telegram.ts` — `findOrCreateUserByTelegramId()`, `linkTelegramAccount()`, `mergeShadowAccount()`
- [ ] Shadow account auto-creation on first Telegram contact
- [ ] Merge logic: when user signs up on web and links Telegram, transfer all data from shadow account

### 1.4 Chat Handler
- [ ] Create `src/lib/telegram/handlers/chat.ts`
- [ ] Calls `processChat()` service
- [ ] Sends text response via `sendMessage()`
- [ ] Sends charts as text-based charts (Phase 1) via `renderTextChart()`
- [ ] Sends memory event confirmations inline

### 1.5 Document Handler
- [ ] Create `src/lib/telegram/handlers/document.ts`
- [ ] Downloads file via Telegram `getFile()` API (use highest resolution for photos)
- [ ] Calls `ingestDocument()` service (auto-classification + vision for images)
- [ ] Sends summary + insight + next-ask response

### 1.6 Onboarding State Machine
- [ ] Create `src/lib/telegram/handlers/onboarding.ts`
- [ ] State transitions: first_contact -> rapport -> first_document -> first_value -> account_creation -> first_briefing -> paywall -> completed
- [ ] Conversation flow per product spec (rapport first, then document ask, then value delivery)

### 1.7 Rate Limiting
- [ ] Create `src/lib/services/rate-limit.ts` — sliding window per user per action type
- [ ] Integrate into Telegram message router
- [ ] Limits: X messages/hour, Y uploads/day (configurable via env)

### 1.8 Cron Infrastructure (Daily Briefing)
- [ ] Create `src/app/api/cron/dispatch-briefings/route.ts` — stage 1: enqueues user briefings into `briefing_queue`
- [ ] Create `src/app/api/cron/process-briefings/route.ts` — stage 2: processes N queued briefings per invocation
- [ ] Create `src/lib/services/briefing.ts` — generates personalized morning briefing using dashboard data + memory
- [ ] Add `vercel.json` cron config

### 1.9 Real-Time Alerts
- [ ] Create `src/lib/services/alerts.ts` — checks for alert triggers (overdraft risk, unusual transactions, goal off-track)
- [ ] Integrate with cron or trigger after document processing

### 1.10 Dashboard Handoff (Magic Links)
- [ ] Create `src/lib/services/magic-links.ts` — generate/validate short-lived tokens
- [ ] Create `src/app/d/[token]/page.tsx` — validates token, creates NextAuth session, redirects to dashboard

### 1.11 Token Usage Tracking
- [ ] Create `src/lib/services/usage.ts` — log input/output tokens per Claude call
- [ ] Instrument chat service, document service, briefing service

### 1.12 Memory Note Encryption
- [ ] Update `src/lib/db/memory.ts` — encrypt `content` field using existing AES-256-GCM encryption
- [ ] Add migration to encrypt existing notes

### 1.13 Account Linking (Web Side)
- [ ] Add Telegram linking UI to web settings page
- [ ] Generate verification code, send via bot, verify on web

---

## Phase 2: Payments & Polish (2 weeks)

### 2.1 Telegram Payments
- [ ] Integrate Telegram Payments API with Stripe as provider
- [ ] Paywall flow after first daily briefing
- [ ] Subscription status checks before processing messages

### 2.2 Subscription Management
- [ ] Stripe webhook handler for payment events
- [ ] Subscription status management (active, cancelled, past_due)
- [ ] Money-back guarantee tracking (30-day window)

### 2.3 Web Settings
- [ ] Subscription management in web settings
- [ ] Telegram link/unlink

### 2.4 Landing Page
- [ ] "Connect on Telegram" CTA
- [ ] Bot deep link (t.me/FinLensBot?start=...)

---

## Phase 3: Rich Charts & Deep Tips (2-3 weeks)

### 3.1 Server-Side Chart Rendering
- [ ] Chart-to-image rendering (e.g., using chart.js + canvas)
- [ ] Send as Telegram photo messages

### 3.2 Tier 2 Insights
- [ ] Tax optimization tips
- [ ] Goal gap analysis
- [ ] Debt optimization analysis

### 3.3 Tip Engine
- [ ] Seasonal/calendar awareness
- [ ] Spending trend analysis
- [ ] Subscription audit
- [ ] Stale data detection + re-engagement prompts

---

## Phase 4: Advanced Intelligence (Ongoing)

### 4.1 Tier 3 Insights
- [ ] Investment rebalancing suggestions
- [ ] Income optimization
- [ ] Life event planning

### 4.2 Cadence Adaptation
- [ ] Reduce briefing frequency when data is thin
- [ ] Vary tip depth day-to-day

### 4.3 Periodic Profile Check-ins
- [ ] 90-day cycle to confirm stored information
- [ ] Proactive "is this still accurate?" messages

### 4.4 Error Tracking
- [ ] Incident logging for AI mistakes
- [ ] Human review pipeline

---

## Architecture Decisions

### Auth Model
- Web routes: NextAuth JWT session (existing)
- Telegram webhook: validates secret token header, looks up user by `telegram_id`
- Both call the same service layer with a `userId` parameter

### Cron Pattern (Fan-Out)
```
Vercel Cron (every morning)
  -> /api/cron/dispatch-briefings (enqueues users into briefing_queue)
  -> /api/cron/process-briefings (processes N at a time, within timeout)
```
Dispatch runs once, processor runs every minute until queue is empty.

### Document Ingestion Paths
```
Web Upload (FormData + explicit docType)
  -> uploadDocument() -> processDocument()

Telegram (any file/photo, no docType)
  -> ingestDocument() (auto-classify via Claude, vision for images)
```

### Shadow Accounts
- First Telegram contact: create user with `is_shadow=true`, `telegram_id` set
- Pre-signup data stored against shadow user_id
- On web signup + Telegram linking: merge shadow -> real account (transfer all foreign keys)

### Memory Encryption
- `advisor_memory_notes.content` encrypted with existing AES-256-GCM
- Consistent with `financial_data.amount` encryption pattern
