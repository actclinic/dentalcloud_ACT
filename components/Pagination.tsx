import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';

interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  showAll: boolean;
  onToggleShowAll: () => void;
  showAllToggle?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  showAll,
  onToggleShowAll,
  showAllToggle = true
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
  const startItem = (safeCurrentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(safeCurrentPage * itemsPerPage, totalItems);
  const remainingItems = Math.max(totalItems - endItem, 0);
  const visiblePageCount = Math.min(totalPages, 5);

  if (totalItems === 0) return null;

  const handlePageChange = (page: number) => {
    onPageChange(Math.min(Math.max(page, 1), totalPages));
  };

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
      <div className="text-center text-xs text-gray-600 sm:text-left sm:text-sm">
        Showing <span className="font-semibold text-gray-900">{showAll ? totalItems : `${startItem}-${endItem}`}</span> of{' '}
        <span className="font-semibold text-gray-900">{totalItems}</span> items
      </div>
      
      <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
        {showAllToggle && totalItems > itemsPerPage && (
          <button
            onClick={onToggleShowAll}
            type="button"
            className="flex min-h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-center text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 sm:w-auto sm:px-4"
          >
            {showAll ? (
              <>
                <ChevronUp size={16} />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                {remainingItems > 0 ? `See More (${remainingItems} more)` : 'See More'}
              </>
            )}
          </button>
        )}
        
        {!showAll && totalPages > 1 && (
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:w-auto sm:flex">
            <button
              onClick={() => handlePageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              type="button"
              aria-label="Previous page"
              className="flex min-h-10 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            
            <div className="flex justify-center gap-1 px-0.5">
              {Array.from({ length: visiblePageCount }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (safeCurrentPage <= 3) {
                  pageNum = i + 1;
                } else if (safeCurrentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = safeCurrentPage - 2 + i;
                }

                const isNearbyMobilePage = Math.abs(pageNum - safeCurrentPage) <= 1;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    type="button"
                    aria-label={`Page ${pageNum}`}
                    aria-current={safeCurrentPage === pageNum ? 'page' : undefined}
                    className={`${isNearbyMobilePage ? 'flex' : 'hidden sm:flex'} h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors ${
                      safeCurrentPage === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              type="button"
              aria-label="Next page"
              className="flex min-h-10 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4 sm:hidden" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pagination;
