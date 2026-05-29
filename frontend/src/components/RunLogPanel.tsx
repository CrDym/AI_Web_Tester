import { getLogTone } from '../utils/runUi';

type RunLogFilter = 'all' | 'error' | 'warning' | 'ai' | 'success';

interface RunLogPanelProps {
  filter: RunLogFilter;
  filteredLogs: string[];
  stats: Record<RunLogFilter, number>;
  onFilterChange: (filter: RunLogFilter) => void;
}

const FILTERS: Array<{ key: RunLogFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'error', label: '错误' },
  { key: 'warning', label: '警告' },
  { key: 'ai', label: 'AI' },
  { key: 'success', label: '成功' },
];

export default function RunLogPanel({ filter, filteredLogs, stats, onFilterChange }: RunLogPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">执行日志</div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={`px-2 py-1 rounded-lg border text-[11px] transition-colors ${filter === key ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-800 dark:hover:bg-zinc-900'}`}
            >
              {label} <span className="font-mono opacity-70">{stats[key]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-64 min-h-[120px] overflow-auto bg-zinc-50 dark:bg-black custom-scrollbar">
        {filteredLogs.length === 0 ? (
          <div className="h-full min-h-[96px] flex items-center justify-center text-center">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {filter === 'all' ? '本次运行未记录日志' : '当前过滤条件下没有日志'}
            </div>
          </div>
        ) : (
          <div className="p-4 font-mono text-[13px] leading-relaxed space-y-1">
            {filteredLogs.map((log, i) => {
              const tone = getLogTone(log);
              return (
                <div key={i} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/70 transition-colors">
                  <span className="mt-0.5 w-8 shrink-0 text-[10px] text-zinc-400 dark:text-zinc-600 select-none tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center text-[10px] font-bold leading-none ${tone.iconWrap}`}>{tone.icon}</span>
                  <span className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${tone.text}`}>{log}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
