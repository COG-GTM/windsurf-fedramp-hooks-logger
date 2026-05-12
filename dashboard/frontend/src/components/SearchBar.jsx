import React, { forwardRef } from 'react';
import { Filter, Regex, Search } from 'lucide-react';

export const SearchBar = forwardRef(function SearchBar(
  {
    searchQuery,
    onSearchChange,
    useRegex,
    onToggleRegex,
    onSearch,
    onToggleAdvanced,
    showAdvanced,
  },
  ref,
) {
  return (
    <>
      <div className="relative flex-1 max-w-md">
        <label htmlFor="search-logs" className="sr-only">Search logs</label>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ws-text-muted" aria-hidden="true" />
        <input
          id="search-logs"
          ref={ref}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="Search logs..."
          className="w-full pl-10 pr-10 py-2 bg-ws-card border border-ws-border rounded text-ws-text placeholder-ws-text-muted text-sm focus:outline-none focus:border-ws-teal"
        />
        <button
          onClick={onToggleRegex}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${useRegex ? 'text-ws-teal' : 'text-ws-text-muted hover:text-ws-text'}`}
          title="Toggle regex search"
          aria-label={useRegex ? 'Disable regex search' : 'Enable regex search'}
          aria-pressed={useRegex}
        >
          <Regex className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>

      <button
        onClick={onSearch}
        className="px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm font-medium transition-colors btn-press"
        aria-label="Execute search"
      >
        Search
      </button>

      <button
        onClick={onToggleAdvanced}
        className={`p-2 rounded transition-all btn-press ${showAdvanced ? 'bg-ws-teal text-white' : 'bg-ws-card border border-ws-border text-ws-text-muted hover:text-ws-text'}`}
        title="Advanced filters (⌘K)"
        aria-label="Toggle advanced filters"
        aria-expanded={showAdvanced}
        aria-controls="advanced-search-panel"
      >
        <Filter className="w-4 h-4" aria-hidden="true" />
      </button>
    </>
  );
});

export default SearchBar;
