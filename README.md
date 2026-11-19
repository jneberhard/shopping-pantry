# Pantry & Table

A responsive kitchen app with pantry audits, recipes, weekly meal plans, a calendar, cooking history, and a shopping list calculated from missing ingredients.

The app now uses **Next.js + Prisma 7 + PostgreSQL (Neon)**, is configured for **Vercel**, and uses **pnpm**. Better Auth handles account creation, email/password login, sessions, logout, and optional password recovery. No separate authentication subscription is required for sign-in.

## Local preview

Use Node.js 22.12+ and pnpm 10.34.0 (pinned in `package.json`).

```powershell
pnpm install
pnpm dev
```

Open http://localhost:3001. Without cloud environment variables the app runs in local demo mode, and the login screen explains that cloud setup is pending. Existing local kitchen data is preserved.

## Create Neon and connect locally

1. In the Neon console, create a project named `pantry-table`. Select a region close to your intended Vercel function region. The default PostgreSQL database `neondb` is fine.
2. Open the project's **Connect** dialog. Select your branch, database, and role.
3. With connection pooling enabled, copy the PostgreSQL URL into `DATABASE_URL`. Its hostname includes `-pooler`.
4. Turn pooling off and put that connection string in `DIRECT_URL`. Prisma migrations use this direct connection; application requests use the pooled one. Keep Neon's SSL settings in both URLs. See [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).
5. Copy `.env.example` to `.env` in this project. Fill in the two URLs locally; keep credentials out of chat and Git.

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
```

6. Generate a session secret locally and place it in `BETTER_AUTH_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

7. Keep `BETTER_AUTH_URL=http://localhost:3001` locally. Then create the tables and confirm connectivity:

```powershell
pnpm db:migrate
pnpm db:check
pnpm dev
```

The initial SQL migration is checked in under `prisma/migrations`. `db:migrate` uses `prisma migrate deploy`; it applies pending migrations and does not reset the database. Do not use `db push` to replace this migration workflow.

8. Visit `/login`, create an account, and sign in. New account kitchens start empty. To bring in the guest kitchen saved in this browser, open **Your kitchen → Import this device’s kitchen**. This explicit import replaces the account kitchen; download a backup first if needed.

## Deploy on Vercel

1. Push this project to your Git repository and import the repository into Vercel. Use the project root and the **Next.js** framework preset.
2. `vercel.json` uses `pnpm install --frozen-lockfile` and `pnpm build`. Keep `pnpm-lock.yaml` committed. The production build generates Prisma Client and copies browser assets from `dist/` to `public/`.
3. Add these values under **Settings → Environment Variables** for the intended environment:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string |
| `DIRECT_URL` | Neon direct PostgreSQL connection string, for migration tooling |
| `BETTER_AUTH_SECRET` | A generated secret of at least 32 characters |
| `BETTER_AUTH_URL` | Your exact deployed origin, e.g. `https://your-app.vercel.app` |
| `RESEND_API_KEY` | Optional; enables password recovery with the sender below |
| `AUTH_EMAIL_FROM` | Optional; a verified sender such as `Pantry & Table <accounts@your-domain.com>` |

4. Apply migrations to the production Neon database once using `pnpm db:migrate` from a trusted terminal configured for that database. Builds intentionally do not run database migrations automatically.
5. Deploy/redeploy after changing environment variables. Use the same deployed origin on both devices and sign into the same account. The app refreshes while visible approximately every 15 seconds and when a tab regains focus or a connection returns.

Use a separate Neon branch/database and secret for development and preview deployments. Set each preview's `BETTER_AUTH_URL` to its actual origin; authentication rejects requests from other origins. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Accounts and data

- Every API request verifies the session server-side. The authenticated account determines the household; a client cannot choose another account's household ID.
- Accounts, sessions, pantry records, recipes, recipe ingredients, plans, shopping extras, checks, and cooking history are relational Prisma models. Cooking history retains a recipe's name after recipe deletion.
- Each account owns one private kitchen in this version. Multiple people sharing a household through invitations is a later feature.
- Better Auth handles password hashing and secure session cookies. Database-backed auth rate limiting works across server instances.
- Account caches use separate browser-storage keys. Signing into an account does not silently import the guest kitchen.
- Signed-in edits save locally first, then sync. The complete kitchen is validated and written in one transaction with an optimistic revision check. Independent record edits merge; edits to the same record pause for an explicit choice with both backups available.
- Offline edits retry while the app is open. Opening the app from scratch without any network is not supported yet; an offline service worker is a separate step. A cleared browser cache can remove changes that have not reached the database.
- Sync currently replaces the household's records atomically per revision. This is suitable for the initial bounded kitchen dataset; incremental per-record writes can replace it as usage grows.
- Email ownership verification and self-service account deletion are not implemented yet. Configure recovery before onboarding users, and add those account lifecycle features before a public app-store launch.

## Password recovery

Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` with a verified Resend sender to enable the “Forgot your password?” link. This sends the reset link to the account email, opens a password-reset form, and revokes existing sessions after reset. Without these values, the app hides the recovery link. See [Better Auth email/password](https://better-auth.com/docs/authentication/email-password) and [Resend email API](https://resend.com/docs/api-reference/emails/send-email).

## Checks

```powershell
pnpm db:validate
pnpm check
pnpm test
pnpm build
```

Tests cover ingredient quantities and conversions, validation boundaries, invalid recipe references, private cache scoping, conflict handling, concurrent saves, and offline persistence. A real Neon connection and two signed-in browsers are still required for live integration verification. `pnpm db:studio` opens Prisma Studio against the configured database.

Browser source remains under `dist/` from the original prototype. `scripts/prepare-public.mjs` copies it into Next.js static assets before development and builds. Restart `pnpm dev` after changing these browser source files. The original standalone `server.mjs` is no longer the application server.

Sample photography is served from Unsplash; fonts and photos need a network connection. Pantry stock is updated by inventory edits and purchased groceries; recording a cooked meal does not automatically consume ingredients.
