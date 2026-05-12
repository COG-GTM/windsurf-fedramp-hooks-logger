import React from 'react';

const VIEW_LABELS = {
  workflow: 'Workflow',
  timeline: 'Timeline',
  metrics: 'Metrics',
  list: 'List',
};

export function Footer({ viewMode, logsCount, totalEvents, hasActiveFilters }) {
  return (
    <footer className="bg-ws-sidebar border-t border-ws-border px-6 py-2 flex items-center justify-between text-xs text-ws-text-muted">
      <span>
        {viewMode === 'metrics'
          ? `${(totalEvents || 0).toLocaleString()} total events`
          : `${logsCount} ${logsCount === 1 ? 'entry' : 'entries'}${hasActiveFilters ? ' (filtered)' : ''}`}
      </span>
      <div className="flex items-center gap-4">
        <span>View: {VIEW_LABELS[viewMode] || 'List'}</span>
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </footer>
  );
}

export default Footer;
