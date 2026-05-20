import type { RefObject } from 'react';
import { Terminal } from 'lucide-react';
import { getLogTone } from '../utils/runUi';

type Props = {
  items: string[];
  emptyText: string;
  endRef?: RefObject<HTMLDivElement | null>;
};

export default function LogStream({ items, emptyText, endRef }: Props) {
  return (
    <div className="flex-1 overflow-auto p-4 bg-transparent font-mono text-[13px] leading-relaxed custom-scrollbar">
      {items.length === 0 ? (
        <div className="h-full min-h-[96px] flex items-center justify-center text-center">
          <div>
            <div className="mx-auto mb-2 w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{emptyText}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((log, i) => {
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
      {endRef ? <div ref={endRef} /> : null}
    </div>
  );
}
