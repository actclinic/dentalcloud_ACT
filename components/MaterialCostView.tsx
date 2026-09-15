import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Beaker, Package, Plus, RotateCw, Search, Stethoscope } from 'lucide-react';
import type { ClinicalRecord, PaymentCostSummary, PaymentRecord, TreatmentCostType } from '../types';
import { api } from '../services/api';
import { formatCurrency, type Currency } from '../utils/currency';
import { toLocalISODate } from '../utils/auditLogFilters';
import { formatDoctorName } from '../utils/doctorName';
import { buildMaterialCostPaymentHistoryRows, filterMaterialCostPaymentHistoryRows, type MaterialCostPaymentHistoryRow } from '../utils/materialCostPaymentHistory';
import Pagination from './Pagination';
import MaterialCostModal from './MaterialCostModal';
import ProgressBar from './ProgressBar';

interface MaterialCostViewProps {
  records: ClinicalRecord[];
  paymentRecords: PaymentRecord[];
  loading: boolean;
  currency: Currency;
  canManageMaterials: boolean;
  onRefresh: () => void | Promise<void>;
  onCostsSaved?: (patientId?: string | null) => Promise<void> | void;
  syncProgress?: number | null;
}

type DateFilter = 'all' | 'tomorrow' | 'today' | 'custom';
const isDatabasePaymentId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const typedTotal = (summary: PaymentCostSummary | undefined, type: TreatmentCostType) => Number(
  type === 'lab' ? summary?.labTotal : type === 'special_doctor' ? summary?.specialDoctorTotal : summary?.materialTotal
) || 0;

