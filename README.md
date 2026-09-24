# TRADEDATA

A private trading journal and probability workbench. Raw operations drive statistics, equity/drawdown charts, spreadsheet calculators, Monte Carlo simulations and funded-account bankroll projections. This is an analytical tool, not a source of trading recommendations. No billing or subscriptions are implemented.

## Technology

Next.js 16 App Router, React 19, TypeScript, Supabase Auth/PostgreSQL, Zod, Decimal.js, Recharts, Radix Dialog, Vitest and Playwright. Simulations run in a Web Worker. Financial logic remains in the analytics layer.

## Installation

Use Node.js 22.16+ and npm:

```bash
npm ci
cp .env.example .env.local
```

Set these values in `.env.local` and your deployment environment:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=
```

Use your Supabase project URL and **publishable** key. Set the application URL to `http://localhost:3000` locally and your HTTPS domain in production. The runtime does not use a database password or a service-role key. Never expose private credentials with a `NEXT_PUBLIC_` prefix or commit environment files.

## Database and authentication

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
npm run db:migrate
```

Migrations create six user-owned tables (`profiles`, `trading_accounts`, `trades`, `strategies`, `scenarios`, `preferences`), RLS policies, precision-preserving invoker views and transactional journal/import functions. Every user-owned table references `auth.users`; composite foreign keys prevent attaching records to another user's account. Persist raw inputs, not cached analytics or simulation paths.

Enable email/password authentication and email confirmation in Supabase. Configure a verified SMTP sender before opening registration to arbitrary users: Supabase's default email service restricts delivery. Set the Auth Site URL to the production domain and allow `/auth/callback` on that domain and localhost. Preview callbacks must be explicitly scoped to your own Vercel project. The server uses Vercel's trusted deployment URL for preview origins. Provision a separate Supabase environment for preview testing; do not silently share production data with previews.

`supabase/config.toml` records the current project's configuration, including production/local callback URLs. Review environment-specific URLs before applying it elsewhere. The installed CLI can update Auth and subsequently fail while reading Storage configuration; verify service settings after a partial configuration push.

No Storage bucket is needed: the existing journal supports HTTPS evidence links, not file uploads. No realtime subscriptions are used. Funded accounts currently provide saved bankroll scenarios, not a payout transaction ledger.

## Commands

```bash
npm run dev         # Development server
npm run typecheck   # TypeScript validation
npm test            # Workbook parity, input handling and RLS tests
npm run build       # Production build
npm start           # Production server
npm run test:e2e    # Production API, browser, persistence and hosted RLS tests
npm run db:types    # Print current generated database types
```

There is no ESLint configuration or lint script in the original project. Type checking, tests and the production build are the configured validation gates.

For full source-workbook parity without committing the workbook:

```bash
SOURCE_WORKBOOK="/absolute/path/Trading Web.xlsx" npm test
```

Run E2E tests against `npm start` or set `TEST_BASE_URL` to a deployed test target. The test runner reads the authenticated Supabase CLI's admin key into process memory, or accepts `SUPABASE_TEST_SECRET_KEY` through the test process environment. It creates two uniquely named QA users, verifies direct database isolation, and deletes only those users afterward. Never provide this test-only key to the deployed application. Test reports, traces (which can contain session data), screenshots and local databases are ignored by Git. If a test process is forcibly interrupted, remove only the QA users it created after confirming their identities.

## Structure

```text
src/app/             Pages, protected routes, API handlers and auth callback
src/components/      Shared UI and charts
src/features/        Dashboard, journal, statistics, calculator and simulations
src/lib/analytics/   Spreadsheet-derived statistical functions
src/lib/supabase/    Browser/server clients, configuration and database types
src/lib/server/      Authenticated repository and request guards
src/workers/         Monte Carlo worker
supabase/            Versioned SQL migrations and configuration
tests/               Workbook parity, database policies and browser tests
docs/                Formula audit, resumption audit and verification evidence
```

## Existing local data

The previous PGlite database in `.data/` and legacy Drizzle tooling are preserved. They are no longer used by web requests. Legacy passwords/sessions are not transferred into Supabase, and records are never reassigned based on an unverified email address. Register/confirm a Supabase identity, then import the original workbook through Settings. Preserve the old database for any additional manually entered records; those require an explicit owner-verified transfer. `legacy:db:*` commands are recovery tools, not the production migration path.

## Spreadsheet behavior

[Implementation notes](docs/IMPLEMENTATION.md) document formula dependencies, corrected broken references and preserved per-sheet ±$25/±$15 break-even rules. Imported histories remain separate because they overlap. No fake analytics or hard-coded chart outputs are used. See [verification](docs/VERIFICATION.md) for tested flows and remaining launch prerequisites.
