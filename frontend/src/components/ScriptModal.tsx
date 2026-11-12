import { useEffect, useState } from 'react';
import { Loader2, PencilLine, RefreshCw, RotateCw, Save, XCircle } from 'lucide-react';
import CodeBlock from './CodeBlock';

type Props = {
  open: boolean;
  caseName: string;
  scriptContent: string;
  loadingScript: boolean;
  source?: 'custom' | 'generated' | null;
  onClose: () => void;
  onRegenerate?: () => void;
  onCopy: (text: string) => void;
  copied: boolean;
  onSave?: (content: string) => void;
  saving?: boolean;
  saveError?: string | null;
  onResetToGenerated?: () => void;
  resetting?: boolean;
};

/** 生成脚本大弹窗：占据全屏 90%，代码高亮，独立打开不受左栏宽度限制 */
export default function ScriptModal({
  open,
  caseName,
  scriptContent,
  loadingScript,
  source,
  onClose,
  onRegenerate,
  onCopy,
  copied,
  onSave,
  saving,
  saveError,
  onResetToGenerated,
  resetting,
}: Props) {
  const editable = !!onSave;
  const [draft, setDraft] = useState<string>('');
  const [editing, setEditing] = useState(false);

  // 打开时同步最新脚本内容；内容变化（如重新生成）也同步
  useEffect(() => {
    if (open) {
      setDraft(scriptContent);
      setEditing(false);
    }
  }, [open, scriptContent]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  const dirty = editing && draft !== scriptContent;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.35)] w-[92vw] h-[92vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#f7faf8] dark:bg-zinc-900/70 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="px-2.5 py-1 rounded-lg bg-[#13966f]/10 text-[#13966f] dark:text-emerald-400 text-xs font-semibold font-mono">
              Python
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                生成脚本
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate font-mono">
                {caseName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono mr-2 hidden sm:inline">
              {scriptContent ? `${draft.split('\n').length} 行` : ''}
            </span>
            {editable && editing && (
              <button
                onClick={() => { onSave?.(draft); setEditing(false); }}
                disabled={saving || !dirty}
                className="px-2.5 py-1.5 rounded-xl bg-[#13966f] text-white text-xs font-medium hover:bg-[#0f7a5b] transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                保存脚本
              </button>
            )}
            {editable && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
              >
                <PencilLine className="w-3.5 h-3.5" />
                编辑
              </button>
            )}
            {source === 'custom' && onResetToGenerated && !editing && (
              <button
                onClick={onResetToGenerated}
                disabled={resetting || saving}
                className="px-2.5 py-1.5 rounded-xl border border-violet-300 dark:border-violet-500/40 text-xs text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                恢复自动生成
              </button>
            )}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={loadingScript}
                className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loadingScript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                重新生成
              </button>
            )}
            <button
              onClick={() => onCopy(scriptContent)}
              className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {copied ? '已复制' : '复制代码'}
            </button>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1.5 rounded-full"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 代码区 */}
        <div className="flex-1 overflow-auto px-6 py-5 custom-scrollbar bg-white dark:bg-zinc-950">
          {loadingScript ? (
            <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在加载脚本...
            </div>
          ) : editing && editable ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="w-full h-full min-h-0 bg-transparent text-[13.5px] leading-relaxed font-mono text-zinc-800 dark:text-zinc-200 outline-none resize-none custom-scrollbar"
            />
          ) : scriptContent ? (
            <CodeBlock
              code={scriptContent}
              language="python"
              className="text-[13.5px] leading-relaxed font-mono"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400 text-sm italic">
              暂无脚本内容
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-5 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 dark:text-zinc-500 shrink-0 flex items-center justify-between">
          <span>
            {saveError
              ? <span className="text-rose-600 dark:text-rose-400">保存失败：{saveError}</span>
              : editing
                ? '编辑中 — 修改后点击「保存脚本」写回并重新运行生效'
                : dirty
                  ? '有未保存的修改'
                  : source === 'custom'
                    ? '当前为手动修改的脚本（用例步骤改动不会自动同步，可「恢复自动生成」）'
                    : '脚本由用例实时生成，运行时与本页内容保持一致'}
          </span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}
