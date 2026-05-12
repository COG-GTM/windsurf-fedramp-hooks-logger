import React from 'react';
import { X } from 'lucide-react';
import { formatSessionName } from '../utils';

const DATE_PRESETS = [
  {
    label: 'Today',
    getValue: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { from: today.toISOString().slice(0, 16), to: '' };
    },
  },
  {
    label: 'Last 24h',
    getValue: () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return { from: yesterday.toISOString().slice(0, 16), to: '' };
    },
  },
  {
    label: 'Last 7 days',
    getValue: () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return { from: weekAgo.toISOString().slice(0, 16), to: '' };
    },
  },
  {
    label: 'Last 30 days',
    getValue: () => {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return { from: monthAgo.toISOString().slice(0, 16), to: '' };
    },
  },
  {
    label: 'This week',
    getValue: () => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return { from: startOfWeek.toISOString().slice(0, 16), to: '' };
    },
  },
];

export function ActiveFilters({
  filterCategory,
  filterUser,
  filterSession,
  searchQuery,
  dateFrom,
  dateTo,
  onClearCategory,
  onClearUser,
  onClearSession,
  onClearSearch,
  onClearDates,
  onClearAll,
}) {
  const hasActive =
    filterCategory !== 'all' ||
    filterUser !== 'all' ||
    filterSession !== 'all' ||
    !!searchQuery ||
    !!dateFrom ||
    !!dateTo;

  if (!hasActive) return null;

  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <span className="text-xs text-ws-text-muted">Active filters:</span>
      {filterCategory !== 'all' && (
        <span className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full flex items-center gap-1 filter-pill">
          Category: {filterCategory}
          <button onClick={onClearCategory} className="hover:text-white action-icon" aria-label="Remove category filter">
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </span>
      )}
      {filterUser !== 'all' && (
        <span className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full flex items-center gap-1 filter-pill">
          User: {filterUser}
          <button onClick={onClearUser} className="hover:text-white action-icon" aria-label="Remove user filter">
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </span>
      )}
      {filterSession !== 'all' && (
        <span className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full flex items-center gap-1 filter-pill">
          Session
          <button onClick={onClearSession} className="hover:text-white action-icon" aria-label="Remove session filter">
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </span>
      )}
      {searchQuery && (
        <span className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full flex items-center gap-1 filter-pill">
          Search: "{searchQuery.substring(0, 20)}{searchQuery.length > 20 ? '...' : ''}"
          <button onClick={onClearSearch} className="hover:text-white action-icon" aria-label="Clear search query">
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </span>
      )}
      {(dateFrom || dateTo) && (
        <span className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full flex items-center gap-1 filter-pill">
          Date range
          <button onClick={onClearDates} className="hover:text-white action-icon" aria-label="Remove date range filter">
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </span>
      )}
      <button onClick={onClearAll} className="text-xs text-ws-text-muted hover:text-ws-text underline">
        Clear all
      </button>
    </div>
  );
}

export function FilterBar({
  filterCategory,
  onFilterCategoryChange,
  filterUser,
  onFilterUserChange,
  uniqueUsers,
}) {
  return (
    <>
      <label htmlFor="filter-category" className="sr-only">Filter by category</label>
      <select
        id="filter-category"
        value={filterCategory}
        onChange={(e) => onFilterCategoryChange(e.target.value)}
        className="px-3 py-2 bg-ws-card border border-ws-border rounded text-ws-text-secondary text-sm focus:outline-none focus:border-ws-teal"
      >
        <option value="all">All Categories</option>
        <option value="prompt">Prompts</option>
        <option value="file_read">File Reads</option>
        <option value="file_write">Code Changes</option>
        <option value="command">Commands</option>
        <option value="mcp">MCP Tools</option>
      </select>

      <label htmlFor="filter-user" className="sr-only">Filter by user</label>
      <select
        id="filter-user"
        value={filterUser}
        onChange={(e) => onFilterUserChange(e.target.value)}
        className="px-3 py-2 bg-ws-card border border-ws-border rounded text-ws-text-secondary text-sm focus:outline-none focus:border-ws-teal"
      >
        <option value="all">All Users</option>
        {uniqueUsers.map((user) => (
          <option key={user} value={user}>{user}</option>
        ))}
      </select>
    </>
  );
}

