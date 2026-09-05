# ACT Clinic MLS Production Migration Runbook

This runbook is only for the **ACT Clinic** Supabase project. Do not use the MyDentist migration file here.

## Files

- Preflight: `D:\ACT Clinic Production\dentalcloud_ACT\docs\production\act_mls_preflight.sql`
- Migration: `D:\ACT Clinic Production\dentalcloud_ACT\supabase\migrations\20260906000000_add_special_doctor_treatment_cost.sql`
- Postflight: `D:\ACT Clinic Production\dentalcloud_ACT\docs\production\act_mls_postflight.sql`

## Safe rollout

1. Confirm the Supabase Dashboard organization, project name, and project reference are ACT Clinic. Keep MyDentist closed in another browser profile/window to prevent a project mix-up.
2. Confirm the latest successful database backup and its timestamp. Do not proceed without a restorable backup.
3. Confirm migration `20260905000003_add_fixed_treatment_commission_amounts.sql` is already deployed.
4. Announce a short MLS maintenance window. Ask staff not to edit Material/Lab costs or presets until verification is complete.
5. In SQL Editor, paste and run the complete preflight file. Every prerequisite must be `true`, and `missing_prerequisite` must return zero rows. Save/export the results.
6. Open a new SQL Editor query, paste the **entire** ACT migration file, verify the first comment says `Add Special Doctor Cost as the third treatment-cost category`, and run it once.
7. Success means the SQL Editor reports completion without error. A lock or statement timeout is a safe failure: the transaction rolls back. Wait for quieter traffic, rerun preflight, and retry the complete migration; never run only the remaining tail.
8. Run the complete postflight file. Both constraints must be validated and include `special_doctor`; all three function checks and all four execute checks must be `true`; both zero-row checks must return zero rows.
9. Deploy the matching ACT frontend, then require all staff to hard-refresh/reopen the app before MLS editing resumes.
10. With an authorized staff account, open **MLS**, add a small real Special Doctor Cost to an appropriate real treatment, save, and verify the MLS total, Special Doctor expense, doctor commission, Audit Log, and monthly report. Remove/correct it through the normal UI if it was only a controlled smoke-test entry.
11. End the maintenance window only after the UI smoke test succeeds.

## Migration history

Running SQL in Dashboard SQL Editor changes the schema but does **not** add the migration to Supabase CLI history. Before a future `supabase db push`, link the CLI to the ACT project, run `supabase migration list`, verify the schema with the postflight script, then mark only this timestamp as applied:

```powershell
supabase migration repair --status applied 20260906000000
supabase migration list
```

Do not run `migration repair` against MyDentist, and do not use it if the SQL migration failed or postflight is not clean.

## Failure and rollback policy

- Any error before `COMMIT` rolls back the whole migration automatically.
- Do not manually issue a second `COMMIT`, run fragments, or edit production rows.
- After successful migration, prefer rolling back only the frontend if needed; the database change is additive and remains compatible with Material/Lab data.
- Do not restore the old two-value constraint after any `special_doctor` row exists.
- If an old cached client is still open after Special Doctor data is created, stop MLS writes and have that user refresh before editing, because old code can classify an unknown category as Material.