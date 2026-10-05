# My Journal

A personal XAUUSD-only trading journal built with Next.js App Router, TypeScript, Tailwind CSS, Recharts, Neon PostgreSQL, Drizzle ORM, and Zod. The database is the source of truth for trades and monthly analytics; the only mock trades are in the optional development seed.

## Requirements

- Node.js supported by Next.js 16
- A Neon PostgreSQL database and connection URL

## Setup

```bash
npm install
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

In PowerShell, use `npm.cmd` if execution policy blocks the `npm.ps1` launcher.

Copy `.env.example` to `.env.development.local` for local development and fill in the Neon PostgreSQL connection and private Object Storage credentials. Create a private `trade-screenshots` bucket on the same Neon branch. Keep secret files private and do not put credentials in `NEXT_PUBLIC_*` variables. See [db-storage.md](db-storage.md) for setup details.

For self-hosted production, Next.js reads `.env.production` from the server project root. When deploying through a hosted platform, configure these server-only values in that platform's production environment settings because ignored `.env` files are not included in repository deployments.

Generate and review a migration, then apply it explicitly:

```bash
npm run db:generate
npm run db:migrate
npm run dev
```

`db:generate` creates SQL in `drizzle/`; inspect it before `db:migrate`. `npm run db:push` is available for development schema synchronization, but migrations are the recommended repeatable workflow. Neither migration nor seed runs automatically. If a migration is already committed, run only `npm run db:migrate` rather than generating it again.

If Drizzle Kit cannot connect through its WebSocket driver, run `npm.cmd run db:migrate:http`. This uses Neon’s HTTP driver and applies the setup/checklist compatibility columns idempotently.

Optional development data (20 October 2026 XAUUSD trades, including a break-even):

```bash
npm run db:seed
```

The seed skips October 2026 if that month already contains trades. It is never run automatically and should not be used against production data.

Open [http://localhost:3000](http://localhost:3000). `/` redirects to `/dashboard`.

## Account access

Registration requires an approval code sent through Resend to `APP_OWNER_EMAIL` (default: `janidudev@gmail.com`). The owner shares the code only with an approved applicant. No user is created before verification. Codes expire after five minutes, permit five attempts, and can be requested once per minute per email. A replacement code invalidates the previous request.

Password recovery at `/forgot-password` sends a five-minute OTP to the registered account email through the same Resend service. Old password-reset links are replaced by this flow. Email delivery must succeed before a code becomes usable; codes are never exposed in development responses or logs. Resetting a password invalidates previous login sessions. Existing sessions created before this update require signing in again.

Configure server-only `RESEND_API_KEY`, `APP_OWNER_EMAIL`, and `EMAIL_FROM=My Journal <noreply@journal.janidudev.com>` in both development and production. Verify the sending domain in Resend. Set `APP_URL=https://journal.janidudev.com` and a long random `AUTH_SECRET` in production. Apply `drizzle/0005_auth_otp.sql` with `npm run db:migrate` before using these flows. For an existing installation needing only the new OTP table, run `npm run db:migrate:otp`.

## API

Trade logs, AI analysis history/macro scorecards, and report tables use numbered pagination. Trade/report/history pages retain their filters and selection in the URL. Lists use ten rows per page; report setup breakdown uses five. Summary statistics and Excel downloads always include the complete filtered period. Changing filters resets paging; requests beyond the last page are clamped safely. `npm run test:pagination:browser` verifies paging and complete exports using a temporary account, with no OpenAI inference (requires the app running and the ignored saved analysis artifact).

