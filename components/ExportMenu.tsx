import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileDown, FileSpreadsheet } from 'lucide-react';

interface ExportMenuProps {
  disabled?: boolean;
  onExportPDF: () => void;
  onExportExcel: () => void;
  className?: string;
  buttonLabelClassName?: string;
}

const ExportMenu: React.FC<ExportMenuProps> = ({
  disabled = false,
  onExportPDF,
  onExportExcel,
  className = '',
  buttonLabelClassName = 'hidden sm:inline'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(open => !open)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <FileDown className="w-4 h-4" />
        <span className={buttonLabelClassName}>Export</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction(onExportPDF)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileDown className="w-4 h-4 text-green-600" />
            Export as PDF
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleAction(onExportExcel)}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-3 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export as Excel
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
