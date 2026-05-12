import React, { useMemo } from 'react';
import {
  Activity,
  Calendar,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  FileCode,
  MessageSquare,
  Play,
  Zap,
} from 'lucide-react';
import { formatTimestamp, getPromptTitle } from '../utils';
import { DiffViewer } from './LogEntry';

function WorkflowFileChange({ event, isExpanded, onToggle, copyToClipboard }) {
  const data = event.data || {};
  const hasEdits = data.edits && data.edits.length > 0;
  const fileName = (data.file_path || 'unknown').split('/').pop();
  const filePath = data.file_path || 'unknown file';

  return (
    <div className="bg-ws-card rounded-lg border border-ws-border overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-ws-card-hover transition-colors"
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`File change: ${fileName}`}
      >
        <FileCode className="w-4 h-4 text-ws-teal" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ws-text font-medium">{fileName}</p>
          <p className="text-xs text-ws-text-muted truncate">{filePath}</p>
        </div>
        <div className="flex items-center gap-3">
          {data.total_lines_added !== undefined && (
            <span className="text-xs text-ws-teal">+{data.total_lines_added}</span>
          )}
          {data.total_lines_removed !== undefined && (
            <span className="text-xs text-red-400">-{data.total_lines_removed}</span>
          )}
          <ChevronRight className={`w-4 h-4 text-ws-text-muted chevron-rotate ${isExpanded ? 'rotated' : ''}`} />
        </div>
      </div>

      {isExpanded && hasEdits && (
        <div className="border-t border-ws-border p-3 bg-ws-bg panel-expand-bounce">
          <DiffViewer edits={data.edits} copyToClipboard={copyToClipboard} />
        </div>
      )}
    </div>
  );
}

function WorkflowGroup({
  group,
  groupIndex,
  isExpanded,
  onToggle,
  expandedEntries,
  toggleEntry,
  copyToClipboard,
}) {
  const fileWrites = group.actions.filter((a) => (a.category || a.type) === 'file_write');
  const commands = group.actions.filter((a) => (a.category || a.type) === 'command');
  const fileReads = group.actions.filter((a) => (a.category || a.type) === 'file_read');
  const mcpCalls = group.actions.filter((a) => (a.category || a.type) === 'mcp');
  const promptData = group.prompt?.data || {};

  const promptText = promptData.user_prompt || group.prompt?.content || '';
  const promptTitle = group.prompt ? getPromptTitle(promptText) : 'Pre-session actions';
  const isMultiLine = promptText.includes('\n') || promptText.length > 60;

  return (
    <div className="workflow-group bg-ws-card border border-ws-border rounded-xl overflow-hidden transition-all duration-300 hover:border-ws-border-light">
      <div
        className="p-5 cursor-pointer hover:bg-ws-card-hover transition-colors"
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Workflow step ${groupIndex + 1}: ${promptTitle}`}
      >
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-xl bg-ws-teal/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-ws-teal" />
            </div>
            {(group.actions.length > 0 || isMultiLine) && (
              <div className="w-0.5 h-8 bg-gradient-to-b from-ws-teal/50 to-ws-border mt-2" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-medium text-ws-teal bg-ws-teal/10 px-2.5 py-1 rounded-full">
                Step {groupIndex + 1}
              </span>
              <span className="text-xs text-ws-text-muted">
                {formatTimestamp(group.prompt?.timestamp)}
              </span>
            </div>
            <h3 className="text-ws-text font-medium leading-relaxed whitespace-pre-wrap">
              {promptText}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {fileWrites.length > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full">
                <Edit3 className="w-3 h-3" />
                {fileWrites.length}
              </span>
            )}
            {commands.length > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-ws-orange/10 text-ws-orange text-xs rounded-full">
                <Play className="w-3 h-3" />
                {commands.length}
              </span>
            )}
            <ChevronRight className={`w-5 h-5 text-ws-text-muted chevron-rotate ${isExpanded ? 'rotated' : ''}`} />
          </div>
        </div>
      </div>

      <div className={`expand-content ${isExpanded ? 'expanded' : ''}`}>
        <div className="border-t border-ws-border bg-ws-bg/50">
          {group.prompt && (
            <div className="p-5 border-b border-ws-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-ws-teal" />
                  <h4 className="text-sm font-medium text-ws-text">Full Prompt</h4>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(promptData.user_prompt || group.prompt.content || ''); }}
                  className="text-xs text-ws-text-muted hover:text-ws-text flex items-center gap-1 btn-press"
                  aria-label="Copy prompt to clipboard"
                >
                  <Copy className="w-3 h-3 action-icon" aria-hidden="true" /> Copy
                </button>
              </div>
              <pre className="bg-ws-card rounded-lg p-4 text-sm text-ws-text-secondary whitespace-pre-wrap border border-ws-border max-h-64 overflow-auto">
                {promptData.user_prompt || group.prompt.content || 'No prompt content'}
              </pre>
            </div>
          )}

          {fileWrites.length > 0 && (
            <div className="p-5 border-b border-ws-border">
              <div className="flex items-center gap-2 mb-4">
                <Edit3 className="w-4 h-4 text-ws-teal" />
                <h4 className="text-sm font-medium text-ws-text">Code Changes</h4>
                <span className="text-xs text-ws-text-muted">({fileWrites.length} files)</span>
              </div>
              <div className="space-y-3">
                {fileWrites.map((fw, idx) => (
                  <WorkflowFileChange
                    key={fw.event_id || idx}
                    event={fw}
                    isExpanded={expandedEntries.has(fw.event_id || `fw-${idx}`)}
                    onToggle={() => toggleEntry(fw.event_id || `fw-${idx}`)}
                    copyToClipboard={copyToClipboard}
                  />
                ))}
              </div>
            </div>
          )}

          {commands.length > 0 && (
            <div className="p-5 border-b border-ws-border">
              <div className="flex items-center gap-2 mb-4">
                <Play className="w-4 h-4 text-ws-orange" />
                <h4 className="text-sm font-medium text-ws-text">Commands Executed</h4>
              </div>
              <div className="space-y-2">
                {commands.map((cmd, idx) => (
                  <div key={cmd.event_id || idx} className="bg-ws-card rounded-lg p-3 font-mono text-sm border border-ws-border">
                    <span className="text-ws-orange">$</span>{' '}
                    <span className="text-ws-text-secondary">{cmd.data?.command_line || 'command'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fileReads.length > 0 && (
            <div className="p-5 border-b border-ws-border">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-ws-orange" />
                <h4 className="text-sm font-medium text-ws-text">Files Read</h4>
                <span className="text-xs text-ws-text-muted">({fileReads.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {fileReads.map((fr, idx) => (
                  <span key={fr.event_id || idx} className="px-2.5 py-1 bg-ws-card text-ws-text-secondary text-xs rounded border border-ws-border font-mono">
                    {(fr.data?.file_path || 'file').split('/').pop()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {mcpCalls.length > 0 && (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-ws-teal" />
                <h4 className="text-sm font-medium text-ws-text">MCP Tool Calls</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {mcpCalls.map((mcp, idx) => (
                  <span key={mcp.event_id || idx} className="px-2.5 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full">
                    {mcp.data?.mcp_full_tool || mcp.data?.mcp_tool_name || 'tool'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkflowView({
  selectedSession,
  sessions,
  workflowGroups,
  expandedGroups,
  toggleGroup,
  expandedEntries,
  toggleEntry,
  copyToClipboard,
  onSelectSession,
  sortOrder = 'newest',
}) {
  const sortedWorkflowGroups = useMemo(() => {
    if (!workflowGroups || workflowGroups.length === 0) return workflowGroups;
    return [...workflowGroups].sort((a, b) => {
      const getTimestamp = (group) => {
        if (group.prompt?.timestamp) return new Date(group.prompt.timestamp).getTime();
        if (group.events?.[0]?.timestamp) return new Date(group.events[0].timestamp).getTime();
        return 0;
      };
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [workflowGroups, sortOrder]);

  const sessionsWithPrompts = sessions.filter((s) => s.categories?.prompt > 0);

  if (!selectedSession) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-ws-text-muted">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ws-teal/20 to-ws-card border border-ws-border flex items-center justify-center mb-6">
          <Activity className="w-10 h-10 text-ws-teal" />
        </div>
        <h3 className="text-xl font-semibold text-ws-text mb-2">Select a Session</h3>
        <p className="text-sm text-ws-text-secondary text-center max-w-md mb-6">
          Choose a session from the sidebar to view the workflow of prompts and their resulting code changes.
        </p>
        {sessionsWithPrompts.length > 0 ? (
          <div className="flex flex-wrap gap-2 justify-center max-w-lg">
            {sessionsWithPrompts.slice(0, 5).map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className="px-4 py-2 bg-ws-card hover:bg-ws-card-hover border border-ws-border rounded-lg text-sm text-ws-text-secondary hover:text-ws-text transition-all duration-200 hover:border-ws-teal/50"
              >
                <span className="font-mono text-xs">{session.id === 'no_session' ? 'Ungrouped' : session.id.substring(0, 8) + '...'}</span>
                <span className="ml-2 text-ws-teal">({session.categories?.prompt || 0} prompts)</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ws-text-muted">No sessions with prompts found</p>
        )}
      </div>
    );
  }

  const currentSession = sessions.find((s) => s.id === selectedSession);
  const hasPrompts = currentSession?.categories?.prompt > 0;

  if (!hasPrompts && workflowGroups.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-ws-card to-ws-bg border border-ws-border rounded-xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-ws-orange/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-ws-orange" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ws-text">Session: {selectedSession === 'no_session' ? 'Ungrouped Events' : selectedSession.substring(0, 16) + '...'}</h2>
              <p className="text-sm text-ws-text-muted">{currentSession?.event_count || 0} events (no prompts)</p>
            </div>
          </div>
          <div className="bg-ws-bg/50 rounded-lg p-4 border border-ws-border">
            <p className="text-sm text-ws-text-secondary mb-3">
              This session contains {currentSession?.categories?.file_write || 0} code changes, {currentSession?.categories?.command || 0} commands, and {currentSession?.categories?.file_read || 0} file reads, but no prompts were logged with this session ID.
            </p>
            <p className="text-xs text-ws-text-muted mb-4">
              Prompts are typically logged separately. Try selecting <strong className="text-ws-teal">"Ungrouped"</strong> to see prompts without a session ID.
            </p>
            {sessionsWithPrompts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-ws-text-muted">Sessions with prompts:</span>
                {sessionsWithPrompts.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSelectSession(s.id)}
                    className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded hover:bg-ws-teal/20 transition-colors"
                  >
                    {s.id === 'no_session' ? 'Ungrouped' : s.id.substring(0, 8) + '...'} ({s.categories?.prompt} prompts)
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="bg-gradient-to-r from-ws-card to-ws-bg border border-ws-border rounded-xl p-6 page-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ws-teal/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-ws-teal" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ws-text">Session Workflow</h2>
              <p className="text-sm text-ws-text-muted font-mono">
                {selectedSession === 'no_session' ? 'All Prompts' : selectedSession.substring(0, 24) + '...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-ws-teal">{workflowGroups.filter((g) => g.prompt).length}</p>
              <p className="text-xs text-ws-text-muted">Prompts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-ws-orange">{currentSession?.categories?.file_write || 0}</p>
              <p className="text-xs text-ws-text-muted">Code Changes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-ws-text">{currentSession?.event_count || 0}</p>
              <p className="text-xs text-ws-text-muted">Total Events</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-ws-text-muted">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatTimestamp(currentSession?.start_time)} — {formatTimestamp(currentSession?.end_time)}</span>
        </div>
      </div>

      <div className="space-y-4 stagger-children">
        {sortedWorkflowGroups.map((group, groupIdx) => (
          <WorkflowGroup
            key={group.id}
            group={group}
            groupIndex={groupIdx}
            isExpanded={expandedGroups.has(group.id)}
            onToggle={() => toggleGroup(group.id)}
            expandedEntries={expandedEntries}
            toggleEntry={toggleEntry}
            copyToClipboard={copyToClipboard}
          />
        ))}
      </div>
    </div>
  );
}

export default WorkflowView;