All responses use `{ "success": true, "data": ... }` or `{ "success": false, "error": "..." }`. Validation responses also include `fieldErrors`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/trades?month=YYYY-MM&session=London&setup=...&result=Win&direction=Long` | Filtered, newest-first trades |
| `POST /api/trades` | Validate and create a trade |
| `GET /api/trades/[uuid]` | Read one trade |
| `PATCH /api/trades/[uuid]` | Validate and update editable fields |
| `DELETE /api/trades/[uuid]` | Delete one trade |
| `GET /api/setup-types` | List setup types |
| `POST /api/setup-types` | Create a setup type |
| `GET/PATCH/DELETE /api/setup-types/[uuid]` | Read, update, or delete a setup type |
| `POST /api/uploads` | Upload one PNG, JPEG, or WebP screenshot (max 8 MB) |
| `GET /api/uploads/[key]` | Read an uploaded screenshot through a short-lived signed storage URL |
| `DELETE /api/uploads/[key]` | Remove an uploaded screenshot |
| `GET /api/dashboard?month=YYYY-MM` | Derived monthly summary, chart series, setup/session/direction performance, and recent trades |

The API enforces XAUUSD, valid trade geometry, positive prices/risk, allowed enums, and HTTP(S) URLs. The server derives planned R:R, actual R, and result from price levels, risk, and P/L. Trade dates are PostgreSQL `date` values; month filters use inclusive start and exclusive next-month boundaries, without timezone conversion. Break-even trades are excluded from the win-rate denominator. PostgreSQL numerics are normalized before analytics.

The journal form sends trade data to `POST /api/trades`, then opens the created trade. Edit and delete use `PATCH` and `DELETE`, respectively. Dashboard, trade list, and review pages load database data. Journal pages and APIs require a signed-in user and scope data to that account. There is no broker connection.

Screenshot images upload to Neon Object Storage when a trade is saved. PostgreSQL stores object keys in its screenshot fields; image bytes are never stored in the database. Replaced or removed images are deleted from storage.

Setup types are managed at `/settings/setups`. A setup cannot be deleted while existing trades use it. The setup migration converts the original PostgreSQL enum to a text field and inserts the five default setup types, allowing custom setup names through the full CRUD API.

Each setup can contain pre-trade rules and red “do not take this trade if…” warnings. The trade form calculates the strategy grade from the checked rules: above 75% is `A`, above 90% is `A+`, and 75% or below is not qualified. A qualified grade and the psychology confirmation that you are prepared to lose the planned risk amount are required before saving. The psychology answer and checklist are stored with the trade and shown on its review page.

## Checks

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

`npm run test:auth:live` checks OTP behavior against the development database with email delivery intercepted. It creates temporary test accounts and challenges and removes them afterward.

Without `DATABASE_URL`, schema generation and static checks can still run, but the live data pages and valid database API requests cannot load data. The API returns 503 for missing database configuration.
# riven-trade-journal-system

## AI Analysis: Gold fundamental research

`/ai-analysis` is an authenticated macro research dashboard inside this journal. It loads the most recently saved report and historical reports from Neon. Only pressing Generate/Refresh makes an OpenAI request. It provides professional weekly fundamental research with conditional bullish, bearish, and range scenarios. No technical-context input or alignment comparison is required. Previous analyses include a Delete action with confirmation; only the owner can delete a report.

Configure **server-only** `DATABASE_URL`, `OPENAI_API_KEY`, `FRED_API_KEY`, and `ALPHA_VANTAGE_API_KEY`. The old OpenAI variable name has been migrated in the local environment. `OPENAI_GOLD_MODEL` defaults to `gpt-6-luna`; configure deployment environment variables separately. No provider keys go to the browser or PostgreSQL.

Apply the reviewed migration using `npm run db:migrate`. Existing installations using HTTP compatibility migrations can run `npm run db:migrate:ai`, which atomically applies only `drizzle/0006_confused_phalanx.sql` and checks whether its three tables already exist. The SQL is replay-safe with the regular migration workflow. Do not use the older `db:migrate:http` command to install AI tables; it serves the existing trading schema.

```bash
npm run db:migrate:ai
npm run test:ai:unit
npm run test:ai:providers
npm run test:ai:live
```

Provider health checks use official live sources and an OpenAI model-access check without generating a report. They print only public data and safe status information. `test:ai:live` creates two temporary accounts, generates **one paid OpenAI report**, tests ownership/cooldown/duplicates and existing pages, then deletes those fixtures. Unit tests use synthetic fixtures without paid API requests. The internal diagnostic `scripts/check-openai-gold.ts` makes one paid structured request and saves a local public-data artifact; `npm run test:ai:browser` reuses that artifact to check desktop and mobile layouts without another model request. Artifacts are gitignored.

Connected sources: Alpha Vantage `GOLD_SILVER_SPOT` and `GOLD_SILVER_HISTORY` with `symbol=XAU`, daily history; 16 verified FRED series; official CFTC disaggregated futures-only managed-money Gold positioning (`72hh-3qpy`, COMEX contract `088691`). Official FRED past release dates are attempted for CPI, PCE, employment, and GDP.

FinanceCalendar supplies the current Monday–Friday economic calendar, prior/consensus/actual values when published, and deterministic event risk. No API key is required. Visible [FinanceCalendar](https://www.financecalendar.com/) attribution accompanies its data. Consensus coverage is measured from actual non-null estimates; calendar availability does not imply consensus availability. Existing saved reports retain their original snapshots; intentionally refresh to collect calendar data for a new report.

Not connected: live news, genuine DXY, market-implied Fed probabilities. Consensus may still be missing or partial in the provider response. The broad trade-weighted USD proxy is correctly named. Gold history supplies daily closes, so true weekly OHLC remains null; close-based ranges are explicitly labeled. Seasonally adjusted inflation index YoY may differ from published headline unadjusted YoY.

Run `npm run test:ai:calendar` for live calendar/provider/input checks with zero OpenAI requests. `npm run test:ai:calendar -- --analyze` intentionally makes one paid structured request, verifies Neon snapshot storage/isolation, and checks browser rendering with a local dev server running. Temporary test accounts/reports are removed afterward. `npm run test:ai:unit` includes calendar validation, consensus, risk, surprise, failure, timezone and attribution tests. See [FinanceCalendar integration](docs/finance-calendar.md) for scoring and operational details.

Database provider leases prevent shared cache stampedes. Gold/CFTC cache for 12 hours, FRED daily/weekly/monthly/quarterly data for 6/12/24/48 hours, and official release dates for 24 hours. Failed sources have a 15-minute backoff. A user generation lease and 15-minute attempt cooldown prevent duplicate charges across serverless instances. Each generation uses one bounded Responses request, medium reasoning, strict JSON schema, no tools, no automatic LLM retries, and `store:false`. Every saved analysis preserves its exact normalized snapshot and prompt/model version. The browser never calls upstream APIs directly.

See [AI Analysis implementation and source reference](docs/ai-analysis.md) for verified series, calculations, security, test evidence, and V2 options.
