# Resumption audit

Baseline: `0ee1ef1` (2026-09-23). The original UI and calculation modules are present. Journal CRUD, pagination, filters, CSV export, workbook imports, account settings, chart datasets, worker simulations, saved simulation/bankroll scenarios and theme preferences have executable implementations. No mocked account history drives the app. The formula audit documents corrected broken workbook references and preserved per-sheet rules.

Pending at resumption: production database connection; production authentication/persistence verification; Supabase Auth and RLS (new requirements); reproducible production verification. The previous Vercel build succeeded but requests failed because DATABASE_URL was empty. Merely creating environment variable names did not configure a database. Sensitive Vercel values cannot be verified by inspecting blank values returned by an environment pull.

Evidence is linked trade screenshots, not uploads. Funded analytics is a saved bankroll projection, not an actual payout ledger: the source workbook supplies no ledger or separate profit-split calculation. No new financial formulas, upload buckets, billing or realtime subscriptions are required for this integration.

The Supabase migration is additive and uses new plural table names. Existing local PGlite data and legacy Drizzle migrations remain untouched for recovery/export; old passwords and sessions will not be copied into Supabase. Existing owners must authenticate with Supabase before explicitly migrating their journal data. Never map records by an unverified email claim.
