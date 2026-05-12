import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn((url) => {
      if (typeof url === 'string' && url.includes('/config/defaults')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ log_directory: '/tmp/logs' }) });
      }
      if (typeof url === 'string' && url.includes('/logs/sessions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ sessions: [] }) });
      }
      if (typeof url === 'string' && url.includes('/logs/files')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ files: [], directory: '/tmp/logs' }) });
      }
      if (typeof url === 'string' && url.includes('/logs/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (typeof url === 'string' && url.includes('/logs/metrics')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (typeof url === 'string' && url.includes('/logs/data')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('mounts without crashing', () => {
    render(<App />);
    expect(screen.getByText('Windsurf Hooks Logger')).toBeInTheDocument();
  });

  it('renders the main navigation', () => {
    render(<App />);
    expect(screen.getByText('Workflow View')).toBeInTheDocument();
    expect(screen.getByText('Timeline View')).toBeInTheDocument();
    expect(screen.getByText('List View')).toBeInTheDocument();
    expect(screen.getByText('Metrics Dashboard')).toBeInTheDocument();
  });
});
