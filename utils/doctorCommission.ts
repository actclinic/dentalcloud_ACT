export const DOCTOR_SPECIALIZATIONS = ['General', 'Ortho', 'Implant', 'Surgery', 'Specialists'] as const;

export const FLAT_VISIT_COMMISSION_SPECIALIZATIONS: readonly string[] = ['Ortho', 'Implant', 'Surgery'];

export const usesFlatVisitCommission = (specialization?: string | null) =>
  FLAT_VISIT_COMMISSION_SPECIALIZATIONS.includes((specialization || '').trim());

export const calculateDoctorEarnings = (params: {
  cost: number;
  specialization?: string | null;
  commissionRate?: number | null;
  commissionPerVisit?: number | null;
}) => {
  const amount = usesFlatVisitCommission(params.specialization)
    ? Number(params.commissionPerVisit || 0)
    : Number(params.cost || 0) * (Number(params.commissionRate || 0) / 100);

  return Math.round(amount * 100) / 100;
};