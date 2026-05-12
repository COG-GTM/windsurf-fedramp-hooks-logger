import React, { useState } from 'react';
import {
  User,
  Clock,
  ChevronRight,
  Copy,
  FileCode,
  Zap,
} from 'lucide-react';
import { CATEGORY_CONFIG } from '../constants';
import { formatTimestamp, truncateContent, getEventSummary } from '../utils';

function MetadataItem({ label, value }) {
  return (
    <div>
      <dt className="text-ws-text-muted mb-0.5">{label}</dt>
      <dd className="text-ws-text-secondary truncate m-0" title={value}>{value}</dd>
    </div>
  );
}

export function DiffViewer({ edits, copyToClipboard }) {
  const [viewMode, setViewMode] = useState('split');

  if (!edits || edits.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2" role="group" aria-label="Diff view mode">
        <button
          onClick={() => setViewMode('unified')}
          className={`px-2 py-1 text-xs rounded ${viewMode === 'unified' ? 'bg-ws-teal text-white' : 'bg-ws-card border border-ws-border text-ws-text-muted'}`}
          aria-pressed={viewMode === 'unified'}
        >
          Unified
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`px-2 py-1 text-xs rounded ${viewMode === 'split' ? 'bg-ws-teal text-white' : 'bg-ws-card border border-ws-border text-ws-text-muted'}`}
          aria-pressed={viewMode === 'split'}
        >
          Split
        </button>
      </div>

      {edits.map((edit, idx) => (
        <div key={idx} className="bg-ws-bg rounded overflow-hidden border border-ws-border">
          <div className="flex items-center justify-between px-3 py-2 bg-ws-sidebar text-xs">
            <span className="text-ws-text-muted">Edit {idx + 1}</span>
            <div className="flex items-center gap-3">
              <span className="text-ws-teal">+{edit.new_lines || 0}</span>
              <span className="text-red-400">-{edit.old_lines || 0}</span>
              <button
                onClick={(e) => { e.stopPropagation(); copyToClipboard(edit.new_string); }}
                className="text-ws-text-muted hover:text-ws-text flex items-center gap-1"
                aria-label="Copy new code to clipboard"
              >
                <Copy className="w-3 h-3" aria-hidden="true" /> Copy
              </button>
            </div>
          </div>

          {viewMode === 'unified' ? (
            <div className="p-3 font-mono text-xs overflow-auto max-h-64">
              {edit.old_string && (
                <div className="diff-remove px-2 py-1 mb-1">
                  <pre className="text-red-300 whitespace-pre-wrap">{edit.old_string}</pre>
                </div>
              )}
              {edit.new_string && (
                <div className="diff-add px-2 py-1">
                  <pre className="text-ws-teal whitespace-pre-wrap">{edit.new_string}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-ws-border">
              <div className="p-3 font-mono text-xs overflow-auto max-h-64 bg-red-500/5">
                <p className="text-red-400 text-xs mb-2 font-sans">Before</p>
                <pre className="text-red-300 whitespace-pre-wrap">{edit.old_string || '(empty)'}</pre>
              </div>
              <div className="p-3 font-mono text-xs overflow-auto max-h-64 bg-ws-teal/5">
                <p className="text-ws-teal text-xs mb-2 font-sans">After</p>
                <pre className="text-ws-teal whitespace-pre-wrap">{edit.new_string || '(empty)'}</pre>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ExpandedEventContent({ event, entry, copyToClipboard }) {
  const item = event || entry;
  const category = item.category || item.type || 'unknown';
  const data = item.data || {};
  const hasEdits = category === 'file_write' && data.edits && data.edits.length > 0;
  const hasCodeBlocks = item.code_blocks && item.code_blocks.length > 0;

  return (
    <div className="border-t border-ws-border slide-up">
      {category === 'prompt' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-ws-text-muted uppercase tracking-wider">Prompt</h4>
            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(data.user_prompt || item.content || ''); }}
              className="text-xs text-ws-text-muted hover:text-ws-text flex items-center gap-1"
              aria-label="Copy prompt to clipboard"
            >
              <Copy className="w-3 h-3" aria-hidden="true" /> Copy
            </button>
          </div>
          <pre className="bg-ws-bg rounded p-3 text-sm text-ws-text-secondary overflow-auto max-h-96 whitespace-pre-wrap border border-ws-border">
            {data.user_prompt || item.content}
          </pre>
        </div>
      )}

      {category === 'file_read' && (
        <div className="p-3">
          <h4 className="text-xs text-ws-text-muted uppercase tracking-wider mb-2">File Read</h4>
          <div className="bg-ws-bg rounded p-3 border border-ws-border">
            <div className="flex items-center gap-2 text-ws-text-secondary">
              <FileCode className="w-4 h-4 text-ws-orange" />
              <span className="font-mono text-sm">{data.file_path || item.file_path}</span>
            </div>
          </div>
        </div>
      )}

      {category === 'file_write' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-ws-text-muted uppercase tracking-wider">
              Code Changes {data.edit_count ? `(${data.edit_count} edits${data.net_lines_delta !== undefined ? `, ${data.net_lines_delta > 0 ? '+' : ''}${data.net_lines_delta} lines` : ''})` : ''}
            </h4>
            {(data.total_lines_added !== undefined || data.total_lines_removed !== undefined) && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ws-teal">+{data.total_lines_added || 0}</span>
                <span className="text-red-400">-{data.total_lines_removed || 0}</span>
              </div>
            )}
          </div>
          <div className="bg-ws-bg rounded p-3 mb-3 border border-ws-border">
            <div className="flex items-center gap-2 text-ws-text-secondary">
              <FileCode className="w-4 h-4 text-ws-teal" />
              <span className="font-mono text-sm">{data.file_path || item.file_path || 'unknown file'}</span>
            </div>
          </div>
          {hasEdits && <DiffViewer edits={data.edits} copyToClipboard={copyToClipboard} />}
        </div>
      )}

      {category === 'command' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-ws-text-muted uppercase tracking-wider">Command</h4>
            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(data.command_line || ''); }}
              className="text-xs text-ws-text-muted hover:text-ws-text flex items-center gap-1"
              aria-label="Copy command to clipboard"
            >
              <Copy className="w-3 h-3" aria-hidden="true" /> Copy
            </button>
          </div>
          <div className="bg-ws-bg rounded p-3 font-mono text-sm border border-ws-border">
            <span className="text-ws-orange">$</span> <span className="text-ws-text-secondary">{data.command_line}</span>
          </div>
          {data.cwd && (
            <p className="text-xs text-ws-text-muted mt-2">Working directory: {data.cwd}</p>
          )}
        </div>
      )}

      {category === 'mcp' && (
        <div className="p-3">
          <h4 className="text-xs text-ws-text-muted uppercase tracking-wider mb-2">MCP Tool Call</h4>
          <div className="bg-ws-bg rounded p-3 border border-ws-border">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-ws-teal" />
              <span className="text-ws-text font-medium">{data.mcp_full_tool || data.mcp_tool_name}</span>
            </div>
            <pre className="text-xs text-ws-text-muted overflow-auto max-h-32">
              {JSON.stringify(data.mcp_tool_arguments, null, 2)}
            </pre>
            {data.mcp_result && (
              <div className="mt-3 pt-3 border-t border-ws-border">
                <p className="text-xs text-ws-text-muted mb-1">Result:</p>
                <pre className="text-xs text-ws-text-secondary overflow-auto max-h-32">
                  {typeof data.mcp_result === 'string' ? data.mcp_result : JSON.stringify(data.mcp_result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {!['prompt', 'file_read', 'file_write', 'command', 'mcp'].includes(category) && item.content && (
        <div className="p-3">
          <h4 className="text-xs text-ws-text-muted uppercase tracking-wider mb-2">Content</h4>
          <pre className="bg-ws-bg rounded p-3 text-sm text-ws-text-secondary overflow-auto max-h-96 whitespace-pre-wrap border border-ws-border">
            {item.content}
          </pre>
        </div>
      )}

      {hasCodeBlocks && (
        <div className="p-3 border-t border-ws-border">
          <h4 className="text-xs text-ws-text-muted uppercase tracking-wider mb-2">
            Generated Code ({item.code_blocks.length} blocks)
          </h4>
          <div className="space-y-2">
            {item.code_blocks.map((block, idx) => (
              <div key={idx} className="bg-ws-bg rounded overflow-hidden border border-ws-border">
                <div className="flex items-center justify-between px-3 py-2 bg-ws-sidebar">
                  <span className="text-xs font-medium text-ws-teal">{block.language}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(block.code); }}
                    className="text-xs text-ws-text-muted hover:text-ws-text"
                    aria-label="Copy code block to clipboard"
                  >
                    Copy
                  </button>
                </div>
                <pre className="p-3 text-sm text-ws-text-secondary overflow-auto max-h-64">
                  <code>{block.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 border-t border-ws-border bg-ws-sidebar">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs m-0">
          <MetadataItem label="Event ID" value={item.event_id || item.id || 'N/A'} />
          <MetadataItem label="Trajectory ID" value={item.trajectory_id || 'N/A'} />
          <MetadataItem label="Hostname" value={item.hostname || item.system?.hostname || 'N/A'} />
          <MetadataItem label="Action" value={item.action || 'N/A'} />
        </dl>
      </div>
    </div>
  );
}

export function LogEntry({ entry, isExpanded, onToggle, copyToClipboard, isSelected }) {
  const category = entry.category || entry.type || 'unknown';
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.unknown;
  const Icon = config.icon;
  const data = entry.data || {};
  const hasEdits = category === 'file_write' && data.edits && data.edits.length > 0;
  const hasCodeBlocks = entry.code_blocks && entry.code_blocks.length > 0;

  const borderColors = {
    prompt: 'border-l-ws-teal',
    file_read: 'border-l-ws-orange',
    file_write: 'border-l-ws-teal',
    command: 'border-l-ws-orange',
    mcp: 'border-l-ws-teal',
    response: 'border-l-ws-teal',
    unknown: 'border-l-ws-text-muted',
  };

  return (
    <div className={`bg-ws-card border border-ws-border rounded overflow-hidden border-l-2 log-card ${borderColors[category] || borderColors.unknown} ${isSelected ? 'ring-1 ring-ws-teal' : ''}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-ws-card-hover transition-colors"
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${config.label} entry`}
      >
        <div className={`w-8 h-8 rounded flex items-center justify-center ${config.bgClass}`} aria-hidden="true">
          <Icon className={`w-4 h-4 ${config.textClass}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`px-2 py-0.5 rounded text-xs ${config.bgClass} ${config.textClass}`}>
              {config.label}
            </span>
            {hasEdits && (
              <span className="px-2 py-0.5 rounded text-xs bg-ws-teal/10 text-ws-teal">
                {data.edit_count} edits
              </span>
            )}
            {hasCodeBlocks && (
              <span className="px-2 py-0.5 rounded text-xs bg-ws-teal/10 text-ws-teal">
                {entry.code_block_count} blocks
              </span>
            )}
          </div>
          <p className="text-sm text-ws-text-secondary truncate">
            {getEventSummary(entry, truncateContent)}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-ws-text-muted">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>{entry.user || 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatTimestamp(entry.timestamp)}</span>
          </div>
          <ChevronRight className={`w-4 h-4 chevron-rotate ${isExpanded ? 'rotated' : ''}`} />
        </div>
      </div>

      <div className={`expand-content ${isExpanded ? 'expanded' : ''}`}>
        <div>
          <ExpandedEventContent entry={entry} copyToClipboard={copyToClipboard} />
        </div>
      </div>
    </div>
  );
}

export default LogEntry;
