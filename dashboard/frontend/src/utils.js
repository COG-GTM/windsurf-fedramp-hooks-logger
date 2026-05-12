export function formatTimestamp(ts) {
  if (!ts) return 'Unknown';
  try {
    const date = new Date(ts);
    return date.toLocaleString();
  } catch {
    return ts;
  }
}

export function truncateContent(content, maxLen = 200) {
  if (!content) return '';
  if (content.length <= maxLen) return content;
  return content.substring(0, maxLen) + '...';
}

export function formatSessionName(session) {
  if (session.id === 'no_session') {
    return 'All Prompts';
  }
  const user = session.events?.find((e) => e.user)?.user || 'Unknown User';
  const datetime = session.start_time ? new Date(session.start_time).toLocaleString() : 'Unknown Time';
  return `${user} - ${datetime}`;
}

export function getPromptTitle(promptText, maxLength = 60) {
  if (!promptText) return 'User prompt';
  const firstLine = promptText.split('\n')[0].trim();
  if (firstLine.length <= maxLength) return firstLine;
  const truncated = firstLine.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

export function getEventSummary(entry, truncate = truncateContent) {
  const category = entry.category || entry.type || 'unknown';
  const data = entry.data || {};

  switch (category) {
    case 'prompt':
      return truncate(data.user_prompt || entry.content || 'User prompt', 100);
    case 'file_read':
      return `Read: ${data.file_path || entry.file_path || 'unknown file'}`;
    case 'file_write':
      return `Modified: ${data.file_path || entry.file_path || 'unknown file'} (${data.edit_count || 0} edits)`;
    case 'command':
      return `$ ${truncate(data.command_line || entry.command_line || 'command', 80)}`;
    case 'mcp':
      return `MCP: ${data.mcp_full_tool || data.mcp_tool_name || 'tool'}`;
    case 'response':
      return truncate(entry.content || 'Response', 100);
    default:
      return truncate(entry.content || entry.action || 'Event', 100);
  }
}

export function computeWorkflowGroups(selectedSession, sessions) {
  if (!selectedSession) return [];

  const allEvents = [];
  sessions.forEach((session) => {
    (session.events || []).forEach((event) => {
      allEvents.push({ ...event, _sessionId: session.id });
    });
  });

  allEvents.sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });

  const prompts = allEvents.filter((e) => (e.category || e.type) === 'prompt');
  const actions = allEvents.filter((e) => (e.category || e.type) !== 'prompt');

  if (selectedSession === 'no_session') {
    const groups = [];
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      const promptTime = new Date(prompt.timestamp || 0).getTime();
      const nextPromptTime = i < prompts.length - 1
        ? new Date(prompts[i + 1].timestamp || 0).getTime()
        : Infinity;
      const relatedActions = actions.filter((a) => {
        const actionTime = new Date(a.timestamp || 0).getTime();
        return actionTime > promptTime && actionTime < nextPromptTime;
      });
      groups.push({
        prompt,
        actions: relatedActions,
        id: prompt.event_id || `group-${i}`,
      });
    }
    return groups;
  }

  const session = sessions.find((s) => s.id === selectedSession);
  if (!session?.events?.length) return [];

  const sessionEvents = [...session.events].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });

  const earliestActionTime = sessionEvents.length > 0
    ? new Date(sessionEvents[0].timestamp || 0).getTime()
    : 0;

  const relevantPrompts = prompts.filter((p) => {
    const promptTime = new Date(p.timestamp || 0).getTime();
    return promptTime < earliestActionTime && (earliestActionTime - promptTime) < 5 * 60 * 1000;
  });

  const groups = [];
  for (const prompt of relevantPrompts) {
    const promptTime = new Date(prompt.timestamp || 0).getTime();
    const nextPromptTime = relevantPrompts.indexOf(prompt) < relevantPrompts.length - 1
      ? new Date(relevantPrompts[relevantPrompts.indexOf(prompt) + 1].timestamp || 0).getTime()
      : Infinity;
    const relatedActions = sessionEvents.filter((a) => {
      const actionTime = new Date(a.timestamp || 0).getTime();
      return actionTime > promptTime && actionTime < nextPromptTime;
    });
    if (relatedActions.length > 0 || relevantPrompts.length === 1) {
      groups.push({
        prompt,
        actions: relatedActions,
        id: prompt.event_id || `group-${groups.length}`,
      });
    }
  }

  if (groups.length === 0 && sessionEvents.length > 0) {
    groups.push({
      prompt: null,
      actions: sessionEvents,
      id: 'session-actions',
    });
  }

  return groups;
}
