# FinanceCalendar integration

## Provider and sources

Server-only `lib/market-data/finance-calendar.ts` uses `https://www.financecalendar.com/wp-json/fc/v1/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500`. `getHighImpactEvents` adds `impact=high`; generation uses one weekly query without that filter so useful medium-impact US events are retained. `/next`, `/today`, and `/holidays` are not requested. No keys or authentication are required. The response's `from`, `to`, and `events` envelope was verified live on October 5, 2026. Attribution terms in that response require linking to https://www.financecalendar.com wherever the data appears.

The existing UTC Monday–Friday week utility determines the range dynamically. Weekly snapshot collection runs alongside Gold, FRED and CFTC via `Promise.allSettled`. The existing trading-performance calendar is unrelated and unchanged.

## Normalized events

Each event preserves date, normalized UTC timestamp, supplied ET time, all-day flag, name, title, impact, category, prior, consensus, actual, source, safe HTTPS event URL, fetch timestamp, series classification, relevance and optional numeric surprise. Missing fields stay null. UTC is used internally; display converts UTC with `Intl.DateTimeFormat` and `America/New_York`, respecting DST, with supplied ET as a fallback when UTC is unavailable.

Thirteen priority US families: FOMC/Federal Reserve, CPI/core CPI, PCE/core PCE, NFP/jobs, unemployment, average hourly earnings, initial claims, GDP, PPI, retail sales, ISM manufacturing/services, JOLTS and ADP. Names and titles identify US events, with US-specific series aliases supported without requiring an exact title. Recognized foreign CPI/labor releases are not labeled US. ECB, BoE, BoJ, BoC, RBA, RBNZ and SNB policy decisions are retained as contextual central-bank events. Ambiguous country/title metadata is omitted rather than guessed. This is a priority filter, not a claim that other events cannot move Gold.

At most 24 relevant high/medium events enter the stored/model snapshot. Excess results prefer high impact and US relevance, with a visible partial-coverage warning. Low-impact and irrelevant events are omitted. Provider results at the 500-result cap are rejected because complete coverage cannot be verified.

## Risk and consensus rules

- LOW: no retained meaningful events for that day.
- MEDIUM: at least one relevant medium event and no high events.
- HIGH: one high-impact event.
- VERY HIGH: at least two high-impact events, or a high-impact NFP/FOMC rate decision.
- Weekly risk is the maximum daily category. This is scheduled event risk for the whole week, including earlier days, not a direction signal or a probability of profit.

Consensus coverage is non-null consensus divided by upcoming priority US events (high and relevant medium). Separate high-impact numerator/denominator are also stored/displayed. Upcoming means actual is null and scheduled UTC is at/after analysis time, or date at/after the analysis date when no reliable time exists. No eligible events yields `percent: null`, not 100%. Zero estimates = MISSING; some = PARTIAL; all = AVAILABLE. Non-US bank decisions do not inflate US consensus coverage. Delayed actuals for past events stay null and are not assumed released.

Surprise is actual minus consensus only for strict, comparable numeric strings: percentages, K/M/B counts, jobs/claims, or plain ISM index values. Plain counts are interpreted only for count series. Percentage differences use percentage points. Mixed units, ranges, qualitative policy decisions, approximate values and compound text produce null. Prior/consensus/actual remain independent.

## Weighted quality

Weights sum to 100: Gold 15; nominal yields 12; real yields 15; inflation 12; labor 12; current Fed rates 6; growth/USD proxy 6; COT 7; calendar 6; consensus 5; live news 2; market-implied Fed probabilities 2. Indicator groups receive actual available fractions; stale observations receive half credit. Calendar success earns its weight even for valid empty results; malformed omitted events or trimming make it PARTIAL with half credit. A calendar older than 15 minutes is STALE. Provider failure is ERROR and earns zero. Consensus receives its measured fraction and half credit when stale. Live news and Fed probabilities remain MISSING. Maximum possible completeness with those two missing providers is 96%, not 100%.

Detailed original missing-indicator and staleness lists remain available. Quality still caps model confidence at 85 and reduces it for stale or missing critical real-yield evidence. No direction or AI probability is calculated from event risk or quality.

## OpenAI and storage

