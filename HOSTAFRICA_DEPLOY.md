# HostAfrica Deployment Guide — DELARICO MERCHANDISE & SUPPLIES (`delarico.co.ke`)

This application is pre-built for **HostAfrica Shared Hosting (`public_html` via cPanel File Manager)** without requiring Node.js on the hosting server.

---

## Option 1: HostAfrica Shared Hosting (`public_html` via cPanel File Manager — No Node.js Needed)

1. **Upload the Production ZIP**
   - Log in to **HostAfrica cPanel → Files → File Manager**.
   - Open the **`public_html`** directory for `delarico.co.ke`.
   - Click **Settings** (top-right) and enable **Show Hidden Files (dotfiles)** so `.htaccess` is visible.
   - If you are replacing an older site, back up or clear old website files inside `public_html` (keep cPanel system folders like `.well-known` or `cgi-bin`).
   - Click **Upload**, select **`delarico-hostafrica-public_html.zip`**, and wait until the upload reaches `100%`.

2. **Extract Directly into `public_html`**
   - Right-click `delarico-hostafrica-public_html.zip` in `public_html` → **Extract** → extract to **`/public_html`**.
   - Verify that `index.html`, `.htaccess`, `robots.txt`, `sitemap.xml`, and the `assets/` folder sit directly inside `public_html/` (not nested inside a `dist/` subfolder).
   - Delete `delarico-hostafrica-public_html.zip` from `public_html` after extraction.

3. **Verify SSL & Refresh Routing**
   - Ensure AutoSSL / SSL certificate is active for `delarico.co.ke` and `www.delarico.co.ke` in **cPanel → SSL/TLS Status**.
   - Open `https://delarico.co.ke` and refresh sub-routes such as `https://delarico.co.ke/products`, `https://delarico.co.ke/saved`, and `https://delarico.co.ke/contact` to confirm `.htaccess` SPA routing is active.

4. **Static `public_html` vs Server-Side API Features**
   - **Works immediately on static `public_html` (no Node.js)**: All storefront pages & routes, Kenyan construction material catalog & photos, Cloud Firestore live public data (`categories`, `products`, `promotions`, `branches`, `reviews`, `settings`), Quick Search, Wishlist, Shopping Cart, Compare, WhatsApp checkout/quotations, and client-side routing.
   - **Requires a live `/api` backend (because secrets stay off public static files)**: Phone/password login & registration (`/api/auth/*`), Operations Console (`/api/ops/*`), AI Customer Care chat (`/api/ai/chat`), and server-gated Firestore form submissions (`orders`, `quotations`, `enquiries`, `reviews`, `affiliates`, `newsletterSubscribers`). To enable those on static `public_html`, host the Express server (Option 2 or external API host), set `VITE_API_BASE_URL=https://api.delarico.co.ke` (or your API origin), rebuild with `npm run build`, and ensure `ALLOWED_ORIGINS=https://delarico.co.ke,https://www.delarico.co.ke` is set on the API server.

---

## Option 2: HostAfrica cPanel ("Setup Node.js App" — Full-Stack Mode)

1. **Build Before or After Upload**
   - Upload the repository without `node_modules/`, then in cPanel Terminal / SSH run:
     ```bash
     npm install
     npm run build
     ```
2. **Create the Node.js App in cPanel**
   - Open **cPanel → Software → Setup Node.js App → Create Application**.
   - **Node.js version**: `20.x` or `22.x`
   - **Application mode**: `Production`
   - **Application startup file**: `app.cjs`
   - **Application URL**: `delarico.co.ke`
3. **Environment Variables**
   - `NODE_ENV=production`
   - `GEMINI_API_KEY=<your Gemini API key>`
   - `SESSION_SECRET=<random 32+ character string>`
   - `APP_URL=https://delarico.co.ke`
   - `ALLOWED_ORIGINS=https://delarico.co.ke,https://www.delarico.co.ke`
4. **Restart the App** and verify `https://delarico.co.ke/api/health` returns `"ok": true`.

