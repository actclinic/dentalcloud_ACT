import React, { useMemo } from 'react';
import { TeethDiagram } from 'react-teeth-selector';
import { 
  normalizeToFDI, 
  normalizeToUniversal, 
  isValidFDIPrimary,
  isValidFDIPermanent,
  isValidUniversalPermanent
} from '../utils/toothNumbering';

interface SelectorProps {
  selectedTeeth: number[];
  onToggleTooth: (id: number) => void;
  onDeselectAll: () => void;
  compact?: boolean;
  doctorCompact?: boolean;
}

export const ToothSelector: React.FC<SelectorProps> = ({
  selectedTeeth,
  onToggleTooth,
  onDeselectAll,
  compact = false,
  doctorCompact = false
}) => {
  // The app stores teeth in FDI/ISO format (11-48 permanent, 51-85 primary)
  // react-teeth-selector emits FDI-style IDs from the SVG
  // No conversion needed - we work natively in FDI/ISO

  // Convert array of tooth numbers to the map format expected by the library
  const selectedTeethMap = useMemo(() => {
    const map: { [key: string]: boolean } = {};
    selectedTeeth.forEach(toothId => {
      // Normalize to FDI/ISO for display
      const displayId = normalizeToFDI(toothId);
      // The library requires 'tooth-' prefix for internal key matching
      map[`tooth-${displayId}`] = true;
    });
    return map;
  }, [selectedTeeth]);

  // Handle tooth click/toggle from react-teeth-selector
  const handleTeethChange = (newMap: any, info: any) => {
    // Get the raw numeric FDI tooth number from the library callback.
    // `id` may be like "tooth-65" (primary tooth)
    const rawId = info?.number ?? info?.id ?? info;

    if (rawId != null) {
      // Parse the ID to a number (supports both "65" and "tooth-65")
      const cleanId = rawId.toString().replace(/\D/g, '');
      const toothId = parseInt(cleanId, 10);

      if (!isNaN(toothId)) {
        // Validate the tooth number (accepts both permanent 11-48 and primary 51-85)
        if (isValidFDIPermanent(toothId) || isValidFDIPrimary(toothId)) {
          // Store in FDI/ISO format natively - no conversion needed
          onToggleTooth(toothId);
        } else {
          console.warn(`[ToothSelector] Invalid tooth number from library: ${toothId}`);
        }
      }
    }
  };

  const diagramMaxWidth = doctorCompact ? '100%' : (compact ? '260px' : '380px');

  return (
    <div 
      className={`flex flex-col items-center bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 shadow-sm w-full max-w-full mx-auto backdrop-blur-sm ${
        doctorCompact ? 'gap-1.5 p-2' : 'gap-3 p-3'
      }`}
      onClick={(e) => {
        // Auto-deselect when clicking the background area of the component
        if (e.target === e.currentTarget) {
          onDeselectAll();
        }
      }}
    >
      
      {/* Diagram Title */}
      <div className={`text-center pointer-events-none ${doctorCompact ? 'mb-0.5' : 'mb-1'}`}>
        <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-0.5 flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Clinical Odontogram
        </h3>
        <p className="text-[10px] text-slate-500">FDI/ISO 3950 Standard</p>
      </div>

      {/* Orientation Labels - Dentist's perspective (facing patient) */}
      {!doctorCompact && (
        <div
          className="w-full grid grid-cols-3 items-center text-[9px] font-bold uppercase tracking-wider text-slate-500 px-1"
          style={{ maxWidth: diagramMaxWidth }}
        >
          <span className="text-left">Right</span>
          <span className="text-center">Maxilla (Upper)</span>
          <span className="text-right">Left</span>
        </div>
      )}

      {/* React Teeth Selector Component */}
      <div 
        className={`w-full flex justify-center ${doctorCompact ? 'py-0' : 'py-1'}`}
        onClick={(e) => {
          // If clicking the padding area around the diagram, deselect all
          if (e.target === e.currentTarget) {
            onDeselectAll();
          }
        }}
      >
        <div className="w-full cursor-pointer" style={{ maxWidth: diagramMaxWidth }}>
          <TeethDiagram 
            selectedTeeth={selectedTeethMap}
            onChange={handleTeethChange}
            width="100%"
            height="auto"
          />
        </div>
      </div>

      {/* Bottom Orientation Labels - Dentist's perspective (facing patient) */}
      {!doctorCompact && (
        <div
          className="w-full grid grid-cols-3 items-center text-[9px] font-bold uppercase tracking-wider text-slate-500 px-1 -mt-1"
          style={{ maxWidth: diagramMaxWidth }}
        >
          <span className="text-left">Right</span>
          <span className="text-center">Mandible (Lower)</span>
          <span className="text-right">Left</span>
        </div>
      )}

      {/* Legend - Very Compact */}
      <div className={`flex items-center justify-between w-full border-t border-slate-100 ${doctorCompact ? 'pt-1 mt-0.5' : 'pt-2 mt-1'}`}>
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-[9px] text-slate-600 font-medium">Selected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-slate-200"></div>
            <span className="text-[9px] text-slate-600 font-medium">Available</span>
          </div>
        </div>
        {!doctorCompact && (
          <div className="px-2 py-0.5 bg-blue-50 rounded text-[9px] text-blue-700 font-bold border border-blue-100">
            {selectedTeeth.length} Teeth
          </div>
        )}
      </div>

    </div>
  );
};
