import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { ClinicalRecord, PaymentRecord } from '../types';
import { buildMaterialCostPaymentHistoryRows } from '../utils/materialCostPaymentHistory';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), records: vi.fn(), payments: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('./api', () => ({ api: { treatments: { getAllRecords: mocks.records }, finance: { getPayments: mocks.payments } } }));
import { loadMlsDirectoryPage } from './mlsDirectory';

const query = { page: 2, pageSize: 1, dateFrom: '2026-11-03', dateTo: '2026-11-03', patientSearch: ' Ann ', doctorSearch: 'Smith', treatmentSearch: 'Crown' };
const old = { id: 'old', patient_id: 'patient-1', date: '2026-10-01', cost: 100, doctor_name: 'Smith' } as ClinicalRecord;
const recent = { ...old, id: 'recent', date: '2026-11-01' };
const prior = { id: 'prior', patientId: 'patient-1', amount: 100, date: '2026-10-02', treatmentIds: ['old'] } as PaymentRecord;
const selected = { id: 'selected', patientId: 'patient-1', amount: 100, date: '2026-11-03' } as PaymentRecord;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: { total: 3, payment_ids: ['selected'], patient_ids: ['patient-1'], treatment_ids: ['recent'] }, error: null });
  mocks.records.mockResolvedValue([old, recent]);
  mocks.payments.mockResolvedValue([selected, prior]);
});

describe('MLS bounded directory', () => {
  it('selects filters/count/page in RPC and hydrates page patient history without date truncation', async () => {
    const progress = vi.fn();
    const result = await loadMlsDirectoryPage('branch-1', query, undefined, progress);
    expect(mocks.rpc).toHaveBeenCalledWith('mls_directory_page', {
      p_location_id: 'branch-1', p_date_from: '2026-11-03', p_date_to: '2026-11-03',
      p_patient_search: 'Ann', p_doctor_search: 'Smith', p_treatment_search: 'Crown', p_page: 2, p_page_size: 1
    });
    expect(mocks.records).toHaveBeenCalledWith('branch-1', { patientIds: ['patient-1'], limit: null, throwOnError: true, signal: undefined });
    expect(mocks.payments).toHaveBeenCalledWith('branch-1', { patientIds: ['patient-1'], includeCorrections: false, signal: undefined });
    expect(result.payments.map((payment) => payment.id)).toEqual(['selected']);
    expect(result.total).toBe(3);
    const [row] = buildMaterialCostPaymentHistoryRows(result.records, result.payments, result.allocationPayments);
    expect(row.treatmentIds).toEqual(['recent']);
    expect(progress).toHaveBeenCalled();
    expect(progress.mock.calls.at(-1)?.[0]).toMatchObject({
      percentage: 100,
      stages: [
        { label: 'Selecting payment rows', status: 'complete' },
        { label: 'Loading treatment allocation history', status: 'complete' },
        { label: 'Loading payment allocation history', status: 'complete' },
        { label: 'Verifying financial rows', status: 'complete' }
      ]
    });
  });

  it('does no hydration for an empty page', async () => {
    mocks.rpc.mockResolvedValue({ data: { total: 3, payment_ids: [], patient_ids: [], treatment_ids: [] }, error: null });
    const progress = vi.fn();
    expect(await loadMlsDirectoryPage('branch-1', query, undefined, progress)).toEqual({ total: 3, records: [], payments: [], allocationPayments: [] });
    expect(mocks.records).not.toHaveBeenCalled();
    expect(progress.mock.calls.at(-1)?.[0].percentage).toBe(100);
  });

  it('rejects missing hydrated payments and malformed selections', async () => {
    mocks.payments.mockResolvedValue([prior]);
    await expect(loadMlsDirectoryPage('branch-1', query)).rejects.toThrow('MLS rows changed');
    mocks.rpc.mockResolvedValue({ data: { total: -1, payment_ids: [], patient_ids: [] }, error: null });
    await expect(loadMlsDirectoryPage('branch-1', query)).rejects.toThrow('invalid selection');
  });

  it('enumerates bounded RPC batches only when showAll is explicit', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { total: 2, payment_ids: ['selected'], patient_ids: ['patient-1'], treatment_ids: [] }, error: null })
      .mockResolvedValueOnce({ data: { total: 2, payment_ids: ['prior'], patient_ids: ['patient-1'], treatment_ids: [] }, error: null });
    const result = await loadMlsDirectoryPage('branch-1', { ...query, showAll: true });
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_page)).toEqual([1, 2]);
    expect(result.payments.map((payment) => payment.id)).toEqual(['selected', 'prior']);
  });

  it('fails closed when the migration is absent or the branch scope is missing', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await expect(loadMlsDirectoryPage('branch-1', query)).rejects.toThrow('Apply the MLS directory migration');
    await expect(loadMlsDirectoryPage('', query)).rejects.toThrow('branch');
  });

  it('migration keeps RLS and allocates full patient history before paging', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261115000001_mls_directory.sql', import.meta.url), 'utf8');
    expect(sql).toContain('SECURITY INVOKER');
    expect(sql).not.toContain('SECURITY DEFINER');
    expect(sql).toContain('p.payment_date >= p_date_from');
    expect(sql).toContain('mls_patient_payment_links(p_location_id, patients.patient_id)');
    expect(sql).toContain('SELECT count(*) FROM filtered');
    expect(sql).toContain('LIMIT least(500');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.mls_directory_page');
  });
});
