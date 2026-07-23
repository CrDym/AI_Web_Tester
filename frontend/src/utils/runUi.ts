import type { FailureReason } from '../types';

export type LogKind = 'error' | 'warning' | 'ai' | 'success' | 'normal';

export const getFailureLabel = (reason?: FailureReason | null) => reason?.label || reason?.category || '未知失败';

export const getFailureSeverityClass = (severity?: string | null) => {
  switch ((severity || '').toLowerCase()) {
    case 'high': return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-200';
    case 'medium': return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200';
    default: return 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';
  }
};

export const getFailureSeverityTone = (severity?: string | null) => {
  switch ((severity || '').toLowerCase()) {
    case 'high': return {
      card: 'border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-white shadow-[0_18px_45px_rgba(225,29,72,0.08)] dark:border-rose-500/30 dark:from-rose-950/30 dark:via-zinc-950 dark:to-zinc-950',
      icon: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/25',
      badge: 'border-rose-200 bg-white/80 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
      code: 'border-rose-100 bg-white/70 text-rose-900 dark:border-rose-500/20 dark:bg-black/20 dark:text-rose-100',
    };
    case 'medium': return {
      card: 'border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-white shadow-[0_18px_45px_rgba(217,119,6,0.08)] dark:border-amber-500/30 dark:from-amber-950/30 dark:via-zinc-950 dark:to-zinc-950',
      icon: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25',
      badge: 'border-amber-200 bg-white/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
      code: 'border-amber-100 bg-white/70 text-amber-900 dark:border-amber-500/20 dark:bg-black/20 dark:text-amber-100',
    };
    default: return {
      card: 'border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-white shadow-[0_18px_45px_rgba(24,24,27,0.05)] dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950',
      icon: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
      badge: 'border-zinc-200 bg-white/80 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
      code: 'border-zinc-200 bg-white/70 text-zinc-700 dark:border-zinc-700 dark:bg-black/20 dark:text-zinc-200',
    };
  }
};

export const getLogKind = (log: string): LogKind => {
  const lower = log.toLowerCase();
  if (log.includes('❌') || log.includes('FAILED') || lower.includes('error')) return 'error';
  if (log.includes('🚑') || log.includes('⚠️') || lower.includes('warning')) return 'warning';
  if (log.includes('🤖') || log.includes('✨')) return 'ai';
  if (log.includes('✅')) return 'success';
  return 'normal';
};

export const getLogTone = (log: string) => {
  const kind = getLogKind(log);
  if (kind === 'success') return { icon: '✓', text: 'text-emerald-700 dark:text-emerald-300', iconWrap: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25' };
  if (kind === 'error') return { icon: '×', text: 'text-rose-700 dark:text-rose-300', iconWrap: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25' };
  if (kind === 'warning') return { icon: '!', text: 'text-amber-700 dark:text-amber-300', iconWrap: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25' };
  if (kind === 'ai') return { icon: 'AI', text: 'text-[#087653] dark:text-[#13966f]', iconWrap: 'bg-[#13966f]/10 text-[#087653] border-[#13966f]/20 dark:bg-[#13966f]/15 dark:text-[#13966f] dark:border-[#13966f]/25' };
  if (log.includes('🛑')) return { icon: '■', text: 'text-zinc-700 dark:text-zinc-300', iconWrap: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' };
  return { icon: '›', text: 'text-zinc-700 dark:text-zinc-300', iconWrap: 'bg-zinc-50 text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800' };
};
