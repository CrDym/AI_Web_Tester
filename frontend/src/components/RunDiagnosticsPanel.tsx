import { Activity, History, ShieldCheck } from 'lucide-react';
import type { RunDetail } from '../types';
import { formatRunTime, formatStatus } from '../utils/formatters';

interface DiagnosticStat {
  label: string;
  value: string;
}

interface RunDiagnosticsPanelProps {
  run: RunDetail;
  stats: DiagnosticStat[];
}

export default function RunDiagnosticsPanel({ run, stats }: RunDiagnosticsPanelProps) {
  const statusTone = run.status === 'passed' || run.status === 'completed'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
    : run.status === 'failed'
      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300'
      : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300';

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            <Activity className="w-3.5 h-3.5 text-[#10a37f]" />
            SOLO 运行诊断
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{run.id}</div>
        </div>
        <div className={`shrink-0 px-2.5 py-1 rounded-full text-xs border ${statusTone}`}>
          {formatStatus(run.status)}
        </div>
      </div>
      <div className="grid grid-cols-5 divide-x divide-zinc-200 dark:divide-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
        {stats.map((item) => (
          <div key={item.label} className="px-3 py-3 min-w-0">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-500">{item.label}</div>
            <div className="mt-1 text-xs font-mono text-zinc-900 dark:text-zinc-100 truncate" title={item.value}>{item.value}</div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-x-4 gap-y-1">
        <div>开始：<span className="text-zinc-900 dark:text-zinc-100">{formatRunTime(run.started_at)}</span></div>
        {run.case_id ? <div>Case：<span className="font-mono text-zinc-900 dark:text-zinc-100">{run.case_id}</span></div> : null}
        <div className="flex items-center gap-1">
          <History className="w-3.5 h-3.5" />
          Replay Audit
        </div>
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          Healing Trace
        </div>
      </div>
    </div>
  );
}
