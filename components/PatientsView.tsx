import React, { useState, useMemo, useRef } from 'react';
import { Search, Plus, Loader2, ChevronRight, Award, User, ShieldCheck, ShieldAlert, Key, Edit, MoreVertical, ArrowLeft } from 'lucide-react';
import { Patient, LoyaltyRule, Appointment, ClinicalRecord } from '../types';
import { formatCurrency, Currency } from '../utils/currency';
import { exportPatientsToPDF } from '../utils/pdfExport';
import { exportPatientsToExcel } from '../utils/excelExport';
import Pagination from './Pagination';
import { Modal, Input, ConfirmDialog } from './Shared';
import ExportMenu from './ExportMenu';
import { SearchableSelect } from './SearchableSelect';
import { getMyanmarCities, getTownshipsForCity } from '../utils/myanmarCities';
import { api } from '../services/api';

interface PatientsViewProps {
  patients: Patient[];
  appointments: Appointment[];
  loading: boolean;
  currency: Currency;
  onSelectPatient: (patient: Patient) => void;
  onAddPatient: () => void;
  onUpdatePatient?: (id: string, data: Partial<Patient>) => Promise<void>;
  onDeletePatient?: (id: string) => Promise<void>;
  onRedeemPoints?: (patient: Patient, points: number, amount: number) => void;
  onUpdatePatientAuth?: (patient: Patient, password: string) => void;
  onExportPDF?: () => Promise<void>;
  onExportExcel?: () => Promise<void>;
  loyaltyEnabled: boolean;
  loyaltyRules?: LoyaltyRule[];
}

