import React, { useMemo, useState } from 'react';
import { Beaker, Loader2, Package, Plus } from 'lucide-react';
import type { ClinicalRecord, PaymentRecord, TreatmentCostSummary } from '../types';
import { api } from '../services/api';
import { formatCurrency, type Currency } from '../utils/currency';
import { toLocalISODate } from '../utils/auditLogFilters';
import { buildAuditLogRows, filterAuditLogRowsForExport, type AuditExportRow } from '../utils/auditLogExport';
import { formatTeethWithPosition } from '../utils/toothNumbering';
import { formatDoctorName } from '../utils/doctorName';
import {
  calculateMaterialAdjustedDoctorEarnings,
  calculateMaterialNetProfit
} from '../utils/materialCostCalculations';
import Pagination from './Pagination';
import MaterialCostModal from './MaterialCostModal';

interface MaterialCostViewProps {
  records: ClinicalRecord[];
  paymentRecords: PaymentRecord[];
  loading: boolean;
  currency: Currency;
  canManageMaterials: boolean;
  onRefresh: () => void | Promise<void>;
}

type TreatmentAuditRow = Extract<AuditExportRow, { kind: 'treatment' }>;
type MaterialCostFilter = 'all' | 'tomorrow' | 'today' | 'custom';

const getTreatmentRecordIds = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
  const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
  return groupedRecords.map((item) => item.id).filter(Boolean);
};

const getPaymentCollectedAmount = (payment: PaymentRecord) => Math.max(0, Number(payment.clearedAmount ?? payment.amount ?? 0));

const getReceiptTreatmentIds = (payment: PaymentRecord) => (
  payment.receiptSnapshot?.treatments || []
).map((treatment) => treatment.id).filter(Boolean);

const paymentDedupeKey = (payment: PaymentRecord) => (
  payment.receiptNumber ||
  `${payment.patientId}|${payment.date}|${payment.amount}|${payment.createdAt || ''}|${payment.paymentMethod || ''}`
);

