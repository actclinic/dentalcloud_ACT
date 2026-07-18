import React from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { PaymentAllocation, PaymentMethod, PaymentRecord } from '../types';
import { api } from '../services/api';
import { auth } from '../services/auth';
import { formatPaymentAllocations, formatPaymentMethod, getPaymentHeaderMethod, normalizePaymentAllocations, PAYMENT_METHOD_OPTIONS, validatePaymentAllocations } from '../utils/paymentMethods';

interface EditPaymentModalProps {
  isOpen: boolean;
  payment: PaymentRecord | null;
  onClose: () => void;
  onSaved: (updatedPayment: PaymentRecord) => void | Promise<void>;
}

const EditPaymentModal: React.FC<EditPaymentModalProps> = ({ isOpen, payment, onClose, onSaved }) => {
  const [amount, setAmount] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('UNKNOWN');
  const [allocations, setAllocations] = React.useState<PaymentAllocation[]>([]);
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !payment) return;
    setAmount(String(payment.amount || ''));
    setPaymentMethod(payment.paymentMethod || 'UNKNOWN');
    setAllocations(normalizePaymentAllocations(payment.allocations, payment.paymentMethod, payment.amount));
    setReason('');
    setError(null);
    setSubmitting(false);
  }, [isOpen, payment]);

  if (!isOpen || !payment) return null;

  const normalizedReason = reason.trim();
  const parsedAmount = Number(amount);
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const isSplit = allocations.length > 1;
  const effectiveAllocations = isSplit ? allocations : normalizePaymentAllocations(null, paymentMethod, parsedAmount);
  const allocationError = validatePaymentAllocations(effectiveAllocations, parsedAmount);
  const isMethodValid = !allocationError;
  const isReasonValid = normalizedReason.length >= 10;
  const originalAllocations = normalizePaymentAllocations(payment.allocations, payment.paymentMethod, payment.amount);
  const hasChanges = parsedAmount !== Number(payment.amount) || JSON.stringify(effectiveAllocations) !== JSON.stringify(originalAllocations);
  const canSubmit = !submitting && isAmountValid && isMethodValid && isReasonValid && hasChanges;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const session = auth.getSession();
      if (!session?.userId || session.role !== 'admin') {
        throw new Error('Only logged-in admins can correct payments.');
      }

      const updatedPayment = await api.finance.correctPayment({
        paymentId: payment.id,
        newAmount: parsedAmount,
        newMethod: getPaymentHeaderMethod(effectiveAllocations),
        allocations: effectiveAllocations,
        wasSplitPayment: originalAllocations.length > 1,
        reason: normalizedReason,
        editedByUserId: session.userId
      });
      await onSaved(updatedPayment);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save payment correction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-600">Financial correction</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Edit payment record</h2>
            <p className="mt-1 text-sm text-slate-500">
              {payment.patient_name || 'Unknown patient'} {payment.receiptNumber ? `· ${payment.receiptNumber}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close edit payment modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p>This updates the live payment and writes an immutable correction entry for audit review.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Amount</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="Enter corrected amount"
              />
            </div>
            {!isSplit ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="UNKNOWN">Select payment method</option>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{formatPaymentMethod(option.value)}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {isSplit ? (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">Payment breakdown</p>
              {allocations.map((allocation, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <select
                    value={allocation.method}
                    onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, method: event.target.value as PaymentMethod } : item))}
                    className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input
                    type="number" min="0.01" step="0.01" value={allocation.amount || ''}
                    onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Math.max(0, Number(event.target.value || 0)) } : item))}
                    className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-right font-bold"
                  />
                  <button type="button" disabled={allocations.length <= 2} onClick={() => setAllocations((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="px-2 font-bold text-rose-600 disabled:opacity-30">×</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next = PAYMENT_METHOD_OPTIONS.find((option) => !allocations.some((allocation) => allocation.method === option.value));
                  if (next) setAllocations((current) => [...current, { method: next.value, amount: 0 }]);
                }}
                className="text-xs font-bold text-amber-700"
              >+ Add method</button>
              {allocationError ? <p className="text-xs font-semibold text-rose-700">{allocationError}</p> : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                const firstAmount = Math.round(parsedAmount / 2 * 100) / 100;
                setAllocations([{ method: paymentMethod === 'UNKNOWN' ? 'CASH' : paymentMethod, amount: firstAmount }, { method: paymentMethod === 'KPAY' ? 'CASH' : 'KPAY', amount: Math.round((parsedAmount - firstAmount) * 100) / 100 }]);
              }}
              className="text-left text-sm font-bold text-amber-700"
            >+ Correct as split payment</button>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Reason for Correction</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="Explain why this payment must be corrected"
            />
            <p className={`mt-2 text-xs font-semibold ${isReasonValid ? 'text-emerald-600' : 'text-slate-500'}`}>
              Minimum 10 characters required.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Previous value: {payment.amount.toFixed(2)} via {originalAllocations.length ? formatPaymentAllocations(originalAllocations) : formatPaymentMethod(payment.paymentMethod)}
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {submitting ? 'Saving & Refreshing...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPaymentModal;
