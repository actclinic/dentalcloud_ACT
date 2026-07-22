import type { ClinicalRecord, TreatmentType } from '../types';

export interface ReceiptTreatmentPricing {
  finalCost: number;
  standardCost: number;
  discountAmount: number;
  note: '' | 'FOC' | 'Discount';
}

const finiteNonNegative = (value: unknown): number => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
};

export const resolveReceiptTreatmentPricing = (
  treatment: Pick<ClinicalRecord, 'cost' | 'description' | 'teeth'> & Partial<ClinicalRecord>,
  treatmentTypes: TreatmentType[] = []
): ReceiptTreatmentPricing => {
  const finalCost = finiteNonNegative(treatment.cost);
  const rawStandard = Number((treatment as any).standardCost ?? (treatment as any).standard_cost);
  const hasExplicitStandard = Number.isFinite(rawStandard) && rawStandard >= 0;
  const explicitDiscount = finiteNonNegative(
    (treatment as any).discountAmount ?? (treatment as any).discount_amount
  );

  const matchedType = treatmentTypes.find((type) => (
    (type.name || '').trim().toLowerCase() === (treatment.description || '').trim().toLowerCase()
  ));
  const menuStandard = matchedType
    ? finiteNonNegative(matchedType.cost) * Math.max(1, treatment.teeth?.length || 1)
    : finalCost;

  const standardCost = hasExplicitStandard
    ? Math.max(finalCost, rawStandard, finalCost + explicitDiscount)
    : explicitDiscount > 0
      ? finalCost + explicitDiscount
      : Math.max(finalCost, menuStandard);
  const discountAmount = Math.max(0, standardCost - finalCost);
  const pricingNote = ((treatment as any).pricingNote || (treatment as any).pricing_note || '') as string;
  const note = discountAmount > 0
    ? (pricingNote === 'FOC' || finalCost === 0 ? 'FOC' : 'Discount')
    : '';

  return { finalCost, standardCost, discountAmount, note };
};
