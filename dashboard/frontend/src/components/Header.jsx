import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Moon,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { SearchBar } from './SearchBar';
import { FilterBar, ActiveFilters, AdvancedSearchPanel } from './FilterBar';

export function Header({
  sidebarOpen,
  onToggleSidebar,
  isRefreshing,
  onRefreshAll,
  onOpenFilePicker,
  onExportLogs,
  isDarkMode,
  onToggleTheme,
  filterCategory,
  setFilterCategory,
  filterUser,
  setFilterUser,
  filterSession,
  setFilterSession,
  searchQuery,
  setSearchQuery,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  useRegex,
  setUseRegex,
  uniqueUsers,
  uniqueSessions,
  sessions,
  onSearch,
  onClearAll,
  showAdvancedSearch,
  setShowAdvancedSearch,
  viewMode,
  sessionSortOrder,
  onToggleSortOrder,
  searchInputRef,
}) {
  return (
    <header className="bg-ws-bg border-b border-ws-border px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-ws-card rounded text-ws-text-muted hover:text-ws-text transition-all duration-200 hover:scale-110"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-5 h-5 transition-transform duration-300" />
            ) : (
              <ChevronRight className="w-5 h-5 transition-transform duration-300" />
            )}
          </button>
          <div>
            <h1 className="text-xl font-semibold text-ws-text">Windsurf Hooks Logger</h1>
            <p className="text-xs text-ws-text-muted">Analytics Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefreshAll}
            className="flex items-center gap-2 px-3 py-1.5 bg-ws-card hover:bg-ws-card-hover border border-ws-border rounded text-sm text-ws-text-secondary hover:text-ws-text transition-colors btn-press"
            title="Refresh all data"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 transition-transform ${isRefreshing ? 'refresh-spinning' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={onOpenFilePicker}
            className="flex items-center gap-2 px-3 py-1.5 bg-ws-card hover:bg-ws-card-hover border border-ws-border rounded text-sm text-ws-text-secondary hover:text-ws-text transition-colors btn-press"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Directory</span>
          </button>
          <div className="relative group">
            <button
              className="p-2 bg-ws-card hover:bg-ws-card-hover border border-ws-border rounded text-ws-text-muted hover:text-ws-text transition-colors"
              aria-label="Export options"
              aria-haspopup="true"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-ws-card border border-ws-border rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
              <button
                onClick={() => onExportLogs('json')}
                className="w-full px-3 py-2 text-left text-sm text-ws-text-secondary hover:bg-ws-card-hover hover:text-ws-text"
              >
                Export JSON
              </button>
              <button
                onClick={() => onExportLogs('csv')}
                className="w-full px-3 py-2 text-left text-sm text-ws-text-secondary hover:bg-ws-card-hover hover:text-ws-text"
              >
                Export CSV
              </button>
            </div>
          </div>
          <button
            onClick={onToggleTheme}
            className="p-2 bg-ws-card hover:bg-ws-card-hover border border-ws-border rounded text-ws-text-muted hover:text-ws-text transition-all duration-300"
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 transition-transform duration-300 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 transition-transform duration-300 hover:-rotate-12" />
            )}
          </button>
        </div>
      </div>

      <ActiveFilters
        filterCategory={filterCategory}
        filterUser={filterUser}
        filterSession={filterSession}
        searchQuery={searchQuery}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onClearCategory={() => setFilterCategory('all')}
        onClearUser={() => setFilterUser('all')}
        onClearSession={() => setFilterSession('all')}
        onClearSearch={() => setSearchQuery('')}
        onClearDates={() => {
          setDateFrom('');
          setDateTo('');
        }}
        onClearAll={onClearAll}
      />

      <div className="flex items-center gap-3">
        <SearchBar
          ref={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          useRegex={useRegex}
          onToggleRegex={() => setUseRegex(!useRegex)}
          onSearch={onSearch}
          onToggleAdvanced={() => setShowAdvancedSearch(!showAdvancedSearch)}
          showAdvanced={showAdvancedSearch}
        />
        <FilterBar
          filterCategory={filterCategory}
          onFilterCategoryChange={setFilterCategory}
          filterUser={filterUser}
          onFilterUserChange={setFilterUser}
          uniqueUsers={uniqueUsers}
        />

        {viewMode === 'workflow' && (
          <button
            onClick={onToggleSortOrder}
            className="flex items-center gap-1.5 px-3 py-2 bg-ws-card border border-ws-border rounded text-sm text-ws-text-secondary hover:text-ws-text hover:border-ws-teal/50 transition-colors"
            title={`Sort workflow ${sessionSortOrder === 'newest' ? 'oldest' : 'newest'} first`}
            aria-label={`Currently showing ${sessionSortOrder} first. Click to show ${sessionSortOrder === 'newest' ? 'oldest' : 'newest'} first`}
          >
            {sessionSortOrder === 'newest' ? (
              <>
                <ArrowDown className="w-4 h-4" />
                <span>Newest</span>
              </>
            ) : (
              <>
                <ArrowUp className="w-4 h-4" />
                <span>Oldest</span>
              </>
            )}
          </button>
        )}
      </div>

      {showAdvancedSearch && (
        <AdvancedSearchPanel
          filterSession={filterSession}
          onFilterSessionChange={setFilterSession}
          uniqueSessions={uniqueSessions}
          sessions={sessions}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          useRegex={useRegex}
          onApply={onSearch}
          onClear={onClearAll}
          onClose={() => setShowAdvancedSearch(false)}
        />
      )}
    </header>
  );
}

export default Header;
