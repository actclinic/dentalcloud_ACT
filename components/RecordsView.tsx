import React, { useState, useMemo } from 'react';
import { Loader2, Download, CalendarDays, Stethoscope, ShieldCheck, Search, RotateCw } from 'lucide-react';
import { Appointment, ClinicalRecord } from '../types';
import { formatCurrency, Currency } from '../utils/currency';
import { exportClinicalRecordsToPDF } from '../utils/pdfExport';
import { exportClinicalRecordsToExcel } from '../utils/excelExport';
import { formatTeethWithPosition } from '../utils/toothNumbering';
import Pagination from './Pagination';
import ExportMenu from './ExportMenu';
import { filterAuditRowsByDateRange, toLocalISODate } from '../utils/auditLogFilters';

interface RecordsViewProps {
  records: ClinicalRecord[];
  appointments?: Appointment[];
  loading: boolean;
  onRefresh: () => void;
  onDeleteAll: () => void;
  currency: Currency;
  isDoctor?: boolean;
  initialFilter?: AuditFilter;
}

type AuditFilter = 'all' | 'appointments' | 'treatments';

type AuditRow =
  | { kind: 'treatment'; sortDate: string; record: ClinicalRecord }
  | { kind: 'appointment'; sortDate: string; appointment: Appointment };

