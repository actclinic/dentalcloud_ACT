import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, ShieldCheck, Stethoscope, X } from 'lucide-react';
import type { Appointment, Doctor, DoctorAssignmentTreatmentCandidate } from '../types';
import { api } from '../services/api';
import { auth } from '../services/auth';
import { formatDoctorName } from '../utils/doctorName';
import { SearchableSelect } from './SearchableSelect';

interface DoctorAssignmentCorrectionModalProps {
  appointment: Appointment | null;
  doctors: Pick<Doctor, 'id' | 'name' | 'location_id' | 'location_ids'>[];
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}

const DoctorAssignmentCorrectionModal: React.FC<DoctorAssignmentCorrectionModalProps> = ({ appointment, doctors, onClose, onSaved }) => {
  const [candidates, setCandidates] = React.useState<DoctorAssignmentTreatmentCandidate[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [newDoctorId, setNewDoctorId] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingCommission, setPendingCommission] = React.useState<{ patientId: string; requestToken: string; message: string } | null>(null);

  React.useEffect(() => {
    if (!appointment) return;
    let active = true;
    setLoading(true);
    setError(null);
    setCandidates([]);
    setSelectedIds([]);
    setNewDoctorId('');
    setReason('');
    setPendingCommission(null);
    api.appointments.getDoctorCorrectionCandidates(appointment)
      .then((rows) => {
        if (!active) return;
        setCandidates(rows);
        setSelectedIds(rows.filter((row) => row.linkStatus === 'linked').map((row) => row.id));
      })
      .catch((err: any) => active && setError(err?.message || 'Treatment records could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [appointment]);

  if (!appointment) return null;

  const availableDoctors = doctors.filter((doctor) => (
    doctor.id !== appointment.doctor_id &&
    (doctor.location_id === appointment.location_id || doctor.location_ids?.includes(appointment.location_id))
  )).sort((left, right) => formatDoctorName(left.name).localeCompare(formatDoctorName(right.name)));
  const selectedDoctor = doctors.find((doctor) => doctor.id === newDoctorId);
  const normalizedReason = reason.trim();
  const canSubmit = !loading && !submitting && Boolean(newDoctorId) && normalizedReason.length >= 10;

  const toggleTreatment = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const session = auth.getSession();
    if (!session?.userId || session.role !== 'admin' || !session.staffAuthToken) {
      setError('A current administrator session is required. Sign out and sign in again.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.appointments.correctDoctorAssignment({
        appointmentId: appointment.id,
        expectedOldDoctorId: appointment.doctor_id || null,
        newDoctorId,
        treatmentIds: selectedIds,
        reason: normalizedReason,
        adminUserId: session.userId,
        sessionToken: session.staffAuthToken
      });
      const pendingText = result.commissionRefreshPending
        ? ' Commission recalculation is pending and must be retried before earnings are finalized.'
        : '';
      const message = `Doctor corrected for the appointment and ${result.correctedTreatmentCount} selected treatment${result.correctedTreatmentCount === 1 ? '' : 's'}.${pendingText}`;
      await onSaved(message);
      if (result.commissionRefreshPending && result.commissionRequestToken) {
        setPendingCommission({ patientId: result.patientId, requestToken: result.commissionRequestToken, message });
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Doctor assignment could not be corrected.');
    } finally {
      setSubmitting(false);
    }
  };

  const retryCommission = async () => {
    if (!pendingCommission) return;
    const session = auth.getSession();
    if (!session?.userId || session.role !== 'admin' || !session.staffAuthToken) {
      setError('A current administrator session is required. Sign out and sign in again.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.appointments.retryDoctorCommissionRecalculation(
        pendingCommission.patientId,
        pendingCommission.requestToken,
        { userId: session.userId, sessionToken: session.staffAuthToken }
      );
      await onSaved('Doctor correction and commission recalculation are complete.');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Commission recalculation is still pending. Try again before closing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="doctor-correction-title">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
              <ShieldCheck size={15} /> Admin safety control
            </div>
            <h2 id="doctor-correction-title" className="text-xl font-black text-slate-900">Correct doctor assignment</h2>
            <p className="mt-1 text-sm text-slate-500">{appointment.patient_name || 'Patient'} · {appointment.date} · {String(appointment.time).slice(0, 5)}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={20} /></button>
        </header>

        {pendingCommission ? (
          <div className="overflow-y-auto px-5 py-8 sm:px-7">
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center">
              <AlertTriangle className="mx-auto text-amber-600" size={36} />
              <h3 className="mt-3 text-lg font-black text-amber-950">Doctor corrected; commission is pending</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-amber-900">The old doctor’s affected commission was removed safely, but the new doctor’s commission could not yet be calculated. Retry now so earnings reports are finalized.</p>
              {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-amber-300 bg-white px-5 py-3 text-sm font-bold text-amber-900">Close and retry later</button>
                <button type="button" onClick={retryCommission} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 py-3 text-sm font-black text-white hover:bg-amber-800 disabled:opacity-50">
                  {submitting ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}
                  {submitting ? 'Recalculating…' : 'Retry commission calculation'}
                </button>
              </div>
            </div>
          </div>
        ) : <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-5 sm:px-7">
          <section className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3 rounded-2xl border border-teal-100 bg-gradient-to-r from-slate-50 via-white to-teal-50 p-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Recorded doctor</span>
              <div className="mt-2 flex items-center gap-2 font-bold text-slate-800"><Stethoscope size={17} />{formatDoctorName(appointment.doctor_name) || 'Unassigned'}</div>
            </div>
            <div className="flex items-center text-teal-600"><ArrowRight size={22} /></div>
            <div className="rounded-xl border border-teal-200 bg-white p-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700">Correct doctor</span>
              <SearchableSelect
                value={newDoctorId}
                onChange={setNewDoctorId}
                options={availableDoctors.map((doctor) => ({ value: doctor.id, label: formatDoctorName(doctor.name) }))}
                placeholder="Choose doctor"
                searchPlaceholder="Search doctor name..."
                ariaLabel="Correct doctor"
                emptyMessage="No doctors match this search."
                className="mt-2"
              />
            </div>
          </section>

          <section className="mt-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900">Treatment records to move</h3>
                <p className="text-xs text-slate-500">Only checked records will change doctor and commission ownership.</p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">{selectedIds.length} selected</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-10 text-sm text-slate-500"><Loader2 className="animate-spin" size={18} />Loading treatments…</div>
            ) : candidates.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No matching treatment records were found. The appointment doctor can still be corrected by itself.</div>
            ) : (
              <div className="space-y-2">
                {candidates.map((record) => {
                  const selected = selectedIds.includes(record.id);
                  const linked = record.linkStatus === 'linked';
                  return (
                    <label key={record.id} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${selected ? 'border-teal-300 bg-teal-50/70' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleTreatment(record.id)} className="mt-1 h-4 w-4 accent-teal-600" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900">{record.description || 'Treatment'}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${linked ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-800'}`}>{linked ? 'Linked visit' : 'Same-day suggestion'}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Teeth: {record.teeth?.length ? record.teeth.join(', ') : 'All / none specified'} · Current earnings: {Number(record.doctorEarnings || 0).toFixed(2)}</p>
                        {!linked && <p className="mt-1 text-xs font-semibold text-amber-700">Review carefully: this older record has no direct appointment link.</p>}
                      </div>
                      {selected && <CheckCircle2 className="shrink-0 text-teal-600" size={19} />}
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-5">
            <label htmlFor="doctor-correction-reason" className="block text-sm font-bold text-slate-800">Reason for correction</label>
            <textarea id="doctor-correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={1000} placeholder="Example: Front desk selected Dr. Kelvin instead of Dr. Joe during check-in." className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-100" />
            <p className={`mt-1 text-xs font-semibold ${normalizedReason.length >= 10 ? 'text-teal-700' : 'text-slate-500'}`}>Minimum 10 characters. This reason becomes permanent audit history.</p>
          </section>

          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p>Saving changes the appointment and exactly <strong>{selectedIds.length}</strong> treatment record{selectedIds.length === 1 ? '' : 's'} from {formatDoctorName(appointment.doctor_name) || 'Unassigned'} to {selectedDoctor ? formatDoctorName(selectedDoctor.name) : 'the selected doctor'}. Historical receipts and reschedule logs stay unchanged.</p>
          </div>

          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

          <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={!canSubmit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
              {submitting ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}
              {submitting ? 'Correcting records…' : `Correct doctor for ${selectedIds.length + 1} record${selectedIds.length === 0 ? '' : 's'}`}
            </button>
          </footer>
        </form>}
      </div>
    </div>
  );
};

export default DoctorAssignmentCorrectionModal;