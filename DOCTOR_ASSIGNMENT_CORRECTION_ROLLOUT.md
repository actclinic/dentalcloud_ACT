# Doctor assignment correction rollout

## Deployment order

1. Back up the production database.
2. Confirm the staff-session, audit-log, material-cost, and doctor commission ledger migrations are already installed.
3. Apply `supabase/migrations/20260810000000_add_doctor_assignment_correction.sql`.
4. Deploy the matching application build only after the migration succeeds.

The migration is transactional. If a prerequisite or statement fails, PostgreSQL rolls the entire migration back.

## What changes

- Adds nullable `treatments.appointment_id`. Existing treatment rows are deliberately not guessed or backfilled.
- Adds immutable `doctor_assignment_corrections` history.
- Adds the session-authorized `correct_doctor_assignment` RPC.
- Blocks direct changes to `appointments.doctor_id` and to treatment doctor/appointment ownership. Existing inserts remain allowed; ownership changes must use **Correct Doctor**.
- Resets and rebuilds affected doctor commission data. A durable pending marker remains if the client-side recalculation cannot finish, and the modal offers an immediate retry.

## Verification after migration

Run in the SQL editor:

```sql
select to_regclass('public.doctor_assignment_corrections') as correction_table;
select to_regprocedure(
  'public.correct_doctor_assignment(uuid,uuid,uuid,uuid[],text,uuid,text)'
) as correction_rpc;

select tgname
from pg_trigger
where not tgisinternal
  and tgname in (
    'trg_guard_appointment_doctor_assignment',
    'trg_guard_treatment_doctor_assignment',
    'trg_prevent_doctor_assignment_correction_update',
    'trg_prevent_doctor_assignment_correction_delete'
  )
order by tgname;
```

Then perform one controlled admin smoke test:

1. Choose a registered-patient appointment with known treatment ownership.
2. Open **Correct Doctor**.
3. Confirm linked records are selected and same-day unlinked suggestions are not selected automatically.
4. Select the correct branch doctor, enter a clear reason, and save.
5. Verify the appointment, selected treatments, audit display, doctor commission ledger, and treatment earnings use the new doctor.
6. Verify unselected same-day treatments and historical receipt/reschedule snapshots are unchanged.

## Rollback

Roll back the application first. Do not delete correction-history rows or restore old commission ownership without reviewing each completed correction.

If the migration must be structurally rolled back during a maintenance window:

1. Drop the two doctor-assignment guard triggers so the old application can update records again.
2. Revoke and drop `correct_doctor_assignment`.
3. Keep `doctor_assignment_corrections` as historical evidence unless clinic management approves archival removal.
4. Keep `treatments.appointment_id`; it is nullable and backward-compatible.

Never roll back by copying one doctor ID across every patient record. Use the immutable correction history to review affected appointments and treatment IDs individually.