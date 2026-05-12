import React, { useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  Database,
  Edit3,
  FileCode,
  MessageSquare,
  PieChart,
  Play,
  Target,
  Terminal,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

function MetricCard({ icon, label, value, color, subValue }) {
  const colorClasses = {
    teal: 'bg-ws-teal/10 text-ws-teal',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    purple: 'bg-purple-500/10 text-purple-500',
    orange: 'bg-ws-orange/10 text-ws-orange',
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
      {subValue && <p className="text-xs text-ws-text-muted mt-1">{subValue}</p>}
    </div>
  );
}

export function MetricsDashboard({ aggregatedMetrics }) {
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
        dateRange: { start: null, end: null },
      };
    }

    const hourlyActivity = aggregatedMetrics.hourly_activity || Array(24).fill(0);
    const serverDaily = aggregatedMetrics.daily_activity || Array(7).fill(0);
    const dailyActivity = [serverDaily[6], ...serverDaily.slice(0, 6)];

    return {
      totalEvents: aggregatedMetrics.total_events || 0,
      categoryBreakdown: aggregatedMetrics.categories || {},
      hourlyActivity,
      maxHourly: Math.max(...hourlyActivity, 1),
      dailyActivity,
      dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      maxDaily: Math.max(...dailyActivity, 1),
      topFiles: (aggregatedMetrics.top_files || []).map((f) => [f.name, f.count]),
      topCommands: (aggregatedMetrics.top_commands || []).map((c) => [c.name, c.count]),
      topMcpTools: (aggregatedMetrics.top_mcp_tools || []).map((t) => [t.name, t.count]),
      recentDays: aggregatedMetrics.recent_days || [],
      maxRecentDaily: Math.max(...(aggregatedMetrics.recent_days || []).map((d) => d.count), 1),
      uniqueSessions: aggregatedMetrics.unique_sessions || 0,
      totalLinesAdded: aggregatedMetrics.total_lines_added || 0,
      totalLinesRemoved: aggregatedMetrics.total_lines_removed || 0,
      uniqueFilesCount: aggregatedMetrics.unique_files_count || 0,
      dateRange: aggregatedMetrics.date_range || { start: null, end: null },
      avgEventsPerSession: aggregatedMetrics.unique_sessions > 0
        ? Math.round((aggregatedMetrics.total_events || 0) / aggregatedMetrics.unique_sessions)
        : 0,
    };
  }, [aggregatedMetrics]);

  const categoryColors = {
    prompt: { bg: 'bg-ws-teal', text: 'text-ws-teal', label: 'Prompts' },
    file_write: { bg: 'bg-emerald-500', text: 'text-emerald-500', label: 'Code Changes' },
    file_read: { bg: 'bg-ws-orange', text: 'text-ws-orange', label: 'File Reads' },
    command: { bg: 'bg-amber-500', text: 'text-amber-500', label: 'Commands' },
    mcp: { bg: 'bg-purple-500', text: 'text-purple-500', label: 'MCP Tools' },
  };

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
            <MetricCard icon={<MessageSquare className="w-5 h-5" />} label="Total Prompts" value={metrics.categoryBreakdown.prompt || 0} color="teal" />
            <MetricCard
              icon={<Edit3 className="w-5 h-5" />}
              label="Code Changes"
              value={metrics.categoryBreakdown.file_write || 0}
              color="emerald"
              subValue={`+${metrics.totalLinesAdded} / -${metrics.totalLinesRemoved} lines`}
            />
            <MetricCard icon={<Play className="w-5 h-5" />} label="Commands Run" value={metrics.categoryBreakdown.command || 0} color="amber" />
            <MetricCard
              icon={<Users className="w-5 h-5" />}
              label="Sessions"
              value={metrics.uniqueSessions}
              color="purple"
              subValue={`~${metrics.avgEventsPerSession} events/session`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      style={{ backgroundColor: `rgba(0, 212, 170, ${intensity * 0.8 + 0.1})` }}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

export default MetricsDashboard;
