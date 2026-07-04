/**
 * Versioned product knowledge injected into every Loli conversation.
 *
 * Keep this focused on user-visible workflow rules that are easy for the
 * model to confuse with older Dental Cloud behavior. Action schemas remain
 * in AIAssistantView because they are only exposed in Agent Mode.
 */
export const ASSISTANT_PRODUCT_KNOWLEDGE_VERSION = '2026-06-20';

export const ASSISTANT_PRODUCT_KNOWLEDGE = `
CURRENT DENTAL CLOUD WORKFLOW KNOWLEDGE (verified ${ASSISTANT_PRODUCT_KNOWLEDGE_VERSION}):

PAYMENTS AND RECEIPTS:
- Every payment requires one supported payment type: KPay, WavePay, Cash, MMQR, Debit Card, Credit Card, AYA Pay, or UAB Pay. Never invent or silently default a payment type.
- Payment records have receipt numbers and can preserve an immutable receipt snapshot. A saved snapshot keeps the clinic heading/contact details, currency, patient details, amount paid, payment type, full/partial status, balance before and after, collector, and the treatment and medicine lines captured at payment time.
- Reprinting a saved payment receipt must use its stored snapshot, so later edits to patient details, receipt settings, treatments, medicines, or balances do not rewrite the historical receipt.
- The receipt item picker supports both treatments and standalone medicine sales. Its "Recent" / "NEW" marker means the item date is today in the clinic's local calendar, not "within the last several days."
- Receipt header title, currency, and default output size (A4, 55 mm thermal, or 80 mm thermal) are shared clinic settings across devices. Changes apply to new receipts; stored historical snapshots keep their original values.

CLINICAL FEES:
- Clinical fees are not charged during patient registration. They are considered when a registered patient's appointment is completed.
- Settings contain separate new-patient and returning-patient visit amounts. The first completed visit uses the new-patient amount; later completed visits use the returning-patient amount.
- Completing an appointment applies the configured fee at most once. Historical appointments completed before this workflow are not charged retroactively.
- Only skip or waive the fee when the user explicitly requests it. Guest/marketing-lead appointments without a registered patient do not receive a patient clinical fee.

APPOINTMENTS AND CLINICAL RECORDS:
- Appointments no longer collect target teeth. Appointment clinical details are Clinical Focus plus optional Extra Notes.
- Tooth numbers belong on treatment/clinical records after care is recorded. Never advise staff to add target teeth to an appointment.
- Unregistered leads remain appointment-only records with guest name, phone, source, and follow-up notes until staff explicitly register or convert them.

PATIENT LIST AND FILTERING:
- The Patients tab can combine registration-date filtering (New today or an inclusive From/To range) with doctor, treatment, and text-search filters.
- Patient PDF/Excel exports use the currently filtered patient list.

USER INTERFACE:
- Toast notifications appear prominently at the top center and dismiss quickly. Do not direct users to look in a bottom corner for confirmations.
`.trim();
