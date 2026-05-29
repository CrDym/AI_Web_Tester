import { Play, RotateCw, Save, Trash2 } from 'lucide-react';
import type { EnvConfig, SuiteDoc, SuiteRunSummary, TestCase } from '../types';
import { formatRunTime, formatStatus } from '../utils/formatters';

interface SuiteEditorPanelProps {
  suiteDoc: SuiteDoc;
  cases: TestCase[];
  envs: EnvConfig[];
  isSuiteDirty: boolean;
  suiteAddCaseId: string;
  suiteAvailableCases: TestCase[];
  suiteRuns: SuiteRunSummary[];
  suiteRunsLoading: boolean;
  selectedSuiteRunId: string | null;
  onSuiteDocChange: (suiteDoc: SuiteDoc) => void;
  onSuiteAddCaseIdChange: (caseId: string) => void;
  onSaveSuite: () => void;
  onRunSuite: () => void;
  onAddCase: () => void;
  onMoveCase: (idx: number, dir: 'up' | 'down') => void;
  onRemoveCase: (caseId: string) => void;
  onRefreshRuns: (suiteId: string) => void;
  onOpenRun: (runId: string) => void;
  onDeleteRun: (e: React.MouseEvent, runId: string) => void;
}

export default function SuiteEditorPanel({
  suiteDoc,
  cases,
  envs,
  isSuiteDirty,
  suiteAddCaseId,
  suiteAvailableCases,
  suiteRuns,
  suiteRunsLoading,
  selectedSuiteRunId,
  onSuiteDocChange,
  onSuiteAddCaseIdChange,
  onSaveSuite,
  onRunSuite,
  onAddCase,
  onMoveCase,
  onRemoveCase,
  onRefreshRuns,
  onOpenRun,
  onDeleteRun,
}: SuiteEditorPanelProps) {
  return (
    <>
      <div className="h-14 border-b border-zinc-200 bg-white px-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-zinc-900 truncate max-w-[520px]">{suiteDoc.name}</div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${isSuiteDirty ? 'border-amber-500 text-amber-600' : 'border-zinc-200 text-zinc-600'}`}>
                {isSuiteDirty ? '未保存' : '已保存'}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-zinc-200 text-zinc-600">
                {suiteDoc.case_ids?.length || 0} cases
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">SuiteID: {suiteDoc.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={suiteDoc.env_id || ''}
            onChange={(e) => onSuiteDocChange({ ...suiteDoc, env_id: e.target.value })}
            className="bg-white border border-zinc-200 rounded-xl px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-[#10a37f]/50"
          >
            <option value="">默认环境</option>
            {envs.map((env) => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>
          <button
            onClick={onSaveSuite}
            disabled={!isSuiteDirty}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
              !isSuiteDirty
                ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                : 'bg-[#10a37f] hover:bg-[#0e8a6a] text-white border-transparent'
            }`}
          >
            <Save className="w-4 h-4" /> 保存套件
          </button>
          <button
            onClick={onRunSuite}
            className="flex items-center gap-2 bg-[#10a37f] hover:bg-[#0e8a6a] text-white px-5 py-1.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Play className="w-4 h-4 fill-current" /> 运行套件
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900 mb-3">前置用例（可选）</div>
          <div className="flex items-center gap-3">
            <select
              value={suiteDoc.setup_case_id || ''}
              onChange={(e) => {
                const next = e.target.value || null;
                const nextCaseIds = next ? (suiteDoc.case_ids || []).filter((x) => x !== next) : (suiteDoc.case_ids || []);
                onSuiteDocChange({ ...suiteDoc, setup_case_id: next, case_ids: nextCaseIds });
              }}
              className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50"
            >
              <option value="">无（每个用例自己处理登录）</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-zinc-500 mt-2">运行套件时会先执行该用例，并把登录态（cookie）共享给后续用例；前置用例失败将终止本次套件运行。</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900 mb-3">添加用例到套件</div>
          <div className="flex items-center gap-3">
            <select
              value={suiteAddCaseId}
              onChange={(e) => onSuiteAddCaseIdChange(e.target.value)}
              className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50"
            >
              <option value="">选择一个用例...</option>
              {suiteAvailableCases.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={onAddCase}
              disabled={!suiteAddCaseId}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                !suiteAddCaseId
                  ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                  : 'bg-white hover:bg-zinc-100 text-zinc-900 border-zinc-200'
              }`}
            >
              添加
            </button>
          </div>
          <div className="text-xs text-zinc-500 mt-2">套件内不允许重复用例；执行按顺序串行运行，失败继续跑。</div>
        </div>

        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 text-sm font-semibold text-zinc-900 flex items-center justify-between">
            <div>套件用例列表（有序）</div>
            <div className="text-xs text-zinc-500">{suiteDoc.case_ids?.length || 0} items</div>
          </div>
          <div className="divide-y divide-zinc-200">
            {(suiteDoc.case_ids || []).length === 0 ? (
              <div className="p-6 text-sm text-zinc-500">暂无用例，先从上方添加。</div>
            ) : (
              (suiteDoc.case_ids || []).map((cid, idx) => (
                <div key={cid} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-zinc-50 transition-colors">
                  <div className="w-8 text-xs text-zinc-500 font-mono">{String(idx + 1).padStart(2, '0')}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-900 truncate">{cases.find((c) => c.id === cid)?.name || cid}</div>
                    <div className="text-[11px] text-zinc-500 font-mono truncate">{cid}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onMoveCase(idx, 'up')}
                      disabled={idx === 0}
                      className="text-xs text-zinc-500 hover:text-[#0e8a6a] disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-zinc-100"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => onMoveCase(idx, 'down')}
                      disabled={idx === (suiteDoc.case_ids || []).length - 1}
                      className="text-xs text-zinc-500 hover:text-[#0e8a6a] disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-zinc-100"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => onRemoveCase(cid)}
                      className="text-xs text-rose-700 hover:text-rose-800 px-2 py-1 rounded-lg hover:bg-rose-50"
                    >
                      移除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 text-sm font-semibold text-zinc-900 flex items-center justify-between">
            <div>套件运行历史</div>
            <button
              onClick={() => onRefreshRuns(suiteDoc.id)}
              disabled={suiteRunsLoading}
              className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
              title="刷新"
            >
              <RotateCw className={`w-4 h-4 ${suiteRunsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="divide-y divide-zinc-200">
            {suiteRunsLoading ? (
              <div className="p-6 text-sm text-zinc-500">加载中...</div>
            ) : suiteRuns.length === 0 ? (
              <div className="p-6 text-sm text-zinc-500">暂无套件运行记录</div>
            ) : (
              suiteRuns.map((r) => (
                <div
                  key={r.id}
                  onClick={() => onOpenRun(r.id)}
                  className={`cursor-pointer flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-zinc-50 transition-colors group ${
                    selectedSuiteRunId === r.id ? 'bg-[#10a37f]/10' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-zinc-900 truncate">{formatRunTime(r.started_at)} · {formatStatus(r.status || '')}</div>
                    <div className="text-[11px] text-zinc-500 font-mono truncate">{r.id}</div>
                  </div>
                  <div className="text-xs text-zinc-500 shrink-0 flex flex-col items-end gap-1">
                    <div>{r.summary?.passed || 0}/{r.summary?.total || 0} · heal {r.summary?.heal_total || 0} · tok {r.summary?.token_total || 0}</div>
                    <button
                      onClick={(e) => onDeleteRun(e, r.id)}
                      className="text-zinc-400 hover:text-rose-700 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-md hover:bg-rose-50"
                      title="删除该记录"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
