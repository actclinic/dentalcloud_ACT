export const normalizeDoctorName = (doctorName?: string | null): string => {
  return (doctorName || '').trim().replace(/^dr\.?\s*/i, '').replace(/\s+/g, ' ').trim();
};

export const formatDoctorName = (doctorName?: string | null, fallback = '-'): string => {
  const normalizedName = normalizeDoctorName(doctorName);
  return normalizedName ? `Dr. ${normalizedName}` : fallback;
};