const RecordsView: React.FC<RecordsViewProps> = ({ records, appointments = [], loading, onRefresh, onDeleteAll, currency, isDoctor = false, initialFilter = 'all' }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditFilter, setAuditFilter] = useState<AuditFilter>(initialFilter);
  const todayKey = useMemo(() => toLocalISODate(new Date()), []);
  const [dateFrom, setDateFrom] = useState(todayKey);
  const [dateTo, setDateTo] = useState(todayKey);
  const itemsPerPage = 10;

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    if (value > dateTo) {
      setDateTo(value);
    }
    setCurrentPage(1);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    if (value < dateFrom) {
      setDateFrom(value);
    }
    setCurrentPage(1);
  };

  const handleResetToToday = () => {
    setDateFrom(todayKey);
    setDateTo(todayKey);
    setCurrentPage(1);
  };

  const formatCreatedAt = (value?: string | null) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const renderPatientBalance = (balance?: number | null) => {
    if (balance === null || balance === undefined) return <span className="text-gray-400">-</span>;
    const numericBalance = Number(balance || 0);
    return (
      <span className={numericBalance > 0 ? 'font-bold text-red-600' : 'font-semibold text-green-600'}>
        {numericBalance > 0 ? formatCurrency(numericBalance, currency) : 'Clear'}
      </span>
    );
  };

  const auditRows = useMemo<AuditRow[]>(() => {
    // Group treatment records by patient + date to show all treatments in one visit
    const groupedTreatmentMap = new Map<string, ClinicalRecord[]>();
    records.forEach((record) => {
      const key = `${record.patient_id || ''}|${record.date || ''}`;
      if (!groupedTreatmentMap.has(key)) {
        groupedTreatmentMap.set(key, []);
      }
      groupedTreatmentMap.get(key)!.push(record);
    });

    // For each group, create a merged row with all treatments listed together
    const treatmentRows: AuditRow[] = [];
    groupedTreatmentMap.forEach((group) => {
      const sorted = [...group].sort((a, b) => {
        const dateCmp = (a.date || '').localeCompare(b.date || '') || a.description.localeCompare(b.description);
        return dateCmp;
      });
      const base = { ...sorted[0] };
      const allDescriptions = sorted.map((r) => r.description).filter(Boolean);
      const allTeeth = sorted.flatMap((r) => r.teeth || []);
      const totalCost = sorted.reduce((sum, r) => sum + (r.cost || 0), 0);
      const totalEarnings = sorted.reduce((sum, r) => sum + (r.doctorEarnings || 0), 0);

      base.description = allDescriptions.join(' + ');
      base.teeth = [...new Set(allTeeth)].sort((a, b) => a - b);
      base.cost = totalCost;
      base.doctorEarnings = totalEarnings > 0 ? totalEarnings : base.doctorEarnings;

      (base as any)._groupedRecords = sorted;

      treatmentRows.push({
        kind: 'treatment',
        sortDate: `${base.date || ''}T23:59:59`,
        record: base
      });
    });

    const appointmentRows: AuditRow[] = isDoctor
      ? []
      : appointments.map((appointment) => ({
          kind: 'appointment',
          sortDate: appointment.created_at || `${appointment.date || ''}T${appointment.time || '00:00:00'}`,
          appointment
        }));

    return [...treatmentRows, ...appointmentRows].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  }, [records, appointments, isDoctor]);

  const filteredRows = useMemo(() => {
    const scopedRows = auditRows.filter((row) => {
      if (auditFilter === 'appointments') return row.kind === 'appointment';
      if (auditFilter === 'treatments') return row.kind === 'treatment';
      return true;
    });

    const dateScopedRows = filterAuditRowsByDateRange(scopedRows, dateFrom, dateTo);

    if (!searchTerm) return dateScopedRows;
    const term = searchTerm.toLowerCase();
    return dateScopedRows.filter((row) => {
      if (row.kind === 'treatment') {
        const record = row.record;
        return (
          (record.patient_name || '').toLowerCase().includes(term) ||
          (record.doctor_name || '').toLowerCase().includes(term) ||
          record.description.toLowerCase().includes(term) ||
          record.date.toLowerCase().includes(term) ||
          record.teeth.some((tooth) => tooth.toString().includes(term))
        );
      }

      const appointment = row.appointment;
      return (
        (appointment.patient_name || '').toLowerCase().includes(term) ||
        (appointment.doctor_name || '').toLowerCase().includes(term) ||
        (appointment.created_by_user_name || '').toLowerCase().includes(term) ||
        (appointment.type || '').toLowerCase().includes(term) ||
        (appointment.status || '').toLowerCase().includes(term) ||
        (appointment.date || '').toLowerCase().includes(term) ||
        (appointment.time || '').toLowerCase().includes(term) ||
        (appointment.created_at || '').toLowerCase().includes(term)
      );
    });
  }, [auditRows, auditFilter, searchTerm, dateFrom, dateTo]);

  const paginatedRows = useMemo(() => {
    if (showAll) return filteredRows;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRows, currentPage, showAll]);

  const filteredSummary = useMemo(() => {
    return filteredRows.reduce(
      (summary, row) => {
        if (row.kind === 'appointment') summary.appointments += 1;
        if (row.kind === 'treatment') summary.treatments += 1;
        return summary;
      },
      { appointments: 0, treatments: 0 }
    );
  }, [filteredRows]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [records, appointments, auditFilter, dateFrom, dateTo]);

  React.useEffect(() => {
    setAuditFilter(initialFilter);
    setCurrentPage(1);
  }, [initialFilter]);

  const handleDownloadPDF = () => {
    exportClinicalRecordsToPDF(records, currency);
  };

  const handleDownloadExcel = async () => {
    await exportClinicalRecordsToExcel(records, currency);
  };

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(records, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${isDoctor ? 'patient-records' : 'clinic-audit-logs'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setTimeout(() => {
      if (confirm(`Download complete! Do you want to delete all ${records.length} ${isDoctor ? 'record' : 'audit log record'} entries from the database? This will free up space but cannot be undone.`)) {
        onDeleteAll();
      }
    }, 500);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40">
        <div className="p-4 md:p-6 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 border border-cyan-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700 mb-1">Clinical governance</p>
            <h2 className="text-2xl font-bold text-slate-900">{isDoctor ? 'Patient Treatment Records' : 'Clinical Audit Trail'}</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              {isDoctor ? 'Your completed treatments and patient clinical history.' : 'A daily operational record of appointments, treatments, responsible staff, and patient balances.'}
            </p>
            {!isDoctor && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">{filteredRows.length} visible entries</span>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 font-semibold text-blue-700">{filteredSummary.appointments} appointments</span>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">{filteredSummary.treatments} treatments</span>
              </div>
            )}
          </div>
        </div>
        {!isDoctor && (
          <div className="w-full xl:max-w-5xl space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
                <div className="grid grid-cols-2 sm:flex gap-2">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.16em] mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="w-full sm:w-36 bg-white text-slate-800 text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.16em] mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="w-full sm:w-36 bg-white text-slate-800 text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <button
                type="button"
                onClick={handleResetToToday}
                className="col-span-2 sm:col-span-1 self-end px-4 py-2.5 text-xs rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-700 font-bold hover:bg-cyan-100 transition-colors"
              >
                Today
              </button>
            </div>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {[
                { value: 'all', label: 'All' },
                { value: 'appointments', label: 'Appointments' },
                { value: 'treatments', label: 'Treatments' }
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setAuditFilter(item.value as AuditFilter);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-2 text-xs rounded-lg transition-colors ${
                    auditFilter === item.value ? 'bg-white text-cyan-800 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
                </div>
            </div>
            </div>
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <input
                type="text"
                placeholder="Search patient, doctor, staff, service..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full bg-white shadow-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
            <ExportMenu
              disabled={records.length === 0}
              onExportPDF={handleDownloadPDF}
              onExportExcel={handleDownloadExcel}
              className="w-full sm:w-auto !rounded-xl !bg-slate-800 hover:!bg-slate-900 !font-semibold !shadow-sm"
            />
            <button
              onClick={handleDownloadJSON}
              disabled={records.length === 0}
              className="flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Download size={16} /> JSON Backup
            </button>
            <button
              onClick={onRefresh}
              className="text-cyan-700 bg-cyan-50 text-sm font-bold flex items-center justify-center gap-2 border border-cyan-100 rounded-xl px-4 py-2 hover:bg-cyan-100 transition-colors"
            >
              <RotateCw size={16} /> Refresh
            </button>
            </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="animate-spin text-cyan-700" />
          <p className="text-sm font-medium">Loading audit records...</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Type</th>
                  <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Date / Time</th>
                  <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Patient</th>
                  <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Clinician</th>
                  <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Clinical Activity</th>
                  <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Recorded By</th>
                  <th className="px-6 py-4 text-right text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Patient Balance</th>
                  <th className="px-6 py-4 text-right text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Amount</th>
                  <th className="px-6 py-4 text-right text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Doctor Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
                        <p className="text-sm font-semibold text-slate-600">No audit records found</p>
                        <p className="text-xs text-slate-400 mt-1">Try another date range or clear the search field.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => {
                    if (row.kind === 'appointment') {
                      const appointment = row.appointment;
                      return (
                        <tr key={`appointment-${appointment.id}`} className="hover:bg-cyan-50/40 transition-colors">
                          <td className="px-6 py-4 text-sm text-blue-700 font-semibold">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold">
                              <CalendarDays size={14} /> Appointment
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{appointment.date} {appointment.time}</td>
                          <td className="px-6 py-4 font-bold text-slate-900">{appointment.patient_name || 'Unknown'}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{appointment.doctor_name ? `Dr. ${appointment.doctor_name}` : '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-700 max-w-md">
                            Appointment made for {appointment.date} at {appointment.time} ({appointment.type || 'Checkup'}, {appointment.status})
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            <span className="font-semibold">{appointment.created_by_user_name || 'Unknown'}</span>
                            <span className="block text-xs text-slate-500">{formatCreatedAt(appointment.created_at)}</span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm">{renderPatientBalance(appointment.patient_balance)}</td>
                          <td className="px-6 py-4 text-right text-sm font-black text-slate-900">-</td>
                          <td className="px-6 py-4 text-right text-sm text-slate-400">-</td>
                        </tr>
                      );
                    }

                    const rec = row.record;
                    return (
                      <tr key={`treatment-${rec.id}`} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-emerald-700 font-semibold">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-bold">
                            <Stethoscope size={14} /> Treatment
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{rec.date}</td>
                        <td className="px-6 py-4 font-bold text-slate-900">{rec.patient_name || 'Unknown'}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{rec.doctor_name ? `Dr. ${rec.doctor_name}` : '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-700 max-w-md">
                          <div className="space-y-0.5">
                            {(rec as any)._groupedRecords ? (
                              (rec as any)._groupedRecords.map((r: ClinicalRecord, i: number) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <span className="text-cyan-500 mt-0.5 shrink-0">•</span>
                                  <span>{r.description}</span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-start gap-1.5">
                                <span className="text-cyan-500 mt-0.5 shrink-0">•</span>
                                <span>{rec.description}</span>
                              </div>
                            )}
                          </div>
                          <span className="block text-xs font-mono text-gray-500 mt-1">
                            {rec.teeth && rec.teeth.length > 0 ? formatTeethWithPosition(rec.teeth) : 'General'}
                          </span>
                          {(rec as any)._groupedRecords && (rec as any)._groupedRecords.length > 0 && (
                            <span className="block text-[11px] font-semibold text-slate-600 mt-1.5 pt-1.5 border-t border-slate-100">
                              Total: {formatCurrency(rec.cost || 0, currency)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">Clinical record</td>
                        <td className="px-6 py-4 text-right text-sm">{renderPatientBalance(rec.patient_balance)}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{formatCurrency(rec.cost || 0, currency)}</td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-emerald-700">{rec.doctorEarnings ? formatCurrency(rec.doctorEarnings, currency) : '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-slate-100 bg-slate-50/40">
            {filteredRows.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-semibold text-slate-600">No audit records found</p>
                <p className="text-xs text-slate-400 mt-1">Try another date range or search term.</p>
              </div>
            ) : (
              paginatedRows.map((row) => {
                if (row.kind === 'appointment') {
                  const appointment = row.appointment;
                  return (
                    <div key={`appointment-${appointment.id}`} className="m-3 rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-blue-600">Appointment</p>
                          <p className="text-sm font-bold text-slate-900">{appointment.patient_name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500 mt-1">{appointment.date} at {appointment.time}</p>
                        </div>
                        <p className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{appointment.status}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">Recorded By</p>
                        <p className="text-sm text-slate-800">{appointment.created_by_user_name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatCreatedAt(appointment.created_at)}</p>
                      </div>
                      <div className="flex justify-between items-center bg-rose-50 rounded-xl p-3">
                        <span className="text-xs font-semibold text-rose-700">Patient Balance</span>
                        <span className="text-sm">{renderPatientBalance(appointment.patient_balance)}</span>
                      </div>
                    </div>
                  );
                }

                const rec = row.record;
                return (
                  <div key={`treatment-${rec.id}`} className="m-3 rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-emerald-500">Treatment</p>
                        <p className="text-sm font-bold text-slate-900">{rec.patient_name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500 mt-1">{rec.date}</p>
                      </div>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(rec.cost || 0, currency)}</p>
                    </div>
                    {rec.doctorEarnings ? (
                      <div className="flex justify-between items-center bg-emerald-50 rounded-xl p-3">
                        <span className="text-xs font-semibold text-emerald-700">Doctor Earned</span>
                        <span className="text-sm font-bold text-emerald-800">{formatCurrency(rec.doctorEarnings, currency)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center bg-rose-50 rounded-xl p-3">
                      <span className="text-xs font-semibold text-rose-700">Patient Balance</span>
                      <span className="text-sm">{renderPatientBalance(rec.patient_balance)}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">Treatment</p>
                      <p className="text-sm text-slate-800">{rec.description}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {!loading && filteredRows.length > 0 && (
        <Pagination
          totalItems={filteredRows.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          showAll={showAll}
          onToggleShowAll={() => setShowAll(!showAll)}
        />
      )}
    </div>
  );
};

export default RecordsView;