export function AdvancedSearchPanel({
  filterSession,
  onFilterSessionChange,
  uniqueSessions,
  sessions,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  useRegex,
  onApply,
  onClear,
  onClose,
}) {
  return (
    <div
      id="advanced-search-panel"
      className="mt-4 p-4 bg-ws-card rounded border border-ws-border panel-expand-bounce"
      role="region"
      aria-label="Advanced search filters"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 id="advanced-filters-heading" className="text-sm font-medium text-ws-text">Advanced Filters</h3>
        <button onClick={onClose} className="text-ws-text-muted hover:text-ws-text" aria-label="Close advanced filters">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-ws-text-muted mb-2">Quick Date Range</label>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                const { from, to } = preset.getValue();
                onDateFromChange(from);
                onDateToChange(to);
              }}
              className="px-3 py-1.5 text-xs bg-ws-bg border border-ws-border rounded hover:border-ws-teal hover:text-ws-teal transition-colors"
            >
              {preset.label}
            </button>
          ))}
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                onDateFromChange('');
                onDateToChange('');
              }}
              className="px-3 py-1.5 text-xs bg-ws-orange/10 border border-ws-orange/30 text-ws-orange rounded hover:bg-ws-orange/20 transition-colors"
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <label htmlFor="filter-session" className="block text-xs text-ws-text-muted mb-1">Session</label>
          <select
            id="filter-session"
            value={filterSession}
            onChange={(e) => onFilterSessionChange(e.target.value)}
            className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text-secondary text-sm focus:outline-none focus:border-ws-teal"
          >
            <option value="all">All Sessions</option>
            {uniqueSessions.map((session) => {
              const sessionData = sessions.find((s) => s.id === session);
              const displayName = sessionData ? formatSessionName(sessionData) : session;
              return (
                <option key={session} value={session}>
                  {displayName.length > 30 ? `${displayName.substring(0, 30)}...` : displayName}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label htmlFor="filter-date-from" className="block text-xs text-ws-text-muted mb-1">
            From Date
            {dateFrom && <span className="ml-1 text-ws-teal">●</span>}
          </label>
          <div className="relative">
            <input
              id="filter-date-from"
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className={`w-full px-3 py-2 bg-ws-bg border rounded text-ws-text-secondary text-sm focus:outline-none focus:border-ws-teal ${dateFrom ? 'border-ws-teal/50' : 'border-ws-border'}`}
            />
            {dateFrom && (
              <button
                onClick={() => onDateFromChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ws-text-muted hover:text-ws-text rounded"
                aria-label="Clear from date"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="filter-date-to" className="block text-xs text-ws-text-muted mb-1">
            To Date
            {dateTo && <span className="ml-1 text-ws-teal">●</span>}
          </label>
          <div className="relative">
            <input
              id="filter-date-to"
              type="datetime-local"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className={`w-full px-3 py-2 bg-ws-bg border rounded text-ws-text-secondary text-sm focus:outline-none focus:border-ws-teal ${dateTo ? 'border-ws-teal/50' : 'border-ws-border'}`}
            />
            {dateTo && (
              <button
                onClick={() => onDateToChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ws-text-muted hover:text-ws-text rounded"
                aria-label="Clear to date"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={onApply}
            className="flex-1 px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors"
          >
            Apply
          </button>
          <button
            onClick={onClear}
            className="px-4 py-2 bg-ws-bg border border-ws-border text-ws-text-muted hover:text-ws-text rounded text-sm transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-ws-text-muted">
        <span>Shortcuts:</span>
        <span><span className="kbd">/</span> Search</span>
        <span><span className="kbd">⌘K</span> Filters</span>
        <span><span className="kbd">↑↓</span> Navigate</span>
        <span><span className="kbd">Esc</span> Close</span>
      </div>
    </div>
  );
}

export default FilterBar;
