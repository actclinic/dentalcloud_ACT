import { Appointment, ClinicalRecord, Doctor, Expense, Medicine, Patient } from '../types';
import { Currency } from './currency';
import { formatTeethWithPosition } from './toothNumbering';

type ExcelPrimitive = string | number;
type ExcelRow = Record<string, ExcelPrimitive>;
type ColumnFormat = 'text' | 'integer' | 'currency';

interface ExcelColumn {
  header: string;
  width?: number;
  format?: ColumnFormat;
}

const getCurrencyNumberFormat = (currency: Currency) => {
  return currency === 'MMK' ? '#,##0"Ks"' : '$#,##0.00';
};

const applyColumnFormatting = (
  worksheet: Record<string, any>,
  columns: ExcelColumn[],
  rowCount: number,
  currency: Currency
) => {
  columns.forEach((column, columnIndex) => {
    if (!column.format || rowCount === 0) return;

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const cellAddress = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 2}`;
      const cell = worksheet[cellAddress];

      if (!cell || cell.t !== 'n') continue;

      if (column.format === 'currency') {
        cell.z = getCurrencyNumberFormat(currency);
      }

      if (column.format === 'integer') {
        cell.z = '#,##0';
      }
    }
  });
};

const buildWorksheet = async (rows: ExcelRow[], columns: ExcelColumn[], currency: Currency) => {
  const XLSX = await import('xlsx');
  const headers = columns.map(column => column.header);
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);

  if (rows.length > 0) {
    XLSX.utils.sheet_add_json(worksheet, rows, {
      header: headers,
      skipHeader: true,
      origin: 'A2'
    });
  }

  worksheet['!cols'] = columns.map((column) => {
    if (column.width) return { wch: column.width };

    const valueLength = rows.reduce((max, row) => {
      const value = row[column.header];
      return Math.max(max, String(value ?? '').length);
    }, column.header.length);

    return { wch: Math.min(Math.max(valueLength + 2, 12), 40) };
  });

  if (headers.length > 0) {
    const lastColumnLetter = String.fromCharCode(64 + headers.length);
    const lastRowNumber = rows.length + 1;
    worksheet['!autofilter'] = { ref: `A1:${lastColumnLetter}${lastRowNumber}` };
  }

  applyColumnFormatting(worksheet, columns, rows.length, currency);

  return { XLSX, worksheet };
};

const saveWorkbook = async (
  rows: ExcelRow[],
  columns: ExcelColumn[],
  sheetName: string,
  fileName: string,
  currency: Currency = 'USD'
) => {
  const { XLSX, worksheet } = await buildWorksheet(rows, columns, currency);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
};

export const exportPatientsToExcel = async (patients: Patient[], currency: Currency) => {
  const columns: ExcelColumn[] = [
    { header: 'Patient Name', width: 24 },
    { header: 'Age', width: 8, format: 'integer' },
    { header: 'Patient Type', width: 15 },
    { header: 'Phone', width: 16 },
    { header: 'Email', width: 28 },
    { header: 'Address', width: 30 },
    { header: 'City', width: 15 },
    { header: 'Township', width: 15 },
    { header: 'Medical Status', width: 18 },
    { header: 'Balance', width: 14, format: 'currency' },
    { header: 'Portal Access', width: 14 },
    { header: 'Loyalty Points', width: 14, format: 'integer' },
    { header: 'Join Date', width: 15 }
  ];
  const rows = patients.map((patient) => ({
    'Patient Name': patient.name,
    Age: patient.age || 'N/A',
    'Patient Type': patient.patient_type || 'N/A',
    Phone: patient.phone || 'N/A',
    Email: patient.email || 'N/A',
    Address: patient.address || '',
    City: patient.city || '',
    Township: patient.township || '',
    'Medical Status': patient.medicalHistory ? 'Review Required' : 'No Alerts',
    Balance: patient.balance || 0,
    'Portal Access': patient.has_account ? 'Active' : 'No Access',
    'Loyalty Points': patient.loyalty_points || 0,
    'Join Date': patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'N/A'
  }));

  await saveWorkbook(rows, columns, 'Patients', `patient-directory-${new Date().toISOString().split('T')[0]}.xlsx`, currency);
};

export const exportAppointmentsToExcel = async (appointments: Appointment[]) => {
  const columns: ExcelColumn[] = [
    { header: 'Date', width: 14 },
    { header: 'Time', width: 10 },
    { header: 'Patient', width: 24 },
    { header: 'Type', width: 18 },
    { header: 'Doctor', width: 22 },
    { header: 'Status', width: 14 },
    { header: 'Notes', width: 32 }
  ];
  const rows = appointments
    .slice()
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .map((appointment) => ({
      Date: appointment.date,
      Time: appointment.time,
      Patient: appointment.patient_name || 'Unknown',
      Type: appointment.type || 'Checkup',
      Doctor: appointment.doctor_name ? `Dr. ${appointment.doctor_name}` : 'N/A',
      Status: appointment.status,
      Notes: appointment.notes || ''
    }));

  await saveWorkbook(rows, columns, 'Appointments', `appointments-report-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportClinicalRecordsToExcel = async (records: ClinicalRecord[], currency: Currency) => {
  const columns: ExcelColumn[] = [
    { header: 'Date', width: 14 },
    { header: 'Patient', width: 24 },
    { header: 'Doctor', width: 22 },
    { header: 'Treatment', width: 32 },
    { header: 'Teeth', width: 18 },
    { header: 'Amount', width: 14, format: 'currency' }
  ];
  const rows = records.map((record) => ({
    Date: record.date,
    Patient: record.patient_name || 'Unknown',
    Doctor: record.doctor_name ? `Dr. ${record.doctor_name}` : 'N/A',
    Treatment: record.description,
    Teeth: record.teeth && record.teeth.length > 0 ? formatTeethWithPosition(record.teeth) : 'General',
    Amount: record.cost || 0
  }));

  await saveWorkbook(rows, columns, 'Clinical Records', `clinical-records-${new Date().toISOString().split('T')[0]}.xlsx`, currency);
};

export const exportDoctorsToExcel = async (doctors: Doctor[]) => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const columns: ExcelColumn[] = [
    { header: 'Doctor Name', width: 24 },
    { header: 'Specialization', width: 18 },
    { header: 'Phone', width: 16 },
    { header: 'Email', width: 28 },
    { header: 'Schedule', width: 40 }
  ];
  const rows = doctors.map((doctor) => ({
    'Doctor Name': `Dr. ${doctor.name}`,
    Specialization: doctor.specialization || 'General',
    Phone: doctor.phone || 'N/A',
    Email: doctor.email || 'N/A',
    Schedule: doctor.schedules.length === 0
      ? 'No schedule set'
      : doctor.schedules
          .map(schedule => `${dayNames[schedule.day_of_week]} ${schedule.start_time}-${schedule.end_time}`)
          .join(' | ')
  }));

  await saveWorkbook(rows, columns, 'Doctors', `doctors-directory-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportInventoryToExcel = async (medicines: Medicine[], currency: Currency) => {
  const columns: ExcelColumn[] = [
    { header: 'Medicine', width: 24 },
    { header: 'Category', width: 18 },
    { header: 'Description', width: 30 },
    { header: 'Unit', width: 10 },
    { header: 'Price', width: 14, format: 'currency' },
    { header: 'Stock', width: 12, format: 'integer' },
    { header: 'Min Stock', width: 12, format: 'integer' },
    { header: 'Inventory Value', width: 16, format: 'currency' }
  ];
  const rows = medicines.map((medicine) => ({
    Medicine: medicine.name,
    Category: medicine.category || 'N/A',
    Description: medicine.description || '',
    Unit: medicine.unit,
    Price: medicine.price || 0,
    Stock: medicine.stock || 0,
    'Min Stock': medicine.min_stock ?? 0,
    'Inventory Value': (medicine.price || 0) * (medicine.stock || 0)
  }));

  await saveWorkbook(rows, columns, 'Inventory', `inventory-report-${new Date().toISOString().split('T')[0]}.xlsx`, currency);
};

export const exportExpensesToExcel = async (expenses: Expense[], currency: Currency) => {
  const columns: ExcelColumn[] = [
    { header: 'Date', width: 14 },
    { header: 'Description', width: 32 },
    { header: 'Category', width: 18 },
    { header: 'Amount', width: 14, format: 'currency' }
  ];
  const rows = expenses.map((expense) => ({
    Date: expense.date,
    Description: expense.description,
    Category: expense.category || 'Uncategorized',
    Amount: expense.amount || 0
  }));

  await saveWorkbook(rows, columns, 'Expenses', `expenses-${new Date().toISOString().split('T')[0]}.xlsx`, currency);
};
