import React from 'react';
import { ReceiptText } from 'lucide-react';
import type { Currency } from '../utils/currency';
import { formatCurrency } from '../utils/currency';
import { formatDoctorName } from '../utils/doctorName';
import type { MaterialCostPaymentHistoryRow } from '../utils/materialCostPaymentHistory';
import { formatPaymentAllocations, formatPaymentMethod } from '../utils/paymentMethods';

interface MaterialCostPaymentHistoryProps {
  rows: MaterialCostPaymentHistoryRow[];
  currency: Currency;
}

const getMethodLabel = (row: MaterialCostPaymentHistoryRow): string => (
  row.paymentAllocations?.length
    ? formatPaymentAllocations(row.paymentAllocations)
    : formatPaymentMethod(row.paymentMethod)
);

const StatusBadge: React.FC<{ status: MaterialCostPaymentHistoryRow['paymentStatus'] }> = ({ status }) => (
  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${
    status === 'FULL'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
      : 'border-amber-100 bg-amber-50 text-amber-700'
  }`}>
    {status === 'FULL' ? 'Full' : 'Partial'}
  </span>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
    <ReceiptText size={24} className="mx-auto text-slate-300" aria-hidden="true" />
    <p className="mt-2 text-sm font-semibold text-slate-600">No treatment payments found</p>
    <p className="mt-1 text-xs text-slate-400">Try another payment date range or clear the search fields.</p>
  </div>
);

const MaterialCostPaymentHistory: React.FC<MaterialCostPaymentHistoryProps> = ({ rows, currency }) => (
  <>
    <div className="hidden xl:block">
      <div
        role="region"
        aria-label="Treatment payment history table"
        tabIndex={0}
        className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--hover-300)]"
      >
        <table className="w-full min-w-[1480px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {['Payment Date', 'Receipt', 'Patient', 'Patient ID', 'Clinician', 'Treatment', 'Payment Method', 'Status'].map((label) => (
                <th key={label} className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</th>
              ))}
              {['Total Paid', 'Applied to Treatment', 'Balance After', 'Doctor Earned'].map((label) => (
                <th key={label} className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr><td colSpan={12} className="px-6 py-12"><EmptyState /></td></tr>
            ) : rows.map((row) => (
              <tr key={`payment-history-${row.paymentId}`} className="border-l-4 border-blue-300 transition-colors hover:bg-blue-50/30">
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{row.paymentDate}</td>
                <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-semibold text-slate-600">{row.receiptNumber || '-'}</td>
                <td className="px-5 py-4 font-bold text-slate-900">{row.patientName}</td>
                <td className="px-5 py-4 break-all font-mono text-[11px] text-slate-500">{row.patientId}</td>
                <td className="px-5 py-4 text-sm text-slate-700">{row.doctorNames.map((name) => formatDoctorName(name)).join('; ') || 'Unassigned'}</td>
                <td className="max-w-sm px-5 py-4 text-sm text-slate-700">{row.treatmentNames.join('; ')}</td>
                <td className="px-5 py-4 text-sm font-semibold text-slate-700">{getMethodLabel(row)}</td>
                <td className="px-5 py-4"><StatusBadge status={row.paymentStatus} /></td>
                <td className="px-5 py-4 text-right text-sm font-black text-slate-900">{formatCurrency(row.totalPaid, currency)}</td>
                <td className="px-5 py-4 text-right text-sm font-black text-blue-700">{formatCurrency(row.appliedToTreatment, currency)}</td>
                <td className={`px-5 py-4 text-right text-sm font-bold ${row.balanceAfter > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {row.balanceAfter > 0 ? formatCurrency(row.balanceAfter, currency) : 'Clear'}
                </td>
                <td className="px-5 py-4 text-right text-sm font-black text-emerald-700">
                  {row.doctorEarned > 0 ? formatCurrency(row.doctorEarned, currency) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className="space-y-3 bg-slate-50/70 p-3 sm:p-4 xl:hidden">
      {rows.length === 0 ? <EmptyState /> : rows.map((row) => (
        <article key={`payment-history-card-${row.paymentId}`} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-l-4 border-blue-300 p-3 sm:p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="break-words text-base font-bold text-slate-900">{row.patientName}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{row.patientId}</p>
                <p className="mt-1 text-xs text-slate-500">{row.paymentDate} · Receipt {row.receiptNumber || '-'}</p>
              </div>
              <StatusBadge status={row.paymentStatus} />
            </div>

            <dl className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
              <div className="grid grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] gap-3">
                <dt className="font-semibold text-slate-500">Doctor</dt>
                <dd className="min-w-0 break-words text-right text-slate-800">{row.doctorNames.map((name) => formatDoctorName(name)).join('; ') || 'Unassigned'}</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] gap-3">
                <dt className="font-semibold text-slate-500">Treatment</dt>
                <dd className="min-w-0 break-words text-right text-slate-800">{row.treatmentNames.join('; ')}</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] gap-3">
                <dt className="font-semibold text-slate-500">Payment method</dt>
                <dd className="min-w-0 break-words text-right font-semibold text-slate-800">{getMethodLabel(row)}</dd>
              </div>
            </dl>

            <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="min-w-0 rounded-xl border border-slate-100 p-3">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total paid</dt>
                <dd className="mt-1 break-words text-sm font-black text-slate-900">{formatCurrency(row.totalPaid, currency)}</dd>
              </div>
              <div className="min-w-0 rounded-xl border border-blue-100 bg-blue-50 p-3">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Applied</dt>
                <dd className="mt-1 break-words text-sm font-black text-blue-700">{formatCurrency(row.appliedToTreatment, currency)}</dd>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-100 p-3">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Balance after</dt>
                <dd className={`mt-1 break-words text-sm font-black ${row.balanceAfter > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {row.balanceAfter > 0 ? formatCurrency(row.balanceAfter, currency) : 'Clear'}
                </dd>
              </div>
              <div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Doctor earned</dt>
                <dd className="mt-1 break-words text-sm font-black text-emerald-700">{row.doctorEarned > 0 ? formatCurrency(row.doctorEarned, currency) : '-'}</dd>
              </div>
            </dl>
          </div>
        </article>
      ))}
    </div>
  </>
);

export default MaterialCostPaymentHistory;
