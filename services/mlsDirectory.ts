import { api } from './api';
import { supabase } from './supabase';
import type { ClinicalRecord, PaymentRecord } from '../types';

export interface MlsDirectoryQuery {
  dateFrom?: string;
  dateTo?: string;
  patientSearch?: string;
  doctorSearch?: string;
  treatmentSearch?: string;
  page: number;
  pageSize: number;
  showAll?: boolean;
}

export interface MlsDirectoryPage {
  records: ClinicalRecord[];
  payments: PaymentRecord[];
  total: number;
  /** Allocation context only; never render these as additional directory rows. */
  allocationPayments: PaymentRecord[];
}

export interface MlsLoadStage {
  label: string;
  unit: string;
  completed: number;
  total: number | null;
  status: 'waiting' | 'active' | 'complete';
  detail?: string;
}

export interface MlsLoadProgress {
  percentage: number;
  label: string;
  stages: MlsLoadStage[];
}

interface Selection {
  payment_ids: string[];
  patient_ids: string[];
  treatment_ids: string[];
  total: number;
}

const positiveInteger = (value: number, fallback: number) => Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;

/** Select on the server first, then hydrate only patients represented by the page.
 * Full patient history is required so earlier payments do not reopen paid debt.
 */
export async function loadMlsDirectoryPage(
  locationId: string,
  query: MlsDirectoryQuery,
  signal?: AbortSignal,
  onLoadProgress?: (progress: MlsLoadProgress) => void
): Promise<MlsDirectoryPage> {
  if (!locationId) throw new Error('A branch is required to load the MLS directory.');
  signal?.throwIfAborted();
  const stages: MlsLoadStage[] = [
    { label: 'Selecting payment rows', unit: 'payments', completed: 0, total: null, status: 'active' },
    { label: 'Loading treatment allocation history', unit: 'patients', completed: 0, total: null, status: 'waiting' },
    { label: 'Loading payment allocation history', unit: 'patients', completed: 0, total: null, status: 'waiting' },
    { label: 'Verifying financial rows', unit: 'checks', completed: 0, total: 1, status: 'waiting' }
  ];
  const report = () => {
    if (signal?.aborted) return;
    const fractions = stages.map(stage => {
      if (stage.status === 'complete') return 1;
      if (stage.total && stage.total > 0) return Math.min(0.99, stage.completed / stage.total);
      return stage.status === 'active' && stage.completed > 0 ? 0.5 : 0;
    });
    const active = stages.filter(stage => stage.status === 'active');
    const allComplete = stages.every(stage => stage.status === 'complete');
    onLoadProgress?.({
      percentage: allComplete ? 100 : Math.min(99, Math.floor(fractions.reduce((sum, value) => sum + value, 0) / stages.length * 100)),
      label: active.length ? active.map(stage => stage.label).join(' + ') : 'Preparing MLS rows',
      stages: stages.map(stage => ({ ...stage }))
    });
  };
  report();
  const pageSize = Math.min(500, positiveInteger(query.pageSize, 100));
  const paymentIds: string[] = [];
  const patientIds = new Set<string>();
  let total = 0;
  let page = query.showAll ? 1 : positiveInteger(query.page, 1);
  do {
    let request = supabase.rpc('mls_directory_page', {
      p_location_id: locationId,
      p_date_from: query.dateFrom || null,
      p_date_to: query.dateTo || null,
      p_patient_search: query.patientSearch?.trim() || '',
      p_doctor_search: query.doctorSearch?.trim() || '',
      p_treatment_search: query.treatmentSearch?.trim() || '',
      p_page: page,
      p_page_size: pageSize
    });
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request;
    signal?.throwIfAborted();
    if (error) throw new Error(error.code === 'PGRST202' || error.code === '42883'
      ? 'MLS filtering is not installed yet. Apply the MLS directory migration.'
      : `Unable to load MLS directory: ${error.message}`);
    const selection = (Array.isArray(data) ? data[0] : data) as Selection | null;
    if (!selection || !Array.isArray(selection.payment_ids) || !Array.isArray(selection.patient_ids)
      || !Number.isSafeInteger(Number(selection.total)) || Number(selection.total) < 0) {
      throw new Error('MLS directory returned an invalid selection.');
    }
    if (selection.payment_ids.some((id) => paymentIds.includes(id))) {
      throw new Error('MLS rows changed while loading. Please refresh.');
    }
    total = Number(selection.total);
    paymentIds.push(...selection.payment_ids);
    selection.patient_ids.forEach((id) => patientIds.add(id));
    stages[0] = {
      ...stages[0],
      completed: paymentIds.length,
      total,
      detail: `${patientIds.size} patients selected`
    };
    report();
    if (!query.showAll || selection.payment_ids.length < pageSize || paymentIds.length >= total) break;
    page += 1;
  } while (true);

  stages[0].status = 'complete';
  if (!paymentIds.length) {
    stages[1] = { ...stages[1], completed: 0, total: 0, status: 'complete' };
    stages[2] = { ...stages[2], completed: 0, total: 0, status: 'complete' };
    stages[3] = { ...stages[3], completed: 1, status: 'complete' };
    report();
    return { records: [], payments: [], allocationPayments: [], total };
  }
  const records: ClinicalRecord[] = [];
  const allocationPayments: PaymentRecord[] = [];
  const ids = [...patientIds];
  stages[1] = { ...stages[1], total: ids.length, status: 'active' };
  stages[2] = { ...stages[2], total: ids.length, status: 'active' };
  report();
  for (let offset = 0; offset < ids.length; offset += 40) {
    signal?.throwIfAborted();
    const patientChunk = ids.slice(offset, offset + 40);
    await Promise.all([
      api.treatments.getAllRecords(locationId, { patientIds: patientChunk, limit: null, throwOnError: true, signal })
        .then(historyRecords => {
          records.push(...historyRecords);
          stages[1].completed = Math.min(ids.length, offset + patientChunk.length);
          stages[1].detail = `${records.length} treatment rows downloaded`;
          if (stages[1].completed >= ids.length) stages[1].status = 'complete';
          report();
        }),
      api.finance.getPayments(locationId, { patientIds: patientChunk, includeCorrections: false, signal })
        .then(historyPayments => {
          allocationPayments.push(...historyPayments);
          stages[2].completed = Math.min(ids.length, offset + patientChunk.length);
          stages[2].detail = `${allocationPayments.length} payment rows downloaded`;
          if (stages[2].completed >= ids.length) stages[2].status = 'complete';
          report();
        })
    ]);
  }
  signal?.throwIfAborted();
  stages[3].status = 'active';
  report();
  const byId = new Map(allocationPayments.map((payment) => [payment.id, payment]));
  const payments = paymentIds.map((id) => byId.get(id)).filter((payment): payment is PaymentRecord => Boolean(payment));
  if (payments.length !== paymentIds.length) throw new Error('MLS rows changed while loading. Please refresh.');
  stages[3] = { ...stages[3], completed: 1, status: 'complete', detail: `${payments.length} selected rows verified` };
  report();
  return { records, payments, total, allocationPayments };
}
