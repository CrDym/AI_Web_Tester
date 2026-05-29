import type { CaseDoc, CaseStep, StepType } from '../types';

interface CaseStepEditorProps {
  caseDoc: CaseDoc;
  onCaseDocChange: (caseDoc: CaseDoc) => void;
  onUpdateStep: (idx: number, patch: Partial<CaseStep>) => void;
  onRemoveStep: (idx: number) => void;
  onDuplicateStep: (idx: number) => void;
  onMoveStep: (idx: number, dir: 'up' | 'down') => void;
}

export default function CaseStepEditor({
  caseDoc,
  onCaseDocChange,
  onUpdateStep,
  onRemoveStep,
  onDuplicateStep,
  onMoveStep,
}: CaseStepEditorProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-2 items-center">
        <div className="col-span-1 text-xs text-zinc-500">起始URL</div>
        <input
          value={caseDoc.start_url || ''}
          onChange={(e) => onCaseDocChange({ ...caseDoc, start_url: e.target.value })}
          placeholder="可选：运行前先 page.goto(...)"
          className="col-span-5 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15"
        />
      </div>
      <div className="text-xs text-zinc-500">步骤</div>
      <div className="space-y-2">
        {caseDoc.steps.map((s, idx) => (
          <div key={idx} className={`rounded-xl border border-zinc-200 bg-white p-4 space-y-3 shadow-sm hover:bg-zinc-50 transition-colors ${s.disabled ? 'opacity-50 grayscale' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-400 font-mono">步骤 {idx + 1}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => onMoveStep(idx, 'up')} disabled={idx === 0} className="text-xs text-zinc-500 hover:text-[#0e8a6a] disabled:opacity-30">↑</button>
                <button onClick={() => onMoveStep(idx, 'down')} disabled={idx === caseDoc.steps.length - 1} className="text-xs text-zinc-500 hover:text-[#0e8a6a] disabled:opacity-30">↓</button>
                <button onClick={() => onDuplicateStep(idx)} className="text-xs text-[#0e8a6a] hover:text-[#0e8a6a]">复制</button>
                <button onClick={() => onUpdateStep(idx, { disabled: !s.disabled })} className="text-xs text-zinc-500 hover:text-[#0e8a6a]">{s.disabled ? '启用' : '禁用'}</button>
                <button onClick={() => onRemoveStep(idx)} className="text-xs text-rose-700 hover:text-rose-800">删除</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={s.type}
                onChange={(e) => onUpdateStep(idx, { type: e.target.value as StepType })}
                className="bg-white border border-zinc-200 rounded-xl px-2 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50"
              >
                <option value="click">点击</option>
                <option value="input">输入</option>
                <option value="wait">等待</option>
                <option value="assert">断言</option>
                <option value="hover">悬停</option>
                <option value="select_option">选择选项</option>
                <option value="set_checked">勾选/取消勾选</option>
                <option value="double_click">双击</option>
                <option value="right_click">右键</option>
                <option value="press_key">按键</option>
                <option value="scroll">滚动</option>
              </select>
              {s.type === 'assert' ? (
                <select
                  value={s.assert_type || 'text'}
                  onChange={(e) => onUpdateStep(idx, { assert_type: e.target.value as CaseStep['assert_type'] })}
                  className="col-span-2 bg-white border border-zinc-200 rounded-xl px-2 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50"
                >
                  <option value="text">页面包含文本</option>
                  <option value="url">URL 包含</option>
                  <option value="visible">元素可见</option>
                </select>
              ) : (
                <input
                  value={s.intent || ''}
                  onChange={(e) => onUpdateStep(idx, { intent: e.target.value })}
                  className="col-span-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50"
                  placeholder="意图（建议写清楚，如：点击登录按钮）"
                />
              )}
            </div>
            {(!s.type || !['wait', 'scroll', 'press_key'].includes(s.type) || (s.type === 'assert' && s.assert_type === 'visible')) ? (
              <input
                value={s.selector || ''}
                onChange={(e) => onUpdateStep(idx, { selector: e.target.value })}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50 font-mono"
                placeholder="selector（Playwright 支持）"
              />
            ) : null}
            {(['input', 'wait', 'select_option', 'set_checked', 'press_key', 'scroll'].includes(s.type || '') || (s.type === 'assert' && s.assert_type !== 'visible')) ? (
              <input
                value={s.value === undefined || s.value === null ? '' : String(s.value)}
                onChange={(e) => onUpdateStep(idx, { value: e.target.value })}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50 font-mono"
                placeholder={
                  s.type === 'wait' ? '等待毫秒数，例如 1000' :
                  s.type === 'scroll' ? '滚动方向 (up/down)' :
                  s.type === 'press_key' ? '按键名称 (如 Enter, Escape)' :
                  s.type === 'select_option' ? '选项的 value 或 text' :
                  s.type === 'set_checked' ? 'true / false' :
                  s.type === 'assert' ? '预期包含的内容' : '输入值'
                }
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
