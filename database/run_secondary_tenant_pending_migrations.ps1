<#
.SYNOPSIS
  Executes the secondary tenant pending migration list in order.

.DESCRIPTION
  Runs each SQL file in the ordered pending list against the secondary
  tenant database, stopping on the first failure.

  Generated: 2026-08-17
  New scripts auto-detected (git log / folder scan) and inserted between
  20260809000000_visit_doctor_correction.sql and
  post_setup_production_checks.sql (always last):

    Added 2026-08-10 (commit d1a1e76):
      20260810000000_add_doctor_assignment_correction.sql
    Added 2026-08-10 (commit 0f022ec):
      20260810130000_repair_doctor_login_user_links.sql
    Added 2026-08-13 (commit 2a8e4d1):
      20260813000000_harden_payment_treatment_references.sql
      manual_20260813_01_repair_pat00064_stale_treatment_commission.sql

  NOTE - same-day script (2026-08-09, NOT auto-inserted because it is not
  dated after the cutoff).  Verify whether it already ran on the secondary
  tenant; if not, place it right after item #10:
      supabase/migrations/manual_20260809_01_recalculate_historical_mixed_payment_commissions.sql

.EXAMPLE
  .\run_secondary_tenant_pending_migrations.ps1 -DatabaseUrl "postgresql://user:pass@host:5432/secondary_tenant_db"
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl
)

$ErrorActionPreference = "Stop"

# --------------------------------------------------------------
# Ordered execution list (15 scripts)
# Items  1-10 : existing pending list (unchanged)
# Items 11-14 : NEWLY ADDED scripts (auto-detected, after 2026-08-09)
# Item     15 : post_setup_production_checks.sql (ALWAYS LAST)
# --------------------------------------------------------------
$scripts = @(
  # ---- Existing pending list ----
  "supabase/migrations/20260803000000_add_doctor_commission_type.sql"
  "supabase/migrations/20260804033408_validate_reconciled_payment_allocations.sql"
  "supabase/migrations/20260804044527_enforce_two_way_reconciled_treatment_links.sql"
  "supabase/migrations/20260805000000_add_appointment_list_index.sql"
  "supabase/migrations/20260806042759_optimize_audit_log_queries.sql"
  "supabase/migrations/20260806213848_atomic_treatment_sales_patient_delete.sql"
  "supabase/migrations/20260807044648_undo_treatment_atomic.sql"
  "supabase/migrations/20260808000000_add_medicine_sale_discounts.sql"
  "supabase/migrations/20260808100000_undo_medicine_sale_atomic.sql"
  "supabase/migrations/20260809000000_visit_doctor_correction.sql"

  # ---- NEW scripts added after 20260809000000_visit_doctor_correction.sql ----
  "supabase/migrations/20260810000000_add_doctor_assignment_correction.sql"        # 2026-08-10
  "supabase/migrations/20260810130000_repair_doctor_login_user_links.sql"          # 2026-08-10
  "supabase/migrations/20260813000000_harden_payment_treatment_references.sql"     # 2026-08-13
  "supabase/migrations/manual_20260813_01_repair_pat00064_stale_treatment_commission.sql" # 2026-08-13

  # ---- Always last ----
  "database/post_setup_production_checks.sql"
)

Write-Host ""
Write-Host "Secondary tenant pending migration list ($($scripts.Count) scripts):"
Write-Host "=================================================="
for ($i = 0; $i -lt $scripts.Count; $i++) {
  "{0,2}. {1}" -f ($i + 1), $scripts[$i] | Write-Host
}
Write-Host ""

$count = 0
foreach ($script in $scripts) {
  $count++
  $fullPath = Join-Path (Get-Location) $script
  if (-not (Test-Path $fullPath)) {
    Write-Error "[$count/$($scripts.Count)] Script not found: $fullPath"
    exit 1
  }
  Write-Host "[$count/$($scripts.Count)] Executing: $script"
  psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $fullPath
  if ($LASTEXITCODE -ne 0) {
    Write-Error "[$count/$($scripts.Count)] FAILED - aborting. rc=$LASTEXITCODE"
    exit $LASTEXITCODE
  }
}

Write-Host ""
Write-Host "All $($scripts.Count) scripts executed successfully."