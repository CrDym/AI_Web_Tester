import { AlertTriangle, Save, Trash2, XCircle } from 'lucide-react';
import type { ConfirmModalOptions } from '../types';

interface ConfirmModalProps {
  options: ConfirmModalOptions;
  onClose: (ok: boolean) => void;
}

export default function ConfirmModal({ options, onClose }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.16)] w-full max-w-lg p-7 flex flex-col relative overflow-hidden">
        <div className="flex items-start justify-between mb-5 relative z-10">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 p-2 rounded-2xl border ${options.destructive ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-[#13966f]/20 bg-[#13966f]/10 text-[#087653]'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-zinc-900">{options.title}</div>
              {options.description && <div className="text-sm text-zinc-600 mt-1 leading-relaxed">{options.description}</div>}
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="text-zinc-500 hover:text-zinc-900 transition-colors hover:bg-zinc-100 p-2 rounded-full"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-2 flex justify-end gap-3 relative z-10">
          <button
            onClick={() => onClose(false)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all"
          >
            取消
          </button>
          <button
            onClick={() => onClose(true)}
            className={`px-6 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-all ${
              options.destructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#13966f] hover:bg-[#087653]'
            }`}
          >
            {options.destructive ? <Trash2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {options.confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}
