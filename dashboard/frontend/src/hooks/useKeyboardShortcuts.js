import { useEffect } from 'react';

export function useKeyboardShortcuts({
  searchInputRef,
  showFilePicker,
  setShowFilePicker,
  showAdvancedSearch,
  setShowAdvancedSearch,
  selectedEntryIndex,
  setSelectedEntryIndex,
  logs,
  toggleEntry,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (showFilePicker) setShowFilePicker(false);
        else if (showAdvancedSearch) setShowAdvancedSearch(false);
        else if (document.activeElement === searchInputRef.current) searchInputRef.current?.blur();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowAdvancedSearch((prev) => !prev);
      }
      if (e.key === 'ArrowDown' && logs.length > 0) {
        e.preventDefault();
        setSelectedEntryIndex((prev) => Math.min(prev + 1, logs.length - 1));
      }
      if (e.key === 'ArrowUp' && logs.length > 0) {
        e.preventDefault();
        setSelectedEntryIndex((prev) => Math.max(prev - 1, 0));
      }
      if (e.key === 'Enter' && selectedEntryIndex >= 0 && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        const entry = logs[selectedEntryIndex];
        if (entry) toggleEntry(entry.event_id || entry.id || selectedEntryIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    searchInputRef,
    showFilePicker,
    setShowFilePicker,
    showAdvancedSearch,
    setShowAdvancedSearch,
    selectedEntryIndex,
    setSelectedEntryIndex,
    logs,
    toggleEntry,
  ]);
}
