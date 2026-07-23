import { Pencil, Save, XCircle } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { PromptModalOptions } from '../types';

interface PromptModalProps {
  options: PromptModalOptions;
  value: string;
  onValueChange: (value: string) => void;
  onClose: (value: string | null) => void;
}

export default function PromptModal({ options, value, onValueChange, onClose }: PromptModalProps) {
  const submit = () => {
    const next = value.trim();
    onClose(next ? next : '');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.16)] w-full max-w-xl p-8 flex flex-col relative overflow-hidden">
        <div className="flex items-start justify-between mb-6 relative z-10">
          <div>
            <div className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#13966f]" />
              {options.title}
            </div>
            {options.description && <div className="text-sm text-zinc-600 mt-1">{options.description}</div>}
          </div>
          <button
            onClick={() => onClose(null)}
            className="text-zinc-500 hover:text-zinc-900 transition-colors hover:bg-zinc-100 p-2 rounded-full"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 relative z-10">
          <input
            type="text"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-3 text-base text-zinc-900 focus:outline-none focus:border-[#13966f]/50 focus:ring-2 focus:ring-[#13966f]/15 transition-all placeholder:text-zinc-400"
            placeholder={options.placeholder || ''}
            autoFocus
          />
        </div>

        <div className="mt-8 flex justify-end gap-3 relative z-10">
          <button
            onClick={() => onClose(null)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all"
          >
            取消
          </button>
          <button
            onClick={submit}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[#13966f] hover:bg-[#087653] flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {options.confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}
