import React from 'react';
import { X, Printer } from 'lucide-react';
import { Patient, ClinicalRecord, MedicineSale, ReceiptSize, TreatmentType } from '../types';
import { formatCurrency, Currency } from '../utils/currency';
import { formatTeethWithPosition } from '../utils/toothNumbering';

interface ReceiptProps {
  patient: Patient;
  treatments: ClinicalRecord[];
  medicines?: MedicineSale[];
  paymentAmount?: number;
  treatmentTypes?: TreatmentType[];
  currency: Currency;
  appName?: string;
  receiptInfo?: { email: string; phone: string };
  receiptSize?: ReceiptSize;
  onClose: () => void;
}

const Receipt: React.FC<ReceiptProps> = ({
  patient,
  treatments,
  medicines = [],
  paymentAmount,
  treatmentTypes = [],
  currency,
  appName = 'DentalCloud Pro',
  receiptInfo,
  receiptSize = 'A4',
  onClose
}) => {
  const receiptEmail = receiptInfo?.email || 'info@dentflowpro.com';
  const receiptPhone = receiptInfo?.phone || '(555) 123-4567';
  const receiptNumber = `REC-${Date.now().toString().slice(-8)}`;
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const getTreatmentPricing = (treatment: ClinicalRecord) => {
    const finalCost = Number(treatment.cost || 0);
    const explicitStandard = Number((treatment as any).standardCost ?? (treatment as any).standard_cost);
    const explicitDiscount = Number((treatment as any).discountAmount ?? (treatment as any).discount_amount ?? 0);
    const matchedType = treatmentTypes.find((type) => {
      return (type.name || '').trim().toLowerCase() === (treatment.description || '').trim().toLowerCase();
    });
    const derivedStandard = matchedType
      ? Number(matchedType.cost || 0) * Math.max(1, treatment.teeth?.length || 1)
      : finalCost;
    const standardCost = Number.isFinite(explicitStandard) && explicitStandard >= finalCost
      ? explicitStandard
      : explicitDiscount > 0
        ? finalCost + explicitDiscount
        : derivedStandard > finalCost
          ? derivedStandard
          : finalCost;
    const discountAmount = Math.max(0, explicitDiscount || (standardCost - finalCost));
    const pricingNote = ((treatment as any).pricingNote || (treatment as any).pricing_note || '') as string;
    const note = discountAmount > 0
      ? (pricingNote === 'FOC' || finalCost === 0 ? 'FOC' : 'Discount')
      : '';

    return {
      finalCost,
      standardCost,
      discountAmount,
      note
    };
  };

  const totalTreatmentCost = treatments.reduce((sum, treatment) => sum + (treatment.cost || 0), 0);
  const totalTreatmentDiscount = treatments.reduce((sum, treatment) => {
    return sum + getTreatmentPricing(treatment).discountAmount;
  }, 0);
  const totalMedicineCost = medicines.reduce((sum, medicine) => sum + (medicine.total_price || 0), 0);
  const grandTotal = totalTreatmentCost + totalMedicineCost;
  const totalPaid = paymentAmount || 0;
  
  // If this is a payment receipt (paymentAmount > 0), show patient's remaining balance
  // Otherwise, calculate balance based on selected treatments
  const remainingBalance = totalPaid > 0 
    ? patient.balance  // After payment, show patient's current balance
    : Math.max(0, grandTotal - totalPaid); // For invoice, calculate from selected services and medicines

  const handlePrint = () => {
    window.print();
  };

  const isThermal = receiptSize === 'THERMAL_55MM';

  const renderServicesTable = (isPrint = false) => (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-300 pb-2">Treatment Services</h3>
      <table className="w-full border-collapse" style={isPrint ? { borderCollapse: 'collapse' } : undefined}>
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-800">
            <th className="text-left py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Date</th>
            <th className="text-left py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Description</th>
            <th className="text-left py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Teeth</th>
            <th className="text-right py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Standard</th>
            <th className="text-right py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Adjustment</th>
            <th className="text-right py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {treatments.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-6 text-center text-gray-500 italic" style={isPrint ? { padding: '24px 16px' } : undefined}>
                No treatment services recorded
              </td>
            </tr>
          ) : (
            treatments.map((treatment, index) => {
              const pricing = getTreatmentPricing(treatment);
              return (
                <tr key={index} className="border-b border-gray-200" style={isPrint ? { borderBottom: '1px solid #e5e7eb' } : undefined}>
                  <td className="py-3 px-4 text-sm text-gray-700" style={isPrint ? { padding: '12px 16px' } : undefined}>
                    {new Date(treatment.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900 font-medium" style={isPrint ? { padding: '12px 16px' } : undefined}>{treatment.description}</td>
                  <td className="py-3 px-4 text-sm text-gray-600" style={isPrint ? { padding: '12px 16px' } : undefined}>
                    {treatment.teeth && treatment.teeth.length > 0
                      ? formatTeethWithPosition(treatment.teeth)
                      : 'General'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 text-right" style={isPrint ? { padding: '12px 16px' } : undefined}>
                    {formatCurrency(pricing.standardCost, currency)}
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-semibold" style={isPrint ? { padding: '12px 16px' } : undefined}>
                    {pricing.discountAmount > 0 ? (
                      <span className={pricing.note === 'FOC' ? 'text-amber-700' : 'text-emerald-700'}>
                        {pricing.note}: -{formatCurrency(pricing.discountAmount, currency)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900 text-right font-semibold" style={isPrint ? { padding: '12px 16px' } : undefined}>
                    {formatCurrency(pricing.finalCost, currency)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const renderMedicinesTable = (isPrint = false) => (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-300 pb-2">Medicines & Items</h3>
      <table className="w-full border-collapse" style={isPrint ? { borderCollapse: 'collapse' } : undefined}>
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-800">
            <th className="text-left py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Date</th>
            <th className="text-left py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Item</th>
            <th className="text-right py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Qty</th>
            <th className="text-right py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Unit Price</th>
            <th className="text-right py-3 px-4 text-sm font-bold text-gray-900" style={isPrint ? { borderBottom: '2px solid #1f2937' } : undefined}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {medicines.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-gray-500 italic" style={isPrint ? { padding: '24px 16px' } : undefined}>
                No medicines or items recorded
              </td>
            </tr>
          ) : (
            medicines.map((medicine, index) => (
              <tr key={index} className="border-b border-gray-200" style={isPrint ? { borderBottom: '1px solid #e5e7eb' } : undefined}>
                <td className="py-3 px-4 text-sm text-gray-700" style={isPrint ? { padding: '12px 16px' } : undefined}>
                  {new Date(medicine.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </td>
                <td className="py-3 px-4 text-sm text-gray-900 font-medium" style={isPrint ? { padding: '12px 16px' } : undefined}>{medicine.medicine_name || 'Medicine'}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right" style={isPrint ? { padding: '12px 16px' } : undefined}>{medicine.quantity}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right" style={isPrint ? { padding: '12px 16px' } : undefined}>
                  {formatCurrency(medicine.unit_price || 0, currency)}
                </td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right font-semibold" style={isPrint ? { padding: '12px 16px' } : undefined}>
                  {formatCurrency(medicine.total_price || 0, currency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // ─── Thermal 55mm helpers ──────────────────────────────────────────────

  const thermalLine = (left: string, right: string, leftStyle?: React.CSSProperties, rightStyle?: React.CSSProperties) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '9px', lineHeight: '1.5' }}>
      <span style={{ flex: 1, textAlign: 'left', ...leftStyle }}>{left}</span>
      <span style={{ textAlign: 'right', whiteSpace: 'nowrap', ...rightStyle }}>{right}</span>
    </div>
  );

  const thermalDivider = () => (
    <div style={{ borderTop: '1px dashed #333', margin: '4px 0' }} />
  );

  const thermalThickDivider = () => (
    <div style={{ borderTop: '2px solid #333', margin: '4px 0' }} />
  );

  const renderThermalServices = () => (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, marginBottom: '2px' }}>-- TREATMENT SERVICES --</div>
      {treatments.length === 0 ? (
        <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#666' }}>No treatment services recorded</div>
      ) : (
        treatments.map((treatment, idx) => {
          const pricing = getTreatmentPricing(treatment);
          return (
            <div key={idx} style={{ marginBottom: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span style={{ flex: 1 }}>{treatment.description}</span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(pricing.finalCost, currency)}</span>
              </div>
              <div style={{ fontSize: '7px', color: '#555' }}>
                {new Date(treatment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {treatment.teeth && treatment.teeth.length > 0 ? ` | ${formatTeethWithPosition(treatment.teeth)}` : ''}
              </div>
              {pricing.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: pricing.note === 'FOC' ? '#b45309' : '#15803d' }}>
                  <span>Std {formatCurrency(pricing.standardCost, currency)}</span>
                  <span>{pricing.note}: -{formatCurrency(pricing.discountAmount, currency)}</span>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const renderThermalMedicines = () => (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, marginBottom: '2px' }}>-- MEDICINES & ITEMS --</div>
      {medicines.length === 0 ? (
        <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#666' }}>No medicines or items recorded</div>
      ) : (
        medicines.map((med, idx) => (
          <div key={idx} style={{ marginBottom: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
              <span style={{ flex: 1 }}>{med.medicine_name || 'Medicine'} x{med.quantity}</span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(med.total_price || 0, currency)}</span>
            </div>
            <div style={{ fontSize: '7px', color: '#555' }}>
              @ {formatCurrency(med.unit_price || 0, currency)}/ea
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ─── A4 Preview ────────────────────────────────────────────────────────

  const renderA4Preview = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header with controls */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-gray-800">Receipt Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Content - A4 Size */}
        <div className="p-8 md:p-12 print:p-12" style={{ 
          width: '210mm', 
          minHeight: '297mm',
          margin: '0 auto',
          background: 'white'
        }}>
          {/* Clinic Header */}
          <div className="text-center mb-8 border-b-2 border-gray-800 pb-6">
            <h1 className="text-2xl font-black text-gray-900 mb-2">{appName}</h1>
            <p className="text-sm text-gray-600">Professional Dental Care Services</p>
            <p className="text-xs text-gray-500 mt-2">Email: {receiptEmail} | Phone: {receiptPhone}</p>
          </div>

          {/* Receipt Info */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">BILL TO:</p>
              <p className="text-base font-bold text-gray-900">{patient.name}</p>
              <p className="text-sm text-gray-600">{patient.email}</p>
              <p className="text-sm text-gray-600">{patient.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Receipt #: <span className="font-semibold">{receiptNumber}</span></p>
              <p className="text-sm text-gray-600">Date: <span className="font-semibold">{today}</span></p>
            </div>
          </div>

          {renderServicesTable()}
          {renderMedicinesTable()}

          {/* Summary */}
          <div className="mb-8">
            <div className="flex justify-end">
              <div className="w-64">
                <div className="flex justify-between py-2 border-b border-gray-300">
                  <span className="text-sm font-semibold text-gray-700">Treatment Services:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(totalTreatmentCost, currency)}
                  </span>
                </div>
                {totalTreatmentDiscount > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-300">
                    <span className="text-sm font-semibold text-gray-700">Treatment Adjustments:</span>
                    <span className="text-sm font-semibold text-amber-700">
                      -{formatCurrency(totalTreatmentDiscount, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-300">
                  <span className="text-sm font-semibold text-gray-700">Medicines & Items:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(totalMedicineCost, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-300">
                  <span className="text-sm font-semibold text-gray-700">Subtotal:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(grandTotal, currency)}
                  </span>
                </div>
                {totalPaid > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-300">
                    <span className="text-sm font-semibold text-gray-700">Payment Received:</span>
                    <span className="text-sm font-semibold text-green-600">
                      -{formatCurrency(totalPaid, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-3 mt-2 border-t-2 border-gray-800">
                  <span className="text-base font-bold text-gray-900">Balance Due:</span>
                  <span className={`text-base font-bold ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(remainingBalance, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details (if payment was made) */}
          {totalPaid > 0 && (
            <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm font-semibold text-gray-900 mb-2">Payment Details:</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment Amount:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totalPaid, currency)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Payment Date:</span>
                <span className="font-semibold text-gray-900">{today}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Payment Status:</span>
                <span className="font-semibold text-green-600">Paid</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t-2 border-gray-800 text-center">
            <p className="text-xs text-gray-600 mb-2">
              Thank you for choosing {appName} for your dental care needs.
            </p>
            <p className="text-xs text-gray-500">
              This is a computer-generated receipt. No signature required.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Please retain this receipt for your records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Thermal 55mm Preview ──────────────────────────────────────────────

  const renderThermalPreview = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-auto" style={{ maxWidth: '380px' }}>
        {/* Header with controls */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3 flex justify-between items-center z-10">
          <h2 className="text-sm font-bold text-gray-800">Thermal Receipt</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors text-xs"
            >
              <Printer className="w-3 h-3" /> Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt Content - 58mm Thermal */}
        <div className="thermal-receipt-preview" style={{
          width: '58mm',
          margin: '0 auto',
          background: 'white',
          padding: '3mm 3mm',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '10px',
          lineHeight: '1.3',
          color: '#222'
        }}>
          {/* Clinic Header */}
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>{appName}</div>
            <div style={{ fontSize: '8px', color: '#555' }}>Professional Dental Care Services</div>
            <div style={{ fontSize: '7px', color: '#777', marginTop: '2px' }}>{receiptEmail} | {receiptPhone}</div>
          </div>

          {thermalThickDivider()}

          {/* Receipt Info */}
          <div style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
              <span>Receipt #: {receiptNumber}</span>
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>

          {thermalDivider()}

          {/* Patient Info */}
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700 }}>{patient.name}</div>
            <div style={{ fontSize: '7px', color: '#555' }}>{patient.email}</div>
            <div style={{ fontSize: '7px', color: '#555' }}>{patient.phone}</div>
          </div>

          {thermalDivider()}

          {/* Services */}
          {renderThermalServices()}

          {/* Medicines */}
          {renderThermalMedicines()}

          {thermalThickDivider()}

          {/* Summary */}
          <div style={{ marginBottom: '6px' }}>
            {thermalLine('Treatment Services:', formatCurrency(totalTreatmentCost, currency))}
            {totalTreatmentDiscount > 0 && thermalLine('Treatment Adjust.:', `-${formatCurrency(totalTreatmentDiscount, currency)}`, undefined, { color: '#b45309' })}
            {thermalLine('Medicines & Items:', formatCurrency(totalMedicineCost, currency))}
            {thermalDivider()}
            {thermalLine('Subtotal:', formatCurrency(grandTotal, currency), undefined, { fontWeight: 700 })}
            {totalPaid > 0 && thermalLine('Payment Received:', `-${formatCurrency(totalPaid, currency)}`, undefined, { color: '#16a34a' })}
            {thermalThickDivider()}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, marginTop: '2px' }}>
              <span>BALANCE DUE</span>
              <span style={{ color: remainingBalance > 0 ? '#dc2626' : '#16a34a' }}>
                {formatCurrency(remainingBalance, currency)}
              </span>
            </div>
          </div>

          {thermalThickDivider()}

          {/* Payment Details */}
          {totalPaid > 0 && (
            <div style={{ marginBottom: '6px', fontSize: '8px', lineHeight: '1.35' }}>
              <div style={{ fontSize: '8.5px', fontWeight: 700, marginBottom: '3px', letterSpacing: '0.3px' }}>-- PAYMENT DETAILS --</div>
              {thermalLine('Amount Paid:', formatCurrency(totalPaid, currency), { fontSize: '8px' }, { fontSize: '8px', fontWeight: 700 })}
              {thermalLine('Date:', today, { fontSize: '8px' }, { fontSize: '8px' })}
              {thermalLine('Status:', 'Paid', undefined, { color: '#16a34a' })}
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '8px', color: '#555' }}>
            <div style={{ fontWeight: 700, marginBottom: '2px' }}>Thank you for choosing {appName}!</div>
            <div>This is a computer-generated receipt.</div>
            <div>No signature required.</div>
          </div>

          {/* Receipt cut line */}
          <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '8px', color: '#999', letterSpacing: '2px' }}>
            - - - - - - - - - - - - - - - - -
          </div>
        </div>
      </div>
    </div>
  );

  // ─── A4 Print Version ──────────────────────────────────────────────────

  const renderA4Print = () => (
    <div className="receipt-print hidden print:block">
      <div className="receipt-content" style={{ 
        width: '210mm', 
        minHeight: '297mm',
        margin: '0 auto',
        padding: '12mm',
        background: 'white',
        fontSize: '12pt',
        fontFamily: 'system-ui, sans-serif'
      }}>
        {/* Clinic Header */}
        <div className="text-center mb-8 border-b-2 border-gray-800 pb-6">
          <h1 className="text-2xl font-black text-gray-900 mb-2">{appName}</h1>
          <p className="text-sm text-gray-600">Professional Dental Care Services</p>
          <p className="text-xs text-gray-500 mt-2">Email: {receiptEmail} | Phone: {receiptPhone}</p>
        </div>

        {/* Receipt Info */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">BILL TO:</p>
            <p className="text-base font-bold text-gray-900">{patient.name}</p>
            <p className="text-sm text-gray-600">{patient.email}</p>
            <p className="text-sm text-gray-600">{patient.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1">Receipt #: <span className="font-semibold">{receiptNumber}</span></p>
            <p className="text-sm text-gray-600">Date: <span className="font-semibold">{today}</span></p>
          </div>
        </div>

        {renderServicesTable(true)}
        {renderMedicinesTable(true)}

        {/* Summary */}
        <div className="mb-8">
          <div className="flex justify-end">
            <div className="w-64">
              <div className="flex justify-between py-2 border-b border-gray-300" style={{ borderBottom: '1px solid #d1d5db', padding: '8px 0' }}>
                <span className="text-sm font-semibold text-gray-700">Treatment Services:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(totalTreatmentCost, currency)}
                </span>
              </div>
              {totalTreatmentDiscount > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-300" style={{ borderBottom: '1px solid #d1d5db', padding: '8px 0' }}>
                  <span className="text-sm font-semibold text-gray-700">Treatment Adjustments:</span>
                  <span className="text-sm font-semibold text-amber-700">
                    -{formatCurrency(totalTreatmentDiscount, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-300" style={{ borderBottom: '1px solid #d1d5db', padding: '8px 0' }}>
                <span className="text-sm font-semibold text-gray-700">Medicines & Items:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(totalMedicineCost, currency)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-300" style={{ borderBottom: '1px solid #d1d5db', padding: '8px 0' }}>
                <span className="text-sm font-semibold text-gray-700">Subtotal:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(grandTotal, currency)}
                </span>
              </div>
              {totalPaid > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-300" style={{ borderBottom: '1px solid #d1d5db', padding: '8px 0' }}>
                  <span className="text-sm font-semibold text-gray-700">Payment Received:</span>
                  <span className="text-sm font-semibold text-green-600">
                    -{formatCurrency(totalPaid, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-3 mt-2 border-t-2 border-gray-800" style={{ borderTop: '2px solid #1f2937', padding: '12px 0' }}>
                <span className="text-base font-bold text-gray-900">Balance Due:</span>
                <span className={`text-base font-bold ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(remainingBalance, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details (if payment was made) */}
        {totalPaid > 0 && (
          <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg" style={{ padding: '16px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <p className="text-sm font-semibold text-gray-900 mb-2">Payment Details:</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Payment Amount:</span>
              <span className="font-semibold text-gray-900">{formatCurrency(totalPaid, currency)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Payment Date:</span>
              <span className="font-semibold text-gray-900">{today}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Payment Status:</span>
              <span className="font-semibold text-green-600">Paid</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t-2 border-gray-800 text-center" style={{ marginTop: '48px', paddingTop: '24px', borderTop: '2px solid #1f2937' }}>
          <p className="text-xs text-gray-600 mb-2">
            Thank you for choosing {appName} for your dental care needs.
          </p>
          <p className="text-xs text-gray-500">
            This is a computer-generated receipt. No signature required.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Please retain this receipt for your records.
          </p>
        </div>
      </div>
    </div>
  );

  // ─── Thermal 55mm Print Version ────────────────────────────────────────

  const renderThermalPrint = () => (
    <div className="receipt-print hidden print:block">
      <div className="thermal-receipt-content" style={{
        width: '58mm',
        margin: '0 auto',
        padding: '2mm 3mm',
        background: 'white',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '10px',
        lineHeight: '1.3',
        color: '#222'
      }}>
        {/* Clinic Header */}
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>{appName}</div>
          <div style={{ fontSize: '8px', color: '#555' }}>Professional Dental Care Services</div>
          <div style={{ fontSize: '7px', color: '#777', marginTop: '2px' }}>{receiptEmail} | {receiptPhone}</div>
        </div>

        <div style={{ borderTop: '2px solid #333', margin: '4px 0' }} />

        {/* Receipt Info */}
        <div style={{ marginBottom: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
            <span>Receipt #: {receiptNumber}</span>
            <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #333', margin: '4px 0' }} />

        {/* Patient Info */}
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700 }}>{patient.name}</div>
          <div style={{ fontSize: '7px', color: '#555' }}>{patient.email}</div>
          <div style={{ fontSize: '7px', color: '#555' }}>{patient.phone}</div>
        </div>

        <div style={{ borderTop: '1px dashed #333', margin: '4px 0' }} />

        {/* Services */}
        {renderThermalServices()}

        {/* Medicines */}
        {renderThermalMedicines()}

        <div style={{ borderTop: '2px solid #333', margin: '4px 0' }} />

        {/* Summary */}
        <div style={{ marginBottom: '6px' }}>
          {thermalLine('Treatment Services:', formatCurrency(totalTreatmentCost, currency))}
          {totalTreatmentDiscount > 0 && thermalLine('Treatment Adjust.:', `-${formatCurrency(totalTreatmentDiscount, currency)}`, undefined, { color: '#b45309' })}
          {thermalLine('Medicines & Items:', formatCurrency(totalMedicineCost, currency))}
          <div style={{ borderTop: '1px dashed #333', margin: '4px 0' }} />
          {thermalLine('Subtotal:', formatCurrency(grandTotal, currency), undefined, { fontWeight: 700 })}
          {totalPaid > 0 && thermalLine('Payment Received:', `-${formatCurrency(totalPaid, currency)}`, undefined, { color: '#16a34a' })}
          <div style={{ borderTop: '2px solid #333', margin: '4px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, marginTop: '2px' }}>
            <span>BALANCE DUE</span>
            <span style={{ color: remainingBalance > 0 ? '#dc2626' : '#16a34a' }}>
              {formatCurrency(remainingBalance, currency)}
            </span>
          </div>
        </div>

        <div style={{ borderTop: '2px solid #333', margin: '4px 0' }} />

        {/* Payment Details */}
        {totalPaid > 0 && (
          <div style={{ marginBottom: '6px', fontSize: '8px', lineHeight: '1.35' }}>
            <div style={{ fontSize: '8.5px', fontWeight: 700, marginBottom: '3px', letterSpacing: '0.3px' }}>-- PAYMENT DETAILS --</div>
            {thermalLine('Amount Paid:', formatCurrency(totalPaid, currency), { fontSize: '8px' }, { fontSize: '8px', fontWeight: 700 })}
            {thermalLine('Date:', today, { fontSize: '8px' }, { fontSize: '8px' })}
            {thermalLine('Status:', 'Paid', undefined, { color: '#16a34a' })}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '8px', color: '#555' }}>
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>Thank you for choosing {appName}!</div>
          <div>This is a computer-generated receipt.</div>
          <div>No signature required.</div>
        </div>

        {/* Receipt cut line */}
        <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '8px', color: '#999', letterSpacing: '2px' }}>
          - - - - - - - - - - - - - - - - -
        </div>
      </div>
    </div>
  );

  // ─── Main Return ───────────────────────────────────────────────────────

  return (
    <>
      {isThermal ? renderThermalPreview() : renderA4Preview()}
      {isThermal ? renderThermalPrint() : renderA4Print()}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .receipt-print,
          .receipt-print * {
            visibility: visible;
          }
          .receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .receipt-content {
            position: relative;
            margin: 0 auto;
          }
          .thermal-receipt-content {
            position: relative;
            margin: 0 auto;
          }
        }

        /* A4 page setup */
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }

        /* Thermal 55mm page setup - overrides @page when thermal is selected */
        @media print {
          @page thermal {
            size: 58mm 297mm;
            margin: 0;
          }
        }
      `}</style>
    </>
  );
};

export default Receipt;