const MaterialCostView: React.FC<MaterialCostViewProps> = ({ records, paymentRecords, loading, currency, canManageMaterials, onRefresh, onCostsSaved, syncProgress = null }) => {
  const requestVersion = React.useRef(0);
  const today = useMemo(() => toLocalISODate(new Date()), []);
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return toLocalISODate(date);
  }, []);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [patientTerm, setPatientTerm] = useState('');
  const [doctorTerm, setDoctorTerm] = useState('');
  const [treatmentTerm, setTreatmentTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editingRow, setEditingRow] = useState<MaterialCostPaymentHistoryRow | null>(null);
  const [summaries, setSummaries] = useState<Record<string, PaymentCostSummary>>({});
  const itemsPerPage = 10;

  const rows = useMemo(() => buildMaterialCostPaymentHistoryRows(records, paymentRecords), [records, paymentRecords]);
  const filteredRows = useMemo(() => filterMaterialCostPaymentHistoryRows(rows, { dateFrom, dateTo, patientTerm, doctorTerm, treatmentTerm }), [rows, dateFrom, dateTo, patientTerm, doctorTerm, treatmentTerm]);
  const visibleRows = useMemo(() => showAll ? filteredRows : filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredRows, currentPage, showAll]);

  const loadSummaries = React.useCallback(async (paymentIds: string[]) => {
    const version = ++requestVersion.current;
    if (!paymentIds.length) return;
    try {
      const next = await api.materialCosts.getTotalsByPaymentIds(paymentIds);
      if (version === requestVersion.current) setSummaries((current) => {
        const updated = { ...current };
        paymentIds.forEach((paymentId) => { delete updated[paymentId]; });
        return { ...updated, ...next };
      });
    } catch (error) { console.warn('Unable to load payment MLS totals.', error); }
  }, []);
  React.useEffect(() => { if (!loading) void loadSummaries(visibleRows.map((row) => row.paymentId)); }, [loading, loadSummaries, visibleRows]);
  React.useEffect(() => setCurrentPage(1), [dateFrom, dateTo, patientTerm, doctorTerm, treatmentTerm, paymentRecords]);

  const chooseDateFilter = (filter: DateFilter) => {
    setDateFilter(filter);
    const selectedDate = filter === 'today' ? today : filter === 'tomorrow' ? tomorrow : '';
    setDateFrom(selectedDate);
    setDateTo(selectedDate);
  };
  const totalCost = (row: MaterialCostPaymentHistoryRow) => Number(summaries[row.paymentId]?.totalAmount || 0);
  const netReceive = (row: MaterialCostPaymentHistoryRow) => Math.max(0, row.totalPaid - totalCost(row));
  const renderBalance = (row: MaterialCostPaymentHistoryRow) => row.balanceAfter > 0
    ? <span className="font-bold text-red-600">{formatCurrency(row.balanceAfter, currency)}</span>
    : <span className="font-semibold text-emerald-700">Clear</span>;
  const renderCost = (row: MaterialCostPaymentHistoryRow, type: TreatmentCostType) => {
    const amount = typedTotal(summaries[row.paymentId], type);
    if (!amount) return <span className="text-slate-400">-</span>;
    const style = type === 'lab'
      ? 'border-violet-100 bg-violet-50 text-violet-700'
      : type === 'special_doctor'
        ? 'border-amber-100 bg-amber-50 text-amber-700'
        : 'border-cyan-100 bg-cyan-50 text-cyan-700';
    const Icon = type === 'lab' ? Beaker : type === 'special_doctor' ? Stethoscope : Package;
    return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${style}`}><Icon size={13} />{formatCurrency(amount, currency)}</span>;
  };
  const saveSummary = async (summary: PaymentCostSummary & { paymentId: string; patientId?: string | null }) => {
    setSummaries((current) => ({ ...current, [summary.paymentId]: summary }));
    if (onCostsSaved) await onCostsSaved(summary.patientId); else await onRefresh();
    await loadSummaries([summary.paymentId]);
  };
  const refresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    try { await onRefresh(); await loadSummaries(visibleRows.map((row) => row.paymentId)); }
    catch (error) { alert(error instanceof Error ? error.message : 'Unable to refresh MLS payments.'); }
    finally { setRefreshing(false); }
  };

  return <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm animate-fade-in">
    <header className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-[var(--hover-50)]/40 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border theme-accent-border theme-accent-soft-bg theme-accent-text"><Package size={23} /></div><div><p className="mb-1 text-[11px] font-black uppercase tracking-[0.28em] theme-accent-text">Service Menu</p><h2 className="break-words text-xl font-black text-slate-900 sm:text-2xl">MLS Costs</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">Track MLS costs and doctor earnings for each collected payment.</p><button type="button" onClick={() => void refresh()} disabled={loading || refreshing} className="refresh-action-button mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold disabled:opacity-50"><RotateCw size={14} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Refreshing...' : 'Refresh'}</button></div></div>
        <div className="w-full min-w-0 xl:max-w-5xl"><div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              <label className="relative min-w-0"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={patientTerm} onChange={(e) => setPatientTerm(e.target.value)} placeholder="Patient name or ID" aria-label="Search patient" className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[var(--hover-300)]" /></label>
              <input value={doctorTerm} onChange={(e) => setDoctorTerm(e.target.value)} placeholder="Doctor" aria-label="Search doctor" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[var(--hover-300)]" />
              <input value={treatmentTerm} onChange={(e) => setTreatmentTerm(e.target.value)} placeholder="Treatment" aria-label="Search treatment" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[var(--hover-300)]" />
              <label className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">From<input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDateFilter('custom'); }} aria-label="Start date" className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-[var(--hover-300)]" /></label>
              <label className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">To<input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDateFilter('custom'); }} aria-label="End date" className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-xs text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-[var(--hover-300)]" /></label>
              <button type="button" onClick={() => chooseDateFilter('today')} className={`min-h-10 rounded-xl text-xs font-bold ${dateFilter === 'today' ? 'theme-accent-soft-bg theme-accent-text' : 'bg-slate-50 text-slate-500 hover:bg-[var(--hover-50)]'}`}>Today</button>
            </div>
            <div className="grid w-full grid-cols-3 rounded-xl border border-slate-200 bg-slate-50 p-1 xl:mt-11 xl:w-[290px]">{(['all', 'tomorrow', 'today'] as DateFilter[]).map((filter) => <button key={filter} type="button" onClick={() => chooseDateFilter(filter)} className={`rounded-lg px-3 py-2 text-xs transition-colors ${dateFilter === filter ? 'bg-white font-bold theme-accent-text shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{filter === 'all' ? 'All' : filter === 'tomorrow' ? 'Tomorrow' : 'Today'}</button>)}</div>
          </div>
        </div></div>
      </div>
    </header>

    {(loading || typeof syncProgress === 'number') ? <div className="p-10"><ProgressBar progress={typeof syncProgress === 'number' ? syncProgress : null} label="Loading payment MLS records…" /></div> : <>
      <div className="hidden xl:block"><div className="flex items-center justify-between gap-3 border-b border-[var(--hover-100)] bg-[var(--hover-50)] px-5 py-2.5 text-xs font-semibold text-[var(--hover-800)]"><span className="inline-flex items-center gap-2"><ArrowLeftRight size={16} className="text-[var(--hover-600)]" />Scroll sideways to view all columns.</span><span>The Action column stays visible</span></div><div className="overflow-x-auto" role="region" aria-label="Payment MLS cost table" tabIndex={0}>
        <table className="w-full min-w-[1500px]"><thead className="border-b border-slate-200 bg-slate-50"><tr>{['Payment Date', 'Patient', 'Clinician', 'Clinical Activity'].map((label) => <th key={label} className="px-5 py-5 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</th>)}{['Patient Balance', 'Collected Payment', 'Material Cost', 'Lab Cost', 'Special Doctor Cost', 'Total Cost', 'Net Receive', 'Doctor Earned'].map((label) => <th key={label} className="px-5 py-5 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</th>)}<th className="sticky right-0 z-20 min-w-[145px] border-l border-slate-200 bg-slate-50 px-5 py-5 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{!visibleRows.length ? <tr><td colSpan={13} className="px-6 py-12 text-center"><p className="text-sm font-semibold text-slate-600">No payment rows found</p><p className="mt-1 text-xs text-slate-400">Try another payment date range or clear the search fields.</p></td></tr> : visibleRows.map((row) => <tr key={row.paymentId} className="group border-l-4 border-[var(--hover-300)] hover:bg-[var(--hover-50)]/30">
            <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{row.paymentDate}</td><td className="px-5 py-4 font-bold text-slate-900">{row.patientName}<span className="block font-mono text-[10px] font-normal text-slate-400">{row.patientId}</span></td><td className="px-5 py-4 text-sm text-slate-700">{row.doctorNames.map(formatDoctorName).join(', ') || 'Unassigned'}</td><td className="max-w-sm px-5 py-4 text-sm text-slate-700">{row.treatmentNames.join(', ') || '-'}</td>
            <td className="px-5 py-4 text-right text-sm">{renderBalance(row)}</td><td className="px-5 py-4 text-right text-sm font-black text-blue-700">{formatCurrency(row.totalPaid, currency)}</td><td className="px-5 py-4 text-right text-sm">{renderCost(row, 'material')}</td><td className="px-5 py-4 text-right text-sm">{renderCost(row, 'lab')}</td><td className="px-5 py-4 text-right text-sm">{renderCost(row, 'special_doctor')}</td><td className="px-5 py-4 text-right text-sm font-black text-slate-800">{totalCost(row) ? formatCurrency(totalCost(row), currency) : '-'}</td><td className="px-5 py-4 text-right text-sm font-black text-teal-700">{formatCurrency(netReceive(row), currency)}</td><td className="px-5 py-4 text-right text-sm font-black text-emerald-700">{row.doctorEarned ? formatCurrency(row.doctorEarned, currency) : '-'}</td>
            <td className="sticky right-0 z-10 border-l border-slate-100 bg-white px-5 py-4 text-right shadow-[-10px_0_16px_-14px_rgba(15,23,42,0.55)] group-hover:bg-[var(--hover-50)]"><button type="button" disabled={!canManageMaterials || !isDatabasePaymentId(row.paymentId)} title={!isDatabasePaymentId(row.paymentId) ? 'This legacy local payment must be synchronized before costs can be added.' : undefined} onClick={() => setEditingRow(row)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--hover-200)] bg-[var(--hover-50)] px-3 py-2 text-xs font-bold text-[var(--hover-700)] hover:bg-[var(--hover-100)] disabled:opacity-40"><Package size={13} /><Plus size={12} />{isDatabasePaymentId(row.paymentId) ? 'MLS Costs' : 'Legacy only'}</button></td>
          </tr>)}</tbody></table></div>
      </div>
      <div className="space-y-3 bg-slate-50/70 p-3 sm:p-4 xl:hidden">{!visibleRows.length ? <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm font-semibold text-slate-500">No payment records found.</div> : visibleRows.map((row) => <article key={row.paymentId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{row.patientName}</p><p className="mt-1 text-xs text-slate-500">{row.paymentDate} · Receipt {row.receiptNumber || '-'}</p></div><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-black text-blue-700">{formatCurrency(row.totalPaid, currency)}</span></div>
        <dl className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Doctor</dt><dd className="text-right font-semibold">{row.doctorNames.map(formatDoctorName).join(', ') || 'Unassigned'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Clinical activity</dt><dd className="text-right">{row.treatmentNames.join(', ') || '-'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Patient balance</dt><dd className="text-right">{renderBalance(row)}</dd></div></dl>
        <dl className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3"><dt className="text-[10px] font-bold uppercase text-cyan-700"><Package size={13} className="mr-1 inline" />Material</dt><dd className="mt-1 text-sm">{renderCost(row, 'material')}</dd></div><div className="rounded-xl border border-violet-100 bg-violet-50 p-3"><dt className="text-[10px] font-bold uppercase text-violet-700"><Beaker size={13} className="mr-1 inline" />Lab</dt><dd className="mt-1 text-sm">{renderCost(row, 'lab')}</dd></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><dt className="text-[10px] font-bold uppercase text-amber-700"><Stethoscope size={13} className="mr-1 inline" />Special Doctor</dt><dd className="mt-1 text-sm">{renderCost(row, 'special_doctor')}</dd></div><div className="rounded-xl border border-teal-100 bg-teal-50 p-3"><dt className="text-[10px] font-bold uppercase text-teal-700">Net Receive</dt><dd className="mt-1 text-sm font-black text-teal-700">{formatCurrency(netReceive(row), currency)}</dd></div></dl>
        <button type="button" disabled={!canManageMaterials || !isDatabasePaymentId(row.paymentId)} onClick={() => setEditingRow(row)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-[var(--hover-200)] bg-[var(--hover-50)] text-sm font-bold text-[var(--hover-700)] disabled:opacity-40"><Package size={15} /><Plus size={13} />{isDatabasePaymentId(row.paymentId) ? 'MLS Costs for Payment' : 'Legacy payment (read only)'}</button>
      </article>)}</div>
    </>}
    {!loading && filteredRows.length > 0 && <Pagination totalItems={filteredRows.length} itemsPerPage={itemsPerPage} currentPage={currentPage} onPageChange={setCurrentPage} showAll={showAll} onToggleShowAll={() => setShowAll(!showAll)} />}
    <MaterialCostModal isOpen={!!editingRow} payment={editingRow?.payment || null} context={editingRow} currency={currency} onClose={() => setEditingRow(null)} onSaved={saveSummary} />
  </div>;
};

export default MaterialCostView;
