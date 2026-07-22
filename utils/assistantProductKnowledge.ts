/**
 * Versioned product knowledge injected into every Loli conversation.
 *
 * Keep this focused on user-visible workflow rules that are easy for the
 * model to confuse with older Dental Cloud behavior. Action schemas remain
 * in AIAssistantView because they are only exposed in Agent Mode.
 */
export const ASSISTANT_PRODUCT_KNOWLEDGE_VERSION = '2026-07-11';

export const ASSISTANT_PRODUCT_KNOWLEDGE = `
CURRENT DENTAL CLOUD WORKFLOW KNOWLEDGE (verified ${ASSISTANT_PRODUCT_KNOWLEDGE_VERSION}):

PAYMENTS AND RECEIPTS:
- Every payment requires one supported payment type: KPay, WavePay, Cash, MMQR, Debit Card, Credit Card, AYA Pay, or UAB Pay. Never invent or silently default a payment type.
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
- Patient PDF/Excel exports use the currently filtered patient list.
- If deleting a patient is blocked by related records, explain that linked appointments, treatments, payments, or other history may need to be reviewed instead of promising deletion will always succeed.

AUDIT LOG AND PERMISSIONS:
- The Audit Log has All, Appointments, Reschedule, Treatments, and Payments filters. Doctors see patient treatment records but cannot delete all records, and payment correction access is limited to admins.
- In the Audit Log treatments section, the old Recorded By and Payment Type columns were replaced with Patient Type and Service Charges. Patient Type comes directly from the Patient tab's patient_type field.
- Audit Log treatment Service Charges show recorded patient service fees for that grouped same-patient/same-day treatment visit. Use payment receipt snapshot serviceFeeAmount first; if no payment service-fee metadata exists, fall back to same-day completed appointments with an APPLIED clinical_fee_amount. Do not treat treatment Amount or Patient Balance as Service Charges.
- Audit Log treatment rows show the total treatment discount for the grouped visit. Payment rows may repeat that amount as the related treatment discount captured on that payment receipt; it is not a second payment-time discount and must not be subtracted from the balance again.
- Audit Log PDF/Excel exports match the visible Audit Log columns: Type, Date / Time, Patient, Clinician, Clinical Activity, Patient Type, Patient Balance, Amount, Discount, Service Charges, and Doctor Earned.
- Theme-aware UI elements follow the selected Settings theme color, including audit accents and refresh buttons; avoid telling users to look for fixed MIT-blue styling.

USER INTERFACE:
- Toast notifications appear prominently at the top center and dismiss quickly. Do not direct users to look in a bottom corner for confirmations.
`.trim();
