import React from 'react';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';
import { MetricsDashboard } from './MetricsDashboard';
import { WorkflowView } from './WorkflowView';
import { TimelineView } from './TimelineView';
import { ListView } from './ListView';

export function MainContent({
  viewMode,
  loading,
  logs,
  sessions,
  aggregatedMetrics,
  workflowGroups,
  selectedSession,
  onSelectSession,
  expandedEntries,
  toggleEntry,
  expandedGroups,
  toggleGroup,
  copyToClipboard,
  selectedEntryIndex,
  sessionSortOrder,
  hasActiveFilters,
  onClearAll,
}) {
  if (loading) return <LoadingSkeleton />;
  if (viewMode === 'metrics') return <MetricsDashboard aggregatedMetrics={aggregatedMetrics} />;
  if (viewMode === 'workflow') {
    return (
      <WorkflowView
        selectedSession={selectedSession}
        sessions={sessions}
        workflowGroups={workflowGroups}
        expandedGroups={expandedGroups}
        toggleGroup={toggleGroup}
        expandedEntries={expandedEntries}
        toggleEntry={toggleEntry}
        copyToClipboard={copyToClipboard}
        onSelectSession={onSelectSession}
        sortOrder={sessionSortOrder}
      />
    );
  }
  if (logs.length === 0) {
    return (
      <div className="page-enter">
        <EmptyState hasFilters={hasActiveFilters} onClearFilters={onClearAll} />
      </div>
    );
  }
  if (viewMode === 'timeline') {
    return (
      <TimelineView
        sessions={sessions}
        expandedEntries={expandedEntries}
        toggleEntry={toggleEntry}
        copyToClipboard={copyToClipboard}
      />
    );
  }
  return (
    <ListView
      logs={logs}
      expandedEntries={expandedEntries}
      toggleEntry={toggleEntry}
      copyToClipboard={copyToClipboard}
      selectedEntryIndex={selectedEntryIndex}
    />
  );
}

export default MainContent;
