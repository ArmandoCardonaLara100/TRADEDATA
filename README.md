# TRADEDATA

TRADEDATA is a private trading journal and analytics application. It records operations, calculates performance statistics from raw trade data, reproduces the supplied workbook's calculator and simulation logic, and keeps separate trading-account histories.

It is an analytical tool, not a source of trade recommendations or financial advice.

## Included modules

- Email/password authentication and account-scoped data access
- Trading journal with create, edit, delete, search, filters, pagination, CSV export, notes, and evidence links
- Account overview, equity, drawdown, outcome, instrument, and monthly charts
- Formula-driven statistics with spreadsheet reconciliation notes
- Workbook import for the supplied `Trading Web.xlsx` journal structure
- EUR/USD and XAU/USD workbook calculators
- Seeded Monte Carlo simulation in a Web Worker, saved scenarios, and funded-account ROI analysis
- Responsive light and dark themes

## Technology

- Next.js 16, React 19, and TypeScript
- PostgreSQL-compatible data access with Drizzle ORM; PGlite for local development
- Better Auth for sessions and email/password authentication
- Zod validation, Decimal.js calculations, Recharts visualizations, Radix Dialog primitives
- Vitest and Playwright for formula, API, browser, accessibility, and responsive checks

## Requirements

- Node.js 22.16 or later
- npm

## Setup

```bash
npm install
cp .env.example .env.local
npm run db:migrate
```

For local development, `DATABASE_URL` may remain empty. TRADEDATA stores its local PGlite database under `.data/`, which is ignored by Git.

For a production deployment, set these variables in the deployment platform rather than committing them:

```text
DATABASE_URL=postgresql://...
BETTER_AUTH_URL=https://your-tradedata-domain.example
BETTER_AUTH_SECRET=<at-least-32-character-random-secret>
```

Generate a secret with `openssl rand -base64 32`. Do not use a local development database or automatically run migrations from public web requests in production. Apply migrations deliberately with `RUN_MIGRATIONS=1 npm run db:migrate` during deployment.

## Commands

```bash
npm run dev          # Start the development server
npm run typecheck    # Check TypeScript
npm test             # Run workbook parity and calculation tests
npm run test:e2e     # Run browser, API, accessibility, and responsive tests
npm run build        # Create a production build
npm run start        # Run the production server
npm run db:generate  # Generate Drizzle SQL migrations
npm run db:migrate   # Apply migrations
```

To test parsing against a local source workbook without including it in the repository:

```bash
SOURCE_WORKBOOK="/absolute/path/Trading Web.xlsx" npm test
```

## Project structure

```text
src/app/             Routes and API handlers
src/components/      Shared UI and charts
src/features/        Product modules
src/lib/             Analytics, simulation, calculations, auth, validation, database
src/workers/         Monte Carlo worker
drizzle/             Database migrations
tests/               Formula parity, import, API, browser, and accessibility tests
docs/                Spreadsheet audit and implementation decisions
```

## Workbook behavior

The full formula audit and known source discrepancies are documented in [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md). The app preserves the two imported journal sheets as separate accounts because they use different break-even bands and contain overlapping history. It does not invent dates, results, or missing source formulas.

## Security and privacy

`.env*`, `.data/`, dependency folders, build output, test reports, editor metadata, and generated audit output are excluded from version control. All journal mutations require an authenticated user and server-side ownership checks.
