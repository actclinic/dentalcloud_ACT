import type { Appointment, ClinicalRecord, Expense, Patient, PaymentRecord } from '../types';

export interface DashboardRangeSummary {
  treatmentRevenue: number;
  collectedPayments: number;
  revenue: number;
  expenses: number;
  profit: number;
  appointments: number;
  newPatients: number;
  dayCount: number;
  avgDailyRevenue: number;
}

export interface DailyFinancialDatum {
  name: string;
  revenue: number;
  collections: number;
  expenses: number;
  profit: number;
  date: string;
}

export interface DailyAppointmentDatum {
  name: string;
  revenue: number;
  collections: number;
  appointments: number;
  date: string;
}

export interface MonthlyProfitDatum {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface MonthRange {
  key: string;
  label: string;
}

export const safeAmount = (amount: number | null | undefined): number => {
  const value = Number(amount || 0);
  return Number.isFinite(value) ? value : 0;
};

export const sumAmounts = <T>(items: T[], amountSelector: (item: T) => number | null | undefined): number => (
  items.reduce((sum, item) => sum + safeAmount(amountSelector(item)), 0)
);

export const countPatientsCreatedInRange = (patients: Patient[], dateFrom: string, dateTo: string): number => (
  patients.filter((patient) => {
    const createdDate = patient.created_at?.slice(0, 10);
    return Boolean(createdDate && createdDate >= dateFrom && createdDate <= dateTo);
  }).length
);

export const calculateDashboardRangeSummary = ({
  filteredTreatmentRecords,
  filteredPaymentRecords,
  filteredExpenses,
  filteredAppointments,
  patients,
  dateFrom,
  dateTo,
  rangeDates
}: {
  filteredTreatmentRecords: ClinicalRecord[];
  filteredPaymentRecords: PaymentRecord[];
  filteredExpenses: Expense[];
  filteredAppointments: Appointment[];
  patients: Patient[];
  dateFrom: string;
  dateTo: string;
  rangeDates: string[];
}): DashboardRangeSummary => {
  const treatmentRevenue = sumAmounts(filteredTreatmentRecords, (record) => record.cost);
  const collectedPayments = sumAmounts(filteredPaymentRecords, (payment) => payment.amount);
  const expenses = sumAmounts(filteredExpenses, (expense) => expense.amount);
  const revenue = treatmentRevenue;
  const profit = revenue - expenses;
  const dayCount = Math.max(rangeDates.length, 1);

  return {
    treatmentRevenue,
    collectedPayments,
    revenue,
    expenses,
    profit,
    appointments: filteredAppointments.length,
    newPatients: countPatientsCreatedInRange(patients, dateFrom, dateTo),
    dayCount,
    avgDailyRevenue: revenue / dayCount
  };
};

export const buildDailyFinancialData = ({
  chartDates,
  filteredTreatmentRecords,
  filteredPaymentRecords,
  filteredExpenses,
  formatDateLabel
}: {
  chartDates: string[];
  filteredTreatmentRecords: ClinicalRecord[];
  filteredPaymentRecords: PaymentRecord[];
  filteredExpenses: Expense[];
  formatDateLabel: (dateStr: string) => string;
}): DailyFinancialDatum[] => (
  chartDates.map((dateStr) => {
    const revenue = sumAmounts(
      filteredTreatmentRecords.filter((record) => record.date === dateStr),
      (record) => record.cost
    );
    const collections = sumAmounts(
      filteredPaymentRecords.filter((payment) => payment.date === dateStr),
      (payment) => payment.amount
    );
    const expenses = sumAmounts(
      filteredExpenses.filter((expense) => expense.date === dateStr),
      (expense) => expense.amount
    );

    return {
      name: formatDateLabel(dateStr),
      revenue,
      collections,
      expenses,
      profit: revenue - expenses,
      date: dateStr
    };
  })
);

export const buildDailyAppointmentData = ({
  chartDates,
  filteredTreatmentRecords,
  filteredPaymentRecords,
  filteredAppointments,
  formatDateLabel
}: {
  chartDates: string[];
  filteredTreatmentRecords: ClinicalRecord[];
  filteredPaymentRecords: PaymentRecord[];
  filteredAppointments: Appointment[];
  formatDateLabel: (dateStr: string) => string;
}): DailyAppointmentDatum[] => (
  chartDates.map((dateStr) => ({
    name: formatDateLabel(dateStr),
    revenue: sumAmounts(
      filteredTreatmentRecords.filter((record) => record.date === dateStr),
      (record) => record.cost
    ),
    collections: sumAmounts(
      filteredPaymentRecords.filter((payment) => payment.date === dateStr),
      (payment) => payment.amount
    ),
    appointments: filteredAppointments.filter((appointment) => appointment.date === dateStr).length,
    date: dateStr
  }))
);

export const buildMonthlyProfitData = ({
  rangeMonths,
  filteredTreatmentRecords,
  filteredExpenses
}: {
  rangeMonths: MonthRange[];
  filteredTreatmentRecords: ClinicalRecord[];
  filteredExpenses: Expense[];
}): MonthlyProfitDatum[] => (
  rangeMonths.map((month) => {
    const revenue = sumAmounts(
      filteredTreatmentRecords.filter((record) => record.date.startsWith(month.key)),
      (record) => record.cost
    );
    const expenses = sumAmounts(
      filteredExpenses.filter((expense) => expense.date.startsWith(month.key)),
      (expense) => expense.amount
    );

    return {
      label: month.label,
      revenue,
      expenses,
      profit: revenue - expenses
    };
  })
);