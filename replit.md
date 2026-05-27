# Legacy Sports

A school sports management platform for managing athletes, coaches, attendance, performances, fees, and analytics across multiple schools.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/web run dev` — run the frontend (port 22333)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing secret

## Default credentials (seeded on first boot)

- **Superadmin**: username `bhullar01` / password `Bhullar_01`
- Login via the "System administrator? Click here →" link on the login page

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4 + shadcn/ui + Wouter + TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/index.ts` — Drizzle database schema
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod server schemas (do not edit)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/web/src/pages/` — React page components
- `artifacts/web/src/hooks/use-auth.tsx` — auth context/hook

## Architecture decisions

- Session-based auth (express-session + bcryptjs) with school-code lookup on login
- Role hierarchy: superadmin → school_admin → sub_admin → coach → player → parent
- Multi-tenant: all data is school-scoped; superadmin can see all schools
- Sports are fully configurable with custom performance fields (JSON schema per sport)
- Billing/subscription module for platform-level invoicing of schools (INR)

## Product

- Multi-school sports management: schools register, coaches and players join by school code
- Attendance marking and trend analysis per player/sport
- Performance logging with sport-specific custom fields and leaderboards
- In-app messaging between users, notification system
- Calendar for training sessions
- Fee management for player-level payments
- AI-assisted letters and certificates (PDF generation)
- Platform billing/subscription management for superadmin

## User preferences

- Currency default: INR
- Date format: Indian locale

## Gotchas

- The API server runs its own bootstrap (migrations + seed) on every startup
- Session secret must be set in `SESSION_SECRET` env var — app will crash without it
- CORS allowlist in `artifacts/api-server/src/app.ts` must include the deployed domain
- `pnpm-workspace.yaml` has a `minimumReleaseAge: 1440` policy — do not disable it

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
