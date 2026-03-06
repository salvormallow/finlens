# USAA Integration Research — FinLens

## Problem Statement

Plaid requires business registration, security due diligence, and approval before granting
production API access. We need alternatives for connecting to USAA accounts in FinLens.

## Approaches Evaluated

### 1. Browser Automation / Cookie Scraping — NOT RECOMMENDED

**Concept:** Use Puppeteer, Playwright, or a Chrome extension to automate login to USAA's
web portal and scrape transaction data via session cookies.

**Why this won't work:**

- **Legal risk:** USAA's site is behind authentication. Under the Computer Fraud and Abuse
  Act (CFAA), automating access to login-protected systems is high-risk. The Van Buren v.
  United States (2021) narrowed CFAA scope for *public* data, but authenticated access
  remains clearly within scope. USAA's Terms of Service almost certainly prohibit automated
  access. "Personal use" is not a recognized CFAA defense.
- **Technical fragility:** USAA uses anti-bot measures including cookie validation, CAPTCHA
  challenges, Content Security Policy headers, and multi-factor authentication. Even
  legitimate tools (Quicken) frequently break with USAA connectivity.
- **Security liability:** Storing USAA credentials or session tokens in a third-party app
  means any app compromise also compromises the user's bank account.
- **Maintenance burden:** Bank UIs change frequently. A scraper requires constant upkeep.

### 2. OFX/QFX File Import — RECOMMENDED (Near-term)

**Concept:** Users download OFX/QFX transaction files directly from USAA's website and
upload them to FinLens.

**Advantages:**
- Zero third-party dependencies or API keys required
- No business application or due diligence process
- OFX is a structured XML-based format — reliable parsing, no AI extraction needed
- Works today with all USAA account types
- Users control their own data (privacy-preserving)
- Small implementation effort — extends existing upload flow

**Implementation:**
- Add `ofx` or `ofx-js` parser to process OFX/QFX files
- Map OFX transaction types to existing FinLens categories
- Route through existing encryption and storage pipeline
- Set `source = 'manual_upload'` (sub-type: 'ofx')

**User flow:**
1. Log into USAA → Download Transactions → Select OFX/QFX format
2. Drag-and-drop file into FinLens Documents page
3. FinLens parses structured data directly (no AI extraction step needed)

### 3. Finicity (Mastercard Open Banking)

**Concept:** Use Finicity's API for direct, token-based USAA data access.

**Key fact:** Finicity has a **confirmed direct data-sharing agreement with USAA**. This
uses a secure tokenized API — no screen scraping. Users authenticate directly with USAA
and grant consent.

**Advantages:**
- Direct API connection to USAA (not screen-scraping)
- Real-time transaction sync
- Mastercard backing (stable, well-funded)
- Lighter onboarding than Plaid for some use cases

**Disadvantages:**
- Still requires developer account and some onboarding
- API costs per connected account
- Less documentation/community support than Plaid

**Reference:** https://www.mastercard.com/us/en/news-and-trends/Insights/2018/Enhancing-the-data-sharing-experience-at-USAA.html

### 4. MX Technologies

**Concept:** Another major US-focused financial data aggregator with broad bank coverage.

- Strong focus on data enhancement and categorization
- May have USAA coverage via direct API or fallback methods
- Developer onboarding required

### 5. Yodlee (Envestnet)

**Concept:** One of the oldest aggregators with broad US bank coverage.

- Extensive bank coverage including USAA
- Enterprise-oriented — onboarding may be heavy
- Being repositioned under Envestnet's strategy

### 6. CFPB Section 1033 — Future (2026–2027)

The Consumer Financial Protection Bureau is mandating that banks provide standardized open
banking APIs under Section 1033 of the Dodd-Frank Act. This will eventually provide:

- Free, standardized API access to your own financial data
- No third-party aggregator needed
- Bank-provided, secure, consumer-permissioned
- Timeline: Large banks (2025–2026), smaller institutions (2027+)

USAA, as a large institution, should be among the early adopters.

## Recommendation

### Phase 1 (Now): OFX/QFX Import
Add OFX file parsing to the existing document upload flow. This gives structured USAA data
import with zero external dependencies. Implementation estimate: add OFX parser, map
transaction types, integrate with existing pipeline.

### Phase 2 (When ready): Finicity or Plaid
When the project is ready for real-time sync, evaluate Finicity (confirmed USAA partner)
vs. Plaid. Finicity may offer a faster path specifically for USAA.

### Phase 3 (2026–2027): CFPB Section 1033 APIs
Adopt standardized open banking APIs as they become available from USAA.

## Architecture Note

FinLens is already well-prepared for multiple data sources. The database schema supports
`source = 'manual_upload' | 'plaid' | 'api'` on accounts and financial_data tables. The
dashboard and chat systems are source-agnostic. Adding OFX import requires only a new
parser — the rest of the pipeline (encryption, storage, aggregation) works as-is.
