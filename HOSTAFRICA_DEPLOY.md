# Deployment & Backend Guide — DELARICO MERCHANDISE & SUPPLIES (`delarico.co.ke`)

---

## Clearing `Your connection is not private` (`NET::ERR_CERT_COMMON_NAME_INVALID`)

This error means DNS for `delarico.co.ke` / `www.delarico.co.ke` and the SSL certificate on the server are out of sync:

- **If hosting on HostAfrica cPanel**:
  1. Point domain nameservers to HostAfrica (`ns1.hostafrica...`) and ensure DNS **A** records for both **`@` (`delarico.co.ke`)** and **`www`** point to your HostAfrica cPanel IP.
  2. Open **cPanel → Security → SSL/TLS Status**, select **both `delarico.co.ke` and `www.delarico.co.ke`**, and click **Run AutoSSL** until both show green certificates.
  3. Only *after* AutoSSL succeeds on both domains, enable **cPanel → Domains → Force HTTPS Redirect**.

- **If pointing DNS to Vercel / Render / VPS**:
  1. Add both `delarico.co.ke` and `www.delarico.co.ke` in your host dashboard and verify SSL shows active.
  2. Wait 15–30 minutes (or clear browser DNS cache) if old records were cached.

---

## Full-Stack Backend API Overview

All `/api/*` routes are served by `server.ts` (`dist-server/server.cjs` in production), `api/[...route].ts` (Vercel), and `netlify/functions/api.ts` (Netlify):

- **Health & Public Storefront REST API**:
  - `GET /api/health` — Live service, Firebase Firestore, and Gemini AI status
  - `GET /api/catalog` — Full storefront bundle (categories, products, promotions, branches, reviews, settings)
  - `GET /api/products`, `GET /api/products/:slugOrId`, `GET /api/categories`, `GET /api/branches`, `GET /api/reviews`, `GET /api/settings`, `GET /api/promotions`, `POST /api/promotions/validate`
- **Authentication & Account**:
  - `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`, `POST /api/auth/logout`, `PATCH /api/auth/password`
- **Customer & Storefront Operations**:
  - `GET /api/customer/dashboard`, `PUT /api/customer/profile`, `PUT /api/customer/favourites`, `POST/DELETE /api/customer/addresses`
  - `POST /api/customer/orders` (authoritative server-side price, wholesale tier, promo discount, delivery fee & stock verification), `GET /api/customer/orders/:id/items`, `PATCH /api/customer/orders/:id/payment-ref`, `PATCH /api/customer/orders/:id/cancel`
  - `POST /api/customer/quotations`, `PATCH /api/customer/quotations/:id/decision`, `POST /api/customer/enquiries`, `POST /api/customer/reviews`
- **Affiliates, Newsletter & AI Customer Care**:
  - `GET /api/affiliates/me`, `POST /api/affiliates/enroll`, `POST /api/affiliates/track-click`, `PATCH /api/affiliates/payout`
  - `POST /api/newsletter/subscribe`, `POST /api/newsletter/unsubscribe`
  - `POST /api/ai/chat` (Gemini server-side proxy)
- **Operations Management Workspace (`/portal/workspace`)**:
  - `GET /api/ops/bootstrap`, `GET /api/ops/analytics`, `POST /api/ops/seed`
  - `GET/PATCH /api/ops/orders/:id/*`, `POST/PUT/PATCH/DELETE /api/ops/products`, `POST/DELETE /api/ops/categories`, `POST /api/ops/stock-movements`
  - `GET/PATCH /api/ops/quotations/:id/*`, `PATCH/DELETE /api/ops/customers/:uid`, `PATCH /api/ops/enquiries/:id/reply`
  - `PATCH/DELETE /api/ops/reviews/:id`, `PATCH/DELETE /api/ops/newsletter/:id`, `POST/PATCH/DELETE /api/ops/promotions`
  - `POST/PATCH/DELETE /api/ops/branches`, `PUT /api/ops/settings`, `PATCH /api/ops/affiliates/:uid/rate|/settle`

---

## Option 1: HostAfrica cPanel ("Setup Node.js App" — Recommended Full-Stack Mode)

1. Run `npm install && npm run build` locally (or on cPanel Terminal) to generate `dist/` and `dist-server/server.cjs`.
2. In **cPanel → Software → Setup Node.js App → Create Application**:
   - **Node.js version**: `20.x` or `22.x`
   - **Application mode**: `Production`
   - **Application startup file**: `app.cjs`
   - **Application URL**: `delarico.co.ke`
3. Configure Environment Variables (see `.env.example`):
   - `NODE_ENV=production`
   - `GEMINI_API_KEY=<your Gemini API key>`
   - `SESSION_SECRET=<random 32+ character secret>`
   - `APP_URL=https://delarico.co.ke`
   - `ALLOWED_ORIGINS=https://delarico.co.ke,https://www.delarico.co.ke`
4. Restart the Node.js App and verify `https://delarico.co.ke/api/health` returns `"ok": true`.

---

## Option 2: HostAfrica Shared Hosting (`public_html` Static + External API)

1. Open **cPanel → Files → File Manager → `public_html`**, enable **Show Hidden Files (dotfiles)**, and upload `delarico-hostafrica-public_html.zip`.
2. Extract directly into `/public_html` so `index.html`, `.htaccess`, `robots.txt`, `sitemap.xml`, and `assets/` sit at the root of `public_html`, then delete the ZIP.
3. Because static `public_html` does not execute `/api/*`, point `VITE_API_BASE_URL` (before `npm run build`) to a hosted instance of this backend (Option 1 Node.js App, Docker, or Vercel).

---

## Option 3: Docker / Cloud Run / VPS / Vercel / Netlify

- **Docker**:
  ```bash
  docker build -t delarico-store .
  docker run -d -p 3000:3000 -e GEMINI_API_KEY=... -e SESSION_SECRET=... -e APP_URL=https://delarico.co.ke delarico-store
  ```
- **Vercel**: Ready via `vercel.json` and `api/[...route].ts`. Set `GEMINI_API_KEY` and `SESSION_SECRET` in Vercel Environment Variables.
- **Netlify**: Ready via `netlify.toml` and `netlify/functions/api.ts`. Set `GEMINI_API_KEY` and `SESSION_SECRET` in Netlify Environment Variables.
