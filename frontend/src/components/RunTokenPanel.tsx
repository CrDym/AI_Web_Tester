import type { RunDetail } from '../types';
import { formatTokenUsage } from '../utils/formatters';

interface RunTokenPanelProps {
  run: RunDetail;
}

export default function RunTokenPanel({ run }: RunTokenPanelProps) {
  const events = run.token_summary?.tests?.[0]?.llm_events || [];

  return (
    <div className="pt-3 border-t border-zinc-200">
      <div className="text-xs font-semibold text-zinc-500 mb-2">
        Token 明细（{events.length}）
      </div>
      {events.length === 0 ? (
        <div className="text-xs text-zinc-500">本次运行未记录到 Token 明细</div>
      ) : (
        <div className="space-y-1 max-h-40 overflow-auto pr-1">
          {events.slice(-30).reverse().map((ev, i: number) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] text-zinc-500 font-mono truncate">{ev.kind || 'llm'}</div>
                <div className="text-[10px] text-zinc-500 font-mono shrink-0">{formatTokenUsage(ev.token_usage)}</div>
              </div>
              {ev.message ? (
                <div className="text-[10px] text-zinc-600 truncate break-words whitespace-pre-wrap mt-1 leading-relaxed">{ev.message}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
