# TRADEDATA implementation plan

## Source audit (before application implementation)

`spreadsheet/workbook-audit.json` inventories every populated cell, original formula, cached value, number format, normalized formula family, native chart, validation, conditional formatting rule and merged range. `scripts/audit_workbook.py` reproduces the read-only audit. No instructions embedded in the workbook are treated as project instructions.

Four worksheets: SEPTIEMBRE 2026 (213 formulas), AGOSTO-DICIEMBRE 2026 (824), SIMULACION MONTE CARLO (10,611), Calculators (4). Total: 11,652 formulas across 62 structural families, seven native charts. No defined names or Excel tables. Journal records are numbered operations, not dated trades.

## Dependency map

1. Journal B5 (initial capital), C:F (symbol/risk fraction/planned reward-to-risk/duration), G (net result), K:L (explanation/evidence and feelings) feed all analytics. B at each operation is its opening balance, so post-trade equity is B + G. Sequence numbers preserve original order.
2. G cumulative sums → H individual return and I accumulated return → J drawdown. Original denominator is fixed 6000, not previous equity. Drawdown = cumulative return minus its running maximum including zero: percentage points of starting capital, not percentage of peak equity.
3. G and per-sheet threshold → W/L/BE amounts → counts/sums/means → win rate = wins / (wins + losses). September threshold is ±25 inclusive BE; longer sheet is ±15 inclusive BE. Net P&L includes BE amounts. Planned R is column E, not realized R.
4. Monte Carlo B4:B11 → cumulative fixed-risk Bernoulli paths → terminal pass/fail/unresolved classification → F4:F6 proportions → bankroll F15:F20. Random trial: RAND() < winProbability. Increment win = rewardRisk × riskFraction; loss = -riskFraction. ROUND to six decimals at every operation. Stop on next row after target or drawdown breach. A trailing limit = maximum return so far minus maxDrawdown. Unresolved paths are not failures. B12 is a visual recalc checkbox with no formula references.
5. Calculator EURUSD A5,C5 → B5 = cash / (pips × 100) → D5 = cash + lots × 5. XAUUSD F5,G5 → H5 = pips × 100 × lots → I5 = cash + lots × 3.32. These are the supplied broker/unit conventions, not universal pip-value rules.
6. Bankroll: investment = cost × accountCount; funded = ROUND(accountCount × simulatedPassRate, 0); net = ROUND(funded × withdrawals × withdrawalAmount - investment, 0); ROI = net/investment; effective account cost = investment/funded; total = net + investment. Account size B15 is informational, not an input to these formulas. No profit split, actual-payout ledger or fee refund formula exists in the source; these are not invented.

## Explicit discrepancies and handling

- September I5 divides by 10,000 instead of 6,000, but its current numerator is zero. Preserve source evidence; application consistently uses the account's starting capital and calls this a corrected reference.
- September B25 incorrectly references B19+G19; application rolls all completed operations forward. G191:G219 contain #REF! outside the displayed 20-operation range. Do not reproduce broken references or expose NaN.
- The long-history title says JUNIO-DICIEMBRE, while its tab name says AGOSTO-DICIEMBRE. There are no actual dates. Imported dates remain null; charts use operation sequence; date filters exclude undated rows only when a date filter is active.
- The sheets overlap and include a differing loss (-62.8 versus -62). Import separately, preserve provenance and never add them into a combined portfolio.
- September has 16 described operations but only 13 numerical results; three are incomplete/observations, not zero-result trades. The long history has 38 completed trades. Empty template rows are not trades.
- Long-history O106 counts the explicit opening-balance G5=0 as a tenth break-even. Trade-only analytics show nine BE trades; worksheet reconciliation separately includes this baseline and compares all cached totals. September's blank G5 is not counted. Never present 39 as the actual number of completed trades.
- The long-history U5 is average winning amount / hard-coded 60; September W5 is mean planned R over all filled E cells, including incomplete trades. Both are preserved as named worksheet metrics; neither is silently relabeled realized average R.
- Formula-derived maximum drawdown, outcome distribution, profit factor, expectancy, streaks and realized R are transparent derived measures; source formulas take precedence. Realized R uses P&L / (starting capital × recorded risk fraction), consistent with fixed-capital risk; unavailable with missing/zero risk.
- Workbook random seeds are absent. Random paths cannot match a fresh Excel RAND run. Tests replay each cached path's observed Bernoulli outcomes and verify every increment, six-decimal rounding, stopping point and terminal classification. Production simulation uses a disclosed reproducible seed and the same transition function.
- Original growth charts include an exponential trendline without displayed equation. No predictive trendline is added: it has no source calculation or application decision role. All chart datasets are dynamically derived from user inputs.
- Source chart ranges sometimes include baseline/blank rows or omit an operation; application charts include every completed trade and disclose the baseline separately.
- Some conditional color bands have reversed endpoints. Status colors communicate actual sign/outcome; arbitrary profitability grades are not carried forward.
- Missing calculator denominators and zero funded accounts return unavailable with explanatory text, instead of division-by-zero errors.

## Architecture and implementation order

This is a standalone SaaS codebase with app-owned registration/login, not a workspace-authenticated Sites page. Next.js App Router, React, TypeScript, semantic CSS tokens, accessible dialog primitives, Recharts, Zod, decimal.js, Better Auth and Drizzle/PostgreSQL. Local development uses persistent PGlite (PostgreSQL engine) without external credentials; deployment uses DATABASE_URL and managed PostgreSQL. Production requires an explicit session secret and trusted origin. No billing code.

1. Complete source inventory and fixtures; define raw input/domain contracts.
2. Pure decimal analytics, calculators, Monte Carlo state transitions and bankroll logic; parity tests.
3. PostgreSQL schema/migrations, ownership-scoped repository, authentication/session guards, request validation and protected mutation APIs.
4. Responsive application shell, intentional light/dark tokens, account settings and imports.
5. Journal CRUD, inspect/search/filter/sort/paginate; source provenance; automatic analytics.
6. Dashboard/statistics and line/area/donut/stacked/bar visualizations. Empty and incomplete data remain explicit.
7. Instant calculators, cancellable worker simulations, saved scenarios and funded ROI projections.
8. Unit/parity tests, authenticated integration and isolation tests, browser tests at desktop/tablet/mobile in both themes, production build and deployment documentation.

## Visual thesis

A calm analytical workbench: neutral graphite surfaces, an electric-blue equity line, generous whitespace and strong tabular numbers. Desktop sidebar, compact mobile drawer, account context always visible. The equity panel is the dominant surface, with a compact outcome ledger and drawdown strip; no decorative charts. A temporary monogram is an asset slot, not a permanent logo.

Tokens: ink #10131a, dark canvas #0b0d12, dark surface #12151c, light canvas #f5f7fb, light surface #ffffff, accent #397bfa; green/red reserved for results. System sans text and restrained monospaced numerical metadata avoid network font dependencies. At 200% zoom and small screens, cards reflow and tables scroll within their own region. Motion respects reduced-motion preferences.

## Acceptance evidence

Keep executable test results and unresolved launch prerequisites in README and docs/VERIFICATION.md. Do not claim externally hosted PostgreSQL, email delivery, deployment or performance at untested scales has been verified locally.
