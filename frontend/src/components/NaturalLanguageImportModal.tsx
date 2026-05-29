import { Check, FileJson, RotateCw, Terminal, XCircle } from 'lucide-react';
import type { NaturalLanguageImportItem } from '../types';

interface NaturalLanguageImportModalProps {
  text: string;
  group: string;
  startUrl: string;
  items: NaturalLanguageImportItem[];
  selected: number[];
  loading: boolean;
  error: string;
  onTextChange: (text: string) => void;
  onGroupChange: (group: string) => void;
  onStartUrlChange: (startUrl: string) => void;
  onSelectedChange: (selected: number[]) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPreview: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function NaturalLanguageImportModal({
  text,
  group,
  startUrl,
  items,
  selected,
  loading,
  error,
  onTextChange,
  onGroupChange,
  onStartUrlChange,
  onSelectedChange,
  onFileChange,
  onPreview,
  onConfirm,
  onClose,
}: NaturalLanguageImportModalProps) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.18)] w-full max-w-6xl h-[82vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
              <div className="p-2 bg-[#10a37f]/10 rounded-xl border border-[#10a37f]/20">
                <FileJson className="w-5 h-5 text-[#10a37f]" />
              </div>
              导入自然语言用例
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 pl-12">批量粘贴测试场景，AI 会拆分为可导入的结构化用例。</p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 p-2 rounded-full disabled:opacity-50">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.05fr] gap-0 min-h-0 flex-1">
          <div className="p-6 border-r border-zinc-200 dark:border-zinc-800 min-h-0 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">默认分组</label>
                <input value={group} onChange={(e) => onGroupChange(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#10a37f]/50" placeholder="导入用例" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">默认起始 URL</label>
                <input value={startUrl} onChange={(e) => onStartUrlChange(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#10a37f]/50" placeholder="可选" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">支持粘贴测试文档、测试点、Markdown 列表。</div>
              <label className="cursor-pointer shrink-0 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900">
                上传 txt/md
                <input type="file" accept=".txt,.md,.markdown" className="hidden" onChange={onFileChange} />
              </label>
            </div>
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              className="flex-1 min-h-[260px] resize-none bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none focus:border-[#10a37f]/50 custom-scrollbar leading-relaxed"
              placeholder={`示例：\n模块：登录\n用例：手机号验证码登录成功\n步骤：\n1. 打开登录页\n2. 输入手机号 13800138000\n3. 点击获取验证码\n4. 输入验证码 260507\n5. 点击登录\n预期结果：进入首页并显示用户昵称`}
            />
          </div>

          <div className="p-6 min-h-0 flex flex-col gap-4 bg-zinc-50/70 dark:bg-black/30">
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">解析预览</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">确认前不会写入用例库。</div>
              </div>
              <button onClick={onPreview} disabled={loading || !text.trim()} className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                AI 解析
              </button>
            </div>

            {error ? <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 shrink-0">{error}</div> : null}

            <div className="grid grid-cols-3 gap-2 shrink-0">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2"><div className="text-[10px] text-zinc-500">识别用例</div><div className="text-lg font-semibold">{items.length}</div></div>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2"><div className="text-[10px] text-zinc-500">可导入</div><div className="text-lg font-semibold text-[#0e8a6a]">{items.filter((i) => i.valid).length}</div></div>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2"><div className="text-[10px] text-zinc-500">已选择</div><div className="text-lg font-semibold">{selected.length}</div></div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar space-y-2 pr-1">
              {items.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-zinc-500 dark:text-zinc-400 text-center">粘贴自然语言用例后点击“AI 解析”查看导入预览</div>
              ) : items.map((item) => {
                const isSelected = selected.includes(item.index);
                return (
                  <div key={item.index} className={`rounded-2xl border bg-white dark:bg-zinc-950 p-4 ${item.valid ? 'border-zinc-200 dark:border-zinc-800' : 'border-rose-200 dark:border-rose-500/30'}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={isSelected} disabled={!item.valid} onChange={(e) => onSelectedChange(e.target.checked ? [...selected, item.index] : selected.filter((x) => x !== item.index))} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{item.case.name}</div>
                          <span className="shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">{item.case.group_name || '未分组'}</span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">步骤 {item.case.steps?.length || 0} · 变量 {Object.keys(item.case.variables || {}).length} · 断言 {(item.case.steps || []).filter((s) => s.type === 'assert').length}</div>
                        {item.errors.length > 0 ? <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">{item.errors.join('；')}</div> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} disabled={loading} className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all disabled:opacity-50">取消</button>
          <button onClick={onConfirm} disabled={loading || selected.length === 0} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[#10a37f] hover:bg-[#0e8a6a] flex items-center gap-2 transition-all disabled:opacity-50">
            {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            确认导入 {selected.length} 条
          </button>
        </div>
      </div>
    </div>
  );
}
