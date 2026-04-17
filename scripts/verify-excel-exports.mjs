import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import XLSX from 'xlsx';
import {
  exportAppointmentsToExcel,
  exportClinicalRecordsToExcel,
  exportDoctorsToExcel,
  exportExpensesToExcel,
  exportInventoryToExcel,
  exportPatientsToExcel
} from '../utils/excelExport.ts';

const today = new Date().toISOString().split('T')[0];
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dentflow-excel-'));
const originalCwd = process.cwd();

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const readWorkbook = (fileName) => {
  const workbook = XLSX.readFile(path.join(tempDir, fileName), { cellNF: true });
  assert(workbook.SheetNames.length === 1, `${fileName}: expected exactly one sheet`);
  return workbook;
};

const expectHeaders = (sheet, expectedHeaders, fileName) => {
  expectedHeaders.forEach((header, index) => {
    const address = `${String.fromCharCode(65 + index)}1`;
    assert(sheet[address]?.v === header, `${fileName}: expected header ${header} at ${address}`);
  });
};

const expectNumericCell = (sheet, address, expectedValue, expectedFormat, fileName) => {
  assert(sheet[address]?.t === 'n', `${fileName}: expected numeric cell at ${address}`);
  assert(sheet[address]?.v === expectedValue, `${fileName}: expected ${expectedValue} at ${address}, got ${sheet[address]?.v}`);
  if (expectedFormat) {
    assert(sheet[address]?.z === expectedFormat, `${fileName}: expected number format ${expectedFormat} at ${address}, got ${sheet[address]?.z}`);
  }
};

const verify = async () => {
  process.chdir(tempDir);

  await exportPatientsToExcel([
    {
      id: 'p1',
      location_id: 'loc1',
      name: 'Alice Smith',
      email: 'alice@example.com',
      phone: '555-1000',
      balance: 120.5,
      loyalty_points: 42,
      medicalHistory: 'Diabetes',
      has_account: true
    }
  ], 'USD');

  await exportAppointmentsToExcel([
    {
      id: 'a2',
      location_id: 'loc1',
      patient_id: 'p2',
      patient_name: 'Bob Jones',
      doctor_id: 'd1',
      doctor_name: 'Hla',
      date: '2026-04-20',
      time: '09:30',
      type: 'Cleaning',
      status: 'Scheduled',
      notes: 'Morning visit'
    },
    {
      id: 'a1',
      location_id: 'loc1',
      patient_id: 'p1',
      patient_name: 'Alice Smith',
      doctor_id: 'd1',
      doctor_name: 'Hla',
      date: '2026-04-19',
      time: '15:00',
      type: 'Checkup',
      status: 'Completed',
      notes: ''
    }
  ]);

  await exportClinicalRecordsToExcel([
    {
      id: 'r1',
      location_id: 'loc1',
      patient_id: 'p1',
      patient_name: 'Alice Smith',
      doctor_id: 'd1',
      doctor_name: 'Hla',
      teeth: [11, 12],
      description: 'Filling',
      cost: 50000,
      date: '2026-04-18'
    }
  ], 'MMK');

  await exportDoctorsToExcel([
    {
      id: 'd1',
      location_id: 'loc1',
      name: 'Hla Win',
      email: 'doctor@example.com',
      phone: '555-3000',
      specialization: 'Orthodontics',
      schedules: [
        { id: 's1', doctor_id: 'd1', day_of_week: 1, start_time: '09:00', end_time: '17:00' }
      ]
    }
  ]);

  await exportInventoryToExcel([
    {
      id: 'm1',
      location_id: 'loc1',
      name: 'Amoxicillin',
      category: 'Antibiotics',
      description: '500mg capsule',
      unit: 'box',
      price: 2500,
      stock: 20,
      min_stock: 5
    }
  ], 'MMK');

  await exportExpensesToExcel([
    {
      id: 'e1',
      location_id: 'loc1',
      description: 'Utility bill',
      amount: 89.75,
      category: 'Utilities',
      date: '2026-04-17'
    }
  ], 'USD');

  const patientsFile = `patient-directory-${today}.xlsx`;
  const patientsBook = readWorkbook(patientsFile);
  const patientsSheet = patientsBook.Sheets.Patients;
  expectHeaders(patientsSheet, ['Patient Name', 'Phone', 'Email', 'Medical Status', 'Balance', 'Portal Access', 'Loyalty Points'], patientsFile);
  expectNumericCell(patientsSheet, 'E2', 120.5, '$#,##0.00', patientsFile);
  expectNumericCell(patientsSheet, 'G2', 42, '#,##0', patientsFile);

  const appointmentsFile = `appointments-report-${today}.xlsx`;
  const appointmentsBook = readWorkbook(appointmentsFile);
  const appointmentsSheet = appointmentsBook.Sheets.Appointments;
  expectHeaders(appointmentsSheet, ['Date', 'Time', 'Patient', 'Type', 'Doctor', 'Status', 'Notes'], appointmentsFile);
  assert(appointmentsSheet.A2?.v === '2026-04-19', `${appointmentsFile}: expected sorted first row date`);
  assert(appointmentsSheet.C3?.v === 'Bob Jones', `${appointmentsFile}: expected second row patient to be Bob Jones`);

  const recordsFile = `clinical-records-${today}.xlsx`;
  const recordsBook = readWorkbook(recordsFile);
  const recordsSheet = recordsBook.Sheets['Clinical Records'];
  expectHeaders(recordsSheet, ['Date', 'Patient', 'Doctor', 'Treatment', 'Teeth', 'Amount'], recordsFile);
  expectNumericCell(recordsSheet, 'F2', 50000, '#,##0"Ks"', recordsFile);

  const doctorsFile = `doctors-directory-${today}.xlsx`;
  const doctorsBook = readWorkbook(doctorsFile);
  const doctorsSheet = doctorsBook.Sheets.Doctors;
  expectHeaders(doctorsSheet, ['Doctor Name', 'Specialization', 'Phone', 'Email', 'Schedule'], doctorsFile);
  assert(doctorsSheet.E2?.v === 'Monday 09:00-17:00', `${doctorsFile}: expected compact schedule text`);

  const inventoryFile = `inventory-report-${today}.xlsx`;
  const inventoryBook = readWorkbook(inventoryFile);
  const inventorySheet = inventoryBook.Sheets.Inventory;
  expectHeaders(inventorySheet, ['Medicine', 'Category', 'Description', 'Unit', 'Price', 'Stock', 'Min Stock', 'Inventory Value'], inventoryFile);
  expectNumericCell(inventorySheet, 'E2', 2500, '#,##0"Ks"', inventoryFile);
  expectNumericCell(inventorySheet, 'F2', 20, '#,##0', inventoryFile);
  expectNumericCell(inventorySheet, 'G2', 5, '#,##0', inventoryFile);
  expectNumericCell(inventorySheet, 'H2', 50000, '#,##0"Ks"', inventoryFile);

  const expensesFile = `expenses-${today}.xlsx`;
  const expensesBook = readWorkbook(expensesFile);
  const expensesSheet = expensesBook.Sheets.Expenses;
  expectHeaders(expensesSheet, ['Date', 'Description', 'Category', 'Amount'], expensesFile);
  expectNumericCell(expensesSheet, 'D2', 89.75, '$#,##0.00', expensesFile);

  console.log(`Verified Excel exports successfully in ${tempDir}`);
};

try {
  await verify();
} finally {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
}
