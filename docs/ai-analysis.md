# Gold AI Analysis implementation

Integrated at `/ai-analysis` in the existing Next.js journal. Existing Reports, Dashboard, Journal, Trades, Calendar and setup management remain accessible. New navigation uses Lucide BrainCircuit; mobile navigation scrolls horizontally to preserve readable labels.

## Files

Created:

- `app/ai-analysis/{page,loading,error}.tsx`
- `app/api/ai-analysis/{current,history,[id],generate}/route.ts`
- `components/ai-analysis/{analysis-controls,analysis-report}.tsx`
- `lib/ai/{schemas,prompts,gold-analysis,generate,api,display-facts}.ts`
- `lib/market-data/{types,calculations,http,alpha-vantage,fred-series,fred,cftc,cache,snapshot,data-quality}.ts`
- `lib/data/gold-analyses.ts`
- `drizzle/0006_confused_phalanx.sql` and `drizzle/meta/0006_snapshot.json`
- `scripts/{migrate-ai-analysis,check-ai-providers,check-openai-gold,check-ai-analysis,check-ai-browser,check-ai-ui}.ts`
- `tests/ai-analysis.test.ts` and this reference.

Modified: `lib/db/schema.ts`, `drizzle/meta/_journal.json`, desktop/mobile navigation, `.env.example`, `.gitignore`, `package.json`, lockfile, README. The gitignored local environment's legacy OpenAI key name was migrated to `OPENAI_API_KEY`. Pre-existing report-feature changes remain intact. No image-upload implementation changes.

The supplied provider credentials are configured in the ignored development and local production environment files. Hosted deployments must set their own server environment variables; no credentials are included in tracked files.

## Database

Three additive tables: `gold_weekly_analyses` (user-owned immutable reports), `gold_generation_locks` (per-user lease/cooldown), `market_data_cache` (public normalized provider facts and leases). PostgreSQL enforces scenario ranges/sum and confidence ranges. Nested interpretations, data quality and the exact normalized snapshot are stored in JSONB. Legacy technical context remains stored for historical compatibility; new reports use no technical input and the UI displays no alignment comparison. Model, prompt version, generation timestamp, week, Gold price and scenario percentages support future calibration.

AI Analysis provides professional weekly fundamental research without a personal context form. The generation endpoint accepts `{}`; supplied technical context is rejected. OpenAI receives only the normalized provider snapshot. Prompt `gold-macro-v1.2-fundamental-only` explicitly excludes technical-bias comparisons. Historical database fields are retained to avoid a destructive migration.

The reviewed migration adds no columns to trades and changes no authentication tables. Its generated snapshot reconciles the earlier migrations' missing metadata; repeated older schema mutations were removed from the new SQL. Run normal `db:migrate` on installations with tracked migrations or `db:migrate:ai` for the existing HTTP compatibility path. Existing trades can later receive a nullable, user-scoped analysis reference in a separate migration; this V1 does not add one.

## Verified FRED series

All IDs were checked against official FRED pages and live `/fred/series` metadata with the configured key.

