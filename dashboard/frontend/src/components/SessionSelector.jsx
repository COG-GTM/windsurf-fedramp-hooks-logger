import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { formatSessionName } from '../utils';

export function SessionSelector({
  sessions,
  selectedSession,
  onSelectSession,
  sessionSortOrder,
  onToggleSortOrder,
}) {
  const sortedSessions = [...sessions].sort((a, b) => {
    const getTimestamp = (session) => {
      if (session.first_event) return new Date(session.first_event).getTime();
      if (session.id === 'no_session') return sessionSortOrder === 'newest' ? Infinity : -Infinity;
      return 0;
    };
    const timeA = getTimestamp(a);
    const timeB = getTimestamp(b);
    return sessionSortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  return (
    <div className="p-3 border-b border-ws-border">
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-ws-text-muted">Select Session</p>
        <button
          onClick={onToggleSortOrder}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-ws-text-muted hover:text-ws-text bg-ws-card/50 hover:bg-ws-card rounded border border-ws-border/50 transition-colors"
          title={`Sort by ${sessionSortOrder === 'newest' ? 'oldest' : 'newest'} first`}
          aria-label={`Currently sorted ${sessionSortOrder} first. Click to sort ${sessionSortOrder === 'newest' ? 'oldest' : 'newest'} first`}
        >
          {sessionSortOrder === 'newest' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
          <span>{sessionSortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
        </button>
      </div>
      <div className="space-y-1 max-h-96 overflow-y-auto custom-scrollbar">
        {sortedSessions.slice(0, 20).map((session) => {
          const hasPrompts = (session.categories?.prompt || 0) > 0;
          const displayName = formatSessionName(session);
          return (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                selectedSession === session.id
                  ? 'bg-ws-teal/10 text-ws-teal border border-ws-teal/30'
                  : hasPrompts
                  ? 'text-ws-text-secondary hover:text-ws-text hover:bg-ws-card/50 border border-ws-teal/20'
                  : 'text-ws-text-muted hover:text-ws-text-secondary hover:bg-ws-card/30 border border-transparent'
              }`}
              aria-pressed={selectedSession === session.id}
              aria-label={`Select session: ${displayName}`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-xs leading-tight flex-1 ${hasPrompts ? 'font-medium' : 'font-mono'}`}>
                    {displayName}
                  </span>
                  {hasPrompts && (
                    <span className="text-xs text-ws-teal font-medium whitespace-nowrap">
                      {session.categories?.prompt} prompts
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-ws-text-muted">
                  <span>{session.event_count} events</span>
                  <span>{session.categories?.prompt || 0} prompts</span>
                  {(session.categories?.file_write || 0) > 0 && (
                    <span>{session.categories?.file_write} changes</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SessionSelector;
