import React from 'react';
import { User, X, Upload, Trash2, FileText, Receipt as ReceiptIcon, Package, RotateCcw, Award, Zap, Key, Edit } from 'lucide-react';
import { ToothSelector } from './ToothSelector';
import { Patient, TreatmentType, ClinicalRecord, PatientFile, LoyaltyTransaction, LoyaltyRule, Doctor } from '../types';
import { formatCurrency, getCurrencySymbol, Currency } from '../utils/currency';
import { Modal, Input } from './Shared';

export interface UploadProgress {
  fileName: string;
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
}

interface ClinicalViewProps {
  selectedPatient: Patient | null;
  doctors: Doctor[];
  selectedDoctorId: string;
  selectedTeeth: number[];
  treatmentTypes: TreatmentType[];
  treatmentHistory: ClinicalRecord[];
  patientFiles: PatientFile[];
  uploadingFiles: boolean;
  useFlatRate: boolean;
  currency: Currency;
  onToggleTooth: (id: number) => void;
  onDoctorChange: (doctorId: string) => void;
  onDeselectAll: () => void;
  onTreatmentSubmit: (t: TreatmentType) => void;
  onPaymentRequest: (amount: number) => void;
  onClosePatient: () => void;
  onOpenDirectory: () => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onUploadFilesWithProgress?: (files: File[], onProgress: (progress: UploadProgress) => void) => Promise<void>;
  onDeleteFile: (path: string) => void;
  onGenerateReceipt: () => void;
  onAddMedicines?: () => void;
  onToggleFlatRate: (value: boolean) => void;
  onUndoTreatment?: (record: ClinicalRecord) => void;
  onRedeemPoints?: (points: number, amount: number) => void;
  onUpdatePatient?: (id: string, data: Partial<Patient>) => Promise<void>;
  onUpdateAccount?: (patient: Patient, password: string) => void;
  loyaltyEnabled: boolean;
  loyaltyRules?: LoyaltyRule[];
  loyaltyTransactions?: LoyaltyTransaction[];
}