const PatientsView: React.FC<PatientsViewProps> = ({ 
  patients, 
  appointments: _appointments,
  loading, 
  currency, 
  onSelectPatient, 
  onAddPatient, 
  onUpdatePatient,
  onDeletePatient,
  onRedeemPoints, 
  onUpdatePatientAuth,
  onExportPDF,
  onExportExcel,
  loyaltyEnabled, 
  loyaltyRules = [] 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTodaysNew, setShowTodaysNew] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean, patient: Patient | null }>({ open: false, patient: null });
  const [editModal, setEditModal] = useState<{ open: boolean, patient: Patient | null }>({ open: false, patient: null });
  const [redeemModal, setRedeemModal] = useState<{ open: boolean, patient: Patient | null }>({ open: false, patient: null });
  const [redeemPointsInput, setRedeemPointsInput] = useState('');
  const [editData, setEditData] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    medicalHistory: '',
    age: '',
    address: '',
    city: '',
    township: '',
    patient_type: 'Walk-in' as Patient['patient_type']
  });
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [detailPatient, setDetailPatient] = useState<Patient | null>(null);
  const [openActionMenuPatientId, setOpenActionMenuPatientId] = useState<string | null>(null);
  const [treatmentRecordsByPatientId, setTreatmentRecordsByPatientId] = useState<Record<string, ClinicalRecord[]>>({});
  const [treatmentRecordsLoadingForPatientId, setTreatmentRecordsLoadingForPatientId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const itemsPerPage = 10;

  const toLocalISODate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayISO = useMemo(() => toLocalISODate(new Date()), []);

  const isNewPatientToday = (patient: Patient) => {
    if (!patient.created_at) return false;
    const createdAt = new Date(patient.created_at);
    if (Number.isNaN(createdAt.getTime())) return false;
    return toLocalISODate(createdAt) === todayISO;
  };

  const formatCreatedDate = (createdAt?: string) => {
    if (!createdAt) return 'N/A';

    const isoDateMatch = createdAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
      const [, year, month, day] = isoDateMatch;
      return `${day}/${month}/${year.slice(-2)}`;
    }

    const parsedDate = new Date(createdAt);
    if (Number.isNaN(parsedDate.getTime())) return 'N/A';

    const day = String(parsedDate.getDate()).padStart(2, '0');
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const year = String(parsedDate.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  // Filtered data based on selected scope and search term
  const filteredPatients = useMemo(() => {
    const scopedPatients = showTodaysNew
      ? patients.filter((patient) => isNewPatientToday(patient))
      : patients;

    if (!searchTerm) return scopedPatients;
    const term = searchTerm.toLowerCase();
    return scopedPatients.filter((patient) => {
      const searchableCreatedDate = formatCreatedDate(patient.created_at).toLowerCase();
      const searchableRawCreatedDate = (patient.created_at || '').toLowerCase();
      const searchableAddress = [patient.address, patient.city, patient.township]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const searchableAge = patient.age !== undefined && patient.age !== null ? String(patient.age) : '';

      return (
        (patient.name || '').toLowerCase().includes(term) ||
        (patient.email || '').toLowerCase().includes(term) ||
        (patient.phone || '').toLowerCase().includes(term) ||
        searchableAddress.includes(term) ||
        searchableAge.includes(term) ||
        searchableCreatedDate.includes(term) ||
        searchableRawCreatedDate.includes(term)
      );
    });
  }, [patients, searchTerm, showTodaysNew, todayISO]);

  const cityOptions = useMemo(
    () => getMyanmarCities().map((city) => ({ value: city, label: city })),
    []
  );

  const townshipOptions = useMemo(
    () => getTownshipsForCity(editData.city || '').map((township) => ({ value: township, label: township })),
    [editData.city]
  );

  const normalizePatientType = (value?: string): Patient['patient_type'] => {
    const normalized = (value || '').trim();
    const mappedLegacy = normalized.toLowerCase();
    const legacyMap: Record<string, Patient['patient_type']> = {
      'walk-in': 'Walk-in',
      online: 'ONP',
      'phone call': 'Rec-ph call',
      hotline: 'Hotline',
      tiktok: 'Tiktok',
      'tiktok hotline': 'Tiktok Hotline',
      onp: 'ONP',
      rnp: 'RNP'
    };

    if (normalized === 'Walk-in' || normalized === 'ONP' || normalized === 'RNP' || normalized === 'Hotline' || normalized === 'Rec-ph call' || normalized === 'Tiktok' || normalized === 'Tiktok Hotline') {
      return normalized as Patient['patient_type'];
    }

    return legacyMap[mappedLegacy] || 'Walk-in';
  };

  // Paginated data
  const paginatedPatients = useMemo(() => {
    if (showAll) return filteredPatients;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPatients.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPatients, currentPage, showAll]);

  // Reset to first page when patients change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [patients, showTodaysNew]);

  const [exporting, setExporting] = useState(false);

  const handleDownloadPDF = async () => {
    if (onExportPDF) {
      setExporting(true);
      try {
        await onExportPDF();
      } finally {
        setExporting(false);
      }
    } else {
      exportPatientsToPDF(patients, currency);
    }
  };

  const handleDownloadExcel = async () => {
    if (onExportExcel) {
      setExporting(true);
      try {
        await onExportExcel();
      } finally {
        setExporting(false);
      }
    } else {
      await exportPatientsToExcel(patients, currency);
    }
  };

  const canRedeem = (patient: Patient) => (patient.loyalty_points || 0) > 0;

  React.useEffect(() => {
    if (!openActionMenuPatientId) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenActionMenuPatientId(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [openActionMenuPatientId]);

  const getPatientAddress = (patient: Patient) => {
    const fullAddress = [patient.address, patient.township, patient.city].filter(Boolean).join(', ');
    return fullAddress || 'N/A';
  };

  const getPatientContact = (patient: Patient) => {
    if (patient.phone && patient.email) return `${patient.phone} / ${patient.email}`;
    return patient.phone || patient.email || 'N/A';
  };

  const handleRedeemClick = (patient: Patient) => {
    setRedeemModal({ open: true, patient });
    setRedeemPointsInput(Math.min(patient.loyalty_points || 0, 1000).toString());
  };

  const openPatientDetails = async (patient: Patient) => {
    setDetailPatient(patient);

    if (Object.prototype.hasOwnProperty.call(treatmentRecordsByPatientId, patient.id)) {
      return;
    }

    setTreatmentRecordsLoadingForPatientId(patient.id);
    try {
      const history = await api.treatments.getHistory(patient.id);
      const sortedHistory = [...history].sort((a, b) => {
        const aTime = new Date(a.date || 0).getTime();
        const bTime = new Date(b.date || 0).getTime();
        return bTime - aTime;
      });
      setTreatmentRecordsByPatientId((prev) => ({
        ...prev,
        [patient.id]: sortedHistory
      }));
    } catch (error) {
      setTreatmentRecordsByPatientId((prev) => ({
        ...prev,
        [patient.id]: []
      }));
    } finally {
      setTreatmentRecordsLoadingForPatientId((prev) => (prev === patient.id ? null : prev));
    }
  };

  const handleRedeemSubmit = () => {
    if (!onRedeemPoints || !redeemModal.patient) return;

    const availablePoints = redeemModal.patient.loyalty_points || 0;
    const points = parseInt(redeemPointsInput, 10);

    if (isNaN(points) || points <= 0 || points > availablePoints) {
      alert(`Please enter a valid amount between 1 and ${availablePoints}.`);
      return;
    }

    onRedeemPoints(redeemModal.patient, points, 0);
    setRedeemModal({ open: false, patient: null });
    setRedeemPointsInput('');
  };

  return (
  <div className="flex flex-col h-full bg-white overflow-hidden">
    <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white sticky top-0 z-10">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Patient Directory</h2>
        <p className="text-sm text-gray-500">Manage all registered clinical patients</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search patients..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page when searching
            }}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"/>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowTodaysNew((prev) => !prev);
              setCurrentPage(1);
            }}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              showTodaysNew
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Today's new
          </button>
          <ExportMenu
            disabled={patients.length === 0 || exporting}
            onExportPDF={handleDownloadPDF}
            onExportExcel={handleDownloadExcel}
            className="flex-1 sm:flex-initial"
          />
          <button onClick={onAddPatient} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Patient</span>
          </button>
        </div>
      </div>
    </div>
    {detailPatient ? (
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
        {(() => {
          const treatmentRecords = treatmentRecordsByPatientId[detailPatient.id] || [];
          const isTreatmentRecordsLoading = treatmentRecordsLoadingForPatientId === detailPatient.id;
          return (
        <div className="mx-auto w-full max-w-6xl space-y-5">
          <button
            onClick={() => setDetailPatient(null)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            Back to Patient List
          </button>

          <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 px-6 py-6 text-white">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">
                    {detailPatient.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/90 font-semibold">Patient Profile</p>
                    <h3 className="text-2xl font-bold leading-tight">{detailPatient.name || 'N/A'}</h3>
                    <p className="mt-1 text-sm text-white/90">
                      Created: {formatCreatedDate(detailPatient.created_at)} • Operator: {detailPatient.patient_type || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Contact</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{getPatientContact(detailPatient)}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Portal Access</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{detailPatient.has_account ? 'Active' : 'No Access'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Balance</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{formatCurrency(detailPatient.balance || 0, currency)}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Treatment and Diagnosis</p>
                  {isTreatmentRecordsLoading ? (
                    <p className="mt-2 text-sm leading-6 text-gray-900">Loading treatment records...</p>
                  ) : treatmentRecords.length === 0 ? (
                    <p className="mt-2 text-sm leading-6 text-gray-900">No Treatment and Diagnosis records available.</p>
                  ) : (
                    <div className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
                      {treatmentRecords.map((record) => (
                        <div key={record.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                          <p className="text-sm font-semibold text-gray-900">{record.description || 'Treatment'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Date: {formatCreatedDate(record.date)}{typeof record.cost === 'number' ? ` • Charge: ${formatCurrency(record.cost, currency)}` : ''}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Doctor: {record.doctor_name?.trim() || '-'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Address</p>
                  <p className="mt-2 text-sm text-gray-900">{getPatientAddress(detailPatient)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Patient Meta</p>
                  <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Age</p>
                      <p className="font-semibold text-gray-900">{detailPatient.age ?? 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="font-semibold text-gray-900">{formatCreatedDate(detailPatient.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Loyalty Point</p>
                      <p className="font-semibold text-gray-900">{detailPatient.loyalty_points || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
          );
        })()}
      </div>
    ) : loading ? (
      <div className="flex-1 flex items-center justify-center p-12"><Loader2 className="animate-spin text-[var(--hover-600)] w-10 h-10" /></div>
    ) : patients.length === 0 ? (
      <div className="flex-1 flex items-center justify-center p-12 text-center text-gray-400 italic">No patients found. Add your first patient to begin.</div>
    ) : (
      <>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto flex-1 min-h-0 p-6 pt-0">
          <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-indigo-50 border-b border-indigo-200">
                  <tr className="text-indigo-700">
                    <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">No</th>
                    <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Name</th>
                    <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Date</th>
                    <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Age</th>
                    <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Contact</th>
                    <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Address</th>
                    <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Balance</th>
                    <th className="px-3 py-3 text-right font-bold uppercase text-xs tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatients.map((patient, index) => (
                    <tr
                      key={patient.id}
                      className={`transition-colors group cursor-pointer border-b border-gray-100 last:border-b-0 ${
                        showTodaysNew
                          ? isNewPatientToday(patient)
                            ? 'bg-emerald-50/70 hover:bg-emerald-100/70'
                            : 'bg-amber-50/70 hover:bg-amber-100/70'
                          : 'hover:bg-indigo-50/30'
                      }`}
                      onClick={() => onSelectPatient(patient)}
                    >
                      <td className="px-3 py-3 align-top font-semibold text-gray-700">
                        {showAll ? index + 1 : (currentPage - 1) * itemsPerPage + index + 1}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center">
                          <div className="theme-accent-soft-bg theme-accent-text h-9 w-9 rounded-full flex items-center justify-center font-bold mr-3">
                            {patient.name?.charAt(0) || '?'}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700">{patient.name}</div>
                            {showTodaysNew && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                  isNewPatientToday(patient)
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                                }`}
                              >
                                {isNewPatientToday(patient) ? 'New' : 'Old'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-gray-700 whitespace-nowrap">
                        {formatCreatedDate(patient.created_at)}
                      </td>
                      <td className="px-3 py-3 align-top text-gray-700">
                        {patient.age ?? 'N/A'}
                      </td>
                      <td className="px-3 py-3 align-top text-gray-700">
                        {getPatientContact(patient)}
                      </td>
                      <td className="px-3 py-3 align-top text-gray-700 max-w-xs truncate" title={getPatientAddress(patient)}>
                        {getPatientAddress(patient)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {patient.balance > 0 ? (
                          <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded border border-red-100">{formatCurrency(patient.balance || 0, currency)}</span>
                        ) : (
                          <span className="text-green-600 font-medium">Clear</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <div className="relative inline-flex items-center justify-end gap-2" ref={openActionMenuPatientId === patient.id ? actionMenuRef : undefined}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditModal({ open: true, patient });
                              setEditData({
                                name: patient.name,
                                email: patient.email || '',
                                phone: patient.phone || '',
                                medicalHistory: patient.medicalHistory || '',
                                age: patient.age?.toString() || '',
                                address: patient.address || '',
                                city: patient.city || '',
                                township: patient.township || '',
                                patient_type: normalizePatientType(patient.patient_type)
                              });
                            }}
                            className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                            title="Edit patient profile"
                          >
                            <Edit size={14} /> Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPatient(patient);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                          >
                            View Chart <ChevronRight size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuPatientId((prev) => (prev === patient.id ? null : patient.id));
                            }}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                            title="Open actions"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openActionMenuPatientId === patient.id && (
                            <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPatientDetails(patient);
                                  setOpenActionMenuPatientId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                View Details
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100 overflow-y-auto flex-1 min-h-0">
          {paginatedPatients.map((patient) => (
            <div 
              key={patient.id} 
              className={`p-4 transition-colors ${
                showTodaysNew
                  ? isNewPatientToday(patient)
                    ? 'bg-emerald-50/70 hover:bg-emerald-100/70'
                    : 'bg-amber-50/70 hover:bg-amber-100/70'
                  : 'hover:bg-gray-50 active:bg-indigo-50'
              }`}
              onClick={() => onSelectPatient(patient)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="theme-accent-soft-bg theme-accent-text h-10 w-10 rounded-full flex items-center justify-center font-bold">
                    {patient.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-gray-900">{patient.name}</div>
                      {showTodaysNew && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            isNewPatientToday(patient)
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-amber-100 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isNewPatientToday(patient) ? 'New' : 'Old'}
                        </span>
                      )}
                      {patient.has_account ? (
                        <ShieldCheck size={12} className="text-green-500" />
                      ) : (
                        <ShieldAlert size={12} className="text-gray-300" />
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{patient.phone}</div>
                    <div className="text-[11px] text-gray-400 mt-1">Date: {formatCreatedDate(patient.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPatientDetails(patient);
                    }}
                    className="text-xs font-semibold text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50"
                  >
                    Details
                  </button>
                  <ChevronRight size={18} className="text-gray-300" />
                </div>
              </div>
              
              <div className={`grid ${loyaltyEnabled ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mt-4`}>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Balance</p>
                  <p className={`text-sm font-bold ${patient.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(patient.balance || 0, currency)}
                  </p>
                </div>
                {loyaltyEnabled && (
                  <div className="bg-amber-50 p-2 rounded-lg">
                    <p className="text-[10px] text-amber-600 uppercase font-bold tracking-wider mb-0.5">Points</p>
                    <p className="text-sm font-bold text-amber-700 flex items-center gap-1">
                      <Award size={12} /> {patient.loyalty_points || 0}
                    </p>
                  </div>
                )}
              </div>
              
              {patient.medicalHistory && (
                <div className="mt-3 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-lg text-[11px] text-orange-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                  Medical Review Required
                </div>
              )}

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setEditModal({ open: true, patient });
                  setEditData({
                    name: patient.name,
                    email: patient.email || '',
                    phone: patient.phone || '',
                    medicalHistory: patient.medicalHistory || '',
                    age: patient.age?.toString() || '',
                    address: patient.address || '',
                    city: patient.city || '',
                    township: patient.township || '',
                    patient_type: normalizePatientType(patient.patient_type)
                  });
                }}
                className="w-full mt-2 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 flex items-center justify-center gap-2"
              >
                <Edit size={14} /> Edit Profile
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setAuthModal({ open: true, patient });
                  setNewPassword('');
                }}
                className="w-full mt-2 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100 flex items-center justify-center gap-2"
              >
                <User size={14} /> {patient.has_account ? 'Update Portal Account' : 'Setup Portal Account'}
              </button>

              {loyaltyEnabled && onRedeemPoints && canRedeem(patient) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRedeemClick(patient);
                  }}
                  className="w-full mt-2 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100 flex items-center justify-center gap-2"
                >
                  <Award size={14} /> Redeem
                </button>
              )}
            </div>
          ))}
        </div>
      </>
    )}
    {!detailPatient && !loading && patients.length > 0 && (
      <div className="sticky bottom-0 bg-white border-t border-gray-100">
        <Pagination
          totalItems={filteredPatients.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          showAll={showAll}
          onToggleShowAll={() => setShowAll(!showAll)}
        />
      </div>
    )}

    {authModal.open && authModal.patient && (
      <Modal 
        title={authModal.patient.has_account ? "Update Portal Account" : "Setup Portal Account"} 
        onClose={() => setAuthModal({ open: false, patient: null })}
      >
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
              <User className="text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Patient Name</p>
              <h4 className="text-lg font-black text-indigo-900">{authModal.patient.name}</h4>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-500 leading-relaxed">
              {authModal.patient.has_account 
                ? "Update the password for this patient's portal access. They will use their email, phone, or username to login."
                : "Create a portal account for this patient. Setting a password will allow them to login and view their history using email, phone, or username."}
            </p>
            
            <Input 
              label="New Portal Password" 
              type="password" 
              placeholder="Enter at least 4 characters"
              value={newPassword}
              onChange={(e: any) => setNewPassword(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setAuthModal({ open: false, patient: null })}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-all border border-transparent"
            >
              Cancel
            </button>
            <button 
              disabled={newPassword.length < 4}
              onClick={() => {
                if (onUpdatePatientAuth && authModal.patient) {
                  onUpdatePatientAuth(authModal.patient, newPassword);
                  setAuthModal({ open: false, patient: null });
                }
              }}
              className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Key size={18} />
              {authModal.patient.has_account ? "Update Password" : "Create Account"}
            </button>
          </div>
        </div>
      </Modal>
    )}

    {editModal.open && editModal.patient && (
      <Modal title="Edit Patient Profile" onClose={() => setEditModal({ open: false, patient: null })}>
        <form 
          onSubmit={async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            setIsSubmitting(true);
            try {
              if (onUpdatePatient && editModal.patient) {
                const patientData: Partial<Patient> = {
                  name: editData.name,
                  email: editData.email,
                  phone: editData.phone,
                  medicalHistory: editData.medicalHistory,
                  age: editData.age ? parseInt(editData.age) : undefined,
                  address: editData.address || undefined,
                  city: editData.city || undefined,
                  township: editData.township || undefined,
                  patient_type: editData.patient_type
                };
                await onUpdatePatient(editModal.patient.id, patientData);
                setEditModal({ open: false, patient: null });
              }
            } catch (err: any) {
              // error handled by onUpdatePatient
            } finally {
              setIsSubmitting(false);
            }
          }} 
          className="space-y-5"
        >
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-2">
            <div className="theme-accent-soft-bg theme-accent-text w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl">
              {editModal.patient.name.charAt(0)}
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Editing Patient</p>
              <h4 className="text-lg font-black text-gray-900">{editModal.patient.name}</h4>
            </div>
          </div>

          <Input label="Full Patient Name" required value={editData.name} onChange={(e: any) => setEditData({...editData, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
             <Input label="Primary Email" type="email" value={editData.email} onChange={(e: any) => setEditData({...editData, email: e.target.value})} />
             <Input label="Mobile Contact" required value={editData.phone} onChange={(e: any) => setEditData({...editData, phone: e.target.value})} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Age</label>
              <input
                type="number"
                min="0"
                max="150"
                className="w-full border-gray-200 border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                value={editData.age}
                onChange={(e) => setEditData({...editData, age: e.target.value})}
                placeholder="Enter age"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Patient Type</label>
              <select
                className="w-full border-gray-200 border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white"
                value={editData.patient_type}
                onChange={(e) => setEditData({...editData, patient_type: e.target.value as Patient['patient_type']})}
              >
                <option value="Walk-in">Walk-in</option>
                <option value="ONP">ONP</option>
                <option value="RNP">RNP</option>
                <option value="Hotline">Hotline</option>
                <option value="Rec-ph call">Rec-ph call</option>
                <option value="Tiktok">Tiktok</option>
                <option value="Tiktok Hotline">Tiktok Hotline</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Address</label>
            <input
              type="text"
              className="w-full border-gray-200 border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              value={editData.address}
              onChange={(e) => setEditData({...editData, address: e.target.value})}
              placeholder="Street address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">City</label>
              <SearchableSelect
                value={editData.city || ''}
                onChange={(selectedCity) => {
                  const allowedTownships = getTownshipsForCity(selectedCity);
                  const nextTownship = allowedTownships.includes(editData.township || '') ? editData.township : '';
                  setEditData({ ...editData, city: selectedCity, township: nextTownship });
                }}
                options={cityOptions}
                placeholder="Select City"
                emptyMessage="No city found"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Township</label>
              <SearchableSelect
                value={editData.township || ''}
                onChange={(selectedTownship) => setEditData({ ...editData, township: selectedTownship })}
                options={townshipOptions}
                placeholder={editData.city ? 'Select Township' : 'Select City first'}
                emptyMessage={editData.city ? 'No township found for this city' : 'Choose city first'}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Relevant Medical History</label>
            <textarea className="w-full border-gray-200 border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all" rows={4}
              value={editData.medicalHistory} onChange={e => setEditData({...editData, medicalHistory: e.target.value})} />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-all mt-2"
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </button>

          {onDeletePatient && (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all mt-2"
            >
              Delete Patient
            </button>
          )}
        </form>
      </Modal>
    )}

    {/* Delete Confirmation Dialog */}
    <ConfirmDialog
      isOpen={deleteConfirmOpen}
      title="Delete Patient"
      message={`Are you sure you want to delete ${editModal.patient?.name}? This will permanently remove the patient and all related records. This action cannot be undone.`}
      confirmText="Delete Patient"
      cancelText="Cancel"
      type="danger"
      isLoading={isDeleting}
      onConfirm={async () => {
        if (!editModal.patient || !onDeletePatient) return;
        setIsDeleting(true);
        try {
          await onDeletePatient(editModal.patient.id);
          setEditModal({ open: false, patient: null });
          setDeleteConfirmOpen(false);
        } catch (err: any) {
          alert(err?.message || 'Failed to delete patient');
        } finally {
          setIsDeleting(false);
        }
      }}
      onCancel={() => setDeleteConfirmOpen(false)}
    />

    {redeemModal.open && redeemModal.patient && (
      <Modal
        title="Redeem Loyalty Points"
        onClose={() => {
          setRedeemModal({ open: false, patient: null });
          setRedeemPointsInput('');
        }}
      >
        <div className="space-y-5">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Patient</p>
            <p className="text-lg font-black text-amber-900">{redeemModal.patient.name}</p>
            <p className="text-sm text-amber-700 mt-1">Available Points: <span className="font-bold">{redeemModal.patient.loyalty_points || 0}</span></p>
          </div>

          <Input
            label="Points to Redeem"
            type="number"
            min={1}
            max={redeemModal.patient.loyalty_points || 0}
            value={redeemPointsInput}
            onChange={(e: any) => setRedeemPointsInput(e.target.value)}
            autoFocus
          />

          <div className="flex gap-3">
            <button
              onClick={() => {
                setRedeemModal({ open: false, patient: null });
                setRedeemPointsInput('');
              }}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleRedeemSubmit}
              className="flex-1 bg-amber-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-amber-600/20 hover:bg-amber-700 transition-all"
            >
              Redeem
            </button>
          </div>
        </div>
      </Modal>
    )}
  </div>
  );
};

export default PatientsView;


