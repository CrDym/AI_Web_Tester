import type { TokenUsage } from '../types';

export const formatRunTime = (ts?: number | null) => {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

export const formatRunDate = (ts?: number | null) => {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
};

export const formatTokenUsage = (u?: TokenUsage | null) => {
  if (!u) return '';
  const t = u.total_tokens ?? 0;
  const p = u.prompt_tokens ?? 0;
  const c = u.completion_tokens ?? 0;
  if (!t && !p && !c) return '';
  return `${t} (P${p}/C${c})`;
};

export const formatStatus = (status: string | undefined | null) => {
  if (!status) return '';
  switch (status.toLowerCase()) {
    case 'completed': return '已完成';
    case 'failed': return '执行失败';
    case 'running': return '运行中';
    case 'stopped': return '已停止';
    case 'timeout': return '已超时';
    case 'pending': return '等待中';
    default: return status;
  }
};

export const formatShotTime = (ms?: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};
