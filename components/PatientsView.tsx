import React, { useState, useMemo } from 'react';
import { Search, Plus, Loader2, ChevronRight, FileDown, Award, User, ShieldCheck, ShieldAlert, Key, Edit } from 'lucide-react';
import { Patient, LoyaltyRule } from '../types';
import { formatCurrency, Currency } from '../utils/currency';
import { exportPatientsToPDF } from '../utils/pdfExport';
import Pagination from './Pagination';
import { Modal, Input } from './Shared';

interface PatientsViewProps {
  patients: Patient[];
  loading: boolean;
  currency: Currency;
  onSelectPatient: (patient: Patient) => void;
  onAddPatient: () => void;
  onUpdatePatient?: (id: string, data: Partial<Patient>) => Promise<void>;
  onRedeemPoints?: (patient: Patient, points: number, amount: number) => void;
  onUpdatePatientAuth?: (patient: Patient, password: string) => void;
  loyaltyEnabled: boolean;
  loyaltyRules?: LoyaltyRule[];
}

const PatientsView: React.FC<PatientsViewProps> = ({ 
  patients, 
  loading, 
  currency, 
  onSelectPatient, 
  onAddPatient, 
  onUpdatePatient,
  onRedeemPoints, 
  onUpdatePatientAuth,
  loyaltyEnabled, 
  loyaltyRules = [] 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [authModal, setAuthModal] = useState<{ open: boolean, patient: Patient | null }>({ open: false, patient: null });
  const [editModal, setEditModal] = useState<{ open: boolean, patient: Patient | null }>({ open: false, patient: null });
  const [editData, setEditData] = useState({ name: '', email: '', phone: '', medicalHistory: '' });
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const itemsPerPage = 10;

  // Filtered data based on search term
  const filteredPatients = useMemo(() => {
    if (!searchTerm) return patients;
    const term = searchTerm.toLowerCase();
    return patients.filter(patient => 
      patient.name.toLowerCase().includes(term) ||
      patient.email?.toLowerCase().includes(term) ||
      patient.phone.toLowerCase().includes(term) ||
      patient.medicalHistory?.toLowerCase().includes(term)
    );
  }, [patients, searchTerm]);

  // Paginated data
  const paginatedPatients = useMemo(() => {
    if (showAll) return filteredPatients;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPatients.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPatients, currentPage, showAll]);

  // Reset to first page when patients change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [patients]);

  const handleDownloadPDF = () => {
    exportPatientsToPDF(patients, currency);
  };

  const canRedeem = (patient: Patient) => (patient.loyalty_points || 0) > 0;

  const handleRedeemClick = (patient: Patient) => {
    if (!onRedeemPoints) return;

    const availablePoints = patient.loyalty_points || 0;
    if (availablePoints <= 0) {
      alert('This patient has no points to redeem.');
      return;
    }

    const input = prompt(
      `Enter points to redeem for ${patient.name} (Available: ${availablePoints}):`,
      Math.min(availablePoints, 1000).toString()
    );

    if (input === null) return;

    const points = parseInt(input, 10);
    if (isNaN(points) || points <= 0 || points > availablePoints) {
      alert(`Please enter a valid amount between 1 and ${availablePoints}.`);
      return;
    }

    if (confirm(`Redeem ${points} points?`)) {
      onRedeemPoints(patient, points, 0);
    }
  };

  return (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
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
            onClick={handleDownloadPDF}
            disabled={patients.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" /> <span className="hidden sm:inline">Export PDF</span>
          </button>
          <button onClick={onAddPatient} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Patient</span>
          </button>
        </div>
      </div>
    </div>
    {loading ? (
      <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
    ) : patients.length === 0 ? (
      <div className="p-12 text-center text-gray-400 italic">No patients found. Add your first patient to begin.</div>
    ) : (
      <>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Portal Access</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Info</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Medical Status</th>
                {loyaltyEnabled && <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Loyalty Points</th>}
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Balance</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-indigo-50/30 transition-colors group cursor-pointer" onClick={() => onSelectPatient(patient)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3">
                        {patient.name?.charAt(0) || '?'}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700">{patient.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {patient.has_account ? (
                      <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100 w-fit">
                        <ShieldCheck size={14} />
                        <span className="text-[10px] font-bold uppercase">Active</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100 w-fit">
                        <ShieldAlert size={14} />
                        <span className="text-[10px] font-bold uppercase">No Access</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-700">{patient.email}</span>
                      <span className="text-xs text-gray-400">{patient.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs ${patient.medicalHistory ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                      {patient.medicalHistory ? 'Review Required' : 'No Alerts'}
                    </span>
                  </td>
                  {loyaltyEnabled && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1.5 text-amber-600 font-bold">
                        <Award size={14} />
                        {patient.loyalty_points || 0}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {patient.balance > 0 ? (
                      <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded border border-red-100">{formatCurrency(patient.balance || 0, currency)}</span>
                    ) : (
                      <span className="text-green-600 font-medium">Clear</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      {loyaltyEnabled && onRedeemPoints && canRedeem(patient) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRedeemClick(patient);
                          }}
                          className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        >
                          <Award size={14} /> Redeem
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditModal({ open: true, patient });
                          setEditData({
                            name: patient.name,
                            email: patient.email || '',
                            phone: patient.phone || '',
                            medicalHistory: patient.medicalHistory || ''
                          });
                        }}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        title="Edit patient profile"
                      >
                        <Edit size={14} /> Edit
                      </button>
                      <button className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1">
                        View Chart <ChevronRight size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {paginatedPatients.map((patient) => (
            <div 
              key={patient.id} 
              className="p-4 hover:bg-gray-50 active:bg-indigo-50 transition-colors"
              onClick={() => onSelectPatient(patient)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                    {patient.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-gray-900">{patient.name}</div>
                      {patient.has_account ? (
                        <ShieldCheck size={12} className="text-green-500" />
                      ) : (
                        <ShieldAlert size={12} className="text-gray-300" />
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{patient.phone}</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
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
                    medicalHistory: patient.medicalHistory || ''
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
    {!loading && patients.length > 0 && (
      <Pagination
        totalItems={patients.length}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        showAll={showAll}
        onToggleShowAll={() => setShowAll(!showAll)}
      />
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
                ? "Update the password for this patient's portal access. They will use their name/phone to login."
                : "Create a portal account for this patient. Setting a password will allow them to login and view their history."}
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
                await onUpdatePatient(editModal.patient.id, editData);
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
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl">
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
        </form>
      </Modal>
    )}
  </div>
  );
};

export default PatientsView;
