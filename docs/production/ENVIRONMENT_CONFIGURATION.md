# ACT environment configuration

This configuration is preparation only. It does not deploy to Netlify, change
the production Supabase server, or wire `ACT_SUPABASE_URL` into the browser
client. That URL wiring remains a separate reviewed change.

## Files

- `.env.local.example`: copy to `.env.local` for isolated local testing.
- `.env.staging.example`: copy to `.env.staging` for a non-production test site.
- `.env.production.example`: reviewed public production metadata.
- `supabase/functions/.env.example`: server-only Edge Function template.

Real `.env*` files and `supabase/functions/.env*` files are ignored by Git. Only
files ending in `.example` may be committed. Never put a Supabase service-role
key, database password, Resend key, private token, or other server secret in a
frontend or Netlify build environment.

`AI_API_KEY` is currently injected into the browser bundle by `vite.config.ts`.
Treat it as public and use only a browser-restricted key. Moving AI calls to a
server endpoint is a separate security improvement.

## Variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `ACT_ENVIRONMENT` | Validation metadata | `local`, `staging`, or `production` |
| `ACT_APP_ORIGIN` | Validation metadata | Exact browser origin, without a path |
| `ACT_SUPABASE_URL` | Validation metadata | Intended Supabase API base URL |
| `AUTH_ALLOWED_ORIGINS` | Edge Function | Comma-separated browser origins |
| `AI_API_KEY` | Frontend build | Browser-visible, restricted AI key |
| `VITE_DATABASE_FILTERED_DIRECTORIES` | Frontend build | Enables database-filtered directory paths |
| `RESEND_API_KEY` | Edge Function only | Resend server secret |
| `RESEND_FROM_EMAIL` | Edge Function only | Verified sender address |
| `RESEND_FROM_NAME` | Edge Function only | Email sender display name |

## Validation

After copying and editing an example file, run:

```powershell
npm run validate:env -- .env.local
```

The validator fails when placeholders remain, ACT points at a Mydentist value,
local/staging targets the production database, the app origin is missing from
the Edge Function allowlist, URLs are malformed, or server secrets appear in a
frontend environment file. It reports variable names and validation rules only;
it never prints configured values.
