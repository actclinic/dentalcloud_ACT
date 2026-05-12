# AGENTS.md — DentalCloud / DentFlow Pro

## Quick Start

```bash
npm install
# AI_API_KEY env var required for AI features (see AI_ASSISTANT_SETUP.md)
npm run dev        # vite dev server on port 3000
npm run build      # vite build
npm run preview    # vite preview
```

## Non-Obvious Architecture

- **No React Router.** View switching is state-based via `currentView` in `App.tsx`. Components are lazy-loaded (`React.lazy` + `Suspense`).
- **Supabase is the backend.** No custom server. Supabase client is initialized in `services/supabase.ts` with hardcoded URL/anon key.
- **Dual auth system:** Staff log in via the local `users` table; patients use Supabase Auth (with legacy fallback in `services/auth.ts`).
- **Multi-tenancy** via a `locations` table. Most queries filter by `location_id`.
- **Two storage systems** with automatic fallback: S3-compatible (AWS SigV4) via `utils/s3Storage.ts` and Supabase Storage REST API via `utils/supabaseStorage.ts`.
- **AI Assistant "Loli"** uses Qwen AI. Two modes: Ask (read-only) and Agent (CRUD). Falls back to mock mode when no `AI_API_KEY` is set. Supports Myanmar language voice input.

## Verified Commands Only

The only defined scripts are `dev`, `build`, `preview` in `package.json`. There is **no** test framework, no linter (ESLint), no formatter (Prettier), no typecheck script, no commit hooks, and no CI workflows.

## Toolchain

| Tool | Version |
|------|---------|
| React | ^19.2.3 |
| TypeScript | ~5.8.2 |
| Vite | ^6.2.0 |
| Node (Docker) | 20 Alpine |
| Package name | `dentflow-pro` |

- Path alias `@/` maps to root `./` (configured in `tsconfig.json` and `vite.config.ts`).
- Tailwind CSS loaded via CDN in `index.html` (not npm). Custom CSS variable themes (blue, green, yellow, brown, dark) in `index.css`.

## Database

- 19 SQL migration files in `database/` — **not managed by any migration tool.** Apply manually. Schema reference: `database/complete_database_setup.sql` (703 lines, 22+ tables).
- Supabase Edge Function at `supabase/functions/send-manager-email/` (Resend email proxy, `verify_jwt = false`).

## File Uploads

Uses `tus-js-client` for adaptive chunked resumable uploads (bypasses Cloudflare 150MB limit). See `SMART_UPLOAD_FEATURE.md`.

## Key Files

| File | Role |
|------|------|
| `index.tsx` | React mount point |
| `App.tsx` | Main orchestrator (~4600 lines) |
| `services/api.ts` | All Supabase data access (~4700 lines) |
| `services/auth.ts` | Login/auth logic |
| `constants.ts` | Tab definitions, categories, options |
| `types.ts` | All TypeScript interfaces |

## Conventions

- All business logic lives in `services/api.ts` and utility files in `utils/` — components stay thin.
- Receipt generation supports A4 and thermal 55mm formats (`components/Receipt.tsx`).
- AI memory is stored in the `assistant_memory` table per admin.
