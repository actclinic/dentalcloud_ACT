# Password security rollout

## Status

The server-only Argon2id module, credential endpoint, frontend transport, session
validation and recovery paths are implemented. The additive prepare migration is
installed in ACT production. Freeze, conversion, cutover, Edge Function rollout,
frontend rollout and production login smoke tests are still pending.

Never restore legacy credential reads or equality-based authentication after hashes
are stored: that creates pass-the-hash account takeover. Roll back only to a secure
compatible frontend/backend. Private backups still contain historical plaintext.

## First step: read-only audit

1. Confirm the ACT dashboard/project/host. Never run these steps against Mydentist.
2. Confirm a recent encrypted, access-restricted backup and an isolated restore.
3. Run the ENTIRE file:
   `docs/production/password_security_preflight.sql` from the ACT release.
4. Return metadata and aggregate results securely. No credential values are
   requested. Do not send password exports, reset codes, tokens, or database keys.
5. If any statement fails, stop. The explicit read-only transaction makes no
   data changes; use ROLLBACK to close an aborted transaction before continuing.
   Do not add columns or run the destructive complete_database_setup.sql script.

The preflight was executed read-only on production and the restored isolated copy.

## Verified ACT rollout record (2026-11-17)

- Production preflight completed inside a read-only transaction and rolled back.
  It found no duplicate staff identifiers, patient emails, patient usernames or
  patient-auth links, and no empty, null or whitespace-affected credentials.
- Three legacy login doctors lacked canonical staff links. The tested repeatable
  repair migration created all three links; the post-check reported 24 linked
  login doctors and zero unlinked login doctors. Existing valid staff sessions
  remained intact.
- A fresh mode-0600 production backup was created before secure-auth preparation:
  `act_pre_secure_auth_20261117.dump`, SHA-256
  `fa768918d154d179bae43a3977e10c2ace22ee3fc41af790ab4809fa36c7deb8`.
- The fresh backup was restored to disposable containers. Repair, prepare, freeze,
  conversion and cutover all completed there. Argon2id conversion and stored-hash
  verification passed for 64 of 64 credentials. Server session verification passed
  for 28 staff accounts and 12 patient accounts. All 54 pre-existing valid staff
  sessions were preserved. Anonymous credential reads and legacy login RPC access
  were blocked. The disposable database, hasher, network and cache were removed.
- `20261002000000_secure_credentials_prepare.sql` was then applied to production.
  Production remains deliberately unfrozen and unconverted: 64 credentials await
  the coordinated maintenance window, and the 54 valid staff sessions remain valid.
- Production Edge Functions have the mail credentials required by recovery, but
  `AUTH_ALLOWED_ORIGINS` is not configured yet. Server configuration confirms the
  required ACT frontend origin is `https://act.dentalcloud.asia`. This remains a
  stop condition until the coordinated Edge Function rollout.

## Required decisions and release gates

- Confirm whether this self-hosted Supabase runs Edge Functions and can run a
  maintained Argon2id implementation. Do not use bcrypt without addressing its
  72-byte limit. Do not invent a hashing implementation.
- Obtain an isolated database with the actual schema and representative,
  protected legacy credentials. Validate conversion without exporting secrets.
- Review duplicate identifiers and conflicting doctor credentials. Preserve
  account IDs and current successful login behavior; never choose a conflicting
  credential arbitrarily.
- Cover both SQL btrim and JavaScript trim behavior, Unicode, long passwords,
  phone normalization, email case, username spacing, duplicate patient records,
  verified/null/unverified status, and legacy doctor fallback in regression tests.
- Establish server authorization for account writes and recovery. Hashing alone
  does not prevent account takeover with permissive anonymous writes.
- Remove browser-side password comparisons and password-dependent signup resend.
- Ensure password writes and batch conversion cannot overwrite each other.
- Test rollback to a secure compatible release. Never restore plaintext access
  as a compatibility workaround.

## Session policy

Password conversion must not revoke valid staff tokens or change account IDs.
Upgrade a server-validated staff token silently when possible. Patient localStorage
and tokenless doctor sessions are not proof of authentication: never mint a trusted
session from a client-provided ID or role. Require one sign-in for these sessions
when backend enforcement becomes mandatory. No password change is needed solely
because of hashing. Incident evidence may require separate resets/notifications.

## Implementation and deployment order after gates pass

1. Implement a tested trusted credential/authentication module and recovery flows.
2. Add private hash storage and explicit migration state; restrict client access.
3. Test every account creation/update/login/reset route on the isolated database.
4. Deploy compatible backend paths and frontend before final credential cutover.
5. Execute 20261002000001_secure_credentials_freeze.sql BEFORE conversion.
   This is a short login-maintenance window; old clients must refresh afterwards.
   Perform compare-and-swap conversion using the tested migrate-passwords.py runner.
   Verify each hash before atomically clearing its plaintext. Log IDs/counts only.
6. Execute 20261002000002_secure_credentials_cutover.sql after stored hashes verify.
   During final cutover, pause incompatible writes, refresh stale clients, remove
   plaintext fallback, and enforce server-authorized credentials and sessions.
7. Verify zero unexpected plaintext, successful role-specific logins, protected
   credential access, single-use reset tokens, and valid existing staff tokens.
8. Resume normal operation only after checks pass. Restrict historical backups
   and ensure any old-backup restore is remediated before reopening access.

No production deployment, push, or migration execution is authorized by merely
running the read-only audit. Use a reviewed deployment procedure after rehearsal.
