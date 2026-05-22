import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { ClinicalRecord } from '../types';
import { formatCurrency, Currency } from '../utils/currency';
import { formatTeethWithPosition } from '../utils/toothNumbering';

interface TreatmentSelectionModalProps {
  treatments: ClinicalRecord[];
  currency: Currency;
  onConfirm: (selectedTreatments: ClinicalRecord[]) => void;
  onClose: () => void;
}

const RECENT_THRESHOLD_DAYS = 7;

const TreatmentSelectionModal: React.FC<TreatmentSelectionModalProps> = ({
  treatments,
  currency,
  onConfirm,
  onClose
}) => {
  // Start with nothing selected — user picks what they want
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Reset selection whenever the list changes (start deselected)
    setSelectedIds(new Set());
  }, [treatments]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Sort: most recent first
  const sortedTreatments = useMemo(() => {
    return [...treatments].sort((a, b) => {
      const dateA = new Date(a.date || '').getTime();
      const dateB = new Date(b.date || '').getTime();
      return dateB - dateA;
    });
  }, [treatments]);

  const isRecent = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const diffDays = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= RECENT_THRESHOLD_DAYS;
  };

  const toggleTreatment = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(treatments.map(t => t.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    const selected = treatments.filter(t => selectedIds.has(t.id));
    onConfirm(selected);
  };

  const selectedTreatments = treatments.filter(t => selectedIds.has(t.id));
  const totalSelected = selectedTreatments.reduce((sum, t) => sum + (t.cost || 0), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Select Treatments for Receipt</h2>
            <p className="text-sm text-gray-500 mt-1">Choose which treatments to include. Related medicine sales are listed separately on the receipt.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className="mb-4 flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-medium"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Deselect All
            </button>
            <div className="flex-1"></div>
            <div className="text-sm text-gray-600 font-medium">
              Selected: {selectedIds.size} of {treatments.length} treatments
            </div>
          </div>

          <div className="space-y-2">
            {sortedTreatments.length === 0 ? (
              <div className="text-center py-8 text-gray-400 italic">
                No treatments available
              </div>
            ) : (
              sortedTreatments.map((treatment) => {
                const isSelected = selectedIds.has(treatment.id);
                const recent = isRecent(treatment.date || '');
                return (
                  <div
                    key={treatment.id}
                    onClick={() => toggleTreatment(treatment.id)}
                    className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : recent
                          ? 'border-amber-300 bg-amber-50/40 hover:border-amber-400'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {recent && (
                      <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        <Sparkles className="w-3 h-3" />
                        Recent
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <div
                        className={`mt-1 w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">{treatment.description}</h4>
                            {recent && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                <Sparkles className="w-2.5 h-2.5" />
                                NEW
                              </span>
                            )}
                          </div>
                          <span className="text-base font-bold text-gray-900">
                            {formatCurrency(treatment.cost || 0, currency)}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm text-gray-600">
                          <span>
                            Date: {new Date(treatment.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                          {treatment.teeth && treatment.teeth.length > 0 && (
                            <span>Teeth: {formatTeethWithPosition(treatment.teeth)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Total Selected:</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(totalSelected, currency)}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreatmentSelectionModal;

