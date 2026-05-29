import { Check, FileJson, Folder, FolderOpen, History, ListChecks, Moon, Pencil, Plus, RefreshCw, RotateCw, Settings, SquareTerminal, Sun, Tag, Trash2, XCircle, Search } from 'lucide-react';
import type { Dispatch, MouseEvent, RefObject, SetStateAction } from 'react';
import type { RunSummary, SuiteDoc, SuiteRunDetail, SuiteSummary, TestCase } from '../types';
import { formatRunDate, formatRunTime, formatStatus, formatTokenUsage } from '../utils/formatters';
import { getFailureLabel, getFailureSeverityClass } from '../utils/runUi';

type SidebarNav = 'cases' | 'suites' | 'runs';

interface CaseSidebarProps {
  authUser: string | null;
  theme: 'light' | 'dark';
  sidebarNav: SidebarNav;
  sidebarScrollRef: RefObject<HTMLDivElement | null>;
  caseQuery: string;
  allTags: string[];
  selectedTag: string | null;
  caseSelectMode: boolean;
  selectedCaseIds: string[];
  selectedCaseIdSet: Set<string>;
  caseGroups: Array<[string, TestCase[]]>;
  collapsedGroups: Record<string, boolean>;
  filteredCases: TestCase[];
  selectedCase: TestCase | null;
  suites: SuiteSummary[];
  selectedSuiteId: string | null;
  runSelectMode: boolean;
  selectedRunIds: string[];
  runSource: RunSummary[];
  visibleRuns: RunSummary[];
  runFailureFilter: string;
  runFailureCategories: string[];
  runsLoading: boolean;
  selectedRunId: string | null;
  selectedRunIdSet: Set<string>;
  setTheme: Dispatch<SetStateAction<'light' | 'dark'>>;
  setShowGenerateModal: (value: boolean) => void;
  setShowImportNlModal: (value: boolean) => void;
  scrollSidebarTo: (key: SidebarNav) => void;
  setCaseSelectMode: (value: boolean) => void;
  setSelectedCaseIds: (value: string[]) => void;
  fetchCases: () => void;
  setCaseQuery: (value: string) => void;
  setSelectedTag: (value: string | null) => void;
  handleMoveCasesToGroup: (caseIds: string[], currentGroup?: string) => void;
  setCollapsedGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  toggleCaseSelected: (caseId: string) => void;
  setSelectedSuiteId: (value: string | null) => void;
  setSuiteDoc: (value: SuiteDoc | null) => void;
  setSelectedSuiteRunId: (value: string | null) => void;
  setSelectedSuiteRun: (value: SuiteRunDetail | null) => void;
  setSelectedCase: (value: TestCase | null) => void;
  handleEditTags: (c?: TestCase) => void;
  handleRename: (c?: TestCase) => void;
  handleDeleteCase: (c?: TestCase) => void;
  createSuite: () => void;
  fetchSuites: () => void;
  loadSuite: (suiteId: string) => void;
  deleteSuite: (suiteId: string) => void;
  selectAllVisibleRuns: () => void;
  clearSelectedRuns: () => void;
  handleBatchDeleteRuns: () => void;
  exitRunSelectMode: () => void;
  setRunFailureFilter: (value: string) => void;
  setRunSelectMode: (value: boolean) => void;
  fetchRuns: (caseId: string, currentCase?: TestCase | null) => void;
  fetchAllRuns: () => void;
  toggleRunSelected: (runId: string) => void;
  loadRunDetail: (runId: string, standalone?: boolean) => void;
  handleDeleteRun: (e: MouseEvent, runId: string) => void;
  loadSettings: () => void;
  setShowSettings: (value: boolean) => void;
  logout: () => void;
}

