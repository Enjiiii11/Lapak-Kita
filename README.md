# Lapak Kita

Lapak Kita is a React, TypeScript, and Vite marketplace deployed on Vercel. Its serverless API stores marketplace data and email/password accounts in Neon Postgres; database credentials stay server-side.

## Features

- Product catalog with category filtering and search.
- Email/password sign-up and sign-in, with secure HTTP-only database-backed sessions.
- Seller listings, shopping cart, order history, and admin moderation.
- Server-calculated checkout totals and atomic stock/order updates. Checkout is simulated; no real payments are processed.

## Deploy with Vercel and Neon

1. Import this repository into Vercel.
2. In Vercel Marketplace, connect a Neon Postgres database to the Vercel project. Ensure `DATABASE_URL` is available to the project’s Functions.
3. Create and connect a **public Vercel Blob store** to the project. Make sure `BLOB_READ_WRITE_TOKEN` is available to the project’s Functions for each deployment environment you use.
4. Run [`database/migrations/0001_neon_marketplace.sql`](./database/migrations/0001_neon_marketplace.sql) in the Neon SQL Editor. It creates the tables and checkout function and seeds eight sample products.
5. Redeploy after setting environment variables. Vercel detects the Vite frontend and routes API requests through the shared function in `api/index.ts`.
6. To grant administrator access, create and sign in to the intended account, then use the Neon SQL Editor to run `UPDATE users SET is_admin = TRUE WHERE email = 'your-account@example.com';`.

The site build command is `npm run build`, with `dist` as the output directory.

## Local development

Install dependencies, copy `.env.example` to `.env.local`, enter your Neon connection string, then run `npm run vercel:dev`. Sign in to Vercel when prompted. For local image uploads, also make sure `BLOB_READ_WRITE_TOKEN` is configured for the Development environment and available to Vercel CLI; never commit this token. Apply the migration to the database before creating accounts. `npm run dev` starts only the Vite frontend and does not run the serverless API.

## Authentication and account recovery

Passwords are hashed with Node.js scrypt. Session tokens are random, stored as hashes in Postgres, and sent in HTTP-only, same-site cookies. Email verification and password-reset email delivery are not configured; add an email provider before enabling those flows. New accounts are never automatically made administrators.

For privacy, the app clears any existing session when it loads. Users must enter their email and password again after opening or reloading the site; sign-in fields also disable browser autocomplete.

Users can change their password from the signed-in header or the login/sign-up screen by entering only their old password and a new password; no inbox link is required. On the login/sign-up screen, the email entered on the sign-in form identifies the account. The old password is required to protect accounts from changes based on email alone, and active sessions are expired after a password change. Forgotten-password recovery remains disabled until a verified reset flow is configured.

Existing Supabase accounts and data are not copied automatically. This migration creates a fresh Neon database with sample products; transfer any existing production data separately before switching users over.
