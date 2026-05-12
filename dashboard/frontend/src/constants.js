import {
  MessageSquare,
  Eye,
  Edit3,
  Play,
  Zap,
  Code,
  FileText,
} from 'lucide-react';

export const API_BASE = '/api';

export const CATEGORY_CONFIG = {
  prompt: { icon: MessageSquare, color: 'teal', label: 'Prompt', bgClass: 'bg-ws-teal/10', textClass: 'text-ws-teal' },
  file_read: { icon: Eye, color: 'orange', label: 'File Read', bgClass: 'bg-ws-orange/10', textClass: 'text-ws-orange' },
  file_write: { icon: Edit3, color: 'teal', label: 'Code Change', bgClass: 'bg-ws-teal/10', textClass: 'text-ws-teal' },
  command: { icon: Play, color: 'orange', label: 'Command', bgClass: 'bg-ws-orange/10', textClass: 'text-ws-orange' },
  mcp: { icon: Zap, color: 'teal', label: 'MCP Tool', bgClass: 'bg-ws-teal/10', textClass: 'text-ws-teal' },
  response: { icon: Code, color: 'teal', label: 'Response', bgClass: 'bg-ws-teal/10', textClass: 'text-ws-teal' },
  unknown: { icon: FileText, color: 'gray', label: 'Unknown', bgClass: 'bg-ws-text-muted/10', textClass: 'text-ws-text-muted' },
};
