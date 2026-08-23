'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LogEntry {
  id: number;
  ts: string;
  level: 'info' | 'error';
  tag: string;
  msg: string;
  data?: Record<string, unknown>;
}

export default function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'error'>('all');
  const lastIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch(`/api/logs?afterId=${lastIdRef.current}`);
      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (response.ok) {
        const data = await response.json();
        if (data.entries && data.entries.length > 0) {
          setEntries(prev => {
            const combined = [...prev, ...data.entries];
            // Keep last 1000 entries on the client
            return combined.length > 1000 ? combined.slice(-1000) : combined;
          });
          lastIdRef.current = data.entries[data.entries.length - 1].id;
        }
      }
    } catch (_error) {
      // Silently retry on next poll
    }
  }, [router]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => {
      if (!paused) fetchLogs();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchLogs, paused]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll]);

  const filteredEntries = entries.filter(entry => {
    if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
    if (filter) {
      const search = filter.toLowerCase();
      return (
        entry.tag.toLowerCase().includes(search) ||
        entry.msg.toLowerCase().includes(search) ||
        (entry.data && JSON.stringify(entry.data).toLowerCase().includes(search))
      );
    }
    return true;
  });

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      '.' + d.getMilliseconds().toString().padStart(3, '0');
  };

  const formatData = (data?: Record<string, unknown>) => {
    if (!data || Object.keys(data).length === 0) return null;
    // Show compact inline for small objects, expanded for larger ones
    const json = JSON.stringify(data);
    if (json.length <= 120) return json;
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="flex-1 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-full mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-slate-100">Server Logs</h1>
            <Link
              href="/admin"
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              &larr; Dashboard
            </Link>
          </div>
          <div className="flex items-center space-x-3">
            {/* Level filter */}
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as 'all' | 'info' | 'error')}
              className="px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-200"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="error">Errors</option>
            </select>

            {/* Text filter */}
            <input
              type="text"
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-200 w-48 placeholder-slate-500"
            />

            {/* Pause/Resume */}
            <button
              onClick={() => setPaused(!paused)}
              className={`px-3 py-1 text-sm rounded ${
                paused
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              }`}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>

            {/* Auto-scroll toggle */}
            <label className="flex items-center space-x-1 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              <span>Auto-scroll</span>
            </label>

            {/* Clear */}
            <button
              onClick={() => { setEntries([]); lastIdRef.current = 0; }}
              className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
            >
              Clear
            </button>

            {/* Entry count */}
            <span className="text-xs text-slate-500">
              {filteredEntries.length} entries
            </span>
          </div>
        </div>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-auto font-mono text-sm">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-800 text-slate-400 text-xs">
            <tr>
              <th className="text-left px-3 py-2 w-24">Time</th>
              <th className="text-left px-3 py-2 w-16">Level</th>
              <th className="text-left px-3 py-2 w-48">Tag</th>
              <th className="text-left px-3 py-2">Message / Data</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => (
              <tr
                key={entry.id}
                className={`border-b border-slate-800 hover:bg-slate-800/50 ${
                  entry.level === 'error' ? 'bg-red-950/30' : ''
                }`}
              >
                <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap align-top">
                  {formatTime(entry.ts)}
                </td>
                <td className={`px-3 py-1.5 whitespace-nowrap align-top ${
                  entry.level === 'error' ? 'text-red-400' : 'text-slate-500'
                }`}>
                  {entry.level === 'error' ? 'ERR' : 'INF'}
                </td>
                <td className="px-3 py-1.5 text-cyan-400 whitespace-nowrap align-top">
                  {entry.tag}
                </td>
                <td className="px-3 py-1.5 text-slate-300 align-top">
                  <span>{entry.msg}</span>
                  {entry.data && (
                    <pre className="text-slate-500 mt-0.5 text-xs whitespace-pre-wrap break-all">
                      {formatData(entry.data)}
                    </pre>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredEntries.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            {entries.length === 0 ? 'No log entries yet. Logs appear as the server processes requests.' : 'No entries match your filter.'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
