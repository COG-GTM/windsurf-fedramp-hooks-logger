import React, { useState, useEffect, useCallback, useRef, useMemo, forwardRef } from 'react';
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
  ChevronLeft,
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
  History,
  ArrowRight,
  Workflow,
  Hash,
  Calendar,
  Activity,
  Sun,
  Moon,
  TrendingUp,
  PieChart,
  Users,
  Target,
  Cpu,
  Database
} from 'lucide-react';

const API_BASE = '/api';

// Hook for scroll-linked fade-in animations
function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(element);
        }
      },
      { threshold, rootMargin: '50px' }
    );
    
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);
  
  return [ref, isInView];
}

const CATEGORY_CONFIG = {
  prompt: { icon: MessageSquare, color: 'teal', label: 'Prompt', bgClass: 'bg-ws-teal/10', textClass: 'text-ws-teal' },
  file_read: { icon: Eye, color: 'orange', label: 'File Read', bgClass: 'bg-ws-orange/10', textClass: 'text-ws-orange' },
  file_write: { icon: Edit3, color: 'teal', label: 'Code Change', bgClass: 'bg-ws-teal/10', textClass: 'text-ws-teal' },
  command: { icon: Play, color: 'orange', label: 'Command', bgClass: 'bg-ws-orange/10', textClass: 'text-ws-orange' },
  mcp: { icon: Zap, color: 'teal', label: 'MCP Tool', bgClass: 'bg-ws-teal/10', textClass: 'text-ws-teal' },
  response: { icon: Code, color: 'teal', label: 'Response', bgClass: 'bg-ws-teal/10', textClass: 'text-ws-teal' },
  unknown: { icon: FileText, color: 'gray', label: 'Unknown', bgClass: 'bg-ws-text-muted/10', textClass: 'text-ws-text-muted' }
};

function App() {
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [aggregatedMetrics, setAggregatedMetrics] = useState(null);
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [currentDir, setCurrentDir] = useState('/Users/chasedalton/CascadeProjects/windsurf-logger/logs');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState('workflow'); // 'workflow', 'timeline', 'list', or 'metrics'
  const [toasts, setToasts] = useState([]);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(-1);
  const [selectedSession, setSelectedSession] = useState(null);
  const [workflowExpandedGroups, setWorkflowExpandedGroups] = useState(new Set());
  const [allUsers, setAllUsers] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('windsurf-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  console.log('Initial theme:', isDarkMode ? 'dark' : 'light');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('windsurf-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('windsurf-theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  // Auto-select a session with prompts when switching to workflow view
  useEffect(() => {
    if (viewMode === 'workflow' && !selectedSession && sessions.length > 0) {
      // Prefer 'no_session' if it has prompts, otherwise find first session with prompts
      const noSession = sessions.find(s => s.id === 'no_session' && s.categories?.prompt > 0);
      const sessionWithPrompts = sessions.find(s => s.categories?.prompt > 0);
      if (noSession) {
        setSelectedSession(noSession.id);
      } else if (sessionWithPrompts) {
        setSelectedSession(sessionWithPrompts.id);
      }
    }
  }, [viewMode, sessions, selectedSession]);
  
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

  const fetchAggregatedMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/logs/metrics?dir=${encodeURIComponent(currentDir)}`);
      const data = await res.json();
      setAggregatedMetrics(data);
    } catch (err) {
      console.error('Failed to fetch aggregated metrics:', err);
    }
  }, [currentDir]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/logs/sessions?dir=${encodeURIComponent(currentDir)}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      // Extract unique users and session IDs for filter dropdowns
      const users = new Set();
      const sessionIds = new Set();
      (data.sessions || []).forEach(session => {
        if (session.id && session.id !== 'no_session') {
          sessionIds.add(session.id);
        }
        (session.events || []).forEach(event => {
          if (event.user) users.add(event.user);
        });
      });
      setAllUsers([...users]);
      setAllSessions([...sessionIds]);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, [currentDir]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/logs/data`;
      const params = [];
      
      if (selectedFiles.length > 0) {
        selectedFiles.forEach(f => params.push(`files=${encodeURIComponent(f)}`));
      }
      
      // Add filter parameters
      if (filterCategory !== 'all') {
        params.push(`category=${filterCategory}`);
      }
      if (filterUser !== 'all') {
        params.push(`user=${encodeURIComponent(filterUser)}`);
      }
      if (filterSession !== 'all') {
        params.push(`session=${encodeURIComponent(filterSession)}`);
      }
      if (searchQuery.trim()) {
        params.push(`q=${encodeURIComponent(searchQuery)}`);
      }
      if (dateFrom) {
        params.push(`date_from=${encodeURIComponent(dateFrom)}`);
      }
      if (dateTo) {
        params.push(`date_to=${encodeURIComponent(dateTo)}`);
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
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
  }, [selectedFiles, filterCategory, filterUser, filterSession, searchQuery, dateFrom, dateTo]);

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

  const refreshAll = async () => {
    setIsRefreshing(true);
    addToast('Refreshing all data...', 'info');
    await Promise.all([
      fetchFiles(currentDir),
      fetchStats(),
      fetchAggregatedMetrics(),
      fetchSessions(),
      fetchLogs()
    ]);
    setIsRefreshing(false);
    addToast('Data refreshed', 'success');
  };

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
    fetchAggregatedMetrics();
    fetchSessions();
  }, [currentDir, fetchFiles, fetchStats, fetchAggregatedMetrics, fetchSessions]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh logs when filters change
  useEffect(() => {
    if (filterCategory !== 'all' || filterUser !== 'all' || filterSession !== 'all' || dateFrom || dateTo) {
      fetchLogs();
    }
  }, [filterCategory, filterUser, filterSession, dateFrom, dateTo, fetchLogs]);

  // Auto-refresh when search query is cleared (but not on every keystroke)
  useEffect(() => {
    if (!searchQuery) {
      fetchLogs();
    }
  }, [searchQuery, fetchLogs]);

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

  // Logs are already filtered by the backend, no need for client-side filtering
  const filteredLogs = logs;

  // Use allUsers/allSessions from sessions API for stable filter dropdowns
  const uniqueUsers = allUsers.length > 0 ? allUsers : [...new Set(logs.map(l => l.user).filter(Boolean))];
  const uniqueSessions = allSessions.length > 0 ? allSessions : [...new Set(logs.map(l => l.trajectory_id).filter(Boolean))];
  const categories = [...new Set(logs.map(l => l.category || l.type).filter(Boolean))];

  // Group events into workflow steps (prompt -> actions)
  // Note: Prompts may be in 'no_session' while actions are in trajectory sessions
  // So we need to correlate across all sessions by timestamp
  const workflowGroups = useMemo(() => {
    if (!selectedSession) return [];
    
    // Gather ALL events from ALL sessions for correlation
    const allEvents = [];
    sessions.forEach(session => {
      (session.events || []).forEach(event => {
        allEvents.push({ ...event, _sessionId: session.id });
      });
    });
    
    // Sort all events chronologically
    allEvents.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeA - timeB;
    });
    
    // Get prompts and non-prompt actions
    const prompts = allEvents.filter(e => (e.category || e.type) === 'prompt');
    const actions = allEvents.filter(e => (e.category || e.type) !== 'prompt');
    
    // If viewing 'no_session' (where prompts live), show prompts with their correlated actions
    // Otherwise show session-specific view
    if (selectedSession === 'no_session') {
      // Build workflow groups: each prompt followed by actions until next prompt
      const groups = [];
      
      for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i];
        const promptTime = new Date(prompt.timestamp || 0).getTime();
        const nextPromptTime = i < prompts.length - 1 
          ? new Date(prompts[i + 1].timestamp || 0).getTime() 
          : Infinity;
        
        // Find actions between this prompt and the next
        const relatedActions = actions.filter(a => {
          const actionTime = new Date(a.timestamp || 0).getTime();
          return actionTime > promptTime && actionTime < nextPromptTime;
        });
        
        groups.push({
          prompt: prompt,
          actions: relatedActions,
          id: prompt.event_id || `group-${i}`
        });
      }
      
      return groups;
    } else {
      // For specific sessions, show that session's events but try to find related prompts
      const session = sessions.find(s => s.id === selectedSession);
      if (!session?.events?.length) return [];
      
      const sessionEvents = [...session.events].sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeA - timeB;
      });
      
      // Find the earliest action time in this session
      const earliestActionTime = sessionEvents.length > 0 
        ? new Date(sessionEvents[0].timestamp || 0).getTime() 
        : 0;
      
      // Find prompts that occurred just before this session's actions (within 5 minutes)
      const relevantPrompts = prompts.filter(p => {
        const promptTime = new Date(p.timestamp || 0).getTime();
        return promptTime < earliestActionTime && (earliestActionTime - promptTime) < 5 * 60 * 1000;
      });
      
      // Build groups with relevant prompts
      const groups = [];
      let actionIndex = 0;
      
      for (const prompt of relevantPrompts) {
        const promptTime = new Date(prompt.timestamp || 0).getTime();
        const nextPromptTime = relevantPrompts.indexOf(prompt) < relevantPrompts.length - 1
          ? new Date(relevantPrompts[relevantPrompts.indexOf(prompt) + 1].timestamp || 0).getTime()
          : Infinity;
        
        const relatedActions = sessionEvents.filter(a => {
          const actionTime = new Date(a.timestamp || 0).getTime();
          return actionTime > promptTime && actionTime < nextPromptTime;
        });
        
        if (relatedActions.length > 0 || relevantPrompts.length === 1) {
          groups.push({
            prompt: prompt,
            actions: relatedActions,
            id: prompt.event_id || `group-${groups.length}`
          });
          actionIndex += relatedActions.length;
        }
      }
      
      // If no prompts found, just show session actions grouped
      if (groups.length === 0 && sessionEvents.length > 0) {
        groups.push({
          prompt: null,
          actions: sessionEvents,
          id: `session-actions`
        });
      }
      
      return groups;
    }
  }, [selectedSession, sessions]);

  const toggleWorkflowGroup = (id) => {
    setWorkflowExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const formatSessionName = (session) => {
    if (session.id === 'no_session') {
      return 'All Prompts';
    }
    
    // Get user from first event that has a user
    const user = session.events?.find(e => e.user)?.user || 'Unknown User';
    
    // Get datetime from start_time
    const datetime = session.start_time ? new Date(session.start_time).toLocaleString() : 'Unknown Time';
    
    return `${user} - ${datetime}`;
  };

  return (
    <div className="min-h-screen bg-ws-bg flex">
      {/* Skip Navigation Link - 508 Compliance */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ws-teal focus:text-white focus:rounded focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />

      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-ws-sidebar border-r border-ws-border overflow-hidden flex flex-col`}
        aria-label="Navigation and filters"
      >
        <div className="p-4 border-b border-ws-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-ws-teal to-ws-teal-dim flex items-center justify-center shadow-lg shadow-ws-teal/20">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
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

        {/* Navigation */}
        <nav className="p-3 border-b border-ws-border" aria-label="View mode selection">
          <p id="view-mode-label" className="text-[10px] uppercase tracking-wider text-ws-text-muted px-3 py-2">View Mode</p>
          <div role="group" aria-labelledby="view-mode-label">
            <button
              onClick={() => setViewMode('workflow')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                viewMode === 'workflow' 
                  ? 'bg-ws-teal text-white shadow-md shadow-ws-teal/30' 
                  : 'text-ws-text-secondary hover:text-ws-text hover:bg-ws-card/50'
              }`}
              aria-pressed={viewMode === 'workflow'}
            >
              <Activity className={`w-4 h-4 ${viewMode === 'workflow' ? 'text-white' : ''}`} aria-hidden="true" />
              Workflow View
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                viewMode === 'timeline' 
                  ? 'bg-ws-teal text-white shadow-md shadow-ws-teal/30' 
                  : 'text-ws-text-secondary hover:text-ws-text hover:bg-ws-card/50'
              }`}
              aria-pressed={viewMode === 'timeline'}
            >
              <GitBranch className={`w-4 h-4 ${viewMode === 'timeline' ? 'text-white' : ''}`} aria-hidden="true" />
              Timeline View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                viewMode === 'list' 
                  ? 'bg-ws-teal text-white shadow-md shadow-ws-teal/30' 
                  : 'text-ws-text-secondary hover:text-ws-text hover:bg-ws-card/50'
              }`}
              aria-pressed={viewMode === 'list'}
            >
              <Layers className={`w-4 h-4 ${viewMode === 'list' ? 'text-white' : ''}`} aria-hidden="true" />
              List View
            </button>
            <button
              onClick={() => setViewMode('metrics')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                viewMode === 'metrics' 
                  ? 'bg-ws-teal text-white shadow-md shadow-ws-teal/30' 
                  : 'text-ws-text-secondary hover:text-ws-text hover:bg-ws-card/50'
              }`}
              aria-pressed={viewMode === 'metrics'}
            >
              <BarChart3 className={`w-4 h-4 ${viewMode === 'metrics' ? 'text-white' : ''}`} aria-hidden="true" />
              Metrics Dashboard
            </button>
          </div>
        </nav>

        {/* Session Selector for Workflow View */}
        {viewMode === 'workflow' && sessions.length > 0 && (
          <div className="p-3 border-b border-ws-border">
            <p className="text-[10px] uppercase tracking-wider text-ws-text-muted px-3 py-2">Select Session</p>
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {/* Show sessions with prompts first */}
              {sessions
                .sort((a, b) => (b.categories?.prompt || 0) - (a.categories?.prompt || 0))
                .slice(0, 20)
                .map(session => {
                  const hasPrompts = (session.categories?.prompt || 0) > 0;
                  const displayName = formatSessionName(session);
                  return (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session.id)}
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
        )}

        {/* Stats */}
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

        {/* File Selection */}
        <div className="flex-1 overflow-auto p-3">
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-ws-text-muted">Log Files</p>
          </div>
          
          <div className="space-y-0.5">
            {files.map(file => (
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
                  onChange={() => toggleFileSelection(file.path)}
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

      {/* Main Content */}
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden" role="main">
        {/* Header */}
        <header className="bg-ws-bg border-b border-ws-border px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-ws-card rounded text-ws-text-muted hover:text-ws-text transition-all duration-200 hover:scale-110"
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? (
                  <ChevronLeft className="w-5 h-5 transition-transform duration-300" />
                ) : (
                  <ChevronRight className="w-5 h-5 transition-transform duration-300" />
                )}
              </button>
              <div>
                <h1 className="text-xl font-semibold text-ws-text">Windsurf Hooks Logger</h1>
                <p className="text-xs text-ws-text-muted">Analytics Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-ws-card hover:bg-ws-card-hover border border-ws-border rounded text-sm text-ws-text-secondary hover:text-ws-text transition-colors btn-press"
                title="Refresh all data"
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 transition-transform ${isRefreshing ? 'refresh-spinning' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                onClick={() => setShowFilePicker(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-ws-card hover:bg-ws-card-hover border border-ws-border rounded text-sm text-ws-text-secondary hover:text-ws-text transition-colors btn-press"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Directory</span>
              </button>
              <div className="relative group">
                <button 
                  className="p-2 bg-ws-card hover:bg-ws-card-hover border border-ws-border rounded text-ws-text-muted hover:text-ws-text transition-colors"
                  aria-label="Export options"
                  aria-haspopup="true"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                </button>
                <div className="absolute right-0 top-full mt-1 bg-ws-card border border-ws-border rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                  <button
                    onClick={() => exportLogs('json')}
                    className="w-full px-3 py-2 text-left text-sm text-ws-text-secondary hover:bg-ws-card-hover hover:text-ws-text"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={() => exportLogs('csv')}
                    className="w-full px-3 py-2 text-left text-sm text-ws-text-secondary hover:bg-ws-card-hover hover:text-ws-text"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="p-2 bg-ws-card hover:bg-ws-card-hover border border-ws-border rounded text-ws-text-muted hover:text-ws-text transition-all duration-300"
                title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 transition-transform duration-300 hover:rotate-45" />
                ) : (
                  <Moon className="w-4 h-4 transition-transform duration-300 hover:-rotate-12" />
                )}
              </button>
            </div>
          </div>

          {/* Active Filters Indicator */}
          {(filterCategory !== 'all' || filterUser !== 'all' || filterSession !== 'all' || searchQuery || dateFrom || dateTo) && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs text-ws-text-muted">Active filters:</span>
              {filterCategory !== 'all' && (
                <span className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full flex items-center gap-1 filter-pill">
                  Category: {filterCategory}
                  <button onClick={() => { setFilterCategory('all'); }} className="hover:text-white action-icon" aria-label="Remove category filter"><X className="w-3 h-3" aria-hidden="true" /></button>
                </span>
              )}
              {filterUser !== 'all' && (
                <span className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full flex items-center gap-1 filter-pill">
                  User: {filterUser}
                  <button onClick={() => { setFilterUser('all'); }} className="hover:text-white action-icon" aria-label="Remove user filter"><X className="w-3 h-3" aria-hidden="true" /></button>
                </span>
              )}
              {filterSession !== 'all' && (
                <span className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full flex items-center gap-1 filter-pill">
                  Session
                  <button onClick={() => { setFilterSession('all'); }} className="hover:text-white action-icon" aria-label="Remove session filter"><X className="w-3 h-3" aria-hidden="true" /></button>
                </span>
              )}
              {searchQuery && (
                <span className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full flex items-center gap-1 filter-pill">
                  Search: "{searchQuery.substring(0, 20)}{searchQuery.length > 20 ? '...' : ''}"
                  <button onClick={() => { setSearchQuery(''); }} className="hover:text-white action-icon" aria-label="Clear search query"><X className="w-3 h-3" aria-hidden="true" /></button>
                </span>
              )}
              {(dateFrom || dateTo) && (
                <span className="px-2 py-1 bg-ws-teal/10 text-ws-teal text-xs rounded-full flex items-center gap-1 filter-pill">
                  Date range
                  <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="hover:text-white action-icon" aria-label="Remove date range filter"><X className="w-3 h-3" aria-hidden="true" /></button>
                </span>
              )}
              <button
                onClick={() => {
                  setFilterCategory('all');
                  setFilterUser('all');
                  setFilterSession('all');
                  setDateFrom('');
                  setDateTo('');
                  setSearchQuery('');
                  setUseRegex(false);
                }}
                className="text-xs text-ws-text-muted hover:text-ws-text underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Search and Filters Row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <label htmlFor="search-logs" className="sr-only">Search logs</label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ws-text-muted" aria-hidden="true" />
              <input
                id="search-logs"
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (useRegex ? searchLogs() : fetchLogs())}
                placeholder="Search logs..."
                className="w-full pl-10 pr-10 py-2 bg-ws-card border border-ws-border rounded text-ws-text placeholder-ws-text-muted text-sm focus:outline-none focus:border-ws-teal"
              />
              <button
                onClick={() => setUseRegex(!useRegex)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${useRegex ? 'text-ws-teal' : 'text-ws-text-muted hover:text-ws-text'}`}
                title="Toggle regex search"
                aria-label={useRegex ? "Disable regex search" : "Enable regex search"}
                aria-pressed={useRegex}
              >
                <Regex className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>

            <label htmlFor="filter-category" className="sr-only">Filter by category</label>
            <select
              id="filter-category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-ws-card border border-ws-border rounded text-ws-text-secondary text-sm focus:outline-none focus:border-ws-teal"
            >
              <option value="all">All Categories</option>
              <option value="prompt">Prompts</option>
              <option value="file_read">File Reads</option>
              <option value="file_write">Code Changes</option>
              <option value="command">Commands</option>
              <option value="mcp">MCP Tools</option>
            </select>

            <label htmlFor="filter-user" className="sr-only">Filter by user</label>
            <select
              id="filter-user"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="px-3 py-2 bg-ws-card border border-ws-border rounded text-ws-text-secondary text-sm focus:outline-none focus:border-ws-teal"
            >
              <option value="all">All Users</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>

            <button
              onClick={() => useRegex ? searchLogs() : fetchLogs()}
              className="px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm font-medium transition-colors btn-press"
              aria-label="Execute search"
            >
              Search
            </button>

            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className={`p-2 rounded transition-all btn-press ${showAdvancedSearch ? 'bg-ws-teal text-white' : 'bg-ws-card border border-ws-border text-ws-text-muted hover:text-ws-text'}`}
              title="Advanced filters (⌘K)"
              aria-label="Toggle advanced filters"
              aria-expanded={showAdvancedSearch}
              aria-controls="advanced-search-panel"
            >
              <Filter className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Advanced Search Panel */}
          {showAdvancedSearch && (
            <div id="advanced-search-panel" className="mt-4 p-4 bg-ws-card rounded border border-ws-border panel-expand-bounce" role="region" aria-label="Advanced search filters">
              <div className="flex items-center justify-between mb-3">
                <h3 id="advanced-filters-heading" className="text-sm font-medium text-ws-text">Advanced Filters</h3>
                <button onClick={() => setShowAdvancedSearch(false)} className="text-ws-text-muted hover:text-ws-text" aria-label="Close advanced filters">
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label htmlFor="filter-session" className="block text-xs text-ws-text-muted mb-1">Session</label>
                  <select
                    id="filter-session"
                    value={filterSession}
                    onChange={(e) => setFilterSession(e.target.value)}
                    className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text-secondary text-sm focus:outline-none focus:border-ws-teal"
                  >
                    <option value="all">All Sessions</option>
                    {uniqueSessions.map(session => {
                      const sessionData = sessions.find(s => s.id === session);
                      const displayName = sessionData ? formatSessionName(sessionData) : session;
                      return (
                        <option key={session} value={session}>
                          {displayName.length > 30 ? `${displayName.substring(0, 30)}...` : displayName}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label htmlFor="filter-date-from" className="block text-xs text-ws-text-muted mb-1">From Date</label>
                  <input
                    id="filter-date-from"
                    type="datetime-local"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text-secondary text-sm focus:outline-none focus:border-ws-teal"
                  />
                </div>
                <div>
                  <label htmlFor="filter-date-to" className="block text-xs text-ws-text-muted mb-1">To Date</label>
                  <input
                    id="filter-date-to"
                    type="datetime-local"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text-secondary text-sm focus:outline-none focus:border-ws-teal"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => useRegex ? searchLogs() : fetchLogs()}
                    className="flex-1 px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors"
                  >
                    Apply
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
                      // Trigger refetch after clearing filters
                      setTimeout(() => fetchLogs(), 0);
                    }}
                    className="px-4 py-2 bg-ws-bg border border-ws-border text-ws-text-muted hover:text-ws-text rounded text-sm transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-ws-text-muted">
                <span>Shortcuts:</span>
                <span><span className="kbd">/</span> Search</span>
                <span><span className="kbd">⌘K</span> Filters</span>
                <span><span className="kbd">↑↓</span> Navigate</span>
                <span><span className="kbd">Esc</span> Close</span>
              </div>
            </div>
          )}
        </header>

        {/* Log Entries */}
        <div ref={logContainerRef} className="flex-1 overflow-auto p-6" key={viewMode} aria-busy={loading} aria-live="polite">
          {loading ? (
            <LoadingSkeleton />
          ) : viewMode === 'metrics' ? (
            <MetricsDashboard
              aggregatedMetrics={aggregatedMetrics}
              formatTimestamp={formatTimestamp}
            />
          ) : viewMode === 'workflow' ? (
            <WorkflowView
              selectedSession={selectedSession}
              sessions={sessions}
              workflowGroups={workflowGroups}
              expandedGroups={workflowExpandedGroups}
              toggleGroup={toggleWorkflowGroup}
              expandedEntries={expandedEntries}
              toggleEntry={toggleEntry}
              formatTimestamp={formatTimestamp}
              truncateContent={truncateContent}
              copyToClipboard={copyToClipboard}
              onSelectSession={setSelectedSession}
            />
          ) : filteredLogs.length === 0 ? (
            <div className="page-enter">
              <EmptyState 
                hasFilters={filterCategory !== 'all' || filterUser !== 'all' || filterSession !== 'all' || searchQuery || dateFrom || dateTo}
                onClearFilters={() => {
                  setFilterCategory('all');
                  setFilterUser('all');
                  setFilterSession('all');
                  setDateFrom('');
                  setDateTo('');
                  setSearchQuery('');
                  setUseRegex(false);
                  setTimeout(() => fetchLogs(), 0);
                }}
              />
            </div>
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
            <div className="space-y-3 stagger-children">
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
        <footer className="bg-ws-sidebar border-t border-ws-border px-6 py-2 flex items-center justify-between text-xs text-ws-text-muted">
          <span>
            {viewMode === 'metrics' 
              ? `${(aggregatedMetrics?.total_events || 0).toLocaleString()} total events`
              : `${filteredLogs.length} ${filteredLogs.length === 1 ? 'entry' : 'entries'}${(filterCategory !== 'all' || filterUser !== 'all' || filterSession !== 'all' || searchQuery || dateFrom || dateTo) ? ' (filtered)' : ''}`
            }
          </span>
          <div className="flex items-center gap-4">
            <span>View: {viewMode === 'workflow' ? 'Workflow' : viewMode === 'timeline' ? 'Timeline' : viewMode === 'metrics' ? 'Metrics' : 'List'}</span>
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
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

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div 
          key={i} 
          className="bg-ws-card border border-ws-border rounded-lg p-4 card-load-in skeleton-breathe" 
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg skeleton-enhanced loading-wave loading-wave-delay-${i}`} />
            <div className="flex-1">
              <div className="h-4 w-28 rounded skeleton-enhanced mb-2" />
              <div className="h-3 w-56 rounded skeleton-enhanced" />
            </div>
            <div className="h-4 w-36 rounded skeleton-enhanced" />
          </div>
        </div>
      ))}
      {/* Loading dots indicator */}
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-2 h-2 rounded-full bg-ws-teal loading-dot" />
        <div className="w-2 h-2 rounded-full bg-ws-teal loading-dot" />
        <div className="w-2 h-2 rounded-full bg-ws-teal loading-dot" />
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onClearFilters }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-ws-text-muted slide-up">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ws-card to-ws-bg border border-ws-border flex items-center justify-center mb-6 shadow-lg">
        <FileText className="w-10 h-10 text-ws-text-muted" />
      </div>
      <p className="text-lg font-semibold text-ws-text mb-2">No log entries found</p>
      <p className="text-sm text-center max-w-md text-ws-text-secondary leading-relaxed mb-4">
        {hasFilters 
          ? 'No entries match your current filters. Try adjusting or clearing them.'
          : 'Select log files from the sidebar or adjust your filters to see your Cascade activity.'
        }
      </p>
      {hasFilters && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}

function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2" role="status" aria-live="polite" aria-atomic="true">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg sheet-slide-up flex items-center gap-2 backdrop-blur-sm ${
            toast.type === 'error' ? 'bg-red-500/90 text-white' :
            toast.type === 'success' ? 'bg-ws-teal/90 text-white' :
            'bg-ws-card/95 text-ws-text border border-ws-border'
          }`}
        >
          {toast.type === 'success' && <Check className="w-4 h-4 copy-success" />}
          {toast.type === 'error' && <X className="w-4 h-4" />}
          <span className="text-sm">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

function TimelineView({ sessions, expandedEntries, toggleEntry, formatTimestamp, truncateContent, copyToClipboard }) {
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
          {/* Session Header */}
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

function TimelineEvent({ event, isExpanded, onToggle, formatTimestamp, truncateContent, copyToClipboard, isLast }) {
  const category = event.category || event.type || 'unknown';
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <div className={`relative pl-10 ${isLast ? '' : 'pb-3'}`}>
      {/* Timeline Dot */}
      <div className={`absolute left-3 top-1 w-5 h-5 rounded-full ${config.bgClass} flex items-center justify-center z-10`}>
        <Icon className={`w-2.5 h-2.5 ${config.textClass}`} />
      </div>
      
      {/* Event Card */}
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

function WorkflowView({ 
  selectedSession, 
  sessions, 
  workflowGroups, 
  expandedGroups, 
  toggleGroup,
  expandedEntries,
  toggleEntry,
  formatTimestamp, 
  truncateContent, 
  copyToClipboard,
  onSelectSession 
}) {
  // Find sessions with prompts for quick access
  const sessionsWithPrompts = sessions.filter(s => s.categories?.prompt > 0);
  
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
            {sessionsWithPrompts.slice(0, 5).map(session => (
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

  const currentSession = sessions.find(s => s.id === selectedSession);
  const hasPrompts = currentSession?.categories?.prompt > 0;

  // Show message if session has no prompts
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
                {sessionsWithPrompts.slice(0, 3).map(s => (
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
      {/* Session Header */}
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
              <p className="text-2xl font-bold text-ws-teal">{workflowGroups.filter(g => g.prompt).length}</p>
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

      {/* Workflow Groups */}
      <div className="space-y-4 stagger-children">
        {workflowGroups.map((group, groupIdx) => (
          <WorkflowGroup
            key={group.id}
            group={group}
            groupIndex={groupIdx}
            isExpanded={expandedGroups.has(group.id)}
            onToggle={() => toggleGroup(group.id)}
            expandedEntries={expandedEntries}
            toggleEntry={toggleEntry}
            formatTimestamp={formatTimestamp}
            truncateContent={truncateContent}
            copyToClipboard={copyToClipboard}
          />
        ))}
      </div>
    </div>
  );
}

function getPromptTitle(promptText, maxLength = 60) {
  if (!promptText) return 'User prompt';
  // Get the first line, trimmed
  const firstLine = promptText.split('\n')[0].trim();
  // If the first line is short enough, use it
  if (firstLine.length <= maxLength) return firstLine;
  // Otherwise truncate at word boundary
  const truncated = firstLine.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

function WorkflowGroup({ 
  group, 
  groupIndex,
  isExpanded, 
  onToggle, 
  expandedEntries,
  toggleEntry,
  formatTimestamp, 
  truncateContent, 
  copyToClipboard 
}) {
  const fileWrites = group.actions.filter(a => (a.category || a.type) === 'file_write');
  const commands = group.actions.filter(a => (a.category || a.type) === 'command');
  const fileReads = group.actions.filter(a => (a.category || a.type) === 'file_read');
  const mcpCalls = group.actions.filter(a => (a.category || a.type) === 'mcp');
  const promptData = group.prompt?.data || {};
  
  // Extract title from prompt content
  const promptText = promptData.user_prompt || group.prompt?.content || '';
  const promptTitle = group.prompt ? getPromptTitle(promptText) : 'Pre-session actions';
  const isMultiLine = promptText.includes('\n') || promptText.length > 60;

  return (
    <div className="workflow-group bg-ws-card border border-ws-border rounded-xl overflow-hidden transition-all duration-300 hover:border-ws-border-light">
      {/* Prompt Section */}
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

      {/* Expanded Content */}
      <div className={`expand-content ${isExpanded ? 'expanded' : ''}`}>
        <div className="border-t border-ws-border bg-ws-bg/50">
          {/* Full Prompt Text */}
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

          {/* Code Changes Section */}
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

          {/* Commands Section */}
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

          {/* File Reads Section */}
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

          {/* MCP Calls Section */}
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
    prompt: 'border-l-ws-teal',
    file_read: 'border-l-ws-orange',
    file_write: 'border-l-ws-teal',
    command: 'border-l-ws-orange',
    mcp: 'border-l-ws-teal',
    response: 'border-l-ws-teal',
    unknown: 'border-l-ws-text-muted'
  };

  return (
    <div className={`bg-ws-card border border-ws-border rounded overflow-hidden border-l-2 log-card ${borderColors[category] || borderColors.unknown} ${isSelected ? 'ring-1 ring-ws-teal' : ''}`}>
      {/* Header */}
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

      {/* Expanded Content */}
      <div className={`expand-content ${isExpanded ? 'expanded' : ''}`}>
        <div>
          <ExpandedEventContent entry={entry} copyToClipboard={copyToClipboard} />
        </div>
      </div>
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
    <div className="border-t border-ws-border slide-up">
      {/* Main Content based on category */}
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

      {/* Legacy content display */}
      {!['prompt', 'file_read', 'file_write', 'command', 'mcp'].includes(category) && item.content && (
        <div className="p-3">
          <h4 className="text-xs text-ws-text-muted uppercase tracking-wider mb-2">Content</h4>
          <pre className="bg-ws-bg rounded p-3 text-sm text-ws-text-secondary overflow-auto max-h-96 whitespace-pre-wrap border border-ws-border">
            {item.content}
          </pre>
        </div>
      )}

      {/* Legacy Code Blocks */}
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

      {/* Metadata */}
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

function DiffViewer({ edits, copyToClipboard }) {
  const [viewMode, setViewMode] = useState('split'); // 'unified' or 'split'

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

function MetadataItem({ label, value }) {
  return (
    <div>
      <dt className="text-ws-text-muted mb-0.5">{label}</dt>
      <dd className="text-ws-text-secondary truncate m-0" title={value}>{value}</dd>
    </div>
  );
}

function MetricsDashboard({ aggregatedMetrics, formatTimestamp }) {
  // Use server-provided metrics (computed from ALL log entries)
  const metrics = useMemo(() => {
    if (!aggregatedMetrics) {
      return {
        totalEvents: 0,
        categoryBreakdown: {},
        hourlyActivity: Array(24).fill(0),
        dailyActivity: Array(7).fill(0),
        recentDays: [],
        topFiles: [],
        topCommands: [],
        topMcpTools: [],
        uniqueSessions: 0,
        totalLinesAdded: 0,
        totalLinesRemoved: 0,
        uniqueFilesCount: 0,
        dateRange: { start: null, end: null }
      };
    }
    
    // Convert server data to component format
    const hourlyActivity = aggregatedMetrics.hourly_activity || Array(24).fill(0);
    // Backend returns Monday=0, frontend expects Sunday=0, so rotate array
    const serverDaily = aggregatedMetrics.daily_activity || Array(7).fill(0);
    const dailyActivity = [serverDaily[6], ...serverDaily.slice(0, 6)]; // Rotate: Mon-Sun -> Sun-Sat
    
    return {
      totalEvents: aggregatedMetrics.total_events || 0,
      categoryBreakdown: aggregatedMetrics.categories || {},
      hourlyActivity,
      maxHourly: Math.max(...hourlyActivity, 1),
      dailyActivity,
      dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      maxDaily: Math.max(...dailyActivity, 1),
      topFiles: (aggregatedMetrics.top_files || []).map(f => [f.name, f.count]),
      topCommands: (aggregatedMetrics.top_commands || []).map(c => [c.name, c.count]),
      topMcpTools: (aggregatedMetrics.top_mcp_tools || []).map(t => [t.name, t.count]),
      recentDays: aggregatedMetrics.recent_days || [],
      maxRecentDaily: Math.max(...(aggregatedMetrics.recent_days || []).map(d => d.count), 1),
      uniqueSessions: aggregatedMetrics.unique_sessions || 0,
      totalLinesAdded: aggregatedMetrics.total_lines_added || 0,
      totalLinesRemoved: aggregatedMetrics.total_lines_removed || 0,
      uniqueFilesCount: aggregatedMetrics.unique_files_count || 0,
      dateRange: aggregatedMetrics.date_range || { start: null, end: null },
      avgEventsPerSession: aggregatedMetrics.unique_sessions > 0 
        ? Math.round((aggregatedMetrics.total_events || 0) / aggregatedMetrics.unique_sessions)
        : 0
    };
  }, [aggregatedMetrics]);

  const categoryColors = {
    prompt: { bg: 'bg-ws-teal', text: 'text-ws-teal', label: 'Prompts' },
    file_write: { bg: 'bg-emerald-500', text: 'text-emerald-500', label: 'Code Changes' },
    file_read: { bg: 'bg-ws-orange', text: 'text-ws-orange', label: 'File Reads' },
    command: { bg: 'bg-amber-500', text: 'text-amber-500', label: 'Commands' },
    mcp: { bg: 'bg-purple-500', text: 'text-purple-500', label: 'MCP Tools' }
  };

  // Loading state
  if (!aggregatedMetrics) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-ws-text-muted">
        <div className="rounded-full h-8 w-8 border-2 border-ws-teal border-t-transparent spinner-smooth mb-4"></div>
        <p className="text-sm">Loading metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ws-text">Metrics Dashboard</h2>
          <p className="text-sm text-ws-text-muted mt-1">
            Complete analytics from all historical Cascade activity
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-ws-text-muted">
          {metrics.dateRange.start && (
            <span className="px-2 py-1 bg-ws-card border border-ws-border rounded-full">
              {new Date(metrics.dateRange.start).toLocaleDateString()} - {new Date(metrics.dateRange.end).toLocaleDateString()}
            </span>
          )}
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span>{metrics.totalEvents.toLocaleString()} total events</span>
          </div>
        </div>
      </div>

      {/* Empty state for no data */}
      {metrics.totalEvents === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-ws-text-muted">
          <BarChart3 className="w-16 h-16 mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-ws-text mb-2">No Data Available</h3>
          <p className="text-sm text-center max-w-md">
            No log events found. Start using Cascade to generate activity data.
          </p>
        </div>
      )}

      {metrics.totalEvents > 0 && (
        <>
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
        <MetricCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Total Prompts"
          value={metrics.categoryBreakdown.prompt || 0}
          color="teal"
          trend={null}
        />
        <MetricCard
          icon={<Edit3 className="w-5 h-5" />}
          label="Code Changes"
          value={metrics.categoryBreakdown.file_write || 0}
          color="emerald"
          subValue={`+${metrics.totalLinesAdded} / -${metrics.totalLinesRemoved} lines`}
        />
        <MetricCard
          icon={<Play className="w-5 h-5" />}
          label="Commands Run"
          value={metrics.categoryBreakdown.command || 0}
          color="amber"
        />
        <MetricCard
          icon={<Users className="w-5 h-5" />}
          label="Sessions"
          value={metrics.uniqueSessions}
          color="purple"
          subValue={`~${metrics.avgEventsPerSession} events/session`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Chart */}
        <div className="bg-ws-card border border-ws-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ws-text flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-ws-teal" />
              Recent Activity (7 Days)
            </h3>
          </div>
          <div className="flex items-end justify-between gap-2 h-32">
            {metrics.recentDays.map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-ws-bg rounded-t relative flex items-end justify-center" style={{ height: '100px' }}>
                  <div
                    className="w-full bg-gradient-to-t from-ws-teal to-ws-teal/60 rounded-t transition-all duration-500"
                    style={{ height: `${(day.count / metrics.maxRecentDaily) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                  />
                  {day.count > 0 && (
                    <span className="absolute -top-5 text-xs text-ws-text-muted">{day.count}</span>
                  )}
                </div>
                <span className="text-xs text-ws-text-muted">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-ws-card border border-ws-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ws-text flex items-center gap-2">
              <PieChart className="w-4 h-4 text-ws-teal" />
              Event Categories
            </h3>
          </div>
          <div className="space-y-3">
            {Object.entries(metrics.categoryBreakdown)
              .filter(([cat]) => categoryColors[cat])
              .sort((a, b) => b[1] - a[1])
              .map(([category, count]) => {
                const config = categoryColors[category];
                const percentage = metrics.totalEvents > 0 ? (count / metrics.totalEvents * 100).toFixed(1) : 0;
                return (
                  <div key={category} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm ${config.text}`}>{config.label}</span>
                      <span className="text-sm text-ws-text-muted">{count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-ws-bg rounded-full overflow-hidden">
                      <div
                        className={`h-full ${config.bg} rounded-full transition-all duration-700`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Activity Heatmaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Activity */}
        <div className="bg-ws-card border border-ws-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ws-text flex items-center gap-2">
              <Clock className="w-4 h-4 text-ws-teal" />
              Activity by Hour
            </h3>
          </div>
          <div className="grid grid-cols-12 gap-1">
            {metrics.hourlyActivity.map((count, hour) => {
              const intensity = count / metrics.maxHourly;
              return (
                <div
                  key={hour}
                  className="aspect-square rounded flex items-center justify-center text-xs relative group cursor-default"
                  style={{
                    backgroundColor: `rgba(0, 212, 170, ${intensity * 0.8 + 0.1})`
                  }}
                  title={`${hour}:00 - ${count} events`}
                >
                  <span className="text-[10px] text-white/80">{hour}</span>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ws-card border border-ws-border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">
                    {hour}:00 - {count} events
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-ws-text-muted">
            <span>12 AM</span>
            <span>12 PM</span>
            <span>11 PM</span>
          </div>
        </div>

        {/* Daily Activity */}
        <div className="bg-ws-card border border-ws-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ws-text flex items-center gap-2">
              <Calendar className="w-4 h-4 text-ws-teal" />
              Activity by Day of Week
            </h3>
          </div>
          <div className="space-y-2">
            {metrics.dayNames.map((day, idx) => {
              const count = metrics.dailyActivity[idx];
              const percentage = (count / metrics.maxDaily) * 100;
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-xs text-ws-text-muted w-8">{day}</span>
                  <div className="flex-1 h-6 bg-ws-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-ws-teal to-ws-teal/60 rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(percentage, count > 0 ? 5 : 0)}%` }}
                    >
                      {count > 0 && <span className="text-xs text-white font-medium">{count}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Modified Files */}
        <div className="bg-ws-card border border-ws-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ws-text flex items-center gap-2">
              <FileCode className="w-4 h-4 text-ws-teal" />
              Top Modified Files
            </h3>
          </div>
          {metrics.topFiles.length > 0 ? (
            <div className="space-y-2">
              {metrics.topFiles.map(([file, count], idx) => (
                <div key={file} className="flex items-center gap-3 group">
                  <span className="text-xs text-ws-text-muted w-4">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ws-text-secondary truncate font-mono" title={file}>{file}</p>
                  </div>
                  <span className="text-xs text-ws-teal font-medium">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ws-text-muted text-center py-4">No file changes recorded</p>
          )}
        </div>

        {/* Top Commands */}
        <div className="bg-ws-card border border-ws-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ws-text flex items-center gap-2">
              <Terminal className="w-4 h-4 text-ws-orange" />
              Top Commands
            </h3>
          </div>
          {metrics.topCommands.length > 0 ? (
            <div className="space-y-2">
              {metrics.topCommands.map(([cmd, count], idx) => (
                <div key={cmd} className="flex items-center gap-3">
                  <span className="text-xs text-ws-text-muted w-4">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ws-text-secondary truncate font-mono">{cmd}</p>
                  </div>
                  <span className="text-xs text-ws-orange font-medium">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ws-text-muted text-center py-4">No commands recorded</p>
          )}
        </div>

        {/* Top MCP Tools */}
        <div className="bg-ws-card border border-ws-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ws-text flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              Top MCP Tools
            </h3>
          </div>
          {metrics.topMcpTools.length > 0 ? (
            <div className="space-y-2">
              {metrics.topMcpTools.map(([tool, count], idx) => (
                <div key={tool} className="flex items-center gap-3">
                  <span className="text-xs text-ws-text-muted w-4">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ws-text-secondary truncate">{tool}</p>
                  </div>
                  <span className="text-xs text-purple-500 font-medium">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ws-text-muted text-center py-4">No MCP tools used</p>
          )}
        </div>
      </div>

      {/* Code Impact Summary */}
      <div className="bg-gradient-to-r from-ws-card to-ws-bg border border-ws-border rounded-xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-ws-teal/10 flex items-center justify-center">
            <Target className="w-6 h-6 text-ws-teal" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ws-text">Code Impact Summary</h3>
            <p className="text-sm text-ws-text-muted">Aggregate statistics from all logged sessions</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-ws-teal">{metrics.totalLinesAdded.toLocaleString()}</p>
            <p className="text-xs text-ws-text-muted mt-1">Lines Added</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-400">{metrics.totalLinesRemoved.toLocaleString()}</p>
            <p className="text-xs text-ws-text-muted mt-1">Lines Removed</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-ws-text">{(metrics.totalLinesAdded - metrics.totalLinesRemoved).toLocaleString()}</p>
            <p className="text-xs text-ws-text-muted mt-1">Net Change</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-ws-orange">{metrics.uniqueFilesCount}</p>
            <p className="text-xs text-ws-text-muted mt-1">Unique Files</p>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color, subValue, trend }) {
  const colorClasses = {
    teal: 'bg-ws-teal/10 text-ws-teal',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    purple: 'bg-purple-500/10 text-purple-500',
    orange: 'bg-ws-orange/10 text-ws-orange'
  };

  return (
    <div className="bg-ws-card border border-ws-border rounded-xl p-4 hover:border-ws-border-light transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-sm text-ws-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ws-text">{value.toLocaleString()}</p>
      {subValue && (
        <p className="text-xs text-ws-text-muted mt-1">{subValue}</p>
      )}
    </div>
  );
}

function DirectoryPicker({ currentDir, onSelect, onClose }) {
  const [path, setPath] = useState(currentDir);
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Storage source selection state
  const [storageSource, setStorageSource] = useState('local'); // 'local', 's3', 'azure'
  const [s3Config, setS3Config] = useState({ bucket: '', prefix: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '' });
  const [azureConfig, setAzureConfig] = useState({ container: '', path: '', accountName: '', accountKey: '' });
  const [credentialMode, setCredentialMode] = useState('env'); // 'env' or 'manual'
  const [showEnvGuide, setShowEnvGuide] = useState(false);
  const [envInfo, setEnvInfo] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null); // 'success', 'error', or null
  const [copiedItem, setCopiedItem] = useState(null); // Track which item was copied for visual feedback

  // Fetch env file info on mount and when env guide opens
  useEffect(() => {
    fetch(`${API_BASE}/config/env-info`)
      .then(res => res.json())
      .then(data => setEnvInfo(data))
      .catch((err) => {
        console.error('Failed to fetch env info:', err);
        setEnvInfo({ env_path: 'Error loading path - check backend', error: true });
      });
  }, []);

  // Re-fetch env info when env guide modal opens
  useEffect(() => {
    if (showEnvGuide) {
      setEnvInfo(prev => prev?.error ? prev : null); // Reset to loading state unless error
      fetch(`${API_BASE}/config/env-info`)
        .then(res => res.json())
        .then(data => setEnvInfo(data))
        .catch((err) => {
          console.error('Failed to fetch env info:', err);
          setEnvInfo({ env_path: 'Error loading path - check backend', error: true });
        });
    }
  }, [showEnvGuide]);

  const fetchDirectories = async (dir) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/directories/browse?path=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.items) {
        setDirectories(data.items);
        setPath(data.current_path);
      }
    } catch (err) {
      console.error('Failed to browse directories:', err);
      setError('Failed to browse directory');
    } finally {
      setLoading(false);
    }
  };

  // Update path when currentDir prop changes (modal reopened)
  useEffect(() => {
    setPath(currentDir);
    fetchDirectories(currentDir);
  }, [currentDir]);

  const goUp = () => {
    const parent = path.split('/').slice(0, -1).join('/') || '/';
    fetchDirectories(parent);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="directory-picker-title"
    >
      <div className="bg-ws-card border border-ws-border rounded w-full max-w-lg max-h-[80vh] flex flex-col modal-bounce">
        <div className="flex items-center justify-between p-4 border-b border-ws-border">
          <h2 id="directory-picker-title" className="text-base font-semibold text-ws-text">Select Log Source</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-ws-card-hover rounded text-ws-text-muted hover:text-ws-text transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Storage Source Tabs */}
        <div className="flex border-b border-ws-border">
          <button
            onClick={() => setStorageSource('local')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              storageSource === 'local'
                ? 'text-ws-teal border-b-2 border-ws-teal bg-ws-teal/5'
                : 'text-ws-text-muted hover:text-ws-text hover:bg-ws-card-hover'
            }`}
            aria-pressed={storageSource === 'local'}
          >
            <FolderOpen className="w-4 h-4" aria-hidden="true" />
            Local
          </button>
          <button
            onClick={() => setStorageSource('s3')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              storageSource === 's3'
                ? 'text-ws-teal border-b-2 border-ws-teal bg-ws-teal/5'
                : 'text-ws-text-muted hover:text-ws-text hover:bg-ws-card-hover'
            }`}
            aria-pressed={storageSource === 's3'}
          >
            <Database className="w-4 h-4" aria-hidden="true" />
            AWS S3
          </button>
          <button
            onClick={() => setStorageSource('azure')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              storageSource === 'azure'
                ? 'text-ws-teal border-b-2 border-ws-teal bg-ws-teal/5'
                : 'text-ws-text-muted hover:text-ws-text hover:bg-ws-card-hover'
            }`}
            aria-pressed={storageSource === 'azure'}
          >
            <Layers className="w-4 h-4" aria-hidden="true" />
            Azure Blob
          </button>
        </div>

        {/* Local Directory Browser */}
        {storageSource === 'local' && (
          <>
            <div className="p-4 border-b border-ws-border">
              <div className="flex items-center gap-2">
                <label htmlFor="directory-path" className="sr-only">Directory path</label>
                <input
                  id="directory-path"
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchDirectories(path)}
                  className="flex-1 px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
                />
                <button
                  onClick={() => fetchDirectories(path)}
                  className="px-3 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors"
                >
                  Go
                </button>
              </div>
            </div>
          </>
        )}

        {/* S3 Configuration */}
        {storageSource === 's3' && (
          <div className="p-4 border-b border-ws-border space-y-3 max-h-[50vh] overflow-y-auto">
            <div className="text-xs text-ws-text-muted mb-2">
              Configure AWS S3 bucket to pull hooks logs from a remote location.
            </div>
            
            {/* Credential Mode Toggle */}
            <div className="flex gap-2 p-1 bg-ws-bg rounded border border-ws-border">
              <button
                onClick={() => setCredentialMode('env')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  credentialMode === 'env'
                    ? 'bg-ws-teal text-white'
                    : 'text-ws-text-muted hover:text-ws-text'
                }`}
              >
                🔒 Use .env (Recommended)
              </button>
              <button
                onClick={() => setCredentialMode('manual')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  credentialMode === 'manual'
                    ? 'bg-ws-orange text-white'
                    : 'text-ws-text-muted hover:text-ws-text'
                }`}
              >
                ⚠️ Enter Manually
              </button>
            </div>

            <div>
              <label htmlFor="s3-bucket" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Bucket Name *
              </label>
              <input
                id="s3-bucket"
                type="text"
                value={s3Config.bucket}
                onChange={(e) => setS3Config({ ...s3Config, bucket: e.target.value })}
                placeholder="my-logs-bucket"
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              />
            </div>
            <div>
              <label htmlFor="s3-prefix" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Prefix / Path
              </label>
              <input
                id="s3-prefix"
                type="text"
                value={s3Config.prefix}
                onChange={(e) => setS3Config({ ...s3Config, prefix: e.target.value })}
                placeholder="logs/windsurf/"
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              />
            </div>
            <div>
              <label htmlFor="s3-region" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Region
              </label>
              <select
                id="s3-region"
                value={s3Config.region}
                onChange={(e) => setS3Config({ ...s3Config, region: e.target.value })}
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              >
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-east-2">US East (Ohio)</option>
                <option value="us-west-1">US West (N. California)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="us-gov-west-1">AWS GovCloud (US-West)</option>
                <option value="us-gov-east-1">AWS GovCloud (US-East)</option>
                <option value="eu-west-1">EU (Ireland)</option>
                <option value="eu-west-2">EU (London)</option>
                <option value="eu-central-1">EU (Frankfurt)</option>
              </select>
            </div>

            {/* Manual Credential Entry */}
            {credentialMode === 'manual' && (
              <>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 text-base">⚠️</span>
                    <div>
                      <p className="font-semibold text-red-400 mb-1">Security Warning</p>
                      <p className="text-red-300/80">
                        Entering credentials here is less secure. They may be visible in browser memory/dev tools. 
                        For production use, configure via .env file instead.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="s3-access-key" className="block text-xs font-medium text-ws-text-secondary mb-1">
                    Access Key ID
                  </label>
                  <input
                    id="s3-access-key"
                    type="text"
                    value={s3Config.accessKeyId}
                    onChange={(e) => setS3Config({ ...s3Config, accessKeyId: e.target.value })}
                    placeholder="AKIA..."
                    className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal font-mono"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="s3-secret-key" className="block text-xs font-medium text-ws-text-secondary mb-1">
                    Secret Access Key
                  </label>
                  <input
                    id="s3-secret-key"
                    type="password"
                    value={s3Config.secretAccessKey}
                    onChange={(e) => setS3Config({ ...s3Config, secretAccessKey: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal font-mono"
                    autoComplete="off"
                  />
                </div>
              </>
            )}

            {/* Env Configuration Guide */}
            {credentialMode === 'env' && (
              <div className="bg-ws-teal/10 border border-ws-teal/30 rounded p-3 space-y-2">
                <p className="text-xs text-ws-teal font-medium">✓ Secure: Credentials stored in .env file</p>
                <button
                  onClick={() => setShowEnvGuide(true)}
                  className="w-full px-3 py-2 bg-ws-teal/20 hover:bg-ws-teal/30 border border-ws-teal/30 rounded text-xs text-ws-teal font-medium transition-colors"
                >
                  📝 Configure .env File (Step-by-Step Guide)
                </button>
                {envInfo?.has_env_credentials?.aws && (
                  <p className="text-xs text-green-400">✓ AWS credentials detected in .env</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Azure Configuration */}
        {storageSource === 'azure' && (
          <div className="p-4 border-b border-ws-border space-y-3 max-h-[50vh] overflow-y-auto">
            <div className="text-xs text-ws-text-muted mb-2">
              Configure Azure Blob Storage to pull hooks logs from a remote location.
            </div>
            
            {/* Credential Mode Toggle */}
            <div className="flex gap-2 p-1 bg-ws-bg rounded border border-ws-border">
              <button
                onClick={() => setCredentialMode('env')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  credentialMode === 'env'
                    ? 'bg-ws-teal text-white'
                    : 'text-ws-text-muted hover:text-ws-text'
                }`}
              >
                🔒 Use .env (Recommended)
              </button>
              <button
                onClick={() => setCredentialMode('manual')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  credentialMode === 'manual'
                    ? 'bg-ws-orange text-white'
                    : 'text-ws-text-muted hover:text-ws-text'
                }`}
              >
                ⚠️ Enter Manually
              </button>
            </div>

            <div>
              <label htmlFor="azure-account" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Storage Account Name *
              </label>
              <input
                id="azure-account"
                type="text"
                value={azureConfig.accountName}
                onChange={(e) => setAzureConfig({ ...azureConfig, accountName: e.target.value })}
                placeholder="mystorageaccount"
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              />
            </div>
            <div>
              <label htmlFor="azure-container" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Container Name *
              </label>
              <input
                id="azure-container"
                type="text"
                value={azureConfig.container}
                onChange={(e) => setAzureConfig({ ...azureConfig, container: e.target.value })}
                placeholder="logs-container"
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              />
            </div>
            <div>
              <label htmlFor="azure-path" className="block text-xs font-medium text-ws-text-secondary mb-1">
                Blob Path / Prefix
              </label>
              <input
                id="azure-path"
                type="text"
                value={azureConfig.path}
                onChange={(e) => setAzureConfig({ ...azureConfig, path: e.target.value })}
                placeholder="windsurf/hooks/"
                className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal"
              />
            </div>

            {/* Manual Credential Entry */}
            {credentialMode === 'manual' && (
              <>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 text-base">⚠️</span>
                    <div>
                      <p className="font-semibold text-red-400 mb-1">Security Warning</p>
                      <p className="text-red-300/80">
                        Entering credentials here is less secure. They may be visible in browser memory/dev tools. 
                        For production use, configure via .env file instead.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="azure-key" className="block text-xs font-medium text-ws-text-secondary mb-1">
                    Storage Account Key
                  </label>
                  <input
                    id="azure-key"
                    type="password"
                    value={azureConfig.accountKey}
                    onChange={(e) => setAzureConfig({ ...azureConfig, accountKey: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 bg-ws-bg border border-ws-border rounded text-ws-text text-sm focus:outline-none focus:border-ws-teal font-mono"
                    autoComplete="off"
                  />
                </div>
              </>
            )}

            {/* Env Configuration Guide */}
            {credentialMode === 'env' && (
              <div className="bg-ws-teal/10 border border-ws-teal/30 rounded p-3 space-y-2">
                <p className="text-xs text-ws-teal font-medium">✓ Secure: Credentials stored in .env file</p>
                <button
                  onClick={() => setShowEnvGuide(true)}
                  className="w-full px-3 py-2 bg-ws-teal/20 hover:bg-ws-teal/30 border border-ws-teal/30 rounded text-xs text-ws-teal font-medium transition-colors"
                >
                  📝 Configure .env File (Step-by-Step Guide)
                </button>
                {envInfo?.has_env_credentials?.azure && (
                  <p className="text-xs text-green-400">✓ Azure credentials detected in .env</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Local Directory Browser */}
        {storageSource === 'local' && (
          <div className="flex-1 overflow-auto p-2">
            <button
              onClick={goUp}
              className="w-full flex items-center gap-2 p-2 rounded hover:bg-ws-card-hover text-ws-text-secondary text-sm transition-colors"
              aria-label="Navigate to parent directory"
            >
              <FolderOpen className="w-4 h-4 text-ws-text-muted" aria-hidden="true" />
              <span>..</span>
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="rounded-full h-5 w-5 border-2 border-ws-teal border-t-transparent spinner-smooth"></div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-red-400 text-sm mb-2">{error}</p>
                <button
                  onClick={() => fetchDirectories(path)}
                  className="text-xs text-ws-teal hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : directories.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-ws-text-muted text-sm">No subdirectories found</p>
              </div>
            ) : (
              directories.map(dir => (
                <button
                  key={dir.path}
                  onClick={() => fetchDirectories(dir.path)}
                  className={`w-full flex items-center gap-2 p-2 rounded hover:bg-ws-card-hover text-ws-text-secondary text-sm transition-colors ${
                    dir.has_logs ? 'border border-ws-teal/30' : ''
                  }`}
                  aria-label={`Open directory ${dir.name}${dir.has_logs ? ', contains log files' : ''}`}
                >
                  <FolderOpen className={`w-4 h-4 ${dir.has_logs ? 'text-ws-teal' : 'text-ws-text-muted'}`} aria-hidden="true" />
                  <span className="flex-1 text-left" style={{wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.2'}}>{dir.name}</span>
                  {dir.has_logs && (
                    <span className="text-xs text-ws-teal">Has logs</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* Cloud storage status content */}
        {storageSource !== 'local' && (
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
              connectionStatus === 'success' ? 'bg-green-500/10' : 
              connectionStatus === 'error' ? 'bg-red-500/10' : 'bg-ws-teal/10'
            }`}>
              {storageSource === 's3' ? (
                <Database className={`w-6 h-6 ${
                  connectionStatus === 'success' ? 'text-green-400' : 
                  connectionStatus === 'error' ? 'text-red-400' : 'text-ws-teal'
                }`} />
              ) : (
                <Layers className={`w-6 h-6 ${
                  connectionStatus === 'success' ? 'text-green-400' : 
                  connectionStatus === 'error' ? 'text-red-400' : 'text-ws-teal'
                }`} />
              )}
            </div>
            <p className="text-ws-text-secondary text-sm mb-1">
              {storageSource === 's3' ? 'AWS S3' : 'Azure Blob Storage'}
            </p>
            {connectionStatus === 'success' ? (
              <p className="text-green-400 text-xs">✓ Connected successfully</p>
            ) : connectionStatus === 'error' ? (
              <p className="text-red-400 text-xs">✗ Connection failed - check credentials</p>
            ) : (
              <p className="text-ws-text-muted text-xs max-w-xs">
                Configure the {storageSource === 's3' ? 'bucket' : 'container'} details above to connect.
              </p>
            )}
          </div>
        )}

        <div className="p-4 border-t border-ws-border flex justify-between gap-2">
          <button
            onClick={() => {
              // Test connection
              setTestingConnection(true);
              setConnectionStatus(null);
              const config = storageSource === 's3' ? {
                type: 's3',
                bucket: s3Config.bucket,
                prefix: s3Config.prefix,
                region: s3Config.region,
                ...(credentialMode === 'manual' && s3Config.accessKeyId && {
                  access_key_id: s3Config.accessKeyId,
                  secret_access_key: s3Config.secretAccessKey
                })
              } : {
                type: 'azure',
                account_name: azureConfig.accountName,
                container: azureConfig.container,
                path: azureConfig.path,
                ...(credentialMode === 'manual' && azureConfig.accountKey && {
                  account_key: azureConfig.accountKey
                })
              };
              
              fetch(`${API_BASE}/storage/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
              })
                .then(res => res.json())
                .then(data => {
                  setConnectionStatus(data.success ? 'success' : 'error');
                })
                .catch(() => setConnectionStatus('error'))
                .finally(() => setTestingConnection(false));
            }}
            disabled={
              storageSource === 'local' ||
              testingConnection ||
              (storageSource === 's3' && !s3Config.bucket) ||
              (storageSource === 'azure' && (!azureConfig.accountName || !azureConfig.container))
            }
            className={`px-4 py-2 border rounded text-sm transition-colors ${
              storageSource === 'local' ? 'hidden' : ''
            } ${
              testingConnection 
                ? 'border-ws-border text-ws-text-muted cursor-wait' 
                : 'border-ws-teal text-ws-teal hover:bg-ws-teal/10'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-ws-text-muted hover:text-ws-text text-sm transition-colors"
            >
              Cancel
            </button>
            {storageSource === 'local' ? (
              <button
                onClick={() => onSelect(path)}
                className="px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors"
              >
                Select Directory
              </button>
            ) : (
              <button
                onClick={async () => {
                  const config = storageSource === 's3' ? {
                    type: 's3',
                    bucket: s3Config.bucket,
                    prefix: s3Config.prefix,
                    region: s3Config.region,
                    ...(credentialMode === 'manual' && s3Config.accessKeyId && {
                      access_key_id: s3Config.accessKeyId,
                      secret_access_key: s3Config.secretAccessKey
                    })
                  } : {
                    type: 'azure',
                    account_name: azureConfig.accountName,
                    container: azureConfig.container,
                    path: azureConfig.path,
                    ...(credentialMode === 'manual' && azureConfig.accountKey && {
                      account_key: azureConfig.accountKey
                    })
                  };
                  
                  try {
                    const res = await fetch(`${API_BASE}/storage/configure`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(config)
                    });
                    const data = await res.json();
                    if (data.success) {
                      // Pass the storage URI to parent
                      const storageUri = storageSource === 's3' 
                        ? `s3://${s3Config.bucket}/${s3Config.prefix || ''}` 
                        : `azure://${azureConfig.accountName}/${azureConfig.container}/${azureConfig.path || ''}`;
                      onSelect(storageUri);
                    } else {
                      alert(`Failed to configure storage: ${data.error || 'Unknown error'}`);
                    }
                  } catch (err) {
                    alert('Failed to configure storage. Please check your settings.');
                  }
                }}
                disabled={
                  (storageSource === 's3' && !s3Config.bucket) ||
                  (storageSource === 'azure' && (!azureConfig.accountName || !azureConfig.container))
                }
                className="px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect & Use Storage
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Environment Configuration Guide Modal */}
      {showEnvGuide && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
          <div className="bg-ws-card border border-ws-border rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-ws-border">
              <h3 className="text-base font-semibold text-ws-text">📝 Configure Credentials via .env File</h3>
              <button
                onClick={() => setShowEnvGuide(false)}
                className="p-1 hover:bg-ws-card-hover rounded text-ws-text-muted hover:text-ws-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Step 1 */}
              <div className="bg-ws-bg/50 rounded-lg p-4 border border-ws-border">
                <h4 className="text-sm font-semibold text-ws-teal mb-2">Step 1: Locate your .env file</h4>
                <p className="text-xs text-ws-text-secondary mb-3">
                  The .env file should be in your windsurf-logger root directory:
                </p>
                <div className={`bg-ws-bg rounded p-2 font-mono text-xs flex items-center justify-between gap-2 ${
                  envInfo?.error ? 'text-red-400 border border-red-500/30' : 'text-ws-text'
                }`}>
                  <span className="break-all flex-1">
                    {envInfo === null ? (
                      <span className="text-ws-text-muted">Loading path...</span>
                    ) : envInfo?.error ? (
                      <span>⚠️ {envInfo.env_path}</span>
                    ) : (
                      envInfo.env_path
                    )}
                  </span>
                  <button
                    onClick={() => {
                      const pathToCopy = envInfo?.env_path;
                      if (pathToCopy && !envInfo?.error) {
                        navigator.clipboard.writeText(pathToCopy);
                        setCopiedItem('env-path');
                        setTimeout(() => setCopiedItem(null), 2000);
                      }
                    }}
                    disabled={!envInfo || envInfo?.error}
                    className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-all ${
                      copiedItem === 'env-path' 
                        ? 'bg-green-500/20 text-green-400' 
                        : envInfo?.error
                          ? 'text-ws-text-muted cursor-not-allowed opacity-50'
                          : 'text-ws-teal hover:bg-ws-teal/10'
                    }`}
                  >
                    {copiedItem === 'env-path' ? '✓ Copied!' : '📋 Copy Path'}
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/config/reveal-env`, { method: 'POST' });
                        const data = await res.json();
                        if (!data.success) {
                          alert(data.message || 'Could not open file location');
                        }
                      } catch (err) {
                        alert(`Network error: ${err.message}. Make sure the backend is running.`);
                      }
                    }}
                    className="px-3 py-1.5 bg-ws-teal/20 hover:bg-ws-teal/30 text-ws-teal rounded text-xs font-medium transition-colors"
                  >
                    📂 Open in Finder
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/config/open-env`, { method: 'POST' });
                        const data = await res.json();
                        if (!data.success) {
                          alert(data.message || 'Could not open file');
                        }
                      } catch (err) {
                        alert(`Network error: ${err.message}. Make sure the backend is running.`);
                      }
                    }}
                    className="px-3 py-1.5 bg-ws-teal/20 hover:bg-ws-teal/30 text-ws-teal rounded text-xs font-medium transition-colors"
                  >
                    📝 Open in Editor
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-ws-bg/50 rounded-lg p-4 border border-ws-border">
                <h4 className="text-sm font-semibold text-ws-teal mb-2">Step 2: Add your credentials</h4>
                <p className="text-xs text-ws-text-secondary mb-3">
                  Copy and paste the following into your .env file, replacing the placeholder values:
                </p>
                
                {storageSource === 's3' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-ws-text-muted">For AWS S3:</p>
                    <pre className="bg-ws-bg rounded p-3 text-xs text-ws-text font-mono overflow-x-auto whitespace-pre">
{`# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_DEFAULT_REGION=${s3Config.region || 'us-east-1'}

# S3 Bucket Settings (optional - can also set in UI)
WINDSURF_S3_BUCKET=${s3Config.bucket || 'your-bucket-name'}
WINDSURF_S3_PREFIX=${s3Config.prefix || 'logs/'}`}
                    </pre>
                    <button
                      onClick={() => {
                        const text = `# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_DEFAULT_REGION=${s3Config.region || 'us-east-1'}

# S3 Bucket Settings (optional - can also set in UI)
WINDSURF_S3_BUCKET=${s3Config.bucket || 'your-bucket-name'}
WINDSURF_S3_PREFIX=${s3Config.prefix || 'logs/'}`;
                        navigator.clipboard.writeText(text);
                        setCopiedItem('s3-config');
                        setTimeout(() => setCopiedItem(null), 2000);
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                        copiedItem === 's3-config'
                          ? 'bg-green-500 text-white'
                          : 'bg-ws-teal text-white hover:bg-ws-teal-dim'
                      }`}
                    >
                      {copiedItem === 's3-config' ? '✓ Copied!' : '📋 Copy to Clipboard'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-ws-text-muted">For Azure Blob Storage:</p>
                    <pre className="bg-ws-bg rounded p-3 text-xs text-ws-text font-mono overflow-x-auto whitespace-pre">
{`# Azure Blob Storage Configuration
AZURE_STORAGE_ACCOUNT_NAME=${azureConfig.accountName || 'your_account_name'}
AZURE_STORAGE_ACCOUNT_KEY=your_account_key_here

# Azure Container Settings (optional - can also set in UI)
WINDSURF_AZURE_CONTAINER=${azureConfig.container || 'your-container'}
WINDSURF_AZURE_PATH=${azureConfig.path || 'logs/'}`}
                    </pre>
                    <button
                      onClick={() => {
                        const text = `# Azure Blob Storage Configuration
AZURE_STORAGE_ACCOUNT_NAME=${azureConfig.accountName || 'your_account_name'}
AZURE_STORAGE_ACCOUNT_KEY=your_account_key_here

# Azure Container Settings (optional - can also set in UI)
WINDSURF_AZURE_CONTAINER=${azureConfig.container || 'your-container'}
WINDSURF_AZURE_PATH=${azureConfig.path || 'logs/'}`;
                        navigator.clipboard.writeText(text);
                        setCopiedItem('azure-config');
                        setTimeout(() => setCopiedItem(null), 2000);
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                        copiedItem === 'azure-config'
                          ? 'bg-green-500 text-white'
                          : 'bg-ws-teal text-white hover:bg-ws-teal-dim'
                      }`}
                    >
                      {copiedItem === 'azure-config' ? '✓ Copied!' : '📋 Copy to Clipboard'}
                    </button>
                  </div>
                )}
              </div>

              {/* Step 3 */}
              <div className="bg-ws-bg/50 rounded-lg p-4 border border-ws-border">
                <h4 className="text-sm font-semibold text-ws-teal mb-2">Step 3: Restart the backend</h4>
                <p className="text-xs text-ws-text-secondary">
                  After saving your .env file, restart the dashboard backend for changes to take effect:
                </p>
                <pre className="bg-ws-bg rounded p-2 mt-2 text-xs text-ws-text font-mono">
                  cd windsurf-logger && ./dashboard/start.sh
                </pre>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/config/restart-backend`, { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                          alert('Backend restart initiated. The page will reload in 3 seconds...');
                          setTimeout(() => window.location.reload(), 3000);
                        } else {
                          alert(data.message || 'Could not restart backend');
                        }
                      } catch (err) {
                        alert(`Network error: ${err.message}. You may need to restart manually.`);
                      }
                    }}
                    className="px-3 py-1.5 bg-ws-orange/20 hover:bg-ws-orange/30 text-ws-orange rounded text-xs font-medium transition-colors"
                  >
                    🔄 Restart Backend
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('cd windsurf-logger && ./dashboard/start.sh');
                      setCopiedItem('restart-cmd');
                      setTimeout(() => setCopiedItem(null), 2000);
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      copiedItem === 'restart-cmd'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-ws-teal/20 hover:bg-ws-teal/30 text-ws-teal'
                    }`}
                  >
                    {copiedItem === 'restart-cmd' ? '✓ Copied!' : '📋 Copy Command'}
                  </button>
                </div>
              </div>

              {/* Security Note */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-400 mb-2">✓ Why this is more secure</h4>
                <ul className="text-xs text-green-300/80 space-y-1 list-disc list-inside">
                  <li>Credentials are never sent to the browser</li>
                  <li>The .env file is excluded from git (check your .gitignore)</li>
                  <li>Credentials are only loaded server-side</li>
                  <li>Works with IAM roles in cloud environments</li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-ws-border flex justify-end">
              <button
                onClick={() => {
                  setShowEnvGuide(false);
                  // Refresh env info
                  fetch(`${API_BASE}/config/env-info`)
                    .then(res => res.json())
                    .then(data => setEnvInfo(data))
                    .catch(() => {});
                }}
                className="px-4 py-2 bg-ws-teal hover:bg-ws-teal-dim text-white rounded text-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
