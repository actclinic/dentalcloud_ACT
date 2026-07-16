export const DOCTOR_SPECIALIZATIONS = ['General', 'Ortho', 'Implant', 'Surgery', 'Specialists'] as const;

export const FLAT_VISIT_COMMISSION_SPECIALIZATIONS: readonly string[] = ['Ortho', 'Implant', 'Surgery'];

export const usesFlatVisitCommission = (specialization?: string | null) =>
  FLAT_VISIT_COMMISSION_SPECIALIZATIONS.includes((specialization || '').trim());

export const calculateDoctorEarnings = (params: {
  collectedPayment?: number | null;
  materialCost?: number | null;
  specialization?: string | null;
  commissionPercentage?: number | null;
  commissionPerVisit?: number | null;
}) => {
  const collectedPayment = Math.max(0, Number(params.collectedPayment || 0));
  const materialCost = Math.max(0, Number(params.materialCost || 0));
  const commissionBase = Math.max(0, collectedPayment - materialCost);

  const amount = usesFlatVisitCommission(params.specialization)
    ? (collectedPayment > 0 ? Number(params.commissionPerVisit || 0) : 0)
    : commissionBase * (Number(params.commissionPercentage || 0) / 100);

  return Math.round(amount * 100) / 100;
};