The existing single Responses request receives normalized `economicCalendar` within the exact stored `dataSnapshot`. No raw provider envelope, separate per-event call or inference on reads is added. Prompt `gold-macro-v1.1-calendar` separates current bias from event risk, prohibits inventing missing consensus, treats provider/user text as untrusted, and requests conditional reasoning in the existing scenarios/risks/bias-change fields. The strict output schema is unchanged; factual event values are rendered from provider snapshots, not model prose. Prompt constraints and tests reduce hallucination risk; free-form model explanations cannot provide an absolute guarantee against hallucination.

The existing JSONB snapshot requires no migration. Every generation inserts a new analysis. History is never rewritten when later consensus or actual values arrive. Existing user-scoped authentication/authorization remains in use.

## Cache, errors and attribution

PostgreSQL shared cache key includes week bounds, with a 5-minute TTL, atomic cache lease and existing 15-minute negative-cache backoff. Only explicit generation or server-side diagnostics fetch calendar data; report reads do not poll or call providers. This allows published actuals to be collected on later intentional generation, subject to the existing 15-minute per-user generation cooldown. Actuals may lag official release by roughly an hour; no real-time execution claim is made.

Zod validates the envelope and events. Malformed events are omitted with warnings; an entirely malformed nonempty response fails safely. Invalid UTC timestamps/unsafe links become null. Invalid JSON, HTTP failures, timeout and quotas use safe provider errors. One transient retry, no retries for quota or schema validation. Calendar failure becomes null, lowers completeness and does not block generation when critical Gold/FRED inputs remain sufficient.

Visible linked FinanceCalendar attribution appears in the event panel, quality/source sections and explanation panel. Event detail links use HTTPS and `noopener noreferrer`. News and Fed-probability providers remain unconnected.

## Verification commands

`npm run test:ai:unit`: calendar plus existing analyzer unit tests.

`npm run test:ai:calendar`: live weekly and high-impact endpoint checks, integrated snapshot and quality, no OpenAI inference.

`npm run test:ai:calendar -- --analyze`: one intentional paid structured generation, Neon snapshot round trip, cross-user denial, history immutability, desktop/390px/320px UI, visible attribution and zero inference during report reads/cancelled refresh. Requires the local app running. Test accounts are removed; ignored artifacts are saved under `.ai-artifacts/`.

`npm run test:ai:calendar -- --replay`: rechecks storage/isolation/browser behavior using that saved artifact, with zero additional model requests.

## Verified October 5, 2026

Live weekly API returned six global events; four matched priority US families (ISM Services, ADP, FOMC minutes, initial claims). The only returned high-impact global event was Canadian labor, correctly excluded from the US-priority snapshot. The high-impact query succeeded with zero retained Gold-priority events. Four upcoming priority events had null consensus: 0/4 coverage, consensus MISSING, calendar AVAILABLE, actual weighted completeness 91%. Gold, all 16 FRED indicators and CFTC remained available.

One live `gpt-6-luna` medium-reasoning structured Responses request validated. Its exact normalized calendar snapshot was saved/read through Neon; later provider collection left the saved snapshot unchanged. Cross-user database lookup and authenticated API access denied the foreign report (404). Existing Dashboard, Journal, Trades, trading Calendar, Reports and analysis read/history routes responded successfully for the test account. Test accounts/reports were removed. Browser checks at 1440/390/320px passed with visible attribution, no overflow/runtime exceptions, and zero generation requests on reads/cancelled refresh. Subsequent checks replayed the saved analysis without more inference.

Existing unit suite: 86 passed. Analyzer/calendar suite: 29 passed, including 13 new calendar tests. TypeScript and production build passed. Lint had zero errors and one existing unrelated warning in `scripts/test-draft-flow-browser.mjs:39`. No dependency, secret, environment-variable or database migration changes were needed for FinanceCalendar.

### Files changed for this integration

Created: `lib/market-data/finance-calendar.ts`, `components/ai-analysis/economic-calendar.tsx`, `tests/finance-calendar.test.ts`, `scripts/check-finance-calendar.ts`, `docs/finance-calendar.md`.

Modified: `lib/market-data/types.ts`, `lib/market-data/snapshot.ts`, `lib/market-data/data-quality.ts`, `lib/ai/prompts.ts`, `components/ai-analysis/analysis-report.tsx`, `scripts/check-ai-browser.ts`, `package.json`, `README.md`, `docs/ai-analysis.md`.
