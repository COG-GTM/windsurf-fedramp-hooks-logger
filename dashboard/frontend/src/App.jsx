import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';
import { DirectoryPicker } from './components/DirectoryPicker';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { useLogData } from './hooks/useLogData';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { computeWorkflowGroups } from './utils';

function toggleInSet(prev, id) {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function App() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { toasts, addToast } = useToast();
  const data = useLogData(addToast);

  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState('workflow');
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(-1);
  const [selectedSession, setSelectedSession] = useState(null);
  const [workflowExpandedGroups, setWorkflowExpandedGroups] = useState(new Set());
  const [sessionSortOrder, setSessionSortOrder] = useState('newest');
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (viewMode !== 'workflow' || selectedSession || data.sessions.length === 0) return;
    const noSession = data.sessions.find((s) => s.id === 'no_session' && s.categories?.prompt > 0);
    const withPrompts = data.sessions.find((s) => s.categories?.prompt > 0);
    if (noSession) setSelectedSession(noSession.id);
    else if (withPrompts) setSelectedSession(withPrompts.id);
  }, [viewMode, data.sessions, selectedSession]);

  const toggleEntry = useCallback((id) => setExpandedEntries((p) => toggleInSet(p, id)), []);
  const toggleWorkflowGroup = useCallback(
    (id) => setWorkflowExpandedGroups((p) => toggleInSet(p, id)),
    [],
  );

  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast('Copied to clipboard', 'success');
    } catch {
      addToast('Failed to copy', 'error');
    }
  }, [addToast]);

  useKeyboardShortcuts({
    searchInputRef,
    showFilePicker,
    setShowFilePicker,
    showAdvancedSearch,
    setShowAdvancedSearch,
    selectedEntryIndex,
    setSelectedEntryIndex,
    logs: data.logs,
    toggleEntry,
  });

  const workflowGroups = useMemo(() => computeWorkflowGroups(selectedSession, data.sessions), [selectedSession, data.sessions]);
  const onSearch = data.useRegex ? data.searchLogs : data.fetchLogs;
  const onClearAll = () => { data.clearAllFilters(); setTimeout(() => data.fetchLogs(), 0); };
  const toggleSortOrder = () => setSessionSortOrder((p) => (p === 'newest' ? 'oldest' : 'newest'));

  return (
    <div className="min-h-screen bg-ws-bg flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ws-teal focus:text-white focus:rounded focus:outline-none"
      >
        Skip to main content
      </a>

      <ToastContainer toasts={toasts} />

      <Sidebar
        sidebarOpen={sidebarOpen}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        sessions={data.sessions}
        stats={data.stats}
        files={data.files}
        selectedFiles={data.selectedFiles}
        onToggleFileSelection={data.toggleFileSelection}
        selectedSession={selectedSession}
        onSelectSession={setSelectedSession}
        sessionSortOrder={sessionSortOrder}
        onToggleSortOrder={toggleSortOrder}
      />

      <main id="main-content" className="flex-1 flex flex-col overflow-hidden" role="main">
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((s) => !s)}
          isRefreshing={data.isRefreshing}
          onRefreshAll={data.refreshAll}
          onOpenFilePicker={() => setShowFilePicker(true)}
          onExportLogs={data.exportLogs}
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
          filterCategory={data.filterCategory}
          setFilterCategory={data.setFilterCategory}
          filterUser={data.filterUser}
          setFilterUser={data.setFilterUser}
          filterSession={data.filterSession}
          setFilterSession={data.setFilterSession}
          searchQuery={data.searchQuery}
          setSearchQuery={data.setSearchQuery}
          dateFrom={data.dateFrom}
          setDateFrom={data.setDateFrom}
          dateTo={data.dateTo}
          setDateTo={data.setDateTo}
          useRegex={data.useRegex}
          setUseRegex={data.setUseRegex}
          uniqueUsers={data.uniqueUsers}
          uniqueSessions={data.uniqueSessions}
          sessions={data.sessions}
          onSearch={onSearch}
          onClearAll={onClearAll}
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
          viewMode={viewMode}
          sessionSortOrder={sessionSortOrder}
          onToggleSortOrder={toggleSortOrder}
          searchInputRef={searchInputRef}
        />

        <div
          className="flex-1 overflow-auto p-6"
          key={viewMode}
          aria-busy={data.loading}
          aria-live="polite"
        >
          <MainContent
            viewMode={viewMode}
            loading={data.loading}
            logs={data.logs}
            sessions={data.sessions}
            aggregatedMetrics={data.aggregatedMetrics}
            workflowGroups={workflowGroups}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
            expandedEntries={expandedEntries}
            toggleEntry={toggleEntry}
            expandedGroups={workflowExpandedGroups}
            toggleGroup={toggleWorkflowGroup}
            copyToClipboard={copyToClipboard}
            selectedEntryIndex={selectedEntryIndex}
            sessionSortOrder={sessionSortOrder}
            hasActiveFilters={data.hasActiveFilters}
            onClearAll={onClearAll}
          />
        </div>

        <Footer
          viewMode={viewMode}
          logsCount={data.logs.length}
          totalEvents={data.aggregatedMetrics?.total_events}
          hasActiveFilters={data.hasActiveFilters}
        />
      </main>

      {showFilePicker && (
        <DirectoryPicker
          currentDir={data.currentDir}
          onSelect={(dir) => {
            data.setCurrentDir(dir);
            data.setSelectedFiles([]);
            setShowFilePicker(false);
          }}
          onClose={() => setShowFilePicker(false)}
        />
      )}
    </div>
  );
}

export default App;
