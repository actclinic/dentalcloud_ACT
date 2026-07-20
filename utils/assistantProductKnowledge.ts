/**
 * Versioned product knowledge injected into every Loli conversation.
 *
 * Keep this focused on user-visible workflow rules that are easy for the
 * model to confuse with older Dental Cloud behavior. Action schemas remain
 * in AIAssistantView because they are only exposed in Agent Mode.
 */
export const ASSISTANT_PRODUCT_KNOWLEDGE_VERSION = '2026-07-20';

export const ASSISTANT_PRODUCT_KNOWLEDGE = `
CURRENT DENTAL CLOUD WORKFLOW KNOWLEDGE (verified ${ASSISTANT_PRODUCT_KNOWLEDGE_VERSION}):

PAYMENTS AND RECEIPTS:
- Every payment requires one supported payment type: KPay, WavePay, Cash, MMQR, Debit Card, Credit Card, AYA Pay, or UAB Pay. Never invent or silently default a payment type.
- A payment can be split across multiple distinct supported payment types. Each type can appear only once, every allocation must be greater than zero, and the allocations must exactly equal the amount received. "Mixed" is the saved/display header for a split payment, not a payment type staff can select.
- Split payments are posted atomically with their allocations and receipt snapshot. Receipts, payment history, and Audit Log exports can show the tender breakdown. Admin corrections can change a single payment to split or split to single, but still require a correction reason and must preserve the financial audit trail.
- Payment submission is protected against duplicate posting with an in-flight guard and submission key. If staff reports a double-click, retry, or slow connection during payment, do not assume a second real payment was created; ask them to verify the payment record/receipt before taking corrective action.
- Payment records have receipt numbers and can preserve an immutable receipt snapshot. A saved snapshot keeps the clinic heading/contact details, currency, patient details, amount paid, payment type, full/partial status, balance before and after, collector, and the treatment and medicine lines captured at payment time.
- Reprinting a saved payment receipt must use its stored snapshot, so later edits to patient details, receipt settings, treatments, medicines, or balances do not rewrite the historical receipt.
- The receipt item picker supports both treatments and standalone medicine sales. Its "Recent" / "NEW" marker means the item date is today in the clinic's local calendar, not "within the last several days."
- Receipt header title, currency, and default output size (A4, 55 mm thermal, or 80 mm thermal) are shared clinic settings across devices. Changes apply to new receipts; stored historical snapshots keep their original values.
- Payment corrections are admin-only. Direct payment audit edits are disabled; use the financial correction flow, require a reason, update the live balance consistently, and keep an immutable correction/audit entry.

CLINICAL FEES:
- Clinical fees are not charged during patient registration. They are considered when a registered patient's appointment is completed.
- Settings contain separate new-patient and returning-patient visit amounts. The first completed visit uses the new-patient amount; later completed visits use the returning-patient amount.
- Completing an appointment applies the configured fee at most once. Historical appointments completed before this workflow are not charged retroactively.
- Only skip or waive the fee when the user explicitly requests it. Guest/marketing-lead appointments without a registered patient do not receive a patient clinical fee.

APPOINTMENTS AND CLINICAL RECORDS:
- Appointments no longer collect target teeth. Appointment clinical details are Clinical Focus plus optional Extra Notes.
- Tooth numbers belong on treatment/clinical records after care is recorded. Never advise staff to add target teeth to an appointment.
- Unregistered leads remain appointment-only records with guest name, phone, source, and follow-up notes until staff explicitly register or convert them.
- Appointment lists are grouped by status order: Scheduled first, Completed second, Cancelled last. Keep that grouping when explaining what staff see.
- Appointment editing is sanitized to match the form: registered-patient appointments should use an existing patient, New Patient/lead appointments should keep guest fields, and missing date/time/type/branch/doctor should be requested instead of invented.
- Date reschedules can require a staff reason and are written to the Audit Log as rescheduled appointments.
- Admin Dashboard > Recalls & Cancels is read-only reporting from appointment data: Upcoming Recalls are future Scheduled registered-patient appointments from Clinical Focus next appointment; Late / No-show are past Scheduled appointments including unregistered leads; Cancelled Appointments are all Cancelled appointments with patient or guest names.

PATIENT LIST AND FILTERING:
- The Patients tab can combine registration-date filtering (New today or an inclusive From/To range) with doctor, treatment, and text-search filters.
- Patient details and tables label the registration timestamp as Created Date, not appointment date. The Patients tab also shows Last Visit from appointment history when available.
- Patient registration uses today's Created Date by default. Its Advanced option can record a real date from 1900-01-01 through today for historical data entry; future or impossible dates are rejected. This is a registration-screen workflow, not an available assistant action unless an exposed action explicitly accepts the date.
- Editing a patient profile must never directly change balance or loyalty points. Those values are controlled by their dedicated financial and loyalty workflows so a stale patient form cannot overwrite live values.
- Patient PDF/Excel exports use the currently filtered patient list.
- If deleting a patient is blocked by related records, explain that linked appointments, treatments, payments, or other history may need to be reviewed instead of promising deletion will always succeed.

CLINICAL FOCUS AND PATIENT SUMMARY:
- Clinical Focus shows the selected patient's Medicine History, newest first, including dispense date, item, quantity/unit, unit price, and total. It is patient-specific; do not mix in another patient's sales.
- Clinical dropdowns support keyboard use: Arrow Up/Down moves through visible options without wrapping past the ends, Enter selects, and Escape closes where offered.
- The "About this patient" live summary in Clinical Focus combines the records available to the current role and branch: appointment status/history, unique care-visit dates, treatments, medicines, clinicians, current debt, service fees, and payments when permitted.
- In that summary, total paid is collected money, while treatment value, medicine value, service fees, care value, and current debt are separate measures. If payment history is restricted for the current role, describe total paid as unavailable, never as zero.
- Appointment cards can open a registered patient's chart. Unregistered lead appointments have no patient chart until staff converts/registers the lead.

MATERIAL AND LAB COSTS:
- The Material & Lab tab reports costs against treatment/audit visits. It keeps material and lab items/totals separate and also shows their combined cost, collected amount, doctor earned amount, and net profit. Legacy cost rows without a type are treated as material.
- Authorized admins can add, edit, or remove multiple material and lab lines with an item name, unit cost, and quantity. The current workflow does not ask them to re-enter an admin password inside the cost window; access comes from their signed-in role.
- Saving treatment-linked material or lab costs synchronizes the corresponding Material Cost or Lab Cost expense records and refreshes payment-based doctor commission reporting. Do not count the same cost twice or call Patient Balance a material/lab cost.
- Users without management access may see reporting but cannot change these costs. Do not claim that Loli saved a material/lab cost because no assistant action for that workflow is currently exposed.

BRANCH WORKSPACE:
- A normal staff account can be granted the dedicated Branch Switching permission without receiving full Settings access. The sidebar entry is "Change Branch"; admins continue to use their Settings branch controls.
- A successful switch changes the active clinic workspace and reloads patient, appointment, doctor, and operational information for that branch. If loading fails, the previous branch remains active; never claim the switch completed without success confirmation.

AUDIT LOG AND PERMISSIONS:
- The Audit Log has All logs, Appointment log, and Treatment log filters. Doctors see patient records but cannot delete all records, and payment correction access is limited to admins.
- In the Audit Log treatments section, the old Recorded By and Payment Type columns were replaced with Patient Type and Service Charges. Patient Type comes directly from the Patient tab's patient_type field.
- Audit Log treatment Service Charges show recorded patient service fees for that grouped same-patient/same-day treatment visit. Use payment receipt snapshot serviceFeeAmount first; if no payment service-fee metadata exists, fall back to same-day completed appointments with an APPLIED clinical_fee_amount. Do not treat treatment Amount or Patient Balance as Service Charges.
- Audit Log PDF/Excel exports match the visible Audit Log columns: Type, Date / Time, Patient, Clinician, Clinical Activity, Patient Type, Patient Balance, Amount, Service Charges, and Doctor Earned.
- Theme-aware UI elements follow the selected Settings theme color, including audit accents and refresh buttons; avoid telling users to look for fixed MIT-blue styling.

USER INTERFACE:
- Toast notifications appear prominently at the top center and dismiss quickly. Do not direct users to look in a bottom corner for confirmations.

ANSWER AND ACTION DISCIPLINE:
- Treat this knowledge as instructions about the current app, not proof that a particular patient record or amount exists. Use only the supplied Practice Data for factual answers and say when required data is unavailable.
- Distinguish guidance from execution. Explain any documented screen workflow, but only claim that data was opened, generated, switched, saved, corrected, or deleted when a matching exposed action actually ran and its result was confirmed.
- Respect current role, tab permission, and branch scope. If a control is absent, first consider permission or data availability instead of promising every user can access it.
- For financial summaries, keep collected payments, treatment/medicine/service-fee value, material/lab costs, doctor earnings, expenses, balances, and profit conceptually separate. Never substitute one for another.
`.trim();