| Key | Official series | Frequency | Meaning |
|---|---|---|---|
| us2y | [DGS2](https://fred.stlouisfed.org/series/DGS2) | Daily | 2-year nominal Treasury yield, percent |
| us10y | [DGS10](https://fred.stlouisfed.org/series/DGS10) | Daily | 10-year nominal Treasury yield, percent |
| realYield10y | [DFII10](https://fred.stlouisfed.org/series/DFII10) | Daily | 10-year TIPS real yield, percent |
| effectiveFedFundsRate | [DFF](https://fred.stlouisfed.org/series/DFF) | Daily, including weekends | Effective funds rate; not futures-implied probabilities |
| cpi | [CPIAUCSL](https://fred.stlouisfed.org/series/CPIAUCSL) | Monthly | Seasonally adjusted CPI price index |
| coreCpi | [CPILFESL](https://fred.stlouisfed.org/series/CPILFESL) | Monthly | Seasonally adjusted CPI excluding food/energy |
| pce | [PCEPI](https://fred.stlouisfed.org/series/PCEPI) | Monthly | Seasonally adjusted PCE price index |
| corePce | [PCEPILFE](https://fred.stlouisfed.org/series/PCEPILFE) | Monthly | Seasonally adjusted core PCE price index |
| payrolls | [PAYEMS](https://fred.stlouisfed.org/series/PAYEMS) | Monthly | Employment level in thousands; backend derives job changes |
| unemployment | [UNRATE](https://fred.stlouisfed.org/series/UNRATE) | Monthly | Unemployment rate, percent |
| joblessClaims | [ICSA](https://fred.stlouisfed.org/series/ICSA) | Weekly, Saturday observation | Initial claims, persons |
| averageHourlyEarnings | [CES0500000003](https://fred.stlouisfed.org/series/CES0500000003) | Monthly | Private hourly earnings, dollars/hour |
| gdp | [A191RL1Q225SBEA](https://fred.stlouisfed.org/series/A191RL1Q225SBEA) | Quarterly | Real GDP growth, seasonally adjusted annual rate |
| retailSales | [RSAFS](https://fred.stlouisfed.org/series/RSAFS) | Monthly | Retail/food-service sales, millions of dollars |
| industrialProduction | [INDPRO](https://fred.stlouisfed.org/series/INDPRO) | Monthly | Industrial production index, 2017=100 |
| usdBroad | [DTWEXBGS](https://fred.stlouisfed.org/series/DTWEXBGS) | Daily observations, weekly publication | Nominal broad trade-weighted dollar index, January 2006=100; **not DXY** |

The [Federal Reserve H.10 release](https://www.federalreserve.gov/releases/h10/) publishes previous-week daily USD observations on Mondays, with holiday adjustments. Its freshness tolerance therefore allows that normal lag.

## Gold and CFTC

[Alpha Vantage official API](https://www.alphavantage.co/documentation/): `GOLD_SILVER_SPOT&symbol=XAU`; `GOLD_SILVER_HISTORY&symbol=XAU&interval=daily`. Free requests are spaced by 1.2 seconds and protected by a shared PostgreSQL cache. Latest historical closes fall back for spot unavailability with explicit warnings. True weekly open/high/low is null because this history endpoint returns closes. Weekly start/high/low of **daily closes** and historical close dates are separately named. Trading-day comparisons use Monday-Friday UTC; no intraday data is fetched.

[CFTC dataset](https://publicreporting.cftc.gov/d/72hh-3qpy): Disaggregated Futures Only, Gold—Commodity Exchange Inc., contract `088691`, Managed Money long/short. The official [CFTC Gold report](https://www.cftc.gov/sites/default/files/files/dea/cotarchives/2025/futures/other_sf092325.htm) confirms the code. Only two Gold observations are requested. Net = longs − shorts; weekly change requires adjacent seven-day report dates. Category, source, report date and fetch date are preserved. Missing COT lowers coverage but does not stop an otherwise viable report.

## OpenAI and schema

Default `gpt-6-luna`, configurable through server `OPENAI_GOLD_MODEL`. The [official model page](https://developers.openai.com/api/docs/models/gpt-6-luna) and [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) establish support. Official OpenAI Node SDK uses `responses.parse`, `reasoning: { effort: 'medium' }`, `text.format: zodTextFormat(...)`, `max_output_tokens:6500`, `store:false`, `maxRetries:0`, 90-second client timeout. No tools or external model browsing.

Zod strict objects bound enums, confidence, percentages, text and arrays. Known indicator keys constrain scorecard rows. Source values are rendered directly from saved facts; the model only supplies impact/explanation. The model schema includes bias, probabilities, summary, scorecard, 3–6 drivers, three conditional scenarios, recent supported context, risks and bias-change conditions. Server quality and technical alignment are added deterministically rather than generated by the model. Allocation mismatches greater than one percentage point are rejected; small rounding differences use largest remainder allocation to total 100, with consistent scenario percentages. Confidence cannot exceed the backend quality cap (maximum 85).

## Calculations and freshness

Daily comparisons use latest versus approximately seven calendar days earlier; weekly/monthly/quarterly require the appropriate preceding economic period. Inflation YoY uses the exact prior-year month; MoM uses the exact prior month. Missing periods yield null. Rate basis points = (latest − comparison) × 100. PAYEMS levels multiply by 1,000 when deriving job changes; the previous job-change month is also calculated. GDP is a published annualized growth metric, not reannualized. Gold one/four-week changes are calculated from historical closes with bounded calendar gaps. COT arithmetic is deterministic.

Missing dots, empty/nonnumeric values and future observations are excluded. Each fact retains source, observation/report date and fetch time. FRED release dates use official `/series/release` and `/release/dates`, and are labeled separately from observation periods. They describe series releases, not consensus. Baseline unexpected-staleness tolerances are 7 days daily, 21 weekly, 80 monthly, 210 quarterly; USD uses 14 days to account for publication lag. These are documented operational tolerances, not inferred event schedules.

## Caches, failures and cost

Gold and CFTC: 12h; FRED daily/weekly/monthly/quarterly: 6/12/24/48h; official past release dates: 24h. PostgreSQL provider leases prevent concurrent cache fills. Failed loads have 15-minute backoff. Expired provider data is never silently returned as fresh. Only two Alpha calls per uncached Gold load. Sources run concurrently; FRED series failures are independent. One transient HTTP/network retry; quota and validation errors are not retried.

Require a recent Gold price, at least two fresh nominal/real Treasury series, and six fresh macro indicators before paying for inference. Missing CFTC or individual macro series remains visible. Backend coverage and stale-data deductions cap confidence; model may lower it further for conflicts. No simplistic macro-to-probability formula exists.

Each generation attempt acquires an atomic PostgreSQL user lease (10-minute expiry) and 15-minute cooldown. Client disables and synchronously guards repeated clicks; refresh additionally asks for confirmation. Each accepted generation makes one compact bounded model request and preserves a new immutable report. Reads and history never import the generation service. A save failure does not automatically retry inference; the cooldown remains, and the user receives a safe error. A long-running serverless plan must support the route's 180-second duration.

## Authorization and tests

Pages use `requireUser`; all API routes re-check database-backed `getSessionUser` beyond the existing proxy. The browser cannot submit a user ID: strict request validation rejects it. Every current/history/by-ID database read is user scoped. Report creation accepts only the session ID. No overwrite endpoint exists. DELETE /api/ai-analysis/[id] authenticates the session, validates the UUID/origin and deletes only where both report ID and trusted user ID match. History rows provide a confirmation before permanent deletion. Generation checks same-origin requests and accepts only an empty validated JSON object, rejecting client context and malformed JSON. No unsafe HTML rendering is used. Provider error objects, credential URLs, SQL errors and stack traces are not returned. Health diagnostics are terminal tools, not public production routes.

`test:ai:unit`: provider parsing, missing values, quota failures, freshness, calendar arithmetic, basis points, inflation and payroll math, CFTC arithmetic, strict output, malformed response, confidence cap, exact probability total, alignment, partial failures, database-save failure and single-request behavior.

`test:ai:live`: temporary Users A/B, one genuine generation against the server, parallel duplicate and cooldown rejection, cross-user UUID/page denial, immutable snapshot, unsupported mutation methods, no key exposure, shared cache lease, and existing journal page responses. Fixtures are deleted afterward.

`test:ai:browser`: reuses a local live-analysis artifact in a temporary test account, checks desktop/390px/320px rendering, overflow, runtime errors, and zero generation POSTs during reading/cancelled refresh. Captures ignored screenshots. No additional OpenAI inference is needed for this UI check.

## Verification on October 5, 2026

- Live Alpha Vantage spot and historical Gold retrieval passed; the initial free-tier spacing rejection led to spacing enforcement. True OHLC remains unavailable.
- All 16 live FRED metadata/observation fetches passed; official historical release dates for CPI/PCE/employment/GDP returned.
- Live CFTC Gold managed-money positioning passed, including two report dates and computed net/weekly change.
- OpenAI `gpt-6-luna` model access and actual Responses structured generation passed.
- Live paired generation returned 201 and 429: one saved report, one duplicate rejection. Subsequent isolation checks were completed using the verified live report artifact to avoid another paid inference. Next.js streamed not-found handling was accounted for in the page test.
- User A/B API and page isolation, rejected overwrite/delete methods, immutable snapshot, cooldown, database cache lease and absent browser credentials passed. Temporary test accounts/reports were removed; public-source caches were retained.
- Browser checks passed at 1440/390/320px, with no document overflow or runtime errors and zero generation POSTs from reading/cancelling refresh. Screenshots: `.ai-artifacts/ai-analysis-{1440,390,320}.png` (ignored).
- Existing Dashboard/Journal/Trades/Calendar/Reports authenticated page responses passed. Existing unit suite: 86 passed. AI suite: 16 passed. TypeScript and production build passed. Lint: zero errors, one unrelated pre-existing warning in `scripts/test-draft-flow-browser.mjs`.

## Missing sources and V2

FinanceCalendar now supplies weekly economic calendar and consensus where actually published; see [FinanceCalendar integration](finance-calendar.md). Null consensus remains missing and partial coverage remains visible. Live news, genuine DXY, and market-implied Fed probabilities remain unavailable. No fake dates, news, forecasts, technical targets, trade execution, or model training. Economic history revisions are isolated from stored snapshots.

V2: broader consensus coverage and licensed news; genuine USD/Fed-futures data when licensed; nullable user-checked trade-to-analysis references; historical scenario calibration using stored dates/prices/probabilities; accuracy analysis for aligned/conflicting trades. These are intentionally not implemented in V1.