export default function CaseSidebar({
  authUser,
  theme,
  sidebarNav,
  sidebarScrollRef,
  caseQuery,
  allTags,
  selectedTag,
  caseSelectMode,
  selectedCaseIds,
  selectedCaseIdSet,
  caseGroups,
  collapsedGroups,
  filteredCases,
  selectedCase,
  suites,
  selectedSuiteId,
  runSelectMode,
  selectedRunIds,
  runSource,
  visibleRuns,
  runFailureFilter,
  runFailureCategories,
  runsLoading,
  selectedRunId,
  selectedRunIdSet,
  setTheme,
  setShowGenerateModal,
  setShowImportNlModal,
  scrollSidebarTo,
  setCaseSelectMode,
  setSelectedCaseIds,
  fetchCases,
  setCaseQuery,
  setSelectedTag,
  handleMoveCasesToGroup,
  setCollapsedGroups,
  toggleCaseSelected,
  setSelectedSuiteId,
  setSuiteDoc,
  setSelectedSuiteRunId,
  setSelectedSuiteRun,
  setSelectedCase,
  handleEditTags,
  handleRename,
  handleDeleteCase,
  createSuite,
  fetchSuites,
  loadSuite,
  deleteSuite,
  selectAllVisibleRuns,
  clearSelectedRuns,
  handleBatchDeleteRuns,
  exitRunSelectMode,
  setRunFailureFilter,
  setRunSelectMode,
  fetchRuns,
  fetchAllRuns,
  toggleRunSelected,
  loadRunDetail,
  handleDeleteRun,
  loadSettings,
  setShowSettings,
  logout,
}: CaseSidebarProps) {
  return (
<div className="w-[320px] shrink-0 bg-[#f9f9fa] dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col z-20 min-h-0">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-[#f9f9fa] dark:bg-zinc-950">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0">
              <SquareTerminal className="text-[#10a37f] w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight truncate">SOLO 测试</h1>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono tracking-wider uppercase truncate">系统运行中</div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="w-full px-3 py-2 rounded-xl bg-[#10a37f] hover:bg-[#0e8a6a] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              title="使用自然语言生成测试用例"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>NL2Case <span className="text-xs text-white/80 font-normal ml-1">自然语言生成用例</span></span>
            </button>
            <button
              onClick={() => setShowImportNlModal(true)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              title="批量导入自然语言描述的测试用例"
            >
              <FileJson className="w-4 h-4 text-[#10a37f]" />
              <span>导入自然语言用例</span>
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => scrollSidebarTo('cases')}
                className={`h-9 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  sidebarNav === 'cases'
                    ? 'bg-[#10a37f]/10 border-[#10a37f]/20 text-[#0e8a6a]'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                }`}
                title="跳到用例"
              >
                <FileJson className="w-3.5 h-3.5" />
                用例
              </button>
              <button
                onClick={() => scrollSidebarTo('suites')}
                className={`h-9 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  sidebarNav === 'suites'
                    ? 'bg-[#10a37f]/10 border-[#10a37f]/20 text-[#0e8a6a]'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                }`}
                title="跳到套件"
              >
                <SquareTerminal className="w-3.5 h-3.5" />
                套件
              </button>
              <button
                onClick={() => scrollSidebarTo('runs')}
                className={`h-9 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  sidebarNav === 'runs'
                    ? 'bg-[#10a37f]/10 border-[#10a37f]/20 text-[#0e8a6a]'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                }`}
                title="跳到运行历史"
              >
                <History className="w-3.5 h-3.5" />
                历史
              </button>
            </div>
          </div>
        </div>

        <div ref={sidebarScrollRef} className="p-3 flex-1 overflow-y-auto custom-scrollbar min-h-0">
          {sidebarNav === 'cases' && (
            <>
              <div className="mt-4 flex items-center justify-between px-1 mb-2">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  普通用例
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setCaseSelectMode(!caseSelectMode); setSelectedCaseIds([]); }}
                    className={`px-2 py-1 rounded-lg text-[11px] border transition-colors ${caseSelectMode ? 'bg-[#10a37f]/10 border-[#10a37f]/25 text-[#0e8a6a]' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100'}`}
                    title="批量选择用例"
                  >
                    {caseSelectMode ? '取消' : '批量'}
                  </button>
                  <button onClick={fetchCases} className="p-1 hover:bg-zinc-100 rounded-md text-zinc-500 hover:text-zinc-900 transition" title="刷新用例">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mb-3 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={caseQuery}
                    onChange={(e) => setCaseQuery(e.target.value)}
                    placeholder="搜索用例名称 / ID"
                    className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15"
                  />
                </div>

                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      onClick={() => setSelectedTag(null)}
                      className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors border ${!selectedTag ? 'bg-[#10a37f]/10 text-[#0e8a6a] border-[#10a37f]/25' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-transparent'}`}
                    >
                      全部
                    </button>
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                        className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors border ${tag === selectedTag ? 'bg-[#10a37f]/10 text-[#0e8a6a] border-[#10a37f]/25' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-transparent'}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {caseSelectMode && (
                <div className="mb-3 rounded-xl border border-[#10a37f]/20 bg-[#10a37f]/5 p-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-[#0e8a6a]">已选择 {selectedCaseIds.length} 个用例</span>
                  <button
                    onClick={() => handleMoveCasesToGroup(selectedCaseIds)}
                    disabled={selectedCaseIds.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-[#10a37f] text-white text-[11px] disabled:opacity-40"
                  >
                    移动分组
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {caseGroups.map(([group, groupCases]) => {
                  const collapsed = !!collapsedGroups[group];
                  return (
                    <div key={group} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                      <button
                        onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
                        className="w-full px-3 py-2 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-between text-left transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {collapsed ? <Folder className="w-4 h-4 text-zinc-500 shrink-0" /> : <FolderOpen className="w-4 h-4 text-[#10a37f] shrink-0" />}
                          <span className="text-xs font-semibold text-zinc-700 truncate">{group}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 bg-white border border-zinc-200 rounded-full px-1.5 py-0.5">{groupCases.length}</span>
                      </button>
                      {!collapsed && (
                        <ul className="divide-y divide-zinc-100">
                          {groupCases.map((c) => (
                            <li key={c.id} className="stagger-item">
                              <div
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                  selectedCase?.id === c.id
                                    ? 'bg-[#10a37f]/10 text-zinc-900'
                                    : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                                }`}
                              >
                                {caseSelectMode && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleCaseSelected(c.id); }}
                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedCaseIdSet.has(c.id) ? 'bg-[#10a37f] border-[#10a37f]' : 'bg-white border-zinc-300'}`}
                                    title={selectedCaseIdSet.has(c.id) ? '取消选择' : '选择'}
                                  >
                                    {selectedCaseIdSet.has(c.id) && <Check className="w-3 h-3 text-white" />}
                                  </button>
                                )}
                                <button
                                  onClick={() => { if (caseSelectMode) { toggleCaseSelected(c.id); return; } setSelectedSuiteId(null); setSuiteDoc(null); setSelectedSuiteRunId(null); setSelectedSuiteRun(null); setSelectedCase(c); }}
                                  className="flex-1 min-w-0 flex items-center gap-2 text-left"
                                >
                                  <FileJson className="w-4 h-4 opacity-70 shrink-0" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate">{c.name}</span>
                                    {c.tags && c.tags.length > 0 && (
                                      <div className="flex gap-1 mt-0.5 overflow-hidden">
                                        {c.tags.slice(0, 3).map(tag => (
                                          <span key={tag} className="text-[9px] bg-zinc-100 text-zinc-600 px-1 rounded-sm border border-zinc-200 shrink-0">{tag}</span>
                                        ))}
                                        {c.tags.length > 3 && <span className="text-[9px] text-zinc-500 shrink-0">+{c.tags.length - 3}</span>}
                                      </div>
                                    )}
                                  </div>
                                </button>
                                {!caseSelectMode && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleMoveCasesToGroup([c.id], c.group_name || ''); }}
                                      className={`p-1.5 rounded-md border transition-colors ${selectedCase?.id === c.id ? 'border-[#10a37f]/25 bg-[#10a37f]/10 text-[#0e8a6a]' : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 text-zinc-500'}`}
                                      title="移动分组"
                                    >
                                      <Folder className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEditTags(c); }}
                                      className={`p-1.5 rounded-md border transition-colors ${selectedCase?.id === c.id ? 'border-[#10a37f]/25 bg-[#10a37f]/10 text-[#0e8a6a]' : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 text-zinc-500'}`}
                                      title="编辑标签"
                                    >
                                      <Tag className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRename(c); }}
                                      className={`p-1.5 rounded-md border transition-colors ${selectedCase?.id === c.id ? 'border-[#10a37f]/25 bg-[#10a37f]/10 text-[#0e8a6a]' : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 text-zinc-500'}`}
                                      title="改名"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteCase(c); }}
                                      className={`p-1.5 rounded-md border transition-colors ${selectedCase?.id === c.id ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700' : 'border-transparent hover:border-rose-200 hover:bg-rose-50 text-zinc-500 hover:text-rose-700'}`}
                                      title="删除"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {filteredCases.length === 0 && (
                  <div className="text-sm text-zinc-500 p-4 text-center border border-dashed border-zinc-200 rounded-xl mt-3 bg-white">
                    未找到匹配用例<br/><span className="text-xs mt-1 block">可点击顶部「新建用例」通过自然语言创建</span>
                  </div>
                )}
              </div>
            </>
          )}

          {sidebarNav === 'suites' && (
            <>
              <div className="mt-4 flex items-center justify-between px-2 mb-2">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  <SquareTerminal className="w-4 h-4" /> 套件
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={createSuite}
                    className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
                    title="新建套件"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={fetchSuites}
                    className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
                    title="刷新套件"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1 px-2">
                {suites.length === 0 ? (
                  <div className="text-xs text-zinc-600 px-1">暂无套件</div>
                ) : (
                  suites.map((s) => (
                    <div
                      key={s.id}
                      className={`group w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md border text-xs cursor-pointer ${
                        selectedSuiteId === s.id
                          ? 'bg-[#10a37f]/10 border-[#10a37f]/25 text-zinc-900'
                          : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                      onClick={() => loadSuite(s.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{s.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">{s.id}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSuite(s.id); }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-700 transition-opacity p-0.5 rounded"
                        title="删除套件"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {sidebarNav === 'runs' && (
            <>
              <div className="mt-4 flex items-center justify-between px-2 mb-2">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4" /> 运行历史
                </div>
                {runSelectMode ? (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="h-8 inline-flex items-center rounded-xl bg-zinc-100 border border-zinc-200 px-2.5 text-[11px] text-zinc-600">
                      <span className="font-semibold text-zinc-900 tabular-nums">{selectedRunIds.length}</span>
                      <span className="ml-1">已选</span>
                    </div>
                    <div className="h-8 inline-flex items-center rounded-xl bg-white border border-zinc-200 shadow-sm divide-x divide-zinc-200 overflow-hidden">
                      <button
                        onClick={selectAllVisibleRuns}
                        disabled={!selectedCase || visibleRuns.length === 0}
                        className="h-8 px-3 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 min-w-[52px]"
                        title="全选当前列表"
                      >
                        全选
                      </button>
                      <button
                        onClick={clearSelectedRuns}
                        disabled={selectedRunIds.length === 0}
                        className="h-8 px-3 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 min-w-[52px]"
                        title="清空选择"
                      >
                        清空
                      </button>
                      <button
                        onClick={handleBatchDeleteRuns}
                        disabled={selectedRunIds.length === 0}
                        className="h-8 px-3 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50 min-w-[52px]"
                        title="批量删除"
                      >
                        删除
                      </button>
                      <button
                        onClick={exitRunSelectMode}
                        className="h-8 px-3 text-[11px] text-zinc-700 hover:bg-zinc-50 min-w-[52px]"
                        title="退出选择模式"
                      >
                        完成
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {runSource.length > 0 && (
                      <select
                        value={runFailureFilter}
                        onChange={(e) => setRunFailureFilter(e.target.value)}
                        className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-700 outline-none focus:border-[#10a37f]/50"
                        title="按失败原因过滤"
                      >
                        <option value="">全部</option>
                        {runFailureCategories.map((entry) => {
                          const [category, label] = entry.split('::');
                          return <option key={category} value={category}>{label}</option>;
                        })}
                      </select>
                    )}
                    <button
                      onClick={() => setRunSelectMode(true)}
                      disabled={runSource.length === 0}
                      className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
                      title="批量选择"
                    >
                      <ListChecks className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (selectedCase) fetchRuns(selectedCase.id, selectedCase); else fetchAllRuns(); }}
                      disabled={runsLoading}
                      className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
                      title="刷新"
                    >
                      <RotateCw className={`w-4 h-4 ${runsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
              {!selectedCase && runSource.length > 0 && (
                <div className="text-[11px] text-zinc-500 px-2 mb-2">当前展示全部用例的历史记录；选择某个用例后会自动筛选。</div>
              )}
              {runSource.length === 0 ? (
                <div className="text-xs text-zinc-600 px-2">暂无运行记录</div>
              ) : (
                <div className="space-y-1 px-2 pb-2">
                  {visibleRuns.length === 0 ? (
                    <div className="text-xs text-zinc-600 px-2 py-2">无匹配记录</div>
                  ) : visibleRuns.map((r) => {
                    const statusText = formatStatus(r.status || 'running');
                    const durationText = r.duration_ms ? `${Math.round(r.duration_ms / 1000)}s` : '';
                    const tokenText = formatTokenUsage(r.token_usage);
                    return (
                    <div
                      key={r.id}
                      onClick={() => (runSelectMode ? toggleRunSelected(r.id) : loadRunDetail(r.id, !selectedCase))}
                      className={`group w-full rounded-xl border text-xs cursor-pointer px-3 py-2.5 transition-all ${
                        selectedRunId === r.id
                          ? 'bg-[#10a37f]/10 border-[#10a37f]/30 text-zinc-900 shadow-sm'
                          : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        {runSelectMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleRunSelected(r.id); }}
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              selectedRunIdSet.has(r.id)
                                ? 'bg-[#10a37f] border-[#10a37f]'
                                : 'bg-white border-zinc-300 hover:border-zinc-400'
                            }`}
                            title={selectedRunIdSet.has(r.id) ? '取消选择' : '选择'}
                          >
                            {selectedRunIdSet.has(r.id) && <Check className="w-3 h-3 text-white" />}
                          </button>
                        )}
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${r.status === 'completed' ? 'bg-emerald-500' : r.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="font-mono text-[12px] leading-5 text-zinc-900 dark:text-zinc-100 whitespace-nowrap tabular-nums">
                              {formatRunDate(r.started_at)} {formatRunTime(r.started_at)}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[10px] leading-4 px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap ${r.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : r.status === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'}`}>
                                {statusText}
                              </span>
                              {!runSelectMode && (
                                <button
                                  onClick={(e) => handleDeleteRun(e, r.id)}
                                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-700 transition-opacity p-0.5 rounded shrink-0"
                                  title="删除记录"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
                            {!selectedCase && r.case_id && (
                              <span className="shrink min-w-0 max-w-[140px] truncate text-[10px] leading-4 px-1.5 py-0.5 rounded-full border border-zinc-200 bg-white text-zinc-500 font-mono" title={r.case_id}>
                                {r.case_id}
                              </span>
                            )}
                            {r.status === 'failed' && r.failure_reason?.category && (
                              <span className={`shrink min-w-0 max-w-[120px] truncate text-[10px] leading-4 px-1.5 py-0.5 rounded-full border font-medium ${getFailureSeverityClass(r.failure_reason.severity)}`} title={r.failure_reason.message || r.failure_reason.category}>
                                {getFailureLabel(r.failure_reason)}
                              </span>
                            )}
                            {durationText && (
                              <span className="shrink-0 text-[10px] leading-4 px-1.5 py-0.5 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                                {durationText}
                              </span>
                            )}
                            {tokenText && (
                              <span className="min-w-0 truncate text-[10px] leading-4 px-1.5 py-0.5 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-500 font-mono dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400" title={tokenText}>
                                {tokenText}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-[#f9f9fa] dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => { loadSettings(); setShowSettings(true); }}
              className="h-10 px-3 rounded-2xl hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition flex items-center justify-center gap-2"
              title="设置"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">设置</span>
            </button>
            <button
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="h-10 px-3 rounded-2xl hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition flex items-center justify-center gap-2"
              title={theme === 'dark' ? '切换为浅色' : '切换为深色'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="text-sm font-medium">{theme === 'dark' ? '浅色' : '深色'}</span>
            </button>
            {authUser && (
              <button
                onClick={logout}
                className="h-10 px-3 rounded-2xl hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition flex items-center justify-center gap-2"
                title="退出登录"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">退出</span>
              </button>
            )}
          </div>
        </div>
      </div>


  );
}
