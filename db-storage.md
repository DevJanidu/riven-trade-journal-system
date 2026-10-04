# Database and image storage

Tradezilla uses Neon PostgreSQL for trade records and Neon Object Storage for screenshot files. PostgreSQL stores trade fields and screenshot object keys; image bytes stay in a private S3-compatible bucket.

## Environment

Copy `.env.example` to `.env.development.local` for local development, or `.env.production` for a self-hosted production server, and fill in the values from the same Neon project and branch:

```env
DATABASE_URL=postgresql://.../tradezilla?sslmode=require
AWS_ENDPOINT_URL_S3=https://...storage...neon.tech
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-2
AWS_S3_BUCKET=trade-screenshots
```

Keep environment files out of version control. The `.env*` ignore rule already does this, while `.env.example` is allowed. Never use `NEXT_PUBLIC_` for credentials. Create a **private** bucket named `trade-screenshots` on the same Neon project branch as the database, then retrieve that branch's S3 credentials and endpoint from Neon. Neon Object Storage requires path-style S3 access; the app configures that in its S3 client.

For a self-hosted production server, `.env.production` is read automatically by Next.js at build/start time. Keep the file on the server and out of version control. Hosted deployment platforms that build from the repository do not receive ignored local files; enter the same six server-only variables in that platform's production environment settings. The app reads `DATABASE_URL` and the `AWS_*` values from `process.env` on the server. Drizzle CLI configuration loads `.env.production` when `NODE_ENV=production`.

The credentials previously pasted into this document must be revoked and replaced in Neon. Removing them here does not make the old credentials safe again.

## Database setup

Install packages and configure `.env.local`, then apply the committed migration. Image upload uses the AWS S3 client and presigner:

```bash
npm install
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm run db:migrate
npm run dev
```

In PowerShell, if `npm` is blocked because it resolves to `npm.ps1`, run the same commands with `npm.cmd` (for example, `npm.cmd install`).

`npm run db:generate` is only needed after changing `lib/db/schema.ts`; inspect generated SQL before applying it. `npm run db:push` is for development schema synchronization. Do not run both migration generation and push as competing schema workflows.

## Screenshot flow

The journal form sends selected images to `POST /api/uploads`. The server accepts PNG, JPEG, and WebP files up to 8 MB, assigns an opaque key, and uploads the bytes to the private bucket. The trade create/update request stores that key in `before_screenshot` or `after_screenshot`. Screenshot reads go through `/api/uploads/[key]`, which signs a short-lived storage read and streams the object to the browser. Image objects are removed when replaced, cleared, or when the associated trade is deleted.

Database and object storage do not share a transaction. The API removes newly uploaded objects if saving the trade fails; a rare storage failure during cleanup can leave an unreferenced object that should be removed from the bucket manually.

## CRUD API

- `GET /api/trades` lists and filters trades.
- `POST /api/trades` creates a trade.
- `GET /api/trades/[uuid]`, `PATCH /api/trades/[uuid]`, and `DELETE /api/trades/[uuid]` read, update, and delete a trade.
- `POST /api/uploads` uploads one screenshot and returns its object key.
- `GET /api/uploads/[key]` serves a stored screenshot.
- `DELETE /api/uploads/[key]` removes an uploaded screenshot (used to clean up failed submissions).

There is currently no authentication on the journal API. Deploy it only in a private environment until access control is added.

## Redis cache

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.development.local` for local development and in `.env.production` for a self-hosted production server. Set the same server-only variables in your hosting provider for a hosted deployment. Restart the Next.js server after changing them. The app caches monthly trade lists used by `/dashboard` and `/trades`, plus the `/api/dashboard` summary, for 45 seconds. Creating, editing, or deleting a trade clears the affected month keys. If Redis is unavailable, reads fall back to PostgreSQL; the server logs the Redis error.

Run `npm.cmd run test:cache:live` from the `tradezilla` directory to test a 50 KB Redis write, read, and delete using the development credentials. Set `NODE_ENV=production` to use `.env.production`. The script uses a temporary key and removes it. Run `npm.cmd run test:unit` for the cache helper and calculation tests.

To check caching manually:

1. Start the app with `npm.cmd run dev`, then open `/dashboard?month=2026-10` twice. In Upstash's Redis data browser, find `tradezilla:trades:2026-10`; its TTL should be between 1 and 45 seconds. The second page load should refresh the TTL only after the first key has expired.
2. Open `/api/dashboard?month=2026-10` twice. Find `tradezilla:dashboard:2026-10` with a TTL of at most 45 seconds.
3. Create a trade dated in that month, then check that both keys disappear. Reload the dashboard and confirm the new trade appears and the monthly key is recreated. Editing a trade into another month clears both months; deleting a trade clears its month.

The Upstash data browser may take a moment to refresh. An external database edit does not trigger app invalidation; the cached result expires within 45 seconds.
