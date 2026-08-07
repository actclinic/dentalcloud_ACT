import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Package, Loader2, ArrowRight, ArrowLeft, Percent } from 'lucide-react';
import { Medicine } from '../types';
import { Modal } from './Shared';
import { formatCurrency, Currency } from '../utils/currency';

export interface MedicineSelectionItem {
  medicine: Medicine;
  quantity: number;
  unitPrice: number;
  standardTotal: number;
  finalTotal: number;
  discountAmount: number;
  pricingNote: 'FOC' | 'DISCOUNT' | null;
}

interface MedicineSelectionModalProps {
  medicines: Medicine[];
  currency: Currency;
  onConfirm: (selectedMedicines: MedicineSelectionItem[]) => void;
  onClose: () => void;
}

const MedicineSelectionModal: React.FC<MedicineSelectionModalProps> = ({
  medicines,
  currency,
  onConfirm,
  onClose
}) => {
  // ── Step tracking ──
  const [step, setStep] = useState<'select' | 'review'>('select');

  // ── Step 1: quantity selection ──
  const [selectedMedicines, setSelectedMedicines] = useState<Map<string, number>>(new Map());

  // ── Step 2: charge editing ──
  const [chargeInputs, setChargeInputs] = useState<Map<string, string>>(new Map());
  const [overallDiscountInput, setOverallDiscountInput] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableMedicines = medicines.filter(m => m.stock > 0);
  const currencySymbol = currency === 'USD' ? '$' : currency === 'MMK' ? 'K' : '';

  const formatQuantity = (value: number | undefined) => {
    const num = Number(value || 0);
    return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
  };

  const clampToStep = (value: number, max: number, step: number) => {
    const safeStep = step > 0 ? step : 1;
    const rounded = Math.round(value / safeStep) * safeStep;
    return Math.max(0, Math.min(max, Number(rounded.toFixed(2))));
  };

  // ── Step 1 helpers ──
  const handleQuantityChange = (medicineId: string, change: number) => {
    const current = selectedMedicines.get(medicineId) || 0;
    const medicine = medicines.find(m => m.id === medicineId);
    if (!medicine) return;
    const step = Number(medicine.quantity_step || 1);

    const newQuantity = clampToStep(current + change, Number(medicine.stock), step);
    
    if (newQuantity === 0) {
      const updated = new Map(selectedMedicines);
      updated.delete(medicineId);
      setSelectedMedicines(updated);
    } else {
      setSelectedMedicines(new Map(selectedMedicines).set(medicineId, newQuantity));
    }
  };

  const step1Total = Array.from(selectedMedicines.entries()).reduce((sum, [id, quantity]) => {
    const medicine = medicines.find(m => m.id === id);
    return sum + (medicine ? medicine.price * quantity : 0);
  }, 0);

  const handleGoToReview = () => {
    const inputs = new Map<string, string>();
    Array.from(selectedMedicines.entries()).forEach(([id, quantity]) => {
      const medicine = medicines.find(m => m.id === id);
      if (medicine) inputs.set(id, String(medicine.price * quantity));
    });
    setChargeInputs(inputs);
    setOverallDiscountInput('0');
    setStep('review');
  };


  // Step 2: charge review computations
  const selectedItems = useMemo(() =>
    Array.from(selectedMedicines.entries())
      .map(([id, quantity]) => { const m = medicines.find(med => med.id === id); return m ? { medicine: m, quantity } : null; })
      .filter((item): item is { medicine: Medicine; quantity: number } => item !== null),
    [selectedMedicines, medicines]
  );

  const itemCharges = useMemo(() =>
    selectedItems.map((item) => {
      const standardTotal = item.medicine.price * item.quantity;
      const inputVal = chargeInputs.get(item.medicine.id);
      const parsedVal = Number.parseFloat(inputVal ?? '');
      const finalCharge = Number.isFinite(parsedVal) ? Math.max(0, parsedVal) : standardTotal;
      const initialDiscount = Math.max(0, standardTotal - finalCharge);
      return { ...item, standardTotal, finalCharge, initialDiscount };
    }),
    [selectedItems, chargeInputs]
  );

  const lineSubtotal = itemCharges.reduce((sum, item) => sum + item.finalCharge, 0);
  const parsedOverallDiscount = Number.parseFloat(overallDiscountInput);
  const overallDiscount = Number.isFinite(parsedOverallDiscount) ? Math.min(lineSubtotal, Math.max(0, parsedOverallDiscount)) : 0;

  const distributedItems = useMemo(() => {
    if (overallDiscount === 0 || lineSubtotal === 0) {
      return itemCharges.map(item => ({
        ...item, finalTotal: item.finalCharge, discountAmount: item.initialDiscount,
        pricingNote: (item.finalCharge === 0 && item.standardTotal > 0 ? 'FOC' as const : item.finalCharge < item.standardTotal ? 'DISCOUNT' as const : null)
      }));
    }
    let remainingDiscount = overallDiscount;
    let remainingSubtotal = lineSubtotal;
    return itemCharges.map((item, index) => {
      const isLast = index === itemCharges.length - 1 || itemCharges.slice(index + 1).every(c => c.finalCharge === 0);
      const share = item.finalCharge === 0 ? 0 : isLast ? remainingDiscount : Math.min(item.finalCharge, Math.round((item.finalCharge / remainingSubtotal) * remainingDiscount * 100) / 100);
      remainingDiscount = Math.round((remainingDiscount - share) * 100) / 100;
      remainingSubtotal = Math.round((remainingSubtotal - item.finalCharge) * 100) / 100;
      const finalTotal = Math.max(0, Math.round((item.finalCharge - share) * 100) / 100);
      const totalDiscount = Math.max(0, Math.round((item.standardTotal - finalTotal) * 100) / 100);
      const pricingNote = finalTotal === 0 ? 'FOC' as const : totalDiscount > 0 ? 'DISCOUNT' as const : null;
      return { ...item, finalTotal, discountAmount: totalDiscount, pricingNote };
    });
  }, [itemCharges, overallDiscount, lineSubtotal]);

  const finalTotal = distributedItems.reduce((sum, item) => sum + item.finalTotal, 0);
  const totalDiscount = distributedItems.reduce((sum, item) => sum + item.discountAmount, 0);
  const individualDiscount = distributedItems.reduce((sum, item) => sum + item.initialDiscount, 0);

  const handleChargeInputChange = (medicineId: string, value: string) => { setChargeInputs(new Map(chargeInputs).set(medicineId, value)); };
  const handleAllStandard = () => {
    const inputs = new Map<string, string>();
    selectedItems.forEach(item => inputs.set(item.medicine.id, String(item.medicine.price * item.quantity)));
    setChargeInputs(inputs); setOverallDiscountInput('0');
  };
  const handleAllFOC = () => {
    const inputs = new Map<string, string>();
    selectedItems.forEach(item => inputs.set(item.medicine.id, '0'));
    setChargeInputs(inputs); setOverallDiscountInput('0');
  };

  const handleConfirm = () => {
    setIsSubmitting(true);
    const result: MedicineSelectionItem[] = distributedItems.map(item => ({
      medicine: item.medicine, quantity: item.quantity, unitPrice: item.medicine.price,
      standardTotal: item.standardTotal, finalTotal: item.finalTotal,
      discountAmount: item.discountAmount, pricingNote: item.pricingNote
    }));
    onConfirm(result);
  };

  // ── REVIEW STEP ──
  if (step === 'review') {
    return (
      <Modal title="Review Charges & Discount" onClose={onClose}>
        <div className="space-y-4">
          <button type="button" onClick={() => setStep('select')} className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-700">
            <ArrowLeft size={16} /> Back to selection
          </button>
          <div className="max-h-80 overflow-y-auto space-y-3 border border-gray-200 rounded-xl p-4">
            {distributedItems.map((item) => {
              const standardTotal = item.standardTotal;
              const inputVal = chargeInputs.get(item.medicine.id) ?? String(standardTotal);
              const note = item.pricingNote;
              return (
                <div key={item.medicine.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                    <div>
                      <p className="text-sm font-black text-gray-900">{item.medicine.name}</p>
                      <p className="text-xs font-semibold text-gray-500">
                        {formatQuantity(item.quantity)} {item.medicine.unit} &times; {formatCurrency(item.medicine.price, currency)} = {formatCurrency(standardTotal, currency)}
                      </p>
                    </div>
                    {note && (
                      <span className={`self-start rounded-full px-3 py-1 text-xs font-black ${note === 'FOC' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {note}{note === 'DISCOUNT' ? ` -${formatCurrency(item.discountAmount, currency)}` : ''}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Final Charge ({currencySymbol})</label>
                    <input type="number" min="0" max={standardTotal} step="0.01" value={inputVal}
                      onChange={(e) => handleChargeInputChange(item.medicine.id, e.target.value)}
                      className="w-full border-gray-200 border rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <p className="text-xs font-black text-amber-800 uppercase tracking-wide mb-2">Overall Discount</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-amber-700">{currencySymbol}</span>
              <input type="number" min="0" max={lineSubtotal} step="0.01" value={overallDiscountInput}
                onChange={(e) => setOverallDiscountInput(e.target.value)}
                onBlur={() => setOverallDiscountInput(String(overallDiscount))}
                className="flex-1 border-amber-200 border rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
              <button type="button" onClick={() => setOverallDiscountInput('0')} disabled={overallDiscount === 0}
                className="min-h-9 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-black text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">Clear</button>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-amber-800">Subtotal before discount</span>
              <span className="font-black text-amber-950">{formatCurrency(lineSubtotal, currency)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={handleAllStandard} className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-black text-gray-700 hover:bg-gray-50">All Standard</button>
            <button type="button" onClick={handleAllFOC} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-black text-amber-700 hover:bg-amber-100">All FOC</button>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700">Final Total</span>
              <span className="text-xl font-black text-gray-900">{formatCurrency(finalTotal, currency)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="mt-1 text-xs font-bold text-amber-700">
                <p>Total discount: -{formatCurrency(totalDiscount, currency)}</p>
                {overallDiscount > 0 && individualDiscount > 0 && (
                  <p className="font-semibold text-amber-600">Includes overall: -{formatCurrency(overallDiscount, currency)}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="flex-1 rounded-xl border border-gray-200 px-6 py-3 font-bold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-70">Cancel</button>
            <button type="button" onClick={handleConfirm} disabled={isSubmitting || selectedMedicines.size === 0}
              className="flex-1 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors">
              {isSubmitting ? 'Please wait...' : 'Add to Treatment'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // ── SELECT STEP ──
  return (
    <Modal title="Select Inventory Items" onClose={onClose}>
      <div className="space-y-4">
        {availableMedicines.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No inventory items available in stock.</p>
          </div>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-xl p-4">
              {availableMedicines.map((medicine) => {
                const quantity = selectedMedicines.get(medicine.id) || 0;
                const isLowStock = medicine.min_stock !== undefined && medicine.stock <= medicine.min_stock;
                const step = Number(medicine.quantity_step || 1);
                
                return (
                  <div
                    key={medicine.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      quantity > 0
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="w-4 h-4 text-indigo-600" />
                          <h4 className="font-bold text-gray-900">{medicine.name}</h4>
                          {isLowStock && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">
                              Low Stock
                            </span>
                          )}
                        </div>
                        {medicine.description && (
                          <p className="text-xs text-gray-500 mb-2">{medicine.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">
                            <span className="font-medium">{formatCurrency(medicine.price || 0, currency)}</span> per {medicine.unit}
                          </span>
                          <span className={`text-xs ${isLowStock ? 'text-yellow-600' : 'text-gray-500'}`}>
                            Stock: {formatQuantity(medicine.stock)} {medicine.unit}
                          </span>
                          <span className="text-xs text-gray-500">
                            Step: {formatQuantity(step)} {medicine.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(medicine.id, -step)}
                        disabled={quantity === 0}
                        className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={medicine.stock}
                        step={step}
                        value={quantity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const clamped = clampToStep(val, Number(medicine.stock), step);
                          if (clamped === 0) {
                            const updated = new Map(selectedMedicines);
                            updated.delete(medicine.id);
                            setSelectedMedicines(updated);
                          } else {
                            setSelectedMedicines(new Map(selectedMedicines).set(medicine.id, clamped));
                          }
                        }}
                        className="w-20 text-center border border-gray-300 rounded-lg py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(medicine.id, step)}
                        disabled={quantity >= medicine.stock}
                        className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                      {quantity > 0 && (
                        <span className="ml-auto text-sm font-bold text-indigo-600">
                          {formatCurrency((medicine.price || 0) * quantity, currency)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedMedicines.size > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Total Medicine Cost:</span>
                  <span className="text-lg font-black text-indigo-600">{formatCurrency(step1Total, currency)}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {Array.from(selectedMedicines.entries())
                    .map(([id, qty]) => {
                      const med = medicines.find(m => m.id === id);
                      return med ? `${formatQuantity(qty)} ${med.unit} ${med.name}` : '';
                    })
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 px-6 py-3 font-bold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-70">Cancel</button>
              <button type="button" onClick={handleGoToReview} disabled={selectedMedicines.size === 0}
                className="flex-1 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default MedicineSelectionModal;

