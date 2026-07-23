import { Loader2, MonitorPlay, RotateCw, Terminal } from 'lucide-react';
import type { RefObject } from 'react';
import LogStream from './LogStream';
import type { SuiteRunDetail, SuiteRunItem, TestCase } from '../types';
import { formatStatus } from '../utils/formatters';

interface SuiteRunVM {
  caseIds: string[];
  itemByCaseId: Map<string, SuiteRunItem>;
  total: number;
  doneCount: number;
  progressPct: number;
  currentCaseId: string | null;
}

interface SuiteRunDetailPanelProps {
  selectedSuiteRun: SuiteRunDetail;
  suiteRunVM: SuiteRunVM | null;
  cases: TestCase[];
  suiteLogs: string[];
  suiteLogsEndRef: RefObject<HTMLDivElement | null>;
  suiteScreenshot: string | null;
  onBack: () => void;
  openSuiteRunItem: (item: SuiteRunItem) => void;
}

export default function SuiteRunDetailPanel({
  selectedSuiteRun,
  suiteRunVM,
  cases,
  suiteLogs,
  suiteLogsEndRef,
  suiteScreenshot,
  onBack,
  openSuiteRunItem,
}: SuiteRunDetailPanelProps) {
  return (
          <>
            <div className="h-14 border-b border-zinc-200 bg-white px-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex flex-col leading-tight">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-zinc-900 truncate max-w-[520px]">{selectedSuiteRun.suite_name}</div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      (selectedSuiteRun.status || '') === 'completed' ? 'border-emerald-500/50 text-emerald-500' :
                      (selectedSuiteRun.status || '') === 'failed' ? 'border-rose-500/50 text-rose-500' : 'border-amber-500/50 text-amber-500'
                    }`}>
                      {formatStatus(selectedSuiteRun.status)}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-zinc-200 text-zinc-600">
                      {suiteRunVM?.doneCount || 0}/{suiteRunVM?.total || 0}
                    </span>
                    {selectedSuiteRun.status === 'running' && suiteRunVM?.currentCaseId && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#13966f]/25 text-[#087653] bg-[#13966f]/10 truncate max-w-[260px]">
                        当前：{suiteRunVM.currentCaseId}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">SuiteRunID: {selectedSuiteRun.id}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border border-zinc-200"
                >
                  返回
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {suiteRunVM && (
                <div className="mb-6">
                  <div className="h-2 rounded-full bg-zinc-200 overflow-hidden">
                    <div
                      className="h-full bg-[#13966f]"
                      style={{ width: `${suiteRunVM.progressPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                    <div>{suiteRunVM.progressPct}%</div>
                    <div>{suiteRunVM.doneCount}/{suiteRunVM.total} 已完成</div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-5 gap-3 mb-6">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">总用例</div>
                  <div className="text-2xl font-semibold text-zinc-900 mt-1">{suiteRunVM?.total || 0}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">通过</div>
                  <div className="text-2xl font-semibold text-emerald-500 mt-1">{selectedSuiteRun.summary?.passed || 0}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">失败</div>
                  <div className="text-2xl font-semibold text-rose-500 mt-1">{selectedSuiteRun.summary?.failed || 0}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">自愈次数</div>
                  <div className="text-2xl font-semibold text-[#13966f] mt-1">{selectedSuiteRun.summary?.heal_total || 0}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Token消耗</div>
                  <div className="text-2xl font-semibold text-zinc-900 mt-1">{selectedSuiteRun.summary?.token_total || 0}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
                <div className="px-4 py-3 bg-white border-b border-zinc-200 text-sm font-semibold text-zinc-900">
                  用例明细
                </div>
                <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] text-zinc-500 flex items-center gap-3">
                  <div className="w-8 font-mono">#</div>
                  <div className="flex-1 min-w-0">用例</div>
                  <div className="w-20 text-right">耗时</div>
                  <div className="w-16 text-right">自愈</div>
                  <div className="w-20 text-right font-mono">Token消耗</div>
                  <div className="w-16 text-right">状态</div>
                  <div className="w-[92px] text-right">操作</div>
                </div>
                <div className="divide-y divide-zinc-200">
                  {(suiteRunVM?.caseIds || []).map((cid, idx) => {
                    const it = suiteRunVM?.itemByCaseId.get(cid);
                    const status = it?.status || 'pending';
                    const durationText = it?.duration_ms ? `${Math.round((it.duration_ms || 0) / 1000)}s` : (status === 'running' ? '...' : '-');
                    const healText = typeof it?.heal_count === 'number' ? String(it.heal_count) : (status === 'running' ? '...' : '0');
                    const tokenText = it?.token_usage ? String(it.token_usage.total_tokens || 0) : (status === 'running' ? '...' : '0');
                    const statusColor = status === 'completed'
                      ? 'text-emerald-500'
                      : status === 'failed'
                        ? 'text-rose-500'
                        : status === 'running'
                          ? 'text-amber-500'
                          : 'text-zinc-500';
                    const canOpen = !!it?.run_id && (status === 'completed' || status === 'failed' || status === 'stopped' || status === 'timeout');
                    return (
                      <div key={`${cid}_${idx}`} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-zinc-50 transition-colors">
                        <div className="w-8 text-xs text-zinc-500 font-mono">{String(idx + 1).padStart(2, '0')}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-zinc-900 truncate flex items-center gap-2">
                            {cases.find((c) => c.id === cid)?.name || cid}
                            {selectedSuiteRun?.setup_case_id && cid === selectedSuiteRun.setup_case_id && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#13966f]/25 text-[#087653] bg-[#13966f]/10 shrink-0">
                                前置
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate">{it?.run_id ? `运行ID: ${it.run_id}` : cid}</div>
                        </div>
                        <div className="text-xs text-zinc-500 w-20 text-right">{durationText}</div>
                        <div className="text-xs text-zinc-500 w-16 text-right">{healText}</div>
                        <div className="text-xs text-zinc-500 w-20 text-right font-mono">{tokenText}</div>
                        <div className={`text-xs w-16 text-right ${statusColor}`}>
                          {status === 'running' ? (
                            <span className="inline-flex items-center gap-1 justify-end w-full">
                              <RotateCw className="w-3 h-3 animate-spin" /> {formatStatus('running')}
                            </span>
                          ) : formatStatus(status)}
                        </div>
                        <button
                          onClick={() => it && openSuiteRunItem(it)}
                          disabled={!canOpen}
                          className="text-xs px-3 py-1.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed w-[92px] text-center"
                        >
                          查看回放
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 实时监控面板（当有正在执行的用例时显示） */}
              {selectedSuiteRun.status === 'running' && (
                <div className="mt-6 flex h-[400px] rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
                  {/* Logs */}
                  <div className="w-1/3 flex flex-col border-r border-zinc-200 dark:border-zinc-800 min-h-0 bg-zinc-50 dark:bg-black">
                    <div className="px-4 py-2.5 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
                          <Terminal className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span>实时日志</span>
                          <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500">Suite stream</span>
                        </div>
                      </div>
                      <span className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-[10px] font-mono font-medium text-zinc-500 dark:text-zinc-400">
                        {suiteLogs.length} lines
                      </span>
                    </div>
                    <LogStream items={suiteLogs} emptyText="等待套件执行日志输出" endRef={suiteLogsEndRef} />
                  </div>
                  {/* Screenshot */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="px-4 py-2 text-xs font-semibold text-zinc-600 border-b border-zinc-200 flex items-center gap-2 shrink-0">
                      <MonitorPlay className="w-3.5 h-3.5" /> 实时视觉监控
                    </div>
                    <div className="flex-1 p-4 flex items-center justify-center overflow-hidden bg-[#f7f7f8] relative min-h-0">
                      {suiteScreenshot ? (
                        <div className="relative group rounded-xl shadow-[0_18px_50px_rgba(0,0,0,0.14)] border border-zinc-200 w-full h-full flex items-center justify-center bg-white overflow-hidden">
                          <img src={`data:image/jpeg;base64,${suiteScreenshot}`} alt="Current Screen" className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div className="text-zinc-500 flex flex-col items-center gap-2 relative z-10">
                          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                          等待测试画面...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>

  );
}