const ClinicalView: React.FC<ClinicalViewProps> = ({
  selectedPatient,
  doctors,
  selectedDoctorId,
  selectedTeeth,
  treatmentTypes,
  treatmentHistory,
  patientFiles,
  uploadingFiles,
  useFlatRate,
  currency,
  onToggleTooth,
  onDoctorChange,
  onDeselectAll,
  onTreatmentSubmit,
  onPaymentRequest,
  onClosePatient,
  onOpenDirectory,
  onUploadFiles,
  onUploadFilesWithProgress,
  onDeleteFile,
  onGenerateReceipt,
  onAddMedicines,
  onToggleFlatRate,
  onUndoTreatment,
  onRedeemPoints,
  onUpdatePatient,
  onUpdateAccount,
  loyaltyEnabled,
  loyaltyRules = [],
  loyaltyTransactions = []
}) => {
  const currencySymbol = getCurrencySymbol(currency);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [authModal, setAuthModal] = React.useState(false);
  const [editModal, setEditModal] = React.useState(false);
  const [redeemModal, setRedeemModal] = React.useState(false);
  const [redeemPointsInput, setRedeemPointsInput] = React.useState('');
  const [editData, setEditData] = React.useState({ name: '', email: '', phone: '', medicalHistory: '' });
  const [newPassword, setNewPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<UploadProgress | null>(null);
  const [isUploadingWithProgress, setIsUploadingWithProgress] = React.useState(false);

  const canRedeem = (selectedPatient?.loyalty_points || 0) > 0;

  const handleRedeemSubmit = () => {
    if (!selectedPatient || !onRedeemPoints) return;

    const availablePoints = selectedPatient.loyalty_points || 0;
    const points = parseInt(redeemPointsInput, 10);

    if (isNaN(points) || points <= 0 || points > availablePoints) {
      alert(`Please enter a valid amount between 1 and ${availablePoints}.`);
      return;
    }

    onRedeemPoints(points, 0);
    setRedeemModal(false);
    setRedeemPointsInput('');
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getToothPosition = (tooth: number) => {
    // Universal permanent numbering (1-32)
    if (tooth >= 1 && tooth <= 8) return 'Upper Right';
    if (tooth >= 9 && tooth <= 16) return 'Upper Left';
    if (tooth >= 17 && tooth <= 24) return 'Lower Left';
    if (tooth >= 25 && tooth <= 32) return 'Lower Right';

    // FDI permanent numbering (11-48)
    const quadrant = Math.floor(tooth / 10);
    if (quadrant === 1) return 'Upper Right';
    if (quadrant === 2) return 'Upper Left';
    if (quadrant === 3) return 'Lower Left';
    if (quadrant === 4) return 'Lower Right';

    // FDI primary numbering (51-85)
    if (quadrant === 5) return 'Upper Right';
    if (quadrant === 6) return 'Upper Left';
    if (quadrant === 7) return 'Lower Left';
    if (quadrant === 8) return 'Lower Right';

    return 'Unknown Position';
  };

  const formatTeethWithPosition = (teeth: number[]) => {
    if (!teeth || teeth.length === 0) return 'General';
    return teeth.map((tooth) => `${tooth} (${getToothPosition(tooth)})`).join(', ');
  };

  const formatDoctorName = (name?: string) => {
    if (!name) return '—';
    return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
  };

  const allowedFile = (file: File) => {
    const allowedTypes = [
      'image/',
      'application/pdf',
      'video/',
      'application/zip',
      'application/x-zip-compressed',
      'multipart/x-zip'
    ];
    return allowedTypes.some(type => 
      type.endsWith('/') ? file.type.startsWith(type) : file.type === type
    );
  };

  const handleUpload = async (files: File[]) => {
    const filtered = files.filter(allowedFile);
    if (filtered.length === 0) return;

    // Use chunked upload with progress if available
    if (onUploadFilesWithProgress) {
      setIsUploadingWithProgress(true);
      setUploadProgress(null);
      try {
        await onUploadFilesWithProgress(filtered, (progress) => {
          setUploadProgress(progress);
        });
      } catch (err: any) {
        alert(err.message || 'Upload failed');
      } finally {
        setIsUploadingWithProgress(false);
        setUploadProgress(null);
      }
    } else {
      // Fallback to regular upload
      onUploadFiles(filtered);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) handleUpload(files);
  };

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length) {
      handleUpload(Array.from(files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 animate-fade-in overflow-hidden max-w-full">
    <div className="xl:col-span-2 space-y-4 md:space-y-6 min-w-0 overflow-hidden">
      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Odontogram Interface</h2>
            <p className="text-sm text-gray-500">Interactive tooth mapping and service delivery</p>
          </div>
        </div>
        
        <div className="flex justify-start md:justify-center w-full overflow-x-auto pb-4 custom-scrollbar">
          <div className="min-w-[400px] md:min-w-[600px] max-w-full">
            <ToothSelector 
              selectedTeeth={selectedTeeth} 
              onToggleTooth={onToggleTooth} 
              onDeselectAll={onDeselectAll}
            />
          </div>
        </div>
        
        {selectedPatient && (
          <div className="mt-6 p-6 bg-indigo-50 rounded-lg border border-indigo-100">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-indigo-900">
                {selectedTeeth.length > 0 ? `Apply to Teeth: ${selectedTeeth.join(', ')}` : 'Select Teeth to Perform Treatment'}
              </h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useFlatRate}
                  onChange={(e) => onToggleFlatRate(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-indigo-900">
                  Flat Rate (All Teeth)
                </span>
              </label>
            </div>
            <div className="mb-4">
              <label className="block text-[10px] text-indigo-700 uppercase font-bold tracking-wider mb-1.5">Treating Doctor</label>
              <select
                value={selectedDoctorId}
                onChange={(e) => onDoctorChange(e.target.value)}
                className="w-full border border-indigo-200 bg-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select doctor (optional)</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.name}{doctor.specialization ? ` - ${doctor.specialization}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
               {treatmentTypes.map(t => {
                 const displayCost = useFlatRate 
                   ? t.cost 
                   : (t.cost * (selectedTeeth.length || 1));
                 const costLabel = useFlatRate 
                   ? `${formatCurrency(t.cost, currency)} (flat rate)` 
                   : `${formatCurrency(t.cost, currency)} / tooth`;
                 const isDisabled = !useFlatRate && selectedTeeth.length === 0;
                 
                 return (
                   <button 
                    key={t.id}
                    disabled={isDisabled}
                    onClick={() => onTreatmentSubmit(t)}
                    className="flex flex-col items-start bg-white hover:bg-indigo-600 hover:text-white p-3 rounded-xl border border-indigo-100 text-left transition-all shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     <span className="text-sm font-bold group-hover:text-white text-gray-900">{t.name}</span>
                     <span className="text-xs text-indigo-600 group-hover:text-indigo-100">
                       {costLabel}
                       {!useFlatRate && selectedTeeth.length > 0 && (
                         <span className="block mt-0.5 font-semibold">Total: {formatCurrency(displayCost, currency)}</span>
                       )}
                       {useFlatRate && (
                         <span className="block mt-0.5 font-semibold text-green-600 group-hover:text-green-200">Flat: {formatCurrency(displayCost, currency)}</span>
                       )}
                     </span>
                   </button>
                 );
               })}
            </div>
          </div>
        )}
      </div>

      {selectedPatient && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Clinical Case History</h3>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 sticky top-0 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3">Anatomy (Teeth)</th>
                  <th className="px-4 py-3">Service Provided</th>
                  <th className="px-4 py-3 text-right">Fee</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {treatmentHistory.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 italic">No clinical history recorded for this patient.</td></tr>
                ) : (
                  treatmentHistory.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500">{rec.date}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{formatDoctorName(rec.doctor_name)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded leading-relaxed inline-block">
                          {formatTeethWithPosition(rec.teeth)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{rec.description}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(rec.cost || 0, currency)}</td>
                      <td className="px-4 py-3 text-center">
                        {onUndoTreatment && (
                          <button 
                            onClick={() => onUndoTreatment(rec)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Undo/Delete Record"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>

    <div className="space-y-6 h-fit">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Patient Brief</h3>
        {selectedPatient ? (
          <div className="space-y-6">
             <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-700">
                  {selectedPatient.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 leading-tight">{selectedPatient.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{selectedPatient.phone}</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 gap-3">
               <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                 <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Outstanding Balance</p>
                 <div className="flex justify-between items-baseline">
                    <p className={`text-3xl font-black ${selectedPatient.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(selectedPatient.balance || 0, currency)}
                    </p>
                    {selectedPatient.balance > 0 && (
                      <button 
                        onClick={() => onPaymentRequest(selectedPatient.balance)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        Collect Payment
                      </button>
                    )}
                 </div>
               </div>

               {loyaltyEnabled && selectedPatient && (
                 <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                   <div className="flex justify-between items-center mb-1">
                     <p className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">Loyalty Rewards</p>
                     <Award size={14} className="text-amber-600" />
                   </div>
                   <div className="flex justify-between items-baseline">
                      <p className="text-3xl font-black text-amber-700">
                        {selectedPatient.loyalty_points || 0} <span className="text-sm font-bold">Points</span>
                      </p>
                      {onRedeemPoints && canRedeem && (
                        <button 
                          onClick={() => {
                            const availablePoints = selectedPatient.loyalty_points || 0;
                            setRedeemPointsInput(Math.min(availablePoints, 1000).toString());
                            setRedeemModal(true);
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1"
                        >
                          <Zap size={12} /> Redeem
                        </button>
                      )}
                   </div>
                 </div>
               )}

               <div className={`p-4 rounded-xl border ${selectedPatient.medicalHistory ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
                 <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Medical Alerts</p>
                 <p className={`text-sm ${selectedPatient.medicalHistory ? 'text-orange-900 font-medium' : 'text-gray-500 italic'}`}>
                   {selectedPatient.medicalHistory || "No active medical alerts."}
                 </p>
               </div>

               {onAddMedicines && (
                 <button 
                   className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
                   onClick={onAddMedicines}
                 >
                   <Package size={16} /> Add Medicines
                 </button>
               )}

               <button 
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                onClick={onGenerateReceipt}
               >
                 <ReceiptIcon size={16} /> Generate Receipt
               </button>

               {onUpdatePatient && selectedPatient && (
                 <button 
                  className="w-full bg-indigo-50 text-indigo-700 py-3 rounded-xl font-bold text-sm mt-2 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 border border-indigo-100"
                  onClick={() => {
                    setEditModal(true);
                    setEditData({
                      name: selectedPatient.name,
                      email: selectedPatient.email || '',
                      phone: selectedPatient.phone || '',
                      medicalHistory: selectedPatient.medicalHistory || ''
                    });
                  }}
                 >
                   <Edit size={16} /> Edit Patient Profile
                 </button>
               )}
               
               {onUpdateAccount && selectedPatient && (
                 <button 
                  className="w-full bg-amber-100 text-amber-700 py-3 rounded-xl font-bold text-sm mt-2 hover:bg-amber-200 transition-all flex items-center justify-center gap-2 border border-amber-200"
                  onClick={() => {
                    setAuthModal(true);
                    setNewPassword('');
                  }}
                 >
                   <User size={16} /> {selectedPatient.has_account ? 'Update Portal Account' : 'Set Portal Account'}
                 </button>
               )}

               {authModal && selectedPatient && (
                 <Modal 
                   title={selectedPatient.has_account ? "Update Portal Account" : "Setup Portal Account"} 
                   onClose={() => setAuthModal(false)}
                 >
                   <div className="space-y-6">
                     <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-4">
                       <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                         <User className="text-indigo-600" />
                       </div>
                       <div>
                         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Patient Name</p>
                         <h4 className="text-lg font-black text-indigo-900">{selectedPatient.name}</h4>
                       </div>
                     </div>

                     <div className="space-y-4">
                       <p className="text-sm text-gray-500 leading-relaxed">
                         {selectedPatient.has_account 
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
                         onClick={() => setAuthModal(false)}
                         className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-all border border-transparent"
                       >
                         Cancel
                       </button>
                       <button 
                         disabled={newPassword.length < 4}
                         onClick={() => {
                           if (onUpdateAccount) {
                             onUpdateAccount(selectedPatient, newPassword);
                             setAuthModal(false);
                           }
                         }}
                         className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                       >
                         <Key size={18} />
                         {selectedPatient.has_account ? "Update Password" : "Create Account"}
                       </button>
                     </div>
                   </div>
                 </Modal>
               )}

               {editModal && selectedPatient && (
                 <Modal title="Edit Patient Profile" onClose={() => setEditModal(false)}>
                   <form 
                     onSubmit={async (e) => {
                       e.preventDefault();
                       if (isSubmitting) return;
                       setIsSubmitting(true);
                       try {
                         if (onUpdatePatient) {
                           await onUpdatePatient(selectedPatient.id, editData);
                           setEditModal(false);
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
                         {selectedPatient.name.charAt(0)}
                       </div>
                       <div>
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Editing Patient</p>
                         <h4 className="text-lg font-black text-gray-900">{selectedPatient.name}</h4>
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

               {redeemModal && selectedPatient && (
                 <Modal
                   title="Redeem Loyalty Points"
                   onClose={() => {
                     setRedeemModal(false);
                     setRedeemPointsInput('');
                   }}
                 >
                   <div className="space-y-5">
                     <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                       <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Patient</p>
                       <p className="text-lg font-black text-amber-900">{selectedPatient.name}</p>
                       <p className="text-sm text-amber-700 mt-1">Available Points: <span className="font-bold">{selectedPatient.loyalty_points || 0}</span></p>
                     </div>

                     <Input
                       label="Points to Redeem"
                       type="number"
                       min={1}
                       max={selectedPatient.loyalty_points || 0}
                       value={redeemPointsInput}
                       onChange={(e: any) => setRedeemPointsInput(e.target.value)}
                       autoFocus
                     />

                     <div className="flex gap-3">
                       <button
                         onClick={() => {
                           setRedeemModal(false);
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

               <button 
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-sm mt-2 hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                onClick={onClosePatient}
               >
                 <X size={16} /> Close Patient File
               </button>
             </div>

             {/* Loyalty History */}
             {loyaltyEnabled && loyaltyTransactions.length > 0 && (
               <div className="mt-6">
                 <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Points Activity</h4>
                 <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                   {loyaltyTransactions.slice(0, 5).map(tx => (
                     <div key={tx.id} className="flex justify-between items-center p-2 rounded-lg bg-gray-50 border border-gray-100">
                       <div>
                         <p className="text-[11px] font-bold text-gray-800">{tx.description}</p>
                         <p className="text-[9px] text-gray-400">{new Date(tx.date).toLocaleDateString()}</p>
                       </div>
                       <span className={`text-xs font-black ${tx.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                         {tx.points > 0 ? '+' : ''}{tx.points}
                       </span>
                     </div>
                   ))}
                 </div>
               </div>
             )}
          </div>
        ) : (
          <div className="text-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-2xl">
            <User className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-5 font-medium">No patient currently active in focus.</p>
            <button 
              onClick={onOpenDirectory}
              className="bg-indigo-50 text-indigo-700 font-bold px-6 py-2 rounded-xl text-xs hover:bg-indigo-100"
            >
              Open Directory
            </button>
          </div>
        )}
      </div>

      {selectedPatient && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Files & Imaging</p>
              <h3 className="text-lg font-bold text-gray-800">Patient Documents</h3>
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-4 text-center bg-gray-50 transition-colors ${
              isUploadingWithProgress ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-200 hover:border-indigo-300'
            }`}
          >
            <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-800">Drag & drop X-rays, documents, videos, or ZIP files</p>
            <p className="text-xs text-gray-500 mb-3">Accepted: images, PDF, videos, ZIP. Max 10 files at once.</p>
            
            {/* Upload Progress Bar */}
            {isUploadingWithProgress && uploadProgress && (
              <div className="mb-3 mx-auto max-w-xs">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 truncate max-w-[200px]">{uploadProgress.fileName}</span>
                  <span className="font-semibold text-indigo-600">{uploadProgress.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatBytes(uploadProgress.bytesUploaded)} / {formatBytes(uploadProgress.bytesTotal)}
                </p>
                <p className="text-xs text-indigo-600 font-medium mt-1">Chunked upload in progress...</p>
              </div>
            )}
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingWithProgress}
                className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Browse files
              </button>
              {(uploadingFiles || isUploadingWithProgress) && (
                <span className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full" />
                  Uploading...
                </span>
              )}
            </div>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf,video/*,.zip,application/zip,application/x-zip-compressed"
              ref={fileInputRef}
              onChange={handleBrowse}
              disabled={isUploadingWithProgress}
              className="hidden"
            />
          </div>

          <div className="mt-5 space-y-3">
            {patientFiles.length === 0 ? (
              <div className="text-xs text-gray-400 text-center italic">No files uploaded for this patient.</div>
            ) : (
              patientFiles.map((file) => (
                <div key={file.path} className="flex items-center justify-between px-3 py-2 border border-gray-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                      <p className="text-xs text-gray-500">{file.type || 'File'} · {formatBytes(file.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-600 font-bold hover:text-indigo-800"
                    >
                      View
                    </a>
                    <button
                      onClick={() => onDeleteFile(file.path)}
                      className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  </div>
  );
};

export default ClinicalView;
