import React from 'react';
import { History } from 'lucide-react';
import { CATEGORY_CONFIG } from '../constants';
import { formatTimestamp, truncateContent, getEventSummary } from '../utils';
import { EmptyState } from './EmptyState';
import { ExpandedEventContent } from './LogEntry';

function TimelineEvent({ event, isExpanded, onToggle, copyToClipboard, isLast }) {
  const category = event.category || event.type || 'unknown';
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <div className={`relative pl-10 ${isLast ? '' : 'pb-3'}`}>
      <div className={`absolute left-3 top-1 w-5 h-5 rounded-full ${config.bgClass} flex items-center justify-center z-10`}>
        <Icon className={`w-2.5 h-2.5 ${config.textClass}`} />
      </div>

      <div
        className="bg-ws-bg rounded p-3 cursor-pointer hover:bg-ws-card-hover border border-ws-border transition-colors"
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`px-2 py-0.5 rounded text-xs ${config.bgClass} ${config.textClass}`}>
            {config.label}
          </span>
          <span className="text-xs text-ws-text-muted">{formatTimestamp(event.timestamp)}</span>
        </div>
        <p className="text-sm text-ws-text-secondary">
          {getEventSummary(event, truncateContent)}
        </p>

        {isExpanded && (
          <ExpandedEventContent event={event} copyToClipboard={copyToClipboard} />
        )}
      </div>
    </div>
  );
}

export function TimelineView({ sessions, expandedEntries, toggleEntry, copyToClipboard }) {
  if (!sessions || sessions.length === 0) {
    return <div className="page-enter"><EmptyState hasFilters={false} /></div>;
  }

  return (
    <div className="space-y-4 page-enter stagger-children">
      {sessions.slice(0, 10).map((session, idx) => (
        <div
          key={session.id}
          className="bg-ws-card border border-ws-border rounded overflow-hidden card-load-in"
          style={{ animationDelay: `${idx * 60}ms` }}
        >
          <div className="p-4 border-b border-ws-border bg-ws-sidebar">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-ws-teal/10 flex items-center justify-center">
                  <History className="w-4 h-4 text-ws-teal" />
                </div>
                <div>
                  <h3 className="font-medium text-ws-text text-sm">Session</h3>
                  <p className="text-xs text-ws-text-muted font-mono">{session.id.substring(0, 24)}...</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-ws-text-muted">
                <span>{session.event_count} events</span>
                <span>{formatTimestamp(session.start_time)}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {Object.entries(session.categories || {}).map(([cat, count]) => {
                const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.unknown;
                return (
                  <span key={cat} className={`px-2 py-0.5 rounded text-xs ${config.bgClass} ${config.textClass}`}>
                    {config.label}: {count}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="p-4 timeline-line">
            {session.events.slice(0, 20).map((event, eventIdx) => (
              <TimelineEvent
                key={event.event_id || eventIdx}
                event={event}
                isExpanded={expandedEntries.has(event.event_id || eventIdx)}
                onToggle={() => toggleEntry(event.event_id || eventIdx)}
                copyToClipboard={copyToClipboard}
                isLast={eventIdx === Math.min(session.events.length - 1, 19)}
              />
            ))}
            {session.events.length > 20 && (
              <p className="text-xs text-ws-text-muted text-center mt-4">
                +{session.events.length - 20} more events
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TimelineView;
