import React from 'react';
import { FileText } from 'lucide-react';

export function EmptyState({ hasFilters, onClearFilters }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-ws-text-muted slide-up">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ws-card to-ws-bg border border-ws-border flex items-center justify-center mb-6 shadow-lg">
        <FileText className="w-10 h-10 text-ws-text-muted" />
      </div>
      <p className="text-lg font-semibold text-ws-text mb-2">No log entries found</p>
      <p className="text-sm text-center max-w-md text-ws-text-secondary leading-relaxed mb-4">
        {hasFilters
          ? 'No entries match your current filters. Try adjusting or clearing them.'
          : 'Select log files from the sidebar or adjust your filters to see your Cascade activity.'}
      </p>
      {hasFilters && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}

export default EmptyState;
