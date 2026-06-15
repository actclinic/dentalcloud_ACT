import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, Plus, Mail, Send } from 'lucide-react';
import { Recall, Patient } from '../types';
import { Modal, Input } from './Shared';
import { loadEmailSettings, loadEmailSettingsAsync } from '../utils/emailSettings';

interface RecallsViewProps {
  recalls: Recall[];
  patients: Patient[];
  loading: boolean;
  onCreateRecall: (data: Partial<Recall>, sendEmail?: boolean) => Promise<void>;
  onUpdateStatus: (id: string, status: Recall['status']) => Promise<void>;
  onDeleteRecall: (id: string) => Promise<void>;
  onDeleteAllRecalls: () => Promise<void>;
  onSendRecallEmail?: (recallId: string, patientEmail: string, patientName: string, recallTitle: string, dueDate: string) => Promise<void>;
}

const RecallsView: React.FC<RecallsViewProps> = ({
  recalls,
  patients,
  loading,
  onCreateRecall,
  onUpdateStatus,
  onDeleteRecall,
  onDeleteAllRecalls,
  onSendRecallEmail
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [sendEmailOnCreate, setSendEmailOnCreate] = useState(true);
  const [formData, setFormData] = useState<Partial<Recall>>({
    patient_id: '',
    title: '6-Month Checkup Recall',
    due_date: '',
    reminder_days_before: 7,
    status: 'PENDING',
    notes: ''
  });

  const [emailSettings, setEmailSettings] = useState(() => loadEmailSettings());
  const isEmailEnabled = emailSettings.enabled && emailSettings.senderEmail;

  useEffect(() => {
    let mounted = true;
    loadEmailSettingsAsync()
      .then((settings) => {
        if (mounted) setEmailSettings(settings);
      })
      .catch((error) => {
        console.warn('Failed to load shared email settings:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const summary = useMemo(() => {
    const pending = recalls.filter(r => r.status === 'PENDING' || r.status === 'SCHEDULED').length;
    const overdue = recalls.filter(r => r.status === 'OVERDUE').length;
    const completed = recalls.filter(r => r.status === 'COMPLETED').length;
    const dueToday = recalls.filter(r => r.due_date === today && (r.status === 'PENDING' || r.status === 'SCHEDULED')).length;
    return { pending, overdue, completed, dueToday };
  }, [recalls, today]);

  const sortedRecalls = useMemo(() => {
    return [...recalls].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [recalls]);

  const getStatusClass = (status: Recall['status']) => {
    switch (status) {
      case 'OVERDUE':
        return 'bg-red-100 text-red-700';
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-700';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_id || !formData.due_date || !formData.title) return;
    setSaving(true);
    try {
      const shouldSendEmail = Boolean(sendEmailOnCreate && isEmailEnabled);
      await onCreateRecall(formData, shouldSendEmail);
      setShowCreateModal(false);
      setFormData({
        patient_id: '',
        title: '6-Month Checkup Recall',
        due_date: '',
        reminder_days_before: 7,
        status: 'PENDING',
        notes: ''
      });
      setSendEmailOnCreate(true);
    } finally {
      setSaving(false);
    }
  };

  const handleSendRecallEmail = async (recall: Recall) => {
    if (!onSendRecallEmail) return;
    
    const patient = patients.find(p => p.id === recall.patient_id);
    if (!patient || !patient.email) {
      alert(`Patient "${patient?.name || 'Unknown'}" does not have an email address on file.`);
      return;
    }

    setSendingEmail(recall.id);
    try {
      await onSendRecallEmail(recall.id, patient.email, patient.name, recall.title, recall.due_date);
      alert(`Recall email sent successfully to ${patient.name} (${patient.email})`);
    } catch (error: any) {
      alert(`Failed to send recall email: ${error.message || 'Unknown error'}`);
    } finally {
      setSendingEmail(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Recall & Reminder Center</h2>
          <p className="text-sm text-gray-500">Automate patient follow-ups and track due care</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (window.confirm('Delete entire recall history for this location? This cannot be undone.')) {
                await onDeleteAllRecalls();
              }
            }}
            className="px-4 py-2 rounded-xl font-bold text-sm bg-red-50 text-red-700 hover:bg-red-100"
          >
            Delete Entire History
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700"
          >
            <Plus size={16} /> New Recall
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-bold">Pending</p>
          <p className="text-lg font-black text-indigo-600">{summary.pending}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-bold">Due Today</p>
          <p className="text-lg font-black text-amber-600">{summary.dueToday}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-bold">Overdue</p>
          <p className="text-lg font-black text-red-600">{summary.overdue}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-bold">Completed</p>
          <p className="text-lg font-black text-green-600">{summary.completed}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">All Recall Items</h3>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-gray-500">Loading recalls...</div>
        ) : sortedRecalls.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <BellRing className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No recalls created yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedRecalls.map((r) => {
              const patient = patients.find(p => p.id === r.patient_id);
              const hasPatientEmail = patient?.email;
              
              return (
                <div key={r.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900">{r.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getStatusClass(r.status)}`}>{r.status}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{r.patient_name || 'Unknown Patient'} • Due: {r.due_date}</p>
                    {r.notes && <p className="text-xs text-gray-500 mt-1">{r.notes}</p>}
                    <p className="text-xs text-gray-400 mt-1">Reminder lead time: {r.reminder_days_before} day(s)</p>
                  </div>

                  <div className="flex gap-2 flex-wrap items-center">
                    {onSendRecallEmail && hasPatientEmail && (r.status === 'PENDING' || r.status === 'SCHEDULED') && (
                      <button
                        onClick={() => handleSendRecallEmail(r)}
                        disabled={sendingEmail === r.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-200"
                        title={`Send recall email to ${patient.name}`}
                      >
                        {sendingEmail === r.id ? (
                          <>
                            <span className="animate-spin inline-block w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail size={14} />
                            Send Email
                          </>
                        )}
                      </button>
                    )}
                    {onSendRecallEmail && !hasPatientEmail && (r.status === 'PENDING' || r.status === 'SCHEDULED') && (
                      <span className="text-[10px] text-gray-400 italic" title="Patient has no email on file">
                        No email on file
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500 font-medium">
                      Status auto-updates from appointments
                    </span>
                    {(r.status === 'PENDING' || r.status === 'SCHEDULED') && (
                      <button
                        onClick={async () => {
                          if (window.confirm('Cancel and delete this recall?')) {
                            await onDeleteRecall(r.id);
                          }
                        }}
                        className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200"
                      >
                        Cancel & Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <Modal title="Create Recall" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Patient</label>
              <select
                required
                value={formData.patient_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, patient_id: e.target.value }))}
                className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select patient</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <Input
              label="Recall Title"
              required
              value={formData.title || ''}
              onChange={(e: any) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            />
            <Input
              label="Due Date"
              type="date"
              required
              value={formData.due_date || ''}
              onChange={(e: any) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
            />
            <Input
              label="Reminder Days Before Due"
              type="number"
              min="0"
              value={formData.reminder_days_before ?? 7}
              onChange={(e: any) => setFormData(prev => ({ ...prev, reminder_days_before: Number(e.target.value) }))}
            />
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Notes</label>
              <textarea
                rows={3}
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            {isEmailEnabled && (
              <label className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors">
                <input
                  type="checkbox"
                  checked={sendEmailOnCreate}
                  onChange={(e) => setSendEmailOnCreate(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-emerald-600" />
                    <span className="text-sm font-bold text-gray-900">Send recall email to patient</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    An email notification will be sent to the patient with recall details.
                  </p>
                </div>
              </label>
            )}
            
            {!isEmailEnabled && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> Email delivery is not configured. Go to Settings → Email Delivery to enable recall email notifications.
                </p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Recall
                </>
              )}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default RecallsView;