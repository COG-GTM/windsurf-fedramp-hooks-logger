import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../constants';

export function useLogData(addToast) {
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [aggregatedMetrics, setAggregatedMetrics] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [currentDir, setCurrentDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterSession, setFilterSession] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [useRegex, setUseRegex] = useState(false);

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
      const users = new Set();
      const sessionIds = new Set();
      (data.sessions || []).forEach((session) => {
        if (session.id && session.id !== 'no_session') {
          sessionIds.add(session.id);
        }
        (session.events || []).forEach((event) => {
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
        selectedFiles.forEach((f) => params.push(`files=${encodeURIComponent(f)}`));
      }
      if (filterCategory !== 'all') params.push(`category=${filterCategory}`);
      if (filterUser !== 'all') params.push(`user=${encodeURIComponent(filterUser)}`);
      if (filterSession !== 'all') params.push(`session=${encodeURIComponent(filterSession)}`);
      if (searchQuery.trim()) params.push(`q=${encodeURIComponent(searchQuery)}`);
      if (dateFrom) params.push(`date_from=${encodeURIComponent(dateFrom)}`);
      if (dateTo) params.push(`date_to=${encodeURIComponent(dateTo)}`);

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
      if (searchQuery.trim()) url += `&q=${encodeURIComponent(searchQuery)}`;
      if (filterCategory !== 'all') url += `&category=${filterCategory}`;
      if (filterUser !== 'all') url += `&user=${encodeURIComponent(filterUser)}`;
      if (filterSession !== 'all') url += `&session=${encodeURIComponent(filterSession)}`;
      if (dateFrom) url += `&date_from=${encodeURIComponent(dateFrom)}`;
      if (dateTo) url += `&date_to=${encodeURIComponent(dateTo)}`;
      if (useRegex) url += `&regex=true`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.error && addToast) {
        addToast(data.error, 'error');
      }
      setLogs(data.entries || []);
    } catch (err) {
      console.error('Failed to search:', err);
      if (addToast) addToast('Search failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterCategory, filterUser, filterSession, dateFrom, dateTo, useRegex, currentDir, addToast]);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    if (addToast) addToast('Refreshing all data...', 'info');
    await Promise.all([
      fetchFiles(currentDir),
      fetchStats(),
      fetchAggregatedMetrics(),
      fetchSessions(),
      fetchLogs(),
    ]);
    setIsRefreshing(false);
    if (addToast) addToast('Data refreshed', 'success');
  }, [currentDir, fetchFiles, fetchStats, fetchAggregatedMetrics, fetchSessions, fetchLogs, addToast]);

  const exportLogs = useCallback(
    (format) => {
      const url = `${API_BASE}/logs/export?format=${format}&dir=${encodeURIComponent(currentDir)}${filterCategory !== 'all' ? `&category=${filterCategory}` : ''}`;
      window.open(url, '_blank');
      if (addToast) addToast(`Exporting as ${format.toUpperCase()}...`, 'success');
    },
    [currentDir, filterCategory, addToast],
  );

  const toggleFileSelection = useCallback((filepath) => {
    setSelectedFiles((prev) => {
      if (prev.includes(filepath)) {
        return prev.filter((f) => f !== filepath);
      }
      return [...prev, filepath];
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterCategory('all');
    setFilterUser('all');
    setFilterSession('all');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
    setUseRegex(false);
  }, []);

  const hasActiveFilters =
    filterCategory !== 'all' ||
    filterUser !== 'all' ||
    filterSession !== 'all' ||
    !!searchQuery ||
    !!dateFrom ||
    !!dateTo;

  // Fetch default config from backend on initial load
  useEffect(() => {
    fetch(`${API_BASE}/config/defaults`)
      .then((res) => res.json())
      .then((data) => {
        if (data.log_directory) {
          setCurrentDir(data.log_directory);
        }
      })
      .catch((err) => console.error('Failed to fetch default config:', err));
  }, []);

  useEffect(() => {
    if (!currentDir) return;
    fetchFiles(currentDir);
    fetchStats();
    fetchAggregatedMetrics();
    fetchSessions();
  }, [currentDir, fetchFiles, fetchStats, fetchAggregatedMetrics, fetchSessions]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh logs when filters change (besides searchQuery, handled below)
  useEffect(() => {
    if (filterCategory !== 'all' || filterUser !== 'all' || filterSession !== 'all' || dateFrom || dateTo) {
      fetchLogs();
    }
  }, [filterCategory, filterUser, filterSession, dateFrom, dateTo, fetchLogs]);

  // Auto-refresh when search query is cleared
  useEffect(() => {
    if (!searchQuery) {
      fetchLogs();
    }
  }, [searchQuery, fetchLogs]);

  const uniqueUsers = allUsers.length > 0 ? allUsers : [...new Set(logs.map((l) => l.user).filter(Boolean))];
  const uniqueSessions = allSessions.length > 0 ? allSessions : [...new Set(logs.map((l) => l.trajectory_id).filter(Boolean))];

  return {
    // Data
    logs,
    sessions,
    stats,
    aggregatedMetrics,
    files,
    selectedFiles,
    uniqueUsers,
    uniqueSessions,
    currentDir,
    loading,
    isRefreshing,
    // Filters
    searchQuery,
    filterCategory,
    filterUser,
    filterSession,
    dateFrom,
    dateTo,
    useRegex,
    hasActiveFilters,
    // Setters
    setSearchQuery,
    setFilterCategory,
    setFilterUser,
    setFilterSession,
    setDateFrom,
    setDateTo,
    setUseRegex,
    setCurrentDir,
    setSelectedFiles,
    // Actions
    fetchLogs,
    searchLogs,
    refreshAll,
    exportLogs,
    toggleFileSelection,
    clearAllFilters,
  };
}
