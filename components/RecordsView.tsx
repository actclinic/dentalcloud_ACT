import React, { useState, useMemo } from 'react';
import { Activity, Loader2, Download } from 'lucide-react';
import { ClinicalRecord } from '../types';
import { formatCurrency, Currency } from '../utils/currency';
import { exportClinicalRecordsToPDF } from '../utils/pdfExport';
import { exportClinicalRecordsToExcel } from '../utils/excelExport';
import { formatTeethWithPosition } from '../utils/toothNumbering';
import Pagination from './Pagination';
import ExportMenu from './ExportMenu';

interface RecordsViewProps {
  records: ClinicalRecord[];
  loading: boolean;
  onRefresh: () => void;
  onDeleteAll: () => void;
  currency: Currency;
  isDoctor?: boolean;
}

const RecordsView: React.FC<RecordsViewProps> = ({ records, loading, onRefresh, onDeleteAll, currency, isDoctor = false }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;

  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records;
    const term = searchTerm.toLowerCase();
    return records.filter((record) =>
      (record.patient_name || '').toLowerCase().includes(term) ||
      (record.doctor_name || '').toLowerCase().includes(term) ||
      record.description.toLowerCase().includes(term) ||
      record.date.toLowerCase().includes(term) ||
      record.teeth.some((tooth) => tooth.toString().includes(term))
    );
  }, [records, searchTerm]);

  const paginatedRecords = useMemo(() => {
    if (showAll) return filteredRecords;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage, showAll]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [records]);

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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
      <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-3 bg-white sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{isDoctor ? 'Patient Treatment Records' : 'Clinic Registry Audit'}</h2>
          <p className="text-sm text-gray-500">{isDoctor ? 'Your completed treatments and history.' : 'Master log of all performed clinical treatments'}</p>
        </div>
        {!isDoctor && (
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <ExportMenu
              disabled={records.length === 0}
              onExportPDF={handleDownloadPDF}
              onExportExcel={handleDownloadExcel}
              className="w-full sm:w-auto"
            />
            <button
              onClick={handleDownloadJSON}
              disabled={records.length === 0}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} /> Download JSON
            </button>
            <button
              onClick={onRefresh}
              className="text-indigo-600 text-sm font-bold flex items-center justify-center gap-2 hover:underline border border-indigo-100 rounded-lg px-3 py-2"
            >
              <Activity size={16} /> Refresh Records
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[var(--hover-600)]" /></div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Patient File</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Doctor</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Clinical Event</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Anatomy</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Billed Amt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400 italic">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500">{rec.date}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{rec.patient_name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{rec.doctor_name ? `Dr. ${rec.doctor_name}` : '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{rec.description}</td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-500">
                        {rec.teeth && rec.teeth.length > 0 ? (
                          <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded leading-relaxed">
                            {formatTeethWithPosition(rec.teeth)}
                          </span>
                        ) : 'Gen.'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black text-gray-900">{formatCurrency(rec.cost || 0, currency)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100">
            {records.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 italic">No records found.</div>
            ) : (
              paginatedRecords.map((rec) => (
                <div key={rec.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-gray-400">Patient</p>
                      <p className="text-sm font-bold text-gray-900">{rec.patient_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 mt-1">{rec.date}</p>
                    </div>
                    <p className="text-sm font-black text-indigo-700">{formatCurrency(rec.cost || 0, currency)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1">Treatment</p>
                    <p className="text-sm text-gray-800">{rec.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-gray-100 p-2">
                      <p className="text-gray-400 uppercase font-semibold mb-1">Doctor</p>
                      <p className="text-gray-700">{rec.doctor_name ? `Dr. ${rec.doctor_name}` : '-'}</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 p-2">
                      <p className="text-gray-400 uppercase font-semibold mb-1">Teeth</p>
                      <p className="text-gray-700">
                        {rec.teeth && rec.teeth.length > 0 ? formatTeethWithPosition(rec.teeth) : 'General'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {!loading && records.length > 0 && (
        <Pagination
          totalItems={records.length}
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
