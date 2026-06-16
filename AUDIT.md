# Legacy Sports — Audit Report
**Date:** 2026-06-15
**Auditor:** Replit Agent

---

## 1. Architecture Overview

| Layer | Technology |
|---|---|
| Backend | Express 5, TypeScript, pnpm monorepo |
| Database | PostgreSQL + Drizzle ORM |
| Auth | express-session (cookie-based, server-side sessions) |
| Frontend | React + Vite (served by the API server) |
| Billing | Custom billing engine — invoices, subscriptions, auto-reminders |
| Deployment | Render (single service — API serves frontend) |

---

## 2. Auth & Roles

| Role | Access |
|---|---|
| `superadmin` | Full access — all schools, billing, settings |
| `school_admin` | School-scoped admin |
| `coach` | School-scoped, limited to their students |
| `player` | Read-only access to own profile |

**Auth flow:**
- `POST /api/auth/login` — session login with `schoolCode + username + password`
- `POST /api/auth/seed` — one-time super admin seed (requires `masterKey = SESSION_SECRET`)
- Session stored server-side, cookie is `httpOnly + secure` in production
- Global logout (`logoutAll`) invalidates all sessions via in-memory timestamp

**Default credentials (auto-seeded on first startup):**
- Super admin: `username=bhullar01` / `password=Bhullar_01`
- ⚠️ **Change password after first deployment.**

---

## 3. Environment Variables Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing secret — must be long and random |
| `PORT` | Server port (Render sets this to `10000`) |
| `NODE_ENV` | `production` or `development` |
| `RENDER_EXTERNAL_URL` | Your Render app URL — auto-set by Render, used for CORS |
| `CORS_ORIGIN` | Extra allowed origin (e.g. custom domain) — optional |

---

## 4. Bugs Fixed (this audit)

### BUG-001: Hardcoded Render subdomain URLs in CORS allowlist
- **File:** `artifacts/api-server/src/app.ts`
- **Severity:** Medium
- **Problem:** `legacy-sports-xmoq.onrender.com` and `legacy-sports-ql8y.onrender.com` were hardcoded. These are internal Render preview URLs that change per deployment.
- **Fix:** Removed hardcoded URLs. Set `RENDER_EXTERNAL_URL` env var on Render (auto-set) or use `CORS_ORIGIN` for custom domains.

### BUG-002: render.yaml pointed to wrong server
- **File:** `render.yaml`
- **Severity:** High
- **Problem:** The original `render.yaml` had `rootDir: render_server` and ran `node server.js` — a placeholder static server, not the real Legacy Sports application.
- **Fix:** Updated `render.yaml` to build the real pnpm monorepo and start the actual API server.

---

## 5. No Issues Found

- ✅ Session cookie is `httpOnly + secure` in production
- ✅ `SESSION_SECRET` and `DATABASE_URL` validated at startup
- ✅ Passwords hashed with `bcryptjs` (10 rounds)
- ✅ Security headers set (X-Content-Type-Options, HSTS, X-Frame-Options, etc.)
- ✅ `trust proxy` set correctly for Render/Cloudflare
- ✅ Billing engine: auto-invoicing, grace period, auto-suspend, AI reminders
- ✅ Bootstrap auto-seeds super admin on first startup

---

## 6. Deployment (Render)

```
Build: corepack enable && pnpm install && pnpm --filter @workspace/api-server run build
Start: node --enable-source-maps artifacts/api-server/dist/index.mjs
Port:  10000
Health: /api/healthz
```
**Required env vars in Render dashboard:**
- `DATABASE_URL` — set manually
- `SESSION_SECRET` — set manually

---

## 7. First-Run Checklist

- [ ] Set `DATABASE_URL` and `SESSION_SECRET` in Render dashboard
- [ ] Deploy — auto-seeds super admin `bhullar01` / `Bhullar_01` on startup
- [ ] Login and change super admin password immediately
- [ ] Set `CORS_ORIGIN` if using a custom domain
- [ ] Verify billing scheduler starts (check logs for "billing cycle complete")
