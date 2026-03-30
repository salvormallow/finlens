# Claude Session: Fix AUTH_SECRET on Vercel

## Problem
The FinLens app deployed on Vercel is returning HTTP 500 when users submit login credentials. The Vercel function logs show:

```
MissingSecret: Please define a `secret`. Read more at https://errors.authjs.dev#missingsecret
```

This is because NextAuth v5 (beta.30) requires an `AUTH_SECRET` environment variable, which is not set in the Vercel project.

## Context
- **Repository:** `salvormallow/finlens`
- **Branch:** `claude/advisor-memory-system-Qq8qe`
- **Auth config:** `/home/user/finlens/src/lib/auth/index.ts` — uses NextAuth v5 with Credentials provider and JWT sessions
- **NextAuth version:** `next-auth@5.0.0-beta.30` (see `/home/user/finlens/package.json`)
- **Next.js version:** `16.1.6`

## Root Cause
NextAuth v5 requires `AUTH_SECRET` to be set as an environment variable. The app was likely previously using `NEXTAUTH_SECRET` (v4 naming) or never had it set. NextAuth v5 does NOT fall back to `NEXTAUTH_SECRET`.

## Fix Required

### Step 1: Set AUTH_SECRET in Vercel
This CANNOT be done via code or CLI from this environment. The user must:

1. Go to Vercel Dashboard → `finlens` project → **Settings** → **Environment Variables**
2. Add a new variable:
   - **Name:** `AUTH_SECRET`
   - **Value:** A random 32+ character base64 string (generate with `openssl rand -base64 32`)
   - **Environments:** Production, Preview, Development (all three)
3. Redeploy the project (Vercel → Deployments → click "..." on latest → Redeploy)

### Step 2 (Optional): Add AUTH_SECRET to next.config
If the user wants a code-level fallback for local dev, you could update `/home/user/finlens/src/lib/auth/index.ts` to explicitly pass `secret`:

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  // ... rest of config
});
```

But this is optional — NextAuth v5 auto-reads `AUTH_SECRET` from env.

### Step 3: Verify
After setting the env var and redeploying:
1. Visit the app login page
2. Submit credentials
3. Should authenticate successfully without 500

## Notes
- This is NOT a code bug — it's a missing environment variable on Vercel
- The code changes on this branch (service layer extraction, middleware updates) did NOT cause this issue
- If `NEXTAUTH_SECRET` exists in Vercel env vars, it should be renamed to `AUTH_SECRET`
- The `.env.local` file (if it exists) at `/home/user/finlens/.env.local` may have the secret for local dev but Vercel needs its own copy
