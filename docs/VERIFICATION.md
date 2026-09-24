# Supabase integration verification — 2026-09-24

## Scope and fixes

The original journal, analytics, calculator, Monte Carlo worker, bankroll projections, charts and UI were already implemented. This change replaces live Better Auth/PGlite/Drizzle access with Supabase Auth and PostgreSQL, preserving those calculations and workflows. The original Vercel failure was `DATABASE_URL is required in production`, digest `1573689593`, confirmed in deployment runtime logs. The new runtime does not require DATABASE_URL.

A hosted regression test uncovered a second problem: using SQLSTATE `40001` for an ordinary stale-edit conflict made PostgREST retry a nonrecoverable request. Migration `20260924161417_trade_conflict_status.sql` uses `PT409`; the API returns HTTP 409 within the test's 10-second deadline. See [Supabase's explanation](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

## Connected backend

- Project: TRADEDATA (`tudbqdntlnercpckzsmn`), Canada Central.
- Existing organization: ArmandoCardonaLara100's Org (`rnmeqjlphdogustjxoan`). No duplicate project or organization was created.
- Tables: profiles, trading_accounts, trades, strategies, scenarios, preferences. All user-owned tables have RLS and auth.users relationships.
- Trades and selected-account preferences use composite owner/account foreign keys. Two security-invoker views return monetary values as strings. Transactional invoker functions allocate trade sequences and import workbooks.
- Both migrations are recorded in hosted migration history. CLI connectivity problems were handled through the authenticated management connection; no database reset was performed.
- Email/password Auth, confirmation, 12-character minimum, production/local callback URLs and TOTP configuration are recorded in `supabase/config.toml`.
- Evidence remains HTTPS links. No Storage bucket, realtime subscription or billing code was added.

## Executed validation

| Check | Result |
| --- | --- |
| npm install | Passed; lockfile updated |
| npm run typecheck | Passed |
| SOURCE_WORKBOOK="/Users/armandocl/Downloads/Trading Web.xlsx" npm test | 19 passed: source/calculation/import parity plus SQL/RLS tests |
| npm run build | Passed locally and on Vercel |
| npm run test:e2e | 5 passed against local production server + hosted Supabase |
| TEST_BASE_URL=https://tradedata-five.vercel.app npm run test:e2e | 5 passed against Vercel + hosted Supabase |
| Dependency audit | Zero known vulnerabilities after applying the esbuild override correctly |
| Lint | No lint script/configuration exists; not reported as a passed lint check |

Hosted E2E coverage includes two distinct users, direct PostgREST reads/writes and RPC calls in both isolation directions, forged ownership, foreign-account inserts, anonymous API access, trusted-origin enforcement, invalid input, stale edits, concurrent sequence allocation, workbook import and aggregate parity, UI journal creation/edit/delete, refresh persistence, calculator, simulation chart, saved bankroll reload, logout/login restoration, statistics/settings direct routes, desktop/tablet/mobile layouts and both themes. Browser page errors and console errors were asserted absent in the UI flow. Automated accessibility checks exclude color-contrast; they are not a full accessibility certification.

QA users are uniquely generated and deleted by the suite. The hosted database contained zero users after cleanup. Legacy `.data/` remains intact and is not automatically assigned to a new Supabase identity.

## Deployment and source safety

Required production variables are configured: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_APP_URL. No admin key is used by the application. Generated types and schema are committed; environment values are not.

The first CLI verification upload included ignored local database/audit/test artifacts because Git exclusions did not govern that upload. Actual environment files were not uploaded. Added `.vercelignore`, replaced the deployment, verified the replacement's file list contained none of those paths, and deleted the superseded deployment `dpl_9HPmu5F3miXTL6R17jt45q2PDZmu`. The clean replacement was `dpl_F2dz8xZsK8KHLraemPCtFV1x9ttR`. This cleanup did not delete local data or Git history. Deployment-specific error/fatal logs for the replacement returned no entries.

Tracked/untracked project candidates were scanned for private keys, tokens, JWTs and exact private environment values without printing credentials. Only blank `.env.example` is versioned. `.env*`, local databases, dependencies, builds, traces, screenshots and Supabase CLI metadata are excluded from Git and deployment uploads.

## Remaining launch prerequisites / limits

1. **Public signup email delivery is not verified.** Password login was tested using administratively confirmed QA identities. A reserved-domain signup probe was rejected by Supabase (`email_address_invalid`), so it is not proof of delivered confirmation email. Configure/verify a custom SMTP sender in Supabase Authentication → Email before accepting arbitrary users; keep confirmation enabled and test with an actual controlled inbox. No credentials were requested in chat.
2. Supabase's Auth advisor reports **leaked-password protection disabled**. Enable it if supported by the project's plan; no paid plan change was made. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
3. Existing local records were preserved, not silently reassigned. Original workbook histories can be imported after registering a Supabase identity; additional legacy-only manual records need an explicit owner-verified transfer.
4. Preview deployments are not connected to the production database by default. Configure a separate Supabase environment before using preview authentication.
5. The installed CLI's config push updates Auth but errors when reading Storage configuration. Database migrations and app flows were verified independently; no upload bucket is used.

The authenticated core is verified in production. Public self-service onboarding is not declared complete until confirmation delivery is verified.
