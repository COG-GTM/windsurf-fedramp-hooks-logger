import React from 'react';
import {
  Activity,
  BarChart3,
  Edit3,
  FileText,
  GitBranch,
  Layers,
  MessageSquare,
  Play,
  User,
} from 'lucide-react';
import { SessionSelector } from './SessionSelector';

function StatCard({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-ws-card/50 hover:bg-ws-card transition-all duration-200 group">
      <div className="flex items-center gap-2.5 text-ws-text-secondary">
        <span className="text-ws-teal group-hover:scale-110 transition-transform">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-semibold text-ws-text stat-number">{value || 0}</span>
    </div>
  );
}

const VIEW_MODES = [
  { id: 'workflow', label: 'Workflow View', Icon: Activity },
  { id: 'timeline', label: 'Timeline View', Icon: GitBranch },
  { id: 'list', label: 'List View', Icon: Layers },
  { id: 'metrics', label: 'Metrics Dashboard', Icon: BarChart3 },
];

export function Sidebar({
  sidebarOpen,
  viewMode,
  onSetViewMode,
  sessions,
  stats,
  files,
  selectedFiles,
  onToggleFileSelection,
  selectedSession,
  onSelectSession,
  sessionSortOrder,
  onToggleSortOrder,
}) {
  return (
    <aside
      className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-ws-sidebar border-r border-ws-border overflow-hidden flex flex-col`}
      aria-label="Navigation and filters"
    >
      <div className="p-4 border-b border-ws-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-ws-teal to-ws-teal-dim flex items-center justify-center shadow-lg shadow-ws-teal/20">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="sr-only">Windsurf Logger Logo</span>
            </div>
            <div>
              <span className="font-semibold text-ws-text block">Windsurf Logger</span>
              <span className="text-[10px] text-ws-text-muted">Analytics Dashboard</span>
            </div>
          </div>
        </div>
      </div>

      <nav className="p-3 border-b border-ws-border" aria-label="View mode selection">
        <p id="view-mode-label" className="text-[10px] uppercase tracking-wider text-ws-text-muted px-3 py-2">View Mode</p>
        <div role="group" aria-labelledby="view-mode-label">
          {VIEW_MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onSetViewMode(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                viewMode === id
                  ? 'bg-ws-teal text-white shadow-md shadow-ws-teal/30'
                  : 'text-ws-text-secondary hover:text-ws-text hover:bg-ws-card/50'
              }`}
              aria-pressed={viewMode === id}
            >
              <Icon className={`w-4 h-4 ${viewMode === id ? 'text-white' : ''}`} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {viewMode === 'workflow' && sessions.length > 0 && (
        <SessionSelector
          sessions={sessions}
          selectedSession={selectedSession}
          onSelectSession={onSelectSession}
          sessionSortOrder={sessionSortOrder}
          onToggleSortOrder={onToggleSortOrder}
        />
      )}

      {stats && (
        <div className="p-3 border-b border-ws-border">
          <p className="text-[10px] uppercase tracking-wider text-ws-text-muted px-3 py-2">Statistics</p>
          <div className="space-y-1">
            <StatCard icon={<MessageSquare className="w-4 h-4" />} label="Prompts" value={stats.total_prompts || stats.categories?.prompt || 0} />
            <StatCard icon={<Edit3 className="w-4 h-4" />} label="Code Changes" value={stats.total_file_writes || stats.categories?.file_write || 0} />
            <StatCard icon={<Play className="w-4 h-4" />} label="Commands" value={stats.total_commands || stats.categories?.command || 0} />
            <StatCard icon={<User className="w-4 h-4" />} label="Sessions" value={stats.unique_sessions || 0} />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3">
        <div className="px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-ws-text-muted">Log Files</p>
        </div>

        <div className="space-y-0.5">
          {files.map((file) => (
            <label
              key={file.path}
              className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                selectedFiles.includes(file.path)
                  ? 'bg-ws-card text-ws-text'
                  : 'text-ws-text-secondary hover:bg-ws-card/50 hover:text-ws-text'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedFiles.includes(file.path)}
                onChange={() => onToggleFileSelection(file.path)}
                className="w-3 h-3 rounded border-ws-border bg-ws-card text-ws-teal focus:ring-ws-teal focus:ring-offset-0"
              />
              <FileText className="w-4 h-4 text-ws-text-muted" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{file.name}</p>
                {file.entries > 0 && (
                  <p className="text-xs text-ws-text-muted">
                    {file.entries.toLocaleString()} entries
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>

        {files.length === 0 && (
          <p className="text-sm text-ws-text-muted text-center py-4">No log files found</p>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
