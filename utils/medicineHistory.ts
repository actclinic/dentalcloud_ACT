import type { MedicineSale } from '../types';

export const getPatientMedicineHistory = (
  sales: MedicineSale[],
  patientId: string
): MedicineSale[] => sales
  .filter((sale) => sale.patient_id === patientId)
  .sort((a, b) => {
    const dateComparison = String(b.created_at || b.date || '').localeCompare(String(a.created_at || a.date || ''));
    return dateComparison !== 0 ? dateComparison : b.id.localeCompare(a.id);
  });

export const formatMedicineQuantity = (quantity: number, unit?: string): string => {
  const numericQuantity = Number(quantity || 0);
  const formattedQuantity = Number.isInteger(numericQuantity)
    ? String(numericQuantity)
    : numericQuantity.toFixed(2).replace(/\.?0+$/, '');
  const cleanedUnit = unit?.trim();

  return cleanedUnit ? `${formattedQuantity} ${cleanedUnit}` : formattedQuantity;
};