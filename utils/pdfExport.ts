import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, Appointment, ClinicalRecord, Doctor, Medicine, Expense, PaymentRecord } from '../types';
import { formatCurrency, Currency } from './currency';
import { formatTeethWithPosition } from './toothNumbering';
import { buildAuditLogExportTableRows, buildAuditLogRows, filterAuditLogRowsForExport, type AuditLogFilterOptions } from './auditLogExport';

// Add type declaration for jsPDF with autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

const formatPatientAddressForExport = (patient: Patient) => {
  return [patient.address, patient.township, patient.city].filter(Boolean).join(', ') || '-';
};

const getPatientRecordsForExport = (patientId: string, records: ClinicalRecord[] = []) => {
  return records
    .filter((record) => record.patient_id === patientId)
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
};

const summarizeTreatmentsForExport = (records: ClinicalRecord[]) => {
  const treatments = records.map((record) => record.description?.trim()).filter(Boolean);
  if (treatments.length === 0) return '-';
  const visibleTreatments = treatments.slice(0, 3).join(', ');
  return treatments.length > 3 ? `${visibleTreatments} +${treatments.length - 3} more` : visibleTreatments;
};

const summarizeDoctorsForExport = (records: ClinicalRecord[]) => {
  const doctors = Array.from(new Set(records.map((record) => record.doctor_name?.trim()).filter(Boolean)));
  if (doctors.length === 0) return '-';
  const visibleDoctors = doctors.slice(0, 2).map((doctor) => `Dr. ${doctor}`).join(', ');
  return doctors.length > 2 ? `${visibleDoctors} +${doctors.length - 2} more` : visibleDoctors;
};

