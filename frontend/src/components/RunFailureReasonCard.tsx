import { AlertTriangle } from 'lucide-react';
import type { FailureReason } from '../types';
import { getFailureLabel, getFailureSeverityTone } from '../utils/runUi';

interface RunFailureReasonCardProps {
  reason?: FailureReason | null;
}

export default function RunFailureReasonCard({ reason }: RunFailureReasonCardProps) {
  if (!reason?.category) return null;

  const tone = getFailureSeverityTone(reason.severity);

  return (
    <div className={`rounded-2xl border p-4 overflow-hidden relative ${tone.card}`}>
      <div className="absolute inset-y-0 left-0 w-1 bg-current opacity-25" />
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-9 h-9 rounded-2xl ring-1 flex items-center justify-center shrink-0 ${tone.icon}`}>
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-5">{getFailureLabel(reason)}</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">系统已根据日志自动识别失败类型</div>
            </div>
            {reason.failed_step_no ? (
              <div className={`shrink-0 text-[11px] px-2 py-1 rounded-full border font-mono ${tone.badge}`}>步骤 {reason.failed_step_no}</div>
            ) : null}
          </div>
          {reason.message ? (
            <div className={`mt-3 rounded-xl border px-3 py-2 text-[11px] font-mono break-words leading-relaxed ${tone.code}`}>{reason.message}</div>
          ) : null}
          {reason.suggestion ? (
            <div className="mt-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">建议：</span>{reason.suggestion}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
