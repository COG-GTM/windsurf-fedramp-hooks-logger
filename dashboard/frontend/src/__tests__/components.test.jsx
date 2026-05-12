import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast, ToastContainer } from '../components/Toast';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ListView } from '../components/ListView';
import { TimelineView } from '../components/TimelineView';
import { WorkflowView } from '../components/WorkflowView';
import { MetricsDashboard } from '../components/MetricsDashboard';
import { LogEntry } from '../components/LogEntry';
import { SessionSelector } from '../components/SessionSelector';
import { SearchBar } from '../components/SearchBar';
import { FilterBar } from '../components/FilterBar';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { Footer } from '../components/Footer';
import { MainContent } from '../components/MainContent';

const noop = () => {};

describe('Toast', () => {
  it('renders without throwing', () => {
    render(<Toast toast={{ id: 1, message: 'hi', type: 'info' }} />);
    expect(screen.getByText('hi')).toBeInTheDocument();
  });
});

describe('ToastContainer', () => {
  it('renders with empty toasts', () => {
    const { container } = render(<ToastContainer toasts={[]} />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe('LoadingSkeleton', () => {
  it('renders without throwing', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('renders without filters', () => {
    render(<EmptyState hasFilters={false} onClearFilters={noop} />);
    expect(screen.getByText(/No log entries found/i)).toBeInTheDocument();
  });

  it('renders with filters and clear button', () => {
    render(<EmptyState hasFilters={true} onClearFilters={noop} />);
    expect(screen.getByText(/Clear All Filters/i)).toBeInTheDocument();
  });
});

describe('ListView', () => {
  it('renders with empty logs', () => {
    const { container } = render(
      <ListView logs={[]} expandedEntries={new Set()} toggleEntry={noop} copyToClipboard={noop} selectedEntryIndex={-1} />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe('TimelineView', () => {
  it('renders with empty sessions', () => {
    const { container } = render(
      <TimelineView sessions={[]} expandedEntries={new Set()} toggleEntry={noop} copyToClipboard={noop} />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe('WorkflowView', () => {
  it('renders with no selected session', () => {
    render(
      <WorkflowView
        selectedSession={null}
        sessions={[]}
        workflowGroups={[]}
        expandedGroups={new Set()}
        toggleGroup={noop}
        expandedEntries={new Set()}
        toggleEntry={noop}
        copyToClipboard={noop}
        onSelectSession={noop}
        sortOrder="newest"
      />,
    );
    expect(screen.getByText(/Select a Session/i)).toBeInTheDocument();
  });
});

describe('MetricsDashboard', () => {
  it('renders loading state when metrics not provided', () => {
    render(<MetricsDashboard aggregatedMetrics={null} />);
    expect(screen.getByText(/loading metrics/i)).toBeInTheDocument();
  });

  it('renders with empty metrics object', () => {
    render(<MetricsDashboard aggregatedMetrics={{ total_events: 0 }} />);
    expect(screen.getByText(/Metrics Dashboard/i)).toBeInTheDocument();
  });
});

describe('LogEntry', () => {
  it('renders a minimal entry without throwing', () => {
    const entry = {
      event_id: '1',
      category: 'prompt',
      timestamp: '2024-01-01T00:00:00Z',
      user: 'tester',
      data: { user_prompt: 'hello' },
    };
    render(
      <LogEntry
        entry={entry}
        isExpanded={false}
        onToggle={noop}
        copyToClipboard={noop}
        isSelected={false}
      />,
    );
    expect(screen.getByText(/tester/)).toBeInTheDocument();
  });
});

describe('SessionSelector', () => {
  it('renders with empty sessions', () => {
    const { container } = render(
      <SessionSelector
        sessions={[]}
        selectedSession={null}
        onSelectSession={noop}
        sessionSortOrder="newest"
        onToggleSortOrder={noop}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe('SearchBar', () => {
  it('renders without throwing', () => {
    render(
      <SearchBar
        searchQuery=""
        onSearchChange={noop}
        useRegex={false}
        onToggleRegex={noop}
        onSearch={noop}
        onToggleAdvanced={noop}
        showAdvanced={false}
      />,
    );
    expect(screen.getByPlaceholderText(/search logs/i)).toBeInTheDocument();
  });
});

describe('FilterBar', () => {
  it('renders selects', () => {
    render(
      <FilterBar
        filterCategory="all"
        onFilterCategoryChange={noop}
        filterUser="all"
        onFilterUserChange={noop}
        uniqueUsers={['alice', 'bob']}
      />,
    );
    expect(screen.getByLabelText(/filter by category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by user/i)).toBeInTheDocument();
  });
});

describe('Header', () => {
  it('renders without throwing', () => {
    render(
      <Header
        sidebarOpen
        onToggleSidebar={noop}
        isRefreshing={false}
        onRefreshAll={noop}
        onOpenFilePicker={noop}
        onExportLogs={noop}
        isDarkMode={false}
        onToggleTheme={noop}
        filterCategory="all"
        setFilterCategory={noop}
        filterUser="all"
        setFilterUser={noop}
        filterSession="all"
        setFilterSession={noop}
        searchQuery=""
        setSearchQuery={noop}
        dateFrom=""
        setDateFrom={noop}
        dateTo=""
        setDateTo={noop}
        useRegex={false}
        setUseRegex={noop}
        uniqueUsers={[]}
        uniqueSessions={[]}
        sessions={[]}
        onSearch={noop}
        onClearAll={noop}
        showAdvancedSearch={false}
        setShowAdvancedSearch={noop}
        viewMode="list"
        sessionSortOrder="newest"
        onToggleSortOrder={noop}
        searchInputRef={{ current: null }}
      />,
    );
    expect(screen.getByText('Windsurf Hooks Logger')).toBeInTheDocument();
  });
});

describe('Sidebar', () => {
  it('renders without throwing', () => {
    render(
      <Sidebar
        sidebarOpen
        viewMode="workflow"
        onSetViewMode={noop}
        sessions={[]}
        stats={null}
        files={[]}
        selectedFiles={[]}
        onToggleFileSelection={noop}
        selectedSession={null}
        onSelectSession={noop}
        sessionSortOrder="newest"
        onToggleSortOrder={noop}
      />,
    );
    expect(screen.getByText('Windsurf Logger')).toBeInTheDocument();
  });
});

describe('Footer', () => {
  it('renders count and view label', () => {
    render(<Footer viewMode="list" logsCount={5} totalEvents={0} hasActiveFilters={false} />);
    expect(screen.getByText(/5 entries/i)).toBeInTheDocument();
    expect(screen.getByText(/View: List/i)).toBeInTheDocument();
  });
});

describe('MainContent', () => {
  it('renders loading skeleton when loading', () => {
    const { container } = render(
      <MainContent
        viewMode="list"
        loading
        logs={[]}
        sessions={[]}
        aggregatedMetrics={null}
        workflowGroups={[]}
        selectedSession={null}
        onSelectSession={noop}
        expandedEntries={new Set()}
        toggleEntry={noop}
        expandedGroups={new Set()}
        toggleGroup={noop}
        copyToClipboard={noop}
        selectedEntryIndex={-1}
        sessionSortOrder="newest"
        hasActiveFilters={false}
        onClearAll={noop}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