export const exportPatientsToPDF = (patients: Patient[], currency: Currency, treatmentRecords: ClinicalRecord[] = []) => {
  // Export the patient list currently supplied by the patient tab, including related clinical columns.
  const exportPatients = patients;
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('Patient Directory Report', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Total Patients: ${patients.length}`, 14, 34);
  
  // Table
  autoTable(doc, {
    startY: 40,
    head: [['No', 'Patient ID', 'Patient Name', 'Date', 'Age', 'Type', 'Contact', 'Address', 'Treatment', 'Doctor', 'Balance', 'Points', 'Portal']],
    body: exportPatients.map((patient, index) => {
      const patientRecords = getPatientRecordsForExport(patient.id, treatmentRecords);
      return [
        index + 1,
        patient.patient_unique_id || patient.id.substring(0, 8),
        patient.name,
        patient.created_at ? new Date(patient.created_at).toLocaleDateString() : '-',
        patient.age ?? '-',
        patient.patient_type || '-',
        [patient.phone, patient.email].filter(Boolean).join('\n') || '-',
        formatPatientAddressForExport(patient),
        summarizeTreatmentsForExport(patientRecords),
        summarizeDoctorsForExport(patientRecords),
        formatCurrency(patient.balance || 0, currency),
        patient.loyalty_points || 0,
        patient.has_account ? 'Active' : 'No Access'
      ];
    }),
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 6.5, cellPadding: 1.5, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 40 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 18 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 10 },
      5: { cellWidth: 16 },
      6: { cellWidth: 28 },
      7: { cellWidth: 34 },
      8: { cellWidth: 42 },
      9: { cellWidth: 28 },
      10: { cellWidth: 20 },
      11: { cellWidth: 12 },
      12: { cellWidth: 18 }
    }
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
  
  doc.save(`patient-directory-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportAppointmentsToPDF = (appointments: Appointment[]) => {
  // Use all appointments for export (not just filtered/paginated view)
  const exportAppointments = appointments;
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('Appointments Report', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Total Appointments: ${appointments.length}`, 14, 34);
  
  // Upcoming Appointments
  const upcoming = exportAppointments.filter(apt => {
    const aptDate = new Date(apt.date);
    return aptDate >= new Date() && apt.status === 'Scheduled';
  }).sort((a, b) => a.date.localeCompare(b.date));
  
  if (upcoming.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text('Upcoming Appointments', 14, 42);
    
    autoTable(doc, {
      startY: 46,
      head: [['Date', 'Time', 'Patient', 'Contact', 'Type', 'Doctor', 'Status']],
      body: upcoming.map(apt => [
        new Date(apt.date).toLocaleDateString(),
        apt.time,
        apt.patient_name || 'Unknown',
        apt.patient_id ? 'Registered' : [apt.guest_phone, apt.guest_source].filter(Boolean).join(' / ') || 'Lead',
        apt.type || 'Checkup',
        apt.doctor_name ? `Dr. ${apt.doctor_name}` : 'N/A',
        apt.status
      ]),
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    });
  }
  
  // Past Appointments
  const past = exportAppointments.filter(apt => {
    const aptDate = new Date(apt.date);
    return aptDate < new Date() || apt.status !== 'Scheduled';
  }).sort((a, b) => b.date.localeCompare(a.date));
  
  if (past.length > 0) {
    const startY = upcoming.length > 0 ? (doc as any).lastAutoTable.finalY + 10 : 46;
    
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text('Past Appointments', 14, startY);
    
    autoTable(doc, {
      startY: startY + 4,
      head: [['Date', 'Time', 'Patient', 'Contact', 'Type', 'Status']],
      body: past.map(apt => [
        new Date(apt.date).toLocaleDateString(),
        apt.time,
        apt.patient_name || 'Unknown',
        apt.patient_id ? 'Registered' : [apt.guest_phone, apt.guest_source].filter(Boolean).join(' / ') || 'Lead',
        apt.type || 'Checkup',
        apt.status
      ]),
      theme: 'grid',
      headStyles: { fillColor: [107, 114, 128], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    });
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
  
  doc.save(`appointments-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

interface ClinicalRecordsExportOptions extends AuditLogFilterOptions {
  appointments?: Appointment[];
  payments?: PaymentRecord[];
  includeAppointments?: boolean;
}

export const exportClinicalRecordsToPDF = (records: ClinicalRecord[], currency: Currency, options: ClinicalRecordsExportOptions = {}) => {
  const exportRows = filterAuditLogRowsForExport(
    buildAuditLogRows(records, options.appointments || [], options.includeAppointments ?? false, options.payments || []),
    options
  );
  const tableRows = buildAuditLogExportTableRows(exportRows, currency);
  const doc = new jsPDF('l', 'mm', 'a4');
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text(options.includeAppointments ? 'Clinical Audit Trail Report' : 'Clinical Records Audit Report', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Visible Entries: ${exportRows.length}`, 14, 34);
  if (options.dateFrom && options.dateTo) {
    doc.text(`Date Range: ${options.dateFrom} to ${options.dateTo}`, 14, 40);
  }
  
  const totalRevenue = tableRows.reduce((sum, row) => sum + (row.amount || 0), 0);
  doc.text(`Treatment Revenue: ${formatCurrency(totalRevenue, currency)}`, 14, options.dateFrom && options.dateTo ? 46 : 40);
  
  // Table
  autoTable(doc, {
    startY: options.dateFrom && options.dateTo ? 52 : 46,
    head: [['Type', 'Date / Time', 'Patient', 'Clinician', 'Clinical Activity', 'Recorded By', 'Patient Balance', 'Amount', 'Payment Type', 'Doctor Earned']],
    body: tableRows.map((row) => [
      row.type,
      row.dateTime,
      row.patient,
      row.clinician,
      row.activity,
      row.recordedBy,
      row.patientBalance,
      row.amount === null ? '-' : formatCurrency(row.amount, currency),
      row.paymentMethod,
      row.doctorEarned === null ? '-' : formatCurrency(row.doctorEarned, currency)
    ]),
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 28 },
      2: { cellWidth: 32 },
      3: { cellWidth: 30 },
      4: { cellWidth: 60 },
      5: { cellWidth: 34 },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
    }
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
  
  doc.save(`${options.includeAppointments ? 'clinic-audit-logs' : 'clinical-records'}-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportDoctorsToPDF = (doctors: Doctor[]) => {
  // Use all doctors for export (not just filtered/paginated view)
  const exportDoctors = doctors;
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('Doctors Directory Report', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Total Doctors: ${doctors.length}`, 14, 34);
  
  // Table
  autoTable(doc, {
    startY: 40,
    head: [['Doctor Name', 'Specialization', 'Commission %', 'Contact', 'Email']],
    body: exportDoctors.map(doctor => [
      `Dr. ${doctor.name}`,
      doctor.specialization || 'General',
      doctor.commission_percentage != null ? `${doctor.commission_percentage}%` : '0%',
      doctor.phone || 'N/A',
      doctor.email || 'N/A'
    ]),
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 247, 250] }
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
  
  doc.save(`doctors-directory-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportInventoryToPDF = (medicines: Medicine[], currency: Currency) => {
  // Use all medicines for export (not just filtered/paginated view)
  const exportMedicines = medicines;
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('Medicine Inventory Report', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Total Items: ${medicines.length}`, 14, 34);
  
  const totalValue = medicines.reduce((sum, med) => sum + ((med.price || 0) * (med.stock || 0)), 0);
  doc.text(`Total Inventory Value: ${formatCurrency(totalValue, currency)}`, 14, 40);
  
  // Low Stock Items
  const lowStock = medicines.filter(med => med.min_stock !== undefined && med.stock <= med.min_stock);
  if (lowStock.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38);
    doc.text(`⚠ ${lowStock.length} item(s) low in stock`, 14, 46);
  }
  
  // Table
  autoTable(doc, {
    startY: 52,
    head: [['Medicine', 'Category', 'Unit', 'Price', 'Stock', 'Min Stock', 'Value']],
    body: exportMedicines.map(med => [
      med.name,
      med.category || 'N/A',
      med.unit,
      formatCurrency(med.price || 0, currency),
      `${med.stock} ${med.unit}`,
      med.min_stock !== undefined ? `${med.min_stock} ${med.unit}` : 'N/A',
      formatCurrency((med.price || 0) * (med.stock || 0), currency)
    ]),
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      3: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' }
    }
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
  
  doc.save(`inventory-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportExpensesToPDF = (expenses: Expense[], currency: Currency) => {
  const exportExpenses = expenses;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('Expense Report', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Total Expenses: ${expenses.length}`, 14, 34);

  const total = exportExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  doc.text(`Total Amount: ${formatCurrency(total, currency)}`, 14, 40);

  autoTable(doc, {
    startY: 46,
    head: [['Date', 'Description', 'Category', 'Amount']],
    body: exportExpenses.map(expense => [
      expense.date,
      expense.description,
      expense.category,
      formatCurrency(expense.amount || 0, currency)
    ]),
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      3: { halign: 'right', fontStyle: 'bold' }
    }
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }

  doc.save(`expense-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

