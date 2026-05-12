import React from 'react';
import { LogEntry } from './LogEntry';

export function ListView({
  logs,
  expandedEntries,
  toggleEntry,
  copyToClipboard,
  selectedEntryIndex,
}) {
  return (
    <div className="space-y-3 stagger-children">
      {logs.map((entry, idx) => {
        const key = entry.event_id || entry.id || idx;
        return (
          <LogEntry
            key={key}
            entry={entry}
            isExpanded={expandedEntries.has(key)}
            onToggle={() => toggleEntry(key)}
            copyToClipboard={copyToClipboard}
            isSelected={selectedEntryIndex === idx}
          />
        );
      })}
    </div>
  );
}

export default ListView;
