import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  Filter, 
  FolderOpen, 
  FileText, 
  Code, 
  MessageSquare, 
  User, 
  Clock, 
  ChevronRight,
  ChevronDown,
  X,
  RefreshCw,
  BarChart3,
  Terminal,
  Layers,
  Download,
  Copy,
  Check,
  GitBranch,
  Play,
  Eye,
  Edit3,
  Zap,
  Regex,
  FileCode,
  History
} from 'lucide-react';

const API_BASE = '/api';

const CATEGORY_CONFIG = {
  prompt: { icon: MessageSquare, color: 'blue', label: 'Prompt', bgClass: 'bg-blue-500/20', textClass: 'text-blue-400' },
  file_read: { icon: Eye, color: 'yellow', label: 'File Read', bgClass: 'bg-yellow-500/20', textClass: 'text-yellow-400' },
  file_write: { icon: Edit3, color: 'green', label: 'Code Change', bgClass: 'bg-green-500/20', textClass: 'text-green-400' },
  command: { icon: Play, color: 'orange', label: 'Command', bgClass: 'bg-orange-500/20', textClass: 'text-orange-400' },
  mcp: { icon: Zap, color: 'purple', label: 'MCP Tool', bgClass: 'bg-purple-500/20', textClass: 'text-purple-400' },
  response: { icon: Code, color: 'teal', label: 'Response', bgClass: 'bg-teal-500/20', textClass: 'text-teal-400' },
  unknown: { icon: FileText, color: 'gray', label: 'Unknown', bgClass: 'bg-gray-500/20', textClass: 'text-gray-400' }
};

function App() {
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterSession, setFilterSession] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [currentDir, setCurrentDir] = useState('/Users/chasedalton/CascadeProjects/windsurf-logger/logs');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'timeline'
  const [toasts, setToasts] = useState([]);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(-1);
  
  const searchInputRef = useRef(null);
  const logContainerRef = useRef(null);

  const fetchFiles = useCallback(async (dir) => {
    try {
      const res = await fetch(`${API_BASE}/logs/files?dir=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
        setCurrentDir(data.directory);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/logs/stats?dir=${encodeURIComponent(currentDir)}`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [currentDir]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/logs/sessions?dir=${encodeURIComponent(currentDir)}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, [currentDir]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/logs/data`;
      if (selectedFiles.length > 0) {
        const params = selectedFiles.map(f => `files=${encodeURIComponent(f)}`).join('&');
        url += `?${params}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setLogs(data.entries || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedFiles]);

  const searchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/logs/search?dir=${encodeURIComponent(currentDir)}`;
      if (searchQuery.trim()) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      }
      if (filterCategory !== 'all') {
        url += `&category=${filterCategory}`;
      }
      if (filterUser !== 'all') {
        url += `&user=${encodeURIComponent(filterUser)}`;
      }
      if (filterSession !== 'all') {
        url += `&session=${encodeURIComponent(filterSession)}`;
      }
      if (dateFrom) {
        url += `&date_from=${encodeURIComponent(dateFrom)}`;
      }
      if (dateTo) {
        url += `&date_to=${encodeURIComponent(dateTo)}`;
      }
      if (useRegex) {
        url += `&regex=true`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        addToast(data.error, 'error');
      }
      setLogs(data.entries || []);
    } catch (err) {
      console.error('Failed to search:', err);
      addToast('Search failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterCategory, filterUser, filterSession, dateFrom, dateTo, useRegex, currentDir, addToast]);

  const exportLogs = async (format) => {
    const url = `${API_BASE}/logs/export?format=${format}&dir=${encodeURIComponent(currentDir)}${filterCategory !== 'all' ? `&category=${filterCategory}` : ''}`;
    window.open(url, '_blank');
    addToast(`Exporting as ${format.toUpperCase()}...`, 'success');
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast('Copied to clipboard', 'success');
    } catch (err) {
      addToast('Failed to copy', 'error');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // / to focus search
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to close modals or clear search
      if (e.key === 'Escape') {
        if (showFilePicker) {
          setShowFilePicker(false);
        } else if (showAdvancedSearch) {
          setShowAdvancedSearch(false);
        } else if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
      }
      // Ctrl+K for quick filter
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowAdvancedSearch(prev => !prev);
      }
      // Arrow navigation
      if (e.key === 'ArrowDown' && logs.length > 0) {
        e.preventDefault();
        setSelectedEntryIndex(prev => Math.min(prev + 1, logs.length - 1));
      }
      if (e.key === 'ArrowUp' && logs.length > 0) {
        e.preventDefault();
        setSelectedEntryIndex(prev => Math.max(prev - 1, 0));
      }
      // Enter to expand selected
      if (e.key === 'Enter' && selectedEntryIndex >= 0 && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        const entry = logs[selectedEntryIndex];
        if (entry) {
          toggleEntry(entry.event_id || entry.id || selectedEntryIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilePicker, showAdvancedSearch, selectedEntryIndex, logs]);

  useEffect(() => {
    fetchFiles(currentDir);
    fetchStats();
    fetchSessions();
  }, [currentDir, fetchFiles, fetchStats, fetchSessions]);

  useEffect(() => {
    if (selectedFiles.length > 0) {
      fetchLogs();
    } else {
      searchLogs();
    }
  }, [selectedFiles, fetchLogs, searchLogs]);

  const toggleEntry = (id) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleFileSelection = (filepath) => {
    setSelectedFiles(prev => {
      if (prev.includes(filepath)) {
        return prev.filter(f => f !== filepath);
      }
      return [...prev, filepath];
    });
  };

  const filteredLogs = logs.filter(entry => {
    const category = entry.category || entry.type || 'unknown';
    if (filterCategory !== 'all' && category !== filterCategory) return false;
    if (filterUser !== 'all' && entry.user !== filterUser) return false;
    if (filterSession !== 'all' && entry.trajectory_id !== filterSession) return false;
    return true;
  });

  const uniqueUsers = [...new Set(logs.map(l => l.user).filter(Boolean))];
  const uniqueSessions = [...new Set(logs.map(l => l.trajectory_id).filter(Boolean))];
  const categories = [...new Set(logs.map(l => l.category || l.type).filter(Boolean))];

  const formatTimestamp = (ts) => {
    if (!ts) return 'Unknown';
    try {
      const date = new Date(ts);
      return date.toLocaleString();
    } catch {
      return ts;
    }
  };

  const truncateContent = (content, maxLen = 200) => {
    if (!content) return '';
    if (content.length <= maxLen) return content;
    return content.substring(0, maxLen) + '...';
  };

  return (
    <div className="min-h-screen bg-devin-dark flex">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 bg-devin-darker border-r border-devin-border overflow-hidden flex flex-col`}>
        <div className="p-4 border-b border-devin-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-devin-teal rounded-lg flex items-center justify-center">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-devin-text">Windsurf Logger</h1>
              <p className="text-xs text-devin-muted">Dashboard</p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="p-4 border-b border-devin-border">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'list' ? 'bg-devin-teal text-white' : 'bg-devin-card text-devin-muted hover:text-devin-text'
              }`}
            >
              <Layers className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                viewMode === 'timeline' ? 'bg-devin-teal text-white' : 'bg-devin-card text-devin-muted hover:text-devin-text'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Timeline
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="p-4 border-b border-devin-border">
            <h3 className="text-xs font-medium text-devin-muted uppercase tracking-wider mb-3">Statistics</h3>
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={<MessageSquare className="w-4 h-4" />} label="Prompts" value={stats.total_prompts || stats.categories?.prompt || 0} color="blue" />
              <StatCard icon={<Edit3 className="w-4 h-4" />} label="Code Changes" value={stats.total_file_writes || stats.categories?.file_write || 0} color="green" />
              <StatCard icon={<Play className="w-4 h-4" />} label="Commands" value={stats.total_commands || stats.categories?.command || 0} color="orange" />
              <StatCard icon={<User className="w-4 h-4" />} label="Sessions" value={stats.unique_sessions || 0} color="purple" />
            </div>
          </div>
        )}

        {/* File Selection */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-devin-muted uppercase tracking-wider">Log Files</h3>
            <button 
              onClick={() => fetchFiles(currentDir)}
              className="p-1 hover:bg-devin-card rounded text-devin-muted hover:text-devin-text transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-1">
            {files.map(file => (
              <label 
                key={file.path}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedFiles.includes(file.path) 
                    ? 'bg-devin-teal/20 border border-devin-teal/50' 
                    : 'hover:bg-devin-card border border-transparent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file.path)}
                  onChange={() => toggleFileSelection(file.path)}
                  className="w-4 h-4 rounded border-devin-border bg-devin-card text-devin-teal focus:ring-devin-teal focus:ring-offset-0"
                />
                <FileText className={`w-4 h-4 ${file.type === 'jsonl' ? 'text-devin-teal' : 'text-devin-muted'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-devin-text truncate">{file.name}</p>
                  <div className="flex items-center gap-2 text-xs text-devin-muted">
                    <span>{(file.size / 1024).toFixed(1)} KB</span>
                    {file.entries > 0 && (
                      <span className="px-1.5 py-0.5 bg-devin-teal/20 text-devin-teal rounded text-xs font-medium">
                        {file.entries.toLocaleString()} entries
                      </span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {files.length === 0 && (
            <p className="text-sm text-devin-muted text-center py-4">No log files found</p>
          )}
        </div>

        {/* Directory Picker Button - REMOVED (moved to header) */}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-devin-darker border-b border-devin-border p-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-devin-card rounded-lg text-devin-muted hover:text-devin-text transition-colors"
            >
              <BarChart3 className="w-5 h-5" />
            </button>

            {/* Directory Selector - Moved to header */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilePicker(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-devin-card hover:bg-devin-border rounded-lg text-sm text-devin-text transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Change Directory</span>
              </button>
              <p className="text-xs text-devin-muted max-w-xs truncate" title={currentDir} style={{wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.2'}}>
                {currentDir}
              </p>
            </div>

            {/* Search */}
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-devin-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchLogs()}
                  placeholder="Search logs... (press / to focus)"
                  className="w-full pl-10 pr-20 py-2 bg-devin-card border border-devin-border rounded-lg text-devin-text placeholder-devin-muted focus:outline-none focus:border-devin-teal focus:ring-1 focus:ring-devin-teal"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    onClick={() => setUseRegex(!useRegex)}
                    className={`p-1 rounded ${useRegex ? 'bg-devin-teal text-white' : 'text-devin-muted hover:text-devin-text'}`}
                    title="Toggle regex search"
                  >
                    <Regex className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-devin-muted kbd">/</span>
                </div>
              </div>
              <button
                onClick={searchLogs}
                className="px-4 py-2 bg-devin-teal hover:bg-devin-teal-light text-white rounded-lg transition-colors font-medium"
              >
                Search
              </button>
              <button
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                className={`p-2 rounded-lg transition-colors ${showAdvancedSearch ? 'bg-devin-teal text-white' : 'bg-devin-card text-devin-muted hover:text-devin-text'}`}
                title="Advanced filters (⌘K)"
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); searchLogs(); }}
                className="px-3 py-2 bg-devin-card border border-devin-border rounded-lg text-devin-text focus:outline-none focus:border-devin-teal"
              >
                <option value="all">All Categories</option>
                <option value="prompt">Prompts</option>
                <option value="file_read">File Reads</option>
                <option value="file_write">Code Changes</option>
                <option value="command">Commands</option>
                <option value="mcp">MCP Tools</option>
              </select>

              <select
                value={filterUser}
                onChange={(e) => { setFilterUser(e.target.value); searchLogs(); }}
                className="px-3 py-2 bg-devin-card border border-devin-border rounded-lg text-devin-text focus:outline-none focus:border-devin-teal"
              >
                <option value="all">All Users</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>

              {/* Export */}
              <div className="relative group">
                <button className="p-2 bg-devin-card hover:bg-devin-border rounded-lg text-devin-muted hover:text-devin-text transition-colors">
                  <Download className="w-5 h-5" />
                </button>
                <div className="absolute right-0 top-full mt-1 bg-devin-card border border-devin-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => exportLogs('json')}
                    className="w-full px-4 py-2 text-left text-sm text-devin-text hover:bg-devin-border rounded-t-lg"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={() => exportLogs('csv')}
                    className="w-full px-4 py-2 text-left text-sm text-devin-text hover:bg-devin-border rounded-b-lg"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Search Panel */}
          {showAdvancedSearch && (
            <div className="mt-4 p-4 bg-devin-card rounded-lg border border-devin-border slide-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-devin-text">Advanced Filters</h3>
                <button onClick={() => setShowAdvancedSearch(false)} className="text-devin-muted hover:text-devin-text">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-devin-muted mb-1">Session</label>
                  <select
                    value={filterSession}
                    onChange={(e) => setFilterSession(e.target.value)}
                    className="w-full px-3 py-2 bg-devin-darker border border-devin-border rounded-lg text-devin-text text-sm focus:outline-none focus:border-devin-teal"
                  >
                    <option value="all">All Sessions</option>
                    {uniqueSessions.map(session => (
                      <option key={session} value={session}>{session.substring(0, 20)}...</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-devin-muted mb-1">From Date</label>
                  <input
                    type="datetime-local"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-devin-darker border border-devin-border rounded-lg text-devin-text text-sm focus:outline-none focus:border-devin-teal"
                  />
                </div>
                <div>
                  <label className="block text-xs text-devin-muted mb-1">To Date</label>
                  <input
                    type="datetime-local"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 bg-devin-darker border border-devin-border rounded-lg text-devin-text text-sm focus:outline-none focus:border-devin-teal"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={searchLogs}
                    className="flex-1 px-4 py-2 bg-devin-teal hover:bg-devin-teal-light text-white rounded-lg text-sm transition-colors"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={() => {
                      setFilterCategory('all');
                      setFilterUser('all');
                      setFilterSession('all');
                      setDateFrom('');
                      setDateTo('');
                      setUseRegex(false);
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 bg-devin-darker text-devin-muted hover:text-devin-text rounded-lg text-sm transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-devin-muted">
                <span>Keyboard shortcuts:</span>
                <span><span className="kbd">/</span> Focus search</span>
                <span><span className="kbd">⌘K</span> Toggle filters</span>
                <span><span className="kbd">↑↓</span> Navigate</span>
                <span><span className="kbd">Enter</span> Expand</span>
                <span><span className="kbd">Esc</span> Close</span>
              </div>
            </div>
          )}
        </header>

        {/* Log Entries */}
        <div ref={logContainerRef} className="flex-1 overflow-auto p-4">
          {loading ? (
            <LoadingSkeleton />
          ) : filteredLogs.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'timeline' ? (
            <TimelineView
              sessions={sessions}
              expandedEntries={expandedEntries}
              toggleEntry={toggleEntry}
              formatTimestamp={formatTimestamp}
              truncateContent={truncateContent}
              copyToClipboard={copyToClipboard}
            />
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((entry, idx) => (
                <LogEntry
                  key={entry.event_id || entry.id || idx}
                  entry={entry}
                  isExpanded={expandedEntries.has(entry.event_id || entry.id || idx)}
                  onToggle={() => toggleEntry(entry.event_id || entry.id || idx)}
                  formatTimestamp={formatTimestamp}
                  truncateContent={truncateContent}
                  copyToClipboard={copyToClipboard}
                  isSelected={selectedEntryIndex === idx}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-devin-darker border-t border-devin-border px-4 py-2 flex items-center justify-between text-sm text-devin-muted">
          <span>{filteredLogs.length} entries</span>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </footer>
      </main>

      {/* Directory Picker Modal */}
      {showFilePicker && (
        <DirectoryPicker
          currentDir={currentDir}
          onSelect={(dir) => {
            setCurrentDir(dir);
            setSelectedFiles([]);
            setShowFilePicker(false);
          }}
          onClose={() => setShowFilePicker(false)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color = 'teal' }) {
  const colorClasses = {
    teal: 'text-devin-teal bg-devin-teal/10',
    blue: 'text-blue-400 bg-blue-500/10',
    green: 'text-green-400 bg-green-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
  };
  
  return (
    <div className={`rounded-lg p-3 ${colorClasses[color] || colorClasses.teal}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs opacity-70">{label}</span>
      </div>
      <p className="text-lg font-semibold">{value || 0}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-devin-card border border-devin-border rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg skeleton" />
            <div className="flex-1">
              <div className="h-4 w-24 rounded skeleton mb-2" />
              <div className="h-3 w-48 rounded skeleton" />
            </div>
            <div className="h-4 w-32 rounded skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-devin-muted slide-up">
      <div className="w-20 h-20 rounded-full bg-devin-card flex items-center justify-center mb-4">
        <FileText className="w-10 h-10 opacity-50" />
      </div>
      <p className="text-lg font-medium text-devin-text">No log entries found</p>
      <p className="text-sm mt-2 text-center max-w-md">
        Select log files from the sidebar, adjust your filters, or wait for Cascade to generate new events.
      </p>
      <div className="mt-4 flex gap-2 text-xs">
        <span className="px-2 py-1 bg-devin-card rounded">Tip: Press <span className="kbd">/</span> to search</span>
      </div>
    </div>
  );
}

function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg toast-enter flex items-center gap-2 ${
            toast.type === 'error' ? 'bg-red-500/90 text-white' :
            toast.type === 'success' ? 'bg-green-500/90 text-white' :
            'bg-devin-card text-devin-text border border-devin-border'
          }`}
        >
          {toast.type === 'success' && <Check className="w-4 h-4" />}
          {toast.type === 'error' && <X className="w-4 h-4" />}
          <span className="text-sm">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

function TimelineView({ sessions, expandedEntries, toggleEntry, formatTimestamp, truncateContent, copyToClipboard }) {
  if (!sessions || sessions.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      {sessions.slice(0, 10).map(session => (
        <div key={session.id} className="bg-devin-card border border-devin-border rounded-xl overflow-hidden slide-in">
          {/* Session Header */}
          <div className="p-4 border-b border-devin-border bg-devin-darker/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-devin-teal/20 flex items-center justify-center">
                  <History className="w-5 h-5 text-devin-teal" />
                </div>
                <div>
                  <h3 className="font-medium text-devin-text">Session</h3>
                  <p className="text-xs text-devin-muted font-mono">{session.id.substring(0, 32)}...</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-devin-muted">
                <span>{session.event_count} events</span>
                <span>{formatTimestamp(session.start_time)}</span>
              </div>
            </div>
            {/* Category Pills */}
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
          
          {/* Timeline Events */}
          <div className="p-4 timeline-line">
            {session.events.slice(0, 20).map((event, idx) => (
              <TimelineEvent
                key={event.event_id || idx}
                event={event}
                isExpanded={expandedEntries.has(event.event_id || idx)}
                onToggle={() => toggleEntry(event.event_id || idx)}
                formatTimestamp={formatTimestamp}
                truncateContent={truncateContent}
                copyToClipboard={copyToClipboard}
                isLast={idx === Math.min(session.events.length - 1, 19)}
              />
            ))}
            {session.events.length > 20 && (
              <p className="text-xs text-devin-muted text-center mt-4">
                +{session.events.length - 20} more events
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineEvent({ event, isExpanded, onToggle, formatTimestamp, truncateContent, copyToClipboard, isLast }) {
  const category = event.category || event.type || 'unknown';
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <div className={`relative pl-12 ${isLast ? '' : 'pb-4'}`}>
      {/* Timeline Dot */}
      <div className={`absolute left-3 top-1 w-6 h-6 rounded-full ${config.bgClass} flex items-center justify-center z-10`}>
        <Icon className={`w-3 h-3 ${config.textClass}`} />
      </div>
      
      {/* Event Card */}
      <div 
        className="bg-devin-darker rounded-lg p-3 cursor-pointer hover:bg-devin-border/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`px-2 py-0.5 rounded text-xs ${config.bgClass} ${config.textClass}`}>
            {config.label}
          </span>
          <span className="text-xs text-devin-muted">{formatTimestamp(event.timestamp)}</span>
        </div>
        <p className="text-sm text-devin-text">
          {getEventSummary(event, truncateContent)}
        </p>
        
        {isExpanded && (
          <ExpandedEventContent event={event} copyToClipboard={copyToClipboard} />
        )}
      </div>
    </div>
  );
}

function getEventSummary(entry, truncateContent) {
  const category = entry.category || entry.type || 'unknown';
  const data = entry.data || {};
  
  switch (category) {
    case 'prompt':
      return truncateContent(data.user_prompt || entry.content || 'User prompt', 100);
    case 'file_read':
      return `Read: ${data.file_path || entry.file_path || 'unknown file'}`;
    case 'file_write':
      return `Modified: ${data.file_path || entry.file_path || 'unknown file'} (${data.edit_count || 0} edits)`;
    case 'command':
      return `$ ${truncateContent(data.command_line || entry.command_line || 'command', 80)}`;
    case 'mcp':
      return `MCP: ${data.mcp_full_tool || data.mcp_tool_name || 'tool'}`;
    case 'response':
      return truncateContent(entry.content || 'Response', 100);
    default:
      return truncateContent(entry.content || entry.action || 'Event', 100);
  }
}

function LogEntry({ entry, isExpanded, onToggle, formatTimestamp, truncateContent, copyToClipboard, isSelected }) {
  const category = entry.category || entry.type || 'unknown';
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.unknown;
  const Icon = config.icon;
  const data = entry.data || {};
  const hasEdits = category === 'file_write' && data.edits && data.edits.length > 0;
  const hasCodeBlocks = entry.code_blocks && entry.code_blocks.length > 0;

  const borderColors = {
    prompt: 'border-l-blue-500',
    file_read: 'border-l-yellow-500',
    file_write: 'border-l-green-500',
    command: 'border-l-orange-500',
    mcp: 'border-l-purple-500',
    response: 'border-l-teal-500',
    unknown: 'border-l-gray-500'
  };

  return (
    <div className={`bg-devin-card border border-devin-border rounded-xl overflow-hidden fade-in border-l-4 ${borderColors[category] || borderColors.unknown} ${isSelected ? 'ring-2 ring-devin-teal' : ''}`}>
      {/* Header */}
      <div 
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-devin-border/30 transition-colors"
        onClick={onToggle}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.bgClass}`}>
          <Icon className={`w-5 h-5 ${config.textClass}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgClass} ${config.textClass}`}>
              {config.label}
            </span>
            {entry.phase && (
              <span className="px-2 py-0.5 rounded text-xs bg-devin-border text-devin-muted">
                {entry.phase}
              </span>
            )}
            {hasEdits && (
              <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
                {data.edit_count} edits
              </span>
            )}
            {hasCodeBlocks && (
              <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                {entry.code_block_count} code blocks
              </span>
            )}
          </div>
          <p className="text-sm text-devin-text truncate">
            {getEventSummary(entry, truncateContent)}
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm text-devin-muted">
          <div className="flex items-center gap-1">
            <User className="w-4 h-4" />
            <span>{entry.user || 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{formatTimestamp(entry.timestamp)}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <ExpandedEventContent entry={entry} copyToClipboard={copyToClipboard} />
      )}
    </div>
  );
}

function ExpandedEventContent({ event, entry, copyToClipboard }) {
  const item = event || entry;
  const category = item.category || item.type || 'unknown';
  const data = item.data || {};
  const hasEdits = category === 'file_write' && data.edits && data.edits.length > 0;
  const hasCodeBlocks = item.code_blocks && item.code_blocks.length > 0;

  return (
    <div className="border-t border-devin-border slide-up">
      {/* Main Content based on category */}
      {category === 'prompt' && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-devin-muted uppercase tracking-wider">Prompt</h4>
            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(data.user_prompt || item.content || ''); }}
              className="text-xs text-devin-muted hover:text-devin-text flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="bg-devin-darker rounded-lg p-4 text-sm text-devin-text overflow-auto max-h-96 whitespace-pre-wrap">
            {data.user_prompt || item.content}
          </pre>
        </div>
      )}

      {category === 'file_read' && (
        <div className="p-4">
          <h4 className="text-xs font-medium text-devin-muted uppercase tracking-wider mb-2">File Read</h4>
          <div className="bg-devin-darker rounded-lg p-4">
            <div className="flex items-center gap-2 text-devin-text">
              <FileCode className="w-4 h-4 text-yellow-400" />
              <span className="font-mono text-sm">{data.file_path || item.file_path}</span>
            </div>
          </div>
        </div>
      )}

      {category === 'file_write' && hasEdits && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-devin-muted uppercase tracking-wider">
              Code Changes ({data.edit_count} edits, {data.net_lines_delta > 0 ? '+' : ''}{data.net_lines_delta || 0} lines)
            </h4>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-400">+{data.total_lines_added || 0}</span>
              <span className="text-red-400">-{data.total_lines_removed || 0}</span>
            </div>
          </div>
          <div className="bg-devin-darker rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 text-devin-text">
              <FileCode className="w-4 h-4 text-green-400" />
              <span className="font-mono text-sm">{data.file_path}</span>
            </div>
          </div>
          <DiffViewer edits={data.edits} copyToClipboard={copyToClipboard} />
        </div>
      )}

      {category === 'command' && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-devin-muted uppercase tracking-wider">Command</h4>
            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(data.command_line || ''); }}
              className="text-xs text-devin-muted hover:text-devin-text flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <div className="bg-devin-darker rounded-lg p-4 font-mono text-sm">
            <span className="text-orange-400">$</span> <span className="text-devin-text">{data.command_line}</span>
          </div>
          {data.cwd && (
            <p className="text-xs text-devin-muted mt-2">Working directory: {data.cwd}</p>
          )}
        </div>
      )}

      {category === 'mcp' && (
        <div className="p-4">
          <h4 className="text-xs font-medium text-devin-muted uppercase tracking-wider mb-2">MCP Tool Call</h4>
          <div className="bg-devin-darker rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-devin-text font-medium">{data.mcp_full_tool || data.mcp_tool_name}</span>
            </div>
            <pre className="text-xs text-devin-muted overflow-auto max-h-32">
              {JSON.stringify(data.mcp_tool_arguments, null, 2)}
            </pre>
            {data.mcp_result && (
              <div className="mt-3 pt-3 border-t border-devin-border">
                <p className="text-xs text-devin-muted mb-1">Result:</p>
                <pre className="text-xs text-devin-text overflow-auto max-h-32">
                  {typeof data.mcp_result === 'string' ? data.mcp_result : JSON.stringify(data.mcp_result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legacy content display */}
      {!['prompt', 'file_read', 'file_write', 'command', 'mcp'].includes(category) && item.content && (
        <div className="p-4">
          <h4 className="text-xs font-medium text-devin-muted uppercase tracking-wider mb-2">Content</h4>
          <pre className="bg-devin-darker rounded-lg p-4 text-sm text-devin-text overflow-auto max-h-96 whitespace-pre-wrap">
            {item.content}
          </pre>
        </div>
      )}

      {/* Legacy Code Blocks */}
      {hasCodeBlocks && (
        <div className="p-4 border-t border-devin-border">
          <h4 className="text-xs font-medium text-devin-muted uppercase tracking-wider mb-2">
            Generated Code ({item.code_blocks.length} blocks)
          </h4>
          <div className="space-y-3">
            {item.code_blocks.map((block, idx) => (
              <div key={idx} className="bg-devin-darker rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-devin-border/50">
                  <span className="text-xs font-medium text-devin-teal">{block.language}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(block.code); }}
                    className="text-xs text-devin-muted hover:text-devin-text"
                  >
                    Copy
                  </button>
                </div>
                <pre className="p-4 text-sm text-devin-text overflow-auto max-h-64">
                  <code>{block.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="p-4 border-t border-devin-border bg-devin-darker/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <MetadataItem label="Event ID" value={item.event_id || item.id || 'N/A'} />
          <MetadataItem label="Trajectory ID" value={item.trajectory_id || 'N/A'} />
          <MetadataItem label="Hostname" value={item.hostname || item.system?.hostname || 'N/A'} />
          <MetadataItem label="Action" value={item.action || 'N/A'} />
        </div>
      </div>
    </div>
  );
}

function DiffViewer({ edits, copyToClipboard }) {
  const [viewMode, setViewMode] = useState('unified'); // 'unified' or 'split'

  if (!edits || edits.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode('unified')}
          className={`px-2 py-1 text-xs rounded ${viewMode === 'unified' ? 'bg-devin-teal text-white' : 'bg-devin-border text-devin-muted'}`}
        >
          Unified
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`px-2 py-1 text-xs rounded ${viewMode === 'split' ? 'bg-devin-teal text-white' : 'bg-devin-border text-devin-muted'}`}
        >
          Split
        </button>
      </div>

      {edits.map((edit, idx) => (
        <div key={idx} className="bg-devin-darker rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-devin-border/50 text-xs">
            <span className="text-devin-muted">Edit {idx + 1}</span>
            <div className="flex items-center gap-3">
              <span className="text-green-400">+{edit.new_lines || 0}</span>
              <span className="text-red-400">-{edit.old_lines || 0}</span>
              <button
                onClick={(e) => { e.stopPropagation(); copyToClipboard(edit.new_string); }}
                className="text-devin-muted hover:text-devin-text flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copy new
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
                  <pre className="text-green-300 whitespace-pre-wrap">{edit.new_string}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-devin-border">
              <div className="p-3 font-mono text-xs overflow-auto max-h-64 bg-red-500/5">
                <p className="text-red-400 text-xs mb-2 font-sans">Before</p>
                <pre className="text-red-300 whitespace-pre-wrap">{edit.old_string || '(empty)'}</pre>
              </div>
              <div className="p-3 font-mono text-xs overflow-auto max-h-64 bg-green-500/5">
                <p className="text-green-400 text-xs mb-2 font-sans">After</p>
                <pre className="text-green-300 whitespace-pre-wrap">{edit.new_string || '(empty)'}</pre>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MetadataItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-devin-muted">{label}</p>
      <p className="text-devin-text truncate" title={value}>{value}</p>
    </div>
  );
}

function DirectoryPicker({ currentDir, onSelect, onClose }) {
  const [path, setPath] = useState(currentDir);
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDirectories = async (dir) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/directories/browse?path=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (data.items) {
        setDirectories(data.items);
        setPath(data.current_path);
      }
    } catch (err) {
      console.error('Failed to browse directories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectories(path);
  }, []);

  const goUp = () => {
    const parent = path.split('/').slice(0, -1).join('/') || '/';
    fetchDirectories(parent);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-devin-card border border-devin-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-devin-border">
          <h2 className="text-lg font-semibold text-devin-text">Select Log Directory</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-devin-border rounded text-devin-muted hover:text-devin-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-devin-border">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchDirectories(path)}
              className="flex-1 px-3 py-2 bg-devin-darker border border-devin-border rounded-lg text-devin-text focus:outline-none focus:border-devin-teal"
            />
            <button
              onClick={() => fetchDirectories(path)}
              className="px-3 py-2 bg-devin-teal hover:bg-devin-teal-light text-white rounded-lg transition-colors"
            >
              Go
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          <button
            onClick={goUp}
            className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-devin-border text-devin-text transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-devin-muted" />
            <span>..</span>
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-devin-teal border-t-transparent"></div>
            </div>
          ) : (
            directories.map(dir => (
              <button
                key={dir.path}
                onClick={() => fetchDirectories(dir.path)}
                className={`w-full flex items-center gap-2 p-3 rounded-lg hover:bg-devin-border text-devin-text transition-colors ${
                  dir.has_logs ? 'border border-devin-teal/30' : ''
                }`}
              >
                <FolderOpen className={`w-4 h-4 ${dir.has_logs ? 'text-devin-teal' : 'text-devin-muted'}`} />
                <span className="flex-1 text-left" style={{wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.2'}}>{dir.name}</span>
                {dir.has_logs && (
                  <span className="text-xs text-devin-teal">Has logs</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-devin-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-devin-muted hover:text-devin-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(path)}
            className="px-4 py-2 bg-devin-teal hover:bg-devin-teal-light text-white rounded-lg transition-colors"
          >
            Select This Directory
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