const MaterialCostView: React.FC<MaterialCostViewProps> = ({ records, paymentRecords, loading, currency, canManageMaterials, onRefresh }) => {
  const summaryRequestVersion = React.useRef(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [treatmentSearchTerm, setTreatmentSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState<MaterialCostFilter>('today');
  const [editingRecord, setEditingRecord] = useState<(ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) | null>(null);
  const [materialSummaries, setMaterialSummaries] = useState<Record<string, TreatmentCostSummary>>({});
  const todayKey = useMemo(() => toLocalISODate(new Date()), []);
  const tomorrowKey = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toLocalISODate(tomorrow);
  }, []);
  const [dateFrom, setDateFrom] = useState(todayKey);
  const [dateTo, setDateTo] = useState(todayKey);
  const itemsPerPage = 10;

  const treatmentRows = useMemo<TreatmentAuditRow[]>(() => (
    buildAuditLogRows(records, [], false, [], [])
      .filter((row): row is TreatmentAuditRow => row.kind === 'treatment')
  ), [records]);

  const collectedByTreatmentId = useMemo(() => {
    const treatmentCostById = new Map<string, number>();
    const treatmentIdsByPatientDate = new Map<string, string[]>();
    const uniquePayments = Array.from(new Map(paymentRecords.map((payment) => [paymentDedupeKey(payment), payment])).values());

    records.forEach((record) => {
      if (!record.id) return;
      treatmentCostById.set(record.id, Math.max(0, Number(record.cost || 0)));
      if (record.patient_id && record.date) {
        const key = `${record.patient_id}|${record.date}`;
        const ids = treatmentIdsByPatientDate.get(key) || [];
        ids.push(record.id);
        treatmentIdsByPatientDate.set(key, ids);
      }
    });

    return uniquePayments.reduce((summary, payment) => {
      const explicitTreatmentIds = Array.from(new Set([
        ...(payment.treatmentIds || []),
        ...getReceiptTreatmentIds(payment)
      ].filter(Boolean)));
      const linkedTreatmentIds = explicitTreatmentIds.length > 0
        ? explicitTreatmentIds
        : treatmentIdsByPatientDate.get(`${payment.patientId}|${payment.date}`) || [];
      const collectedAmount = getPaymentCollectedAmount(payment);

      if (linkedTreatmentIds.length === 0 || collectedAmount <= 0) return summary;

      const totalLinkedCost = linkedTreatmentIds.reduce((sum, treatmentId) => {
        return sum + Math.max(0, Number(treatmentCostById.get(treatmentId) || 0));
      }, 0);

      linkedTreatmentIds.forEach((treatmentId) => {
        const weight = totalLinkedCost > 0
          ? Math.max(0, Number(treatmentCostById.get(treatmentId) || 0)) / totalLinkedCost
          : 1 / linkedTreatmentIds.length;
        summary[treatmentId] = (summary[treatmentId] || 0) + (collectedAmount * weight);
      });

      return summary;
    }, {} as Record<string, number>);
  }, [records, paymentRecords]);

  const baseFilteredRows = useMemo(() => {
    return filterAuditLogRowsForExport(treatmentRows, {
      auditFilter: 'treatments',
      dateFrom,
      dateTo,
      searchTerm: ''
    }) as TreatmentAuditRow[];
  }, [treatmentRows, dateFrom, dateTo]);

  const statusFilteredRows = useMemo(() => {
    const doctorTerm = doctorSearchTerm.trim().toLowerCase();
    const treatmentTerm = treatmentSearchTerm.trim().toLowerCase();

    return baseFilteredRows.filter((row) => {
      const record = row.record;
      const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];

      const matchesDoctor = !doctorTerm || (record.doctor_name || '').toLowerCase().includes(doctorTerm);
      const matchesTreatment = !treatmentTerm || groupedRecords.some((item) =>
        (item.description || '').toLowerCase().includes(treatmentTerm)
      );

      return matchesDoctor && matchesTreatment;
    });
  }, [baseFilteredRows, doctorSearchTerm, treatmentSearchTerm]);

  const loadMaterialSummaries = React.useCallback(async (rowsToLoad: TreatmentAuditRow[]) => {
    const requestVersion = ++summaryRequestVersion.current;
    const treatmentIds = rowsToLoad.flatMap((row) => getTreatmentRecordIds(row.record));
    if (treatmentIds.length === 0) {
      return;
    }

    try {
      const summaries = await api.materialCosts.getTotalsByTreatmentIds(treatmentIds);
      if (requestVersion !== summaryRequestVersion.current) return;
      setMaterialSummaries((current) => {
        const next = { ...current };
        treatmentIds.forEach((treatmentId) => {
          delete next[treatmentId];
        });
        return { ...next, ...summaries };
      });
    } catch (error) {
      console.warn('Unable to refresh material cost summaries. Keeping current table totals.', error);
    }
  }, []);

  const renderPatientBalance = (balance?: number | null) => {
    if (balance === null || balance === undefined) return <span className="text-slate-400">-</span>;
    const numericBalance = Number(balance || 0);
    return (
      <span className={numericBalance > 0 ? 'font-bold text-red-600' : 'font-semibold text-green-600'}>
        {numericBalance > 0 ? formatCurrency(numericBalance, currency) : 'Clear'}
      </span>
    );
  };

  const renderTreatmentDescriptionList = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
    return (
      <div className="space-y-1">
        {groupedRecords.map((item, index) => (
          <div key={`${item.id || index}-${index}`} className="flex min-w-0 items-start gap-1.5">
            <span className="mt-0.5 shrink-0 text-green-600">&bull;</span>
            <span className="min-w-0 break-words">{item.description || 'Treatment record'}</span>
          </div>
        ))}
      </div>
    );
  };

  const getMaterialTotal = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    return getTreatmentRecordIds(record).reduce((sum, treatmentId) => {
      return sum + Number(materialSummaries[treatmentId]?.totalAmount || 0);
    }, 0);
  };

  const getTypedCostTotal = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }, costType: 'material' | 'lab') => {
    const key = costType === 'lab' ? 'labTotal' : 'materialTotal';
    return getTreatmentRecordIds(record).reduce((sum, treatmentId) => sum + Number(materialSummaries[treatmentId]?.[key] || 0), 0);
  };

  const getTreatmentAmount = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
    return groupedRecords.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  };

  const getCollectedAmount = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    return getTreatmentRecordIds(record).reduce((sum, treatmentId) => {
      return sum + Number(collectedByTreatmentId[treatmentId] || 0);
    }, 0);
  };

  const getAdjustedDoctorEarned = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
    return calculateMaterialAdjustedDoctorEarnings(
      groupedRecords,
      (treatmentId) => Number(materialSummaries[treatmentId]?.totalAmount || 0)
    );
  };

  const getNetProfit = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
    return calculateMaterialNetProfit(
      groupedRecords,
      (treatmentId) => Number(materialSummaries[treatmentId]?.totalAmount || 0)
    );
  };

  const paginatedRows = useMemo(() => {
    if (showAll) return statusFilteredRows;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return statusFilteredRows.slice(startIndex, startIndex + itemsPerPage);
  }, [statusFilteredRows, currentPage, showAll]);

  React.useEffect(() => {
    if (loading) return;
    void loadMaterialSummaries(paginatedRows);
  }, [loading, loadMaterialSummaries, paginatedRows]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [records, doctorSearchTerm, treatmentSearchTerm, dateFrom, dateTo, materialFilter]);

  const renderTypedCost = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }, costType: 'material' | 'lab') => {
    const totalAmount = getTypedCostTotal(record, costType);
    if (totalAmount <= 0) return <span className="text-slate-400">-</span>;
    const isLab = costType === 'lab';
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${isLab ? 'border-violet-100 bg-violet-50 text-violet-700' : 'border-cyan-100 bg-cyan-50 text-cyan-700'}`}>
        {isLab ? <Beaker size={13} /> : <Package size={13} />}
        {formatCurrency(totalAmount, currency)}
      </span>
    );
  };

  const handleMaterialSaved = async (summary: TreatmentCostSummary & { treatmentId: string }) => {
    setMaterialSummaries((current) => {
      const next = { ...current };
      if (summary.itemCount > 0 && summary.totalAmount > 0) {
        next[summary.treatmentId] = {
          auditLogId: summary.auditLogId,
          totalAmount: summary.totalAmount,
          itemCount: summary.itemCount,
          materialTotal: summary.materialTotal,
          materialItemCount: summary.materialItemCount,
          labTotal: summary.labTotal,
          labItemCount: summary.labItemCount
        };
      } else {
        delete next[summary.treatmentId];
      }
      return next;
    });
    await onRefresh();
    await loadMaterialSummaries(paginatedRows);
  };

  const materialFilterOptions: Array<{ value: MaterialCostFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'today', label: 'Today' }
  ];
  const handleMaterialFilterChange = (filter: MaterialCostFilter) => {
    setMaterialFilter(filter);
    if (filter === 'all') {
      setDateFrom('');
      setDateTo('');
    } else {
      const selectedDate = filter === 'tomorrow' ? tomorrowKey : todayKey;
      setDateFrom(selectedDate);
      setDateTo(selectedDate);
    }
    setCurrentPage(1);
  };
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm animate-fade-in">
      <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-[var(--hover-50)]/40">
        <div className="flex min-w-0 flex-col gap-4 p-3 sm:p-4 md:p-6 xl:flex-row xl:items-start xl:justify-between xl:gap-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="hidden h-11 w-11 items-center justify-center rounded-2xl border theme-accent-border theme-accent-soft-bg theme-accent-text sm:flex">
              <Package size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] theme-accent-text sm:text-[11px] sm:tracking-[0.24em]">Service Menu</p>
              <h2 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">Material & Lab</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
                Track material and lab costs against completed treatment rows.
              </p>
              <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1 text-xs sm:flex-wrap sm:overflow-visible sm:pb-0">
                <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">
                  {statusFilteredRows.length} visible
                </span>
                <span className="shrink-0 rounded-full border theme-accent-border theme-accent-soft-bg px-3 py-1 font-semibold theme-accent-text">
                  {statusFilteredRows.length} treatments
                </span>
              </div>
            </div>
          </div>

          <div className="w-full min-w-0 space-y-3 xl:max-w-5xl">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
              <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:flex xl:flex-1 xl:flex-wrap xl:items-center">
                  <div className="min-w-0 xl:w-36">
                    <input
                      type="text"
                      placeholder="Doctor"
                      value={doctorSearchTerm}
                      onChange={(event) => {
                        setDoctorSearchTerm(event.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--hover-300)]"
                    />
                  </div>
                  <div className="min-w-0 xl:w-40">
                    <input
                      type="text"
                      placeholder="Treatment"
                      value={treatmentSearchTerm}
                      onChange={(event) => {
                        setTreatmentSearchTerm(event.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--hover-300)]"
                    />
                  </div>
                  <div className="flex min-w-0 items-center gap-2 xl:w-auto">
                    <label className="shrink-0 text-sm font-semibold text-slate-600">Filter day</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDateFrom(value);
                        setDateTo(value);
                        setMaterialFilter('custom');
                        setCurrentPage(1);
                      }}
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--hover-300)] xl:w-36"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                        setMaterialFilter('all');
                        setCurrentPage(1);
                      }}
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--hover-300)]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid w-full grid-cols-3 rounded-xl border border-slate-200 bg-slate-50 p-1 sm:w-auto sm:min-w-[240px] xl:ml-3 xl:flex-none">
                    {materialFilterOptions.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleMaterialFilterChange(item.value)}
                        className={`rounded-lg px-2 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--hover-300)] sm:px-3.5 ${
                          materialFilter === item.value
                            ? 'bg-white font-bold theme-accent-text shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12 text-slate-500">
          <Loader2 className="animate-spin text-[var(--hover-600)]" />
          <p className="text-sm font-medium">Loading material and lab cost rows...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1420px] w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Date</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Patient</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Clinician</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Clinical Activity</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Patient Balance</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Treatment Amount</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Collected Payment</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Material Cost</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Lab Cost</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Total Cost</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Doctor Earned</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Net Profit</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {statusFilteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center">
                    <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
                      <p className="text-sm font-semibold text-slate-600">No treatment rows found</p>
                      <p className="mt-1 text-xs text-slate-400">Try another date range or clear the search field.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const record = row.record;
                  const treatmentAmount = getTreatmentAmount(record);
                  const collectedAmount = getCollectedAmount(record);
                  const adjustedDoctorEarned = getAdjustedDoctorEarned(record);
                  const netProfit = getNetProfit(record);
                  return (
                    <tr key={`material-cost-${record.id}`} className="border-l-4 border-[var(--hover-300)] transition-colors hover:bg-[var(--hover-50)]/30">
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500 xl:px-6">{record.date}</td>
                      <td className="px-4 py-4 font-bold text-slate-900 xl:px-6">{record.patient_name || 'Unknown'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 xl:px-6">{formatDoctorName(record.doctor_name)}</td>
                      <td className="max-w-md px-4 py-4 text-sm text-slate-700 xl:px-6">
                        {renderTreatmentDescriptionList(record)}
                        <span className="mt-1 block text-xs font-mono text-gray-500">
                          {record.teeth && record.teeth.length > 0 ? formatTeethWithPosition(record.teeth) : 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm xl:px-6">{renderPatientBalance(record.patient_balance)}</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-slate-900 xl:px-6">{formatCurrency(treatmentAmount, currency)}</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-blue-700 xl:px-6">{collectedAmount > 0 ? formatCurrency(collectedAmount, currency) : '-'}</td>
                      <td className="px-4 py-4 text-right text-sm font-bold xl:px-6">{renderTypedCost(record, 'material')}</td>
                      <td className="px-4 py-4 text-right text-sm font-bold xl:px-6">{renderTypedCost(record, 'lab')}</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-slate-800 xl:px-6">{getMaterialTotal(record) > 0 ? formatCurrency(getMaterialTotal(record), currency) : '-'}</td>
                      <td className="px-4 py-4 text-right text-sm font-bold text-emerald-700 xl:px-6">{adjustedDoctorEarned > 0 ? formatCurrency(adjustedDoctorEarned, currency) : '-'}</td>
                      <td className={`px-4 py-4 text-right text-sm font-black xl:px-6 ${netProfit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{formatCurrency(netProfit, currency)}</td>
                      <td className="px-4 py-4 text-right xl:px-6">
                        {canManageMaterials ? (
                          <button
                            type="button"
                            onClick={() => setEditingRecord(record)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--hover-200)] bg-[var(--hover-50)] px-3 py-1.5 text-xs font-bold text-[var(--hover-700)] hover:bg-[var(--hover-100)]"
                          >
                            <Package size={13} />
                            <Plus size={12} />
                            Material & Lab
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">No access</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && statusFilteredRows.length > 0 && (
        <Pagination
          totalItems={statusFilteredRows.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          showAll={showAll}
          onToggleShowAll={() => setShowAll(!showAll)}
        />
      )}

      <MaterialCostModal
        isOpen={!!editingRecord}
        record={editingRecord}
        currency={currency}
        onClose={() => setEditingRecord(null)}
        onSaved={handleMaterialSaved}
      />
    </div>
  );
};

export default MaterialCostView;
