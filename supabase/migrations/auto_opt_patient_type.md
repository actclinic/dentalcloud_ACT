# Auto OPT patient type rollout

This feature is opt-in and defaults to disabled. Applying the migration does
not backfill or rewrite existing patients or visit history.

## Behavior

- A newly completed appointment or newly inserted treatment dated today may
  convert `ONP` to `OPT(ONP)` or `RNP` to `OPT(RNP)`.
- The patient must have a completed appointment or treatment on an earlier
  calendar day. Bookings, cancellations, no-shows, same-day repeats and
  backdated entries do not qualify.
- The clinical timezone defaults to `Asia/Yangon`.
- Disabling the setting stops future conversion and does not revert patients.
- Auto ONP is capped at 200 updates per request and cannot overwrite either
  protected OPT type.

## Production order (not executed by this change)

1. Take and verify a restorable database backup.
2. Rehearse both SQL files on a restored staging database.
3. During a low-traffic window, run
   `database/auto_opt_patient_type_indexes.sql` with `psql` autocommit. Do not
   wrap it in a transaction; it uses `CREATE INDEX CONCURRENTLY`.
4. Verify both indexes are valid and ready.
5. Apply `20261111000000_auto_opt_patient_type.sql`.
6. Deploy the compatible client, verify the clinic timezone, and leave Auto
   OPT disabled until ONP/RNP return-visit checks pass.

The main migration refuses to proceed when the required indexes are missing,
invalid or have an unexpected definition.
