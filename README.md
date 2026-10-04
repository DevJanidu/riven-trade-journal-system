# Gold Journal

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

## API

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

The journal form sends trade data to `POST /api/trades`, then opens the created trade. Edit and delete use `PATCH` and `DELETE`, respectively. Dashboard, trade list, and review pages load database data. There is no authentication or broker connection, so deploy only in an appropriately private environment until access control is added.

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

Without `DATABASE_URL`, schema generation and static checks can still run, but the live data pages and valid database API requests cannot load data. The API returns 503 for missing database configuration.
# riven-trade-journal-system
