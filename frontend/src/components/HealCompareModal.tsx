import { Activity, Loader2, XCircle } from 'lucide-react';
import type { HealEvent } from '../types';

interface HealCompareModalProps {
  event: HealEvent;
  images: { before: string | null; after: string | null };
  loading: boolean;
  onClose: () => void;
  onOpenImage: (b64: string, title: string) => void;
}

export default function HealCompareModal({
  event,
  images,
  loading,
  onClose,
  onOpenImage,
}: HealCompareModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-7xl h-[85vh] flex flex-col shadow-[0_18px_60px_rgba(0,0,0,0.35)] overflow-hidden relative">
        <div className="p-4 border-b border-zinc-200 flex justify-between items-start bg-white shrink-0">
          <div className="flex-1 mr-8">
            <h3 className="text-lg text-zinc-900 font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#13966f]" />
              自愈记录审计: {event.intent || '未知意图'}
            </h3>
            <div className="text-[13px] text-zinc-600 mt-2 flex flex-col gap-1.5 font-mono bg-zinc-50 p-3 rounded-lg border border-zinc-200">
              <div className="flex items-start gap-2">
                <span className="text-rose-700 shrink-0 select-none">[-] 旧选择器:</span>
                <span className="line-through decoration-rose-500/40 text-rose-700 break-all">{event.original_selector}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-700 shrink-0 select-none">[+] 新选择器:</span>
                <span className="text-emerald-700 break-all">{event.new_selector || `[ai-id="${event.new_id}"]`}</span>
              </div>
              {event.reason ? (
                <div className="mt-1 pt-1.5 border-t border-zinc-200 text-zinc-600 font-sans text-xs flex gap-2">
                  <span className="shrink-0">决策原因:</span>
                  <span>{event.reason}</span>
                </div>
              ) : null}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900 transition-colors p-2 hover:bg-zinc-100 rounded-full shrink-0"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden bg-zinc-50 p-6 gap-6 relative">
          {loading ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
              <Loader2 className="w-8 h-8 text-[#13966f] animate-spin mb-4" />
              <span className="text-sm text-zinc-600">正在加载高清对比截图...</span>
            </div>
          ) : null}

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
              <span className="text-sm font-medium text-zinc-700">自愈前 (元素定位失败)</span>
            </div>
            <div className="flex-1 relative border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm group">
              {images.before ? (
                <img
                  src={`data:image/jpeg;base64,${images.before}`}
                  className="object-contain w-full h-full p-2 cursor-zoom-in"
                  alt="Before Heal"
                  onClick={() => onOpenImage(images.before as string, '自愈前')}
                />
              ) : !loading ? (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">暂无自愈前截图</div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center shrink-0 w-8">
            <div className="h-full w-px bg-zinc-200"></div>
            <div className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-500 z-10 my-4 shadow-sm">VS</div>
            <div className="h-full w-px bg-zinc-200"></div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-sm font-medium text-zinc-700">自愈后 (AI 寻素并执行成功)</span>
            </div>
            <div className="flex-1 relative border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm group">
              {images.after ? (
                <img
                  src={`data:image/jpeg;base64,${images.after}`}
                  className="object-contain w-full h-full p-2 cursor-zoom-in"
                  alt="After Heal"
                  onClick={() => onOpenImage(images.after as string, '自愈后')}
                />
              ) : !loading ? (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">暂无自愈后截图</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
