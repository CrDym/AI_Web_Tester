import { useMemo, useState, useEffect, useRef } from 'react';
import { Play, FileJson, Terminal, XCircle, Plus, Save, History } from 'lucide-react';
import { apiClient } from './api/client';
import AIFixSuggestionPanel from './components/AIFixSuggestionPanel';
import AuthGate from './components/AuthGate';
import CaseStepEditor from './components/CaseStepEditor';
import CodeBlock from './components/CodeBlock';
import DatasetEditor from './components/DatasetEditor';
import CaseSidebar from './components/CaseSidebar';
import ConfirmModal from './components/ConfirmModal';
import CreateSuiteModal from './components/CreateSuiteModal';
import EmptyMainPanel from './components/EmptyMainPanel';
import GenerateCaseModal from './components/GenerateCaseModal';
import HealCompareModal from './components/HealCompareModal';
import ImageViewerModal from './components/ImageViewerModal';
import LogStream from './components/LogStream';
import NaturalLanguageImportModal from './components/NaturalLanguageImportModal';
import PromptModal from './components/PromptModal';
import RunDiagnosticsPanel from './components/RunDiagnosticsPanel';
import RunFailureReasonCard from './components/RunFailureReasonCard';
import RunHealEventsPanel from './components/RunHealEventsPanel';
import RunLogPanel from './components/RunLogPanel';
import RunScreenshotPanel from './components/RunScreenshotPanel';
import RunTokenPanel from './components/RunTokenPanel';
import SettingsModal from './components/SettingsModal';
import SuiteEditorPanel from './components/SuiteEditorPanel';
import SuiteRunDetailPanel from './components/SuiteRunDetailPanel';
import type { CaseDoc, NaturalLanguageImportItem, RunDetail, SuiteDoc, SuiteRunDetail, SuiteRunItem, SuiteRunSummary, SuiteSummary, TestCase } from './types';
import { formatRunTime, formatStatus, formatTokenUsage } from './utils/formatters';
import { getLogKind } from './utils/runUi';
import { useAuth } from './hooks/useAuth';
import { useCaseEditor } from './hooks/useCaseEditor';
import { useCaseLibrary } from './hooks/useCaseLibrary';
import { useGenerateCaseForm } from './hooks/useGenerateCaseForm';
import { useImageViewer } from './hooks/useImageViewer';
import { useModalDialogs } from './hooks/useModalDialogs';
import { useNaturalLanguageImport } from './hooks/useNaturalLanguageImport';
import { useRunHistory } from './hooks/useRunHistory';
import { useRunScreenshots } from './hooks/useRunScreenshots';
import { useSettings } from './hooks/useSettings';

function App() {
  const {
    authToken,
    authUser,
    authReady,
    authMode,
    authUsername,
    authPassword,
    authSubmitting,
    authError,
    setAuthMode,
    setAuthUsername,
    setAuthPassword,
    setAuthError,
    submitAuth,
    logoutAuth,
  } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const v = localStorage.getItem('theme');
    if (v === 'dark' || v === 'light') return v;
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const {
    cases,
    setCases,
    caseQuery,
    setCaseQuery,
    selectedTag,
    setSelectedTag,
    allTags,
    collapsedGroups,
    setCollapsedGroups,
    caseSelectMode,
    setCaseSelectMode,
    selectedCaseIds,
    setSelectedCaseIds,
    selectedCaseIdSet,
    fetchCases,
    filteredCases,
    caseGroups,
    allGroups,
    toggleCaseSelected,
    resetCaseSelection,
  } = useCaseLibrary();
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [suites, setSuites] = useState<SuiteSummary[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [suiteDoc, setSuiteDoc] = useState<SuiteDoc | null>(null);
  const [suiteLastSaved, setSuiteLastSaved] = useState<string>('');
  const [suiteRuns, setSuiteRuns] = useState<SuiteRunSummary[]>([]);
  const [suiteRunsLoading, setSuiteRunsLoading] = useState(false);
  const [selectedSuiteRunId, setSelectedSuiteRunId] = useState<string | null>(null);
  const [selectedSuiteRun, setSelectedSuiteRun] = useState<SuiteRunDetail | null>(null);
  const [suiteAddCaseId, setSuiteAddCaseId] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  const [suiteLogs, setSuiteLogs] = useState<string[]>([]);
  const [suiteScreenshot, setSuiteScreenshot] = useState<string | null>(null);
  const suiteWsRef = useRef<{ ws: WebSocket, runId: string } | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const liveLogsEndRef = useRef<HTMLDivElement>(null);
  const suiteLogsEndRef = useRef<HTMLDivElement>(null);
  const {
    caseDoc,
    setCaseDoc,
    scriptContent,
    setScriptContent,
    saving,
    setSaving,
    leftTab,
    setLeftTab,
    setLastSaved,
    isDirty,
    resetCaseEditor,
    addStep,
    updateStep,
    removeStep,
    duplicateStep,
    moveStep,
  } = useCaseEditor();
  const [runLogFilter, setRunLogFilter] = useState<'all' | 'error' | 'warning' | 'ai' | 'success'>('all');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [runDetailStandalone, setRunDetailStandalone] = useState(false);
  const [pendingRunToOpen, setPendingRunToOpen] = useState<{ case_id: string; run_id: string } | null>(null);
  const [approvingHeals, setApprovingHeals] = useState<Record<string, boolean>>({});
  const [approvedHeals, setApprovedHeals] = useState<Record<string, boolean>>({});
  const {
    screenshot,
    setScreenshot,
    selectedShotFile,
    setSelectedShotFile,
    shotCache,
    screenshotsContainerRef,
    comparingHealEvent,
    compareImages,
    compareImagesLoading,
    resetScreenshots,
    loadScreenshotFile,
    prefetchScreenshots,
    loadLatestScreenshot,
    handleOpenHealCompare,
    openRunScreenshot,
    closeHealCompare,
  } = useRunScreenshots(selectedRunId);
  
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportNlModal, setShowImportNlModal] = useState(false);
  const [showCreateSuiteModal, setShowCreateSuiteModal] = useState(false);
  const [createSuiteName, setCreateSuiteName] = useState('');
  const [createSuiteEnvId, setCreateSuiteEnvId] = useState<string>('');
  const [creatingSuite, setCreatingSuite] = useState(false);
  const {
    confirmModal,
    confirmAction,
    closeConfirm,
    promptModal,
    promptAction,
    closePrompt,
    promptValue,
    setPromptValue,
  } = useModalDialogs();
  const { generateForm, setGenerateForm, generating, setGenerating, resetGenerateForm } = useGenerateCaseForm();
  const {
    importNlText,
    importNlGroup,
    setImportNlGroup,
    importNlStartUrl,
    setImportNlStartUrl,
    importNlItems,
    setImportNlItems,
    importNlSelected,
    setImportNlSelected,
    importNlLoading,
    setImportNlLoading,
    importNlError,
    setImportNlError,
    resetImportNl,
    setImportNlTextAndClearPreview,
  } = useNaturalLanguageImport();
  const {
    showSettings,
    setShowSettings,
    apiBase,
    setApiBase,
    apiKey,
    setApiKey,
    apiKeySet,
    modelName,
    setModelName,
    prompts,
    setPrompts,
    activePromptFile,
    setActivePromptFile,
    settingsTab,
    setSettingsTab,
    savingSettings,
    testingSettings,
    settingsTestResult,
    envs,
    setEnvs,
    selectedEnvId,
    setSelectedEnvId,
    loadSettings,
    saveSettings,
    testSettingsConnection,
  } = useSettings((message) => setLogs((prev) => [...prev, message]));
  const [sidebarNav, setSidebarNav] = useState<'cases' | 'suites' | 'runs'>('cases');
  
  const {
    imageViewer,
    viewerScale,
    viewerOffset,
    viewerDragging,
    openImageViewer,
    closeImageViewer,
    resetViewerTransform,
    setViewerScale,
    onViewerWheel,
    onViewerMouseDown,
    onViewerMouseMove,
    stopViewerDrag,
  } = useImageViewer();

  const [fixSuggestLoading, setFixSuggestLoading] = useState(false);
  const [applyFixLoading, setApplyFixLoading] = useState(false);

  const {
    setRuns,
    allRuns,
    setAllRuns,
    runsLoading,
    runFailureFilter,
    setRunFailureFilter,
    runSelectMode,
    setRunSelectMode,
    selectedRunIds,
    setSelectedRunIds,
    selectedRunIdSet,
    fetchAllRuns,
    fetchRuns,
    runSource,
    runFailureCategories,
    visibleRuns,
    toggleRunSelected,
    selectAllVisibleRuns,
    clearSelectedRuns,
    exitRunSelectMode,
  } = useRunHistory(selectedCase);
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRunSelectMode(false);
    setSelectedRunIds([]);
  }, [selectedCase?.id]);

  useEffect(() => {
    if (sidebarNav === 'runs' && !selectedCase && allRuns.length === 0 && authUser) {
      fetchAllRuns();
    }
  }, [sidebarNav, selectedCase?.id, authUser]);

  const scrollSidebarTo = (key: 'cases' | 'suites' | 'runs') => {
    if (key !== 'runs') {
      setRunSelectMode(false);
      setSelectedRunIds([]);
    }
    setSidebarNav(key);
    requestAnimationFrame(() => {
      sidebarScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const logout = () => {
    logoutAuth();
    setSelectedCase(null);
    resetCaseEditor();
    setSuites([]);
    setCases([]);
    setSelectedRunId(null);
    setSelectedRun(null);
    setRunDetailStandalone(false);
    setRuns([]);
    setAllRuns([]);
    setSuiteRuns([]);
    setSelectedSuiteId(null);
    setSuiteDoc(null);
    setSelectedSuiteRunId(null);
    setSelectedSuiteRun(null);
    setLogs([]);
    resetScreenshots();
    setSuiteLogs([]);
    setSuiteScreenshot(null);
  };

  const fetchSuites = async () => {
    try {
      const res = await apiClient.get('/api/suites');
      setSuites(res.data || []);
    } catch (e) {
      setSuites([]);
    }
  };

  const loadSuite = async (suiteId: string) => {
    try {
      setSelectedSuiteId(suiteId);
      setSelectedCase(null);
      resetCaseEditor();
      setSelectedRunId(null);
      setSelectedRun(null);
      setRunDetailStandalone(false);
      resetScreenshots();
      setLogs([]);
      setSelectedSuiteRunId(null);
      setSelectedSuiteRun(null);
      const res = await apiClient.get(`/api/suites/${suiteId}`);
      setSuiteDoc(res.data);
      setSuiteLastSaved(JSON.stringify(res.data));
      fetchSuiteRuns(res.data.id || suiteId);
    } catch (e: any) {
      alert('加载套件失败: ' + (e.response?.data?.error || e.message));
      setSuiteDoc(null);
      setSuiteLastSaved('');
      setSuiteRuns([]);
    }
  };

  const createSuite = () => {
    setCreateSuiteName('');
    setCreateSuiteEnvId(selectedEnvId || '');
    setShowCreateSuiteModal(true);
  };

  const confirmCreateSuite = async () => {
    const name = createSuiteName.trim();
    if (!name) return;
    setCreatingSuite(true);
    try {
      const res = await apiClient.post('/api/suites', { name, env_id: createSuiteEnvId || null, case_ids: [] });
      await fetchSuites();
      setShowCreateSuiteModal(false);
      setCreateSuiteName('');
      if (res.data?.id) {
        void loadSuite(res.data.id);
      }
    } catch (e: any) {
      alert('创建套件失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setCreatingSuite(false);
    }
  };

  const deleteSuite = async (suiteId: string) => {
    const ok = await confirmAction({
      title: '删除套件',
      description: `确定要删除套件 ${suiteId} 吗？此操作不可恢复。`,
      confirmText: '删除套件',
      destructive: true
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/api/suites/${suiteId}`);
      if (selectedSuiteId === suiteId) {
        setSelectedSuiteId(null);
        setSuiteDoc(null);
        setSuiteLastSaved('');
        setSuiteRuns([]);
        setSelectedSuiteRunId(null);
        setSelectedSuiteRun(null);
      }
      fetchSuites();
    } catch (e: any) {
      alert('删除失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const saveSuite = async () => {
    if (!suiteDoc) return;
    try {
      await apiClient.put(`/api/suites/${suiteDoc.id}`, {
        name: suiteDoc.name,
        env_id: suiteDoc.env_id || null,
        setup_case_id: suiteDoc.setup_case_id || null,
        case_ids: suiteDoc.case_ids || []
      });
      const refreshed = await apiClient.get(`/api/suites/${suiteDoc.id}`);
      setSuiteDoc(refreshed.data);
      setSuiteLastSaved(JSON.stringify(refreshed.data));
      await fetchSuites();
    } catch (e: any) {
      alert('保存失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const fetchSuiteRuns = async (suiteId: string) => {
    setSuiteRunsLoading(true);
    try {
      const res = await apiClient.get('/api/suite_runs', { params: { suite_id: suiteId } });
      setSuiteRuns(res.data || []);
    } catch (e) {
      setSuiteRuns([]);
    } finally {
      setSuiteRunsLoading(false);
    }
  };

  const loadSuiteRunDetail = async (suiteRunId: string) => {
    if (selectedSuiteRunId !== suiteRunId) {
      setSuiteLogs([]);
      setSuiteScreenshot(null);
    }
    setSelectedSuiteRunId(suiteRunId);
    try {
      const res = await apiClient.get(`/api/suite_runs/${suiteRunId}`);
      setSelectedSuiteRun(res.data);
    } catch (e: any) {
      setSelectedSuiteRun(null);
      alert('加载套件运行详情失败: ' + (e.response?.data?.error || e.message));
    }
  };

  useEffect(() => {
    if (!selectedSuiteRunId || !selectedSuiteRun) return;
    if (selectedSuiteRun.status !== 'running') return;
    const id = selectedSuiteRunId;
    const timer = window.setInterval(() => {
      loadSuiteRunDetail(id);
      if (suiteDoc) {
        fetchSuiteRuns(suiteDoc.id);
      } else if (selectedSuiteRun.suite_id) {
        fetchSuiteRuns(selectedSuiteRun.suite_id);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [selectedSuiteRunId, selectedSuiteRun?.status, suiteDoc?.id, selectedSuiteRun?.suite_id]);

  const runSuite = async () => {
    if (!suiteDoc) return;
    setSuiteLogs([]);
    setSuiteScreenshot(null);
    try {
      const res = await apiClient.post(`/api/suites/${suiteDoc.id}/run`, null, { params: { env_id: suiteDoc.env_id || null } });
      const suiteRunId = res.data?.suite_run_id;
      if (suiteRunId) {
        await fetchSuiteRuns(suiteDoc.id);
        await loadSuiteRunDetail(suiteRunId);
      }
    } catch (e: any) {
      alert('运行套件失败: ' + (e.response?.data?.error || e.message));
    }
  };

  useEffect(() => {
    if (!authReady || !authUser) return;
    fetchCases();
    fetchSuites();
    fetchAllRuns();
    loadSettings();
  }, [authReady, authUser]);

  const handleDeleteSuiteRun = async (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    const ok = await confirmAction({
      title: '删除套件运行记录',
      description: `确定要删除套件运行记录 ${runId} 吗？相关日志与记录将被永久删除。`,
      confirmText: '删除记录',
      destructive: true
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/api/suite_runs/${runId}`);
      if (selectedSuiteRunId === runId) {
        setSelectedSuiteRunId(null);
        setSelectedSuiteRun(null);
        setLogs([]);
        resetScreenshots();
      }
      if (suiteDoc) {
        fetchSuiteRuns(suiteDoc.id);
      }
    } catch (err: any) {
      alert('删除失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteRun = async (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    const ok = await confirmAction({
      title: '删除测试记录',
      description: `确定要删除运行记录 ${runId} 吗？本地日志与截图将被永久删除。`,
      confirmText: '删除记录',
      destructive: true
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/api/runs/${runId}`);
      setAllRuns((prev) => prev.filter((r) => r.id !== runId));
      if (selectedRunId === runId) {
        setSelectedRunId(null);
        setSelectedRun(null);
        setRunDetailStandalone(false);
        setLogs([]);
        resetScreenshots();
      }
      if (selectedCase) {
        fetchRuns(selectedCase.id, selectedCase);
      } else {
        fetchAllRuns();
      }
    } catch (err: any) {
      alert('删除失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleBatchDeleteRuns = async () => {
    if (selectedRunIds.length === 0) return;
    const ok = await confirmAction({
      title: '批量删除运行记录',
      description: `确定要删除选中的 ${selectedRunIds.length} 条运行记录吗？本地日志与截图将被永久删除。`,
      confirmText: '批量删除',
      destructive: true
    });
    if (!ok) return;
    try {
      await apiClient.post('/api/runs/batch_delete', { run_ids: selectedRunIds });
      setAllRuns((prev) => prev.filter((r) => !selectedRunIdSet.has(r.id)));
      if (selectedRunId && selectedRunIdSet.has(selectedRunId)) {
        setSelectedRunId(null);
        setSelectedRun(null);
        setRunDetailStandalone(false);
        setLogs([]);
        resetScreenshots();
      }
      if (selectedCase) {
        fetchRuns(selectedCase.id, selectedCase);
      } else {
        fetchAllRuns();
      }
      exitRunSelectMode();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        return;
      }
      if (status === 404 || status === 405) {
        const okFallback = await confirmAction({
          title: '批量删除不可用',
          description: '当前服务端未启用批量删除接口，将改为逐条删除（可能更慢）。是否继续？',
          confirmText: '继续删除',
          destructive: true
        });
        if (!okFallback) return;
        const results = await Promise.allSettled(selectedRunIds.map((rid) => apiClient.delete(`/api/runs/${rid}`)));
        const failedCount = results.filter((r) => r.status === 'rejected').length;
        setAllRuns((prev) => prev.filter((r) => !selectedRunIdSet.has(r.id)));
        if (selectedRunId && selectedRunIdSet.has(selectedRunId)) {
          setSelectedRunId(null);
          setSelectedRun(null);
          setRunDetailStandalone(false);
          setLogs([]);
          resetScreenshots();
        }
        if (selectedCase) {
          fetchRuns(selectedCase.id, selectedCase);
        } else {
          fetchAllRuns();
        }
        exitRunSelectMode();
        if (failedCount > 0) {
          alert(`部分删除失败：${failedCount} 条。可刷新后重试。`);
        }
        return;
      }
      alert('批量删除失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const loadRunDetail = async (runId: string, standalone = false) => {
    try {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsRunning(false);

      const res = await apiClient.get(`/api/runs/${runId}`);
      const detail: RunDetail = res.data;
      // 如果后端实际仍在运行，则将 isRunning 设为 true 以显示停止按钮
      if (detail.status === 'running') {
        setIsRunning(true);
      }
      
      setRunLogFilter('all');
      setSelectedRunId(runId);
      setSelectedRun(detail);
      setRunDetailStandalone(standalone && !selectedCase);
      if (standalone && !selectedCase) {
        setSelectedSuiteId(null);
        setSuiteDoc(null);
        setSelectedSuiteRunId(null);
        setSelectedSuiteRun(null);
      }
      setLogs(detail.logs || []);

      if (detail.screenshots && detail.screenshots.length > 0) {
        void prefetchScreenshots(runId, detail.screenshots);
      }

      await loadLatestScreenshot(runId, detail.screenshots);
    } catch (e: any) {
      setLogs([`❌ 回放加载失败: ${e.message}`]);
      resetScreenshots();
      setSelectedRun(null);
      setRunDetailStandalone(false);
    }
  };

  useEffect(() => {
    if (!selectedCase) return;
    const pending = pendingRunToOpen && pendingRunToOpen.case_id === selectedCase.id ? pendingRunToOpen : null;
    setLogs([]);
    resetScreenshots();
    resetCaseEditor();
    setSelectedRunId(null);
    setSelectedRun(null);
    setRunDetailStandalone(false);
    apiClient.get(`/api/cases/${selectedCase.id}`).then(res => {
      setCaseDoc(res.data);
      setLastSaved(JSON.stringify(res.data));
      return apiClient.get(`/api/cases/${selectedCase.id}/script`);
    }).then(res => {
      setScriptContent(res.data.content || '');
      fetchRuns(selectedCase.id, selectedCase);
      if (pending) {
        loadRunDetail(pending.run_id).finally(() => setPendingRunToOpen(null));
      } else {
        setSelectedRunId(null);
      }
    }).catch(e => {
      setScriptContent('Failed to load case: ' + e.message);
    });
  }, [selectedCase]);

  useEffect(() => {
    liveLogsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [logs]);

  useEffect(() => {
    suiteLogsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [suiteLogs]);

  useEffect(() => {
    if (!selectedSuiteRun || selectedSuiteRun.status !== 'running') {
      if (suiteWsRef.current) {
        suiteWsRef.current.ws.close();
        suiteWsRef.current = null;
      }
      return;
    }
    const runningItem = (selectedSuiteRun.items || []).find((it) => it.status === 'running');
    if (!runningItem || !runningItem.run_id) return;
    const runId = runningItem.run_id;

    if (suiteWsRef.current?.runId === runId) return; // already connected
    if (suiteWsRef.current) {
      suiteWsRef.current.ws.close();
    }

    // 不要在切换套件子任务时清空日志，让它连贯输出
    // setSuiteLogs([]);
    // setSuiteScreenshot(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/run/${runId}?token=${encodeURIComponent(authToken)}`;
    const ws = new WebSocket(wsUrl);
    suiteWsRef.current = { ws, runId };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        setSuiteLogs(prev => [...prev, data.message]);
      } else if (data.type === 'screenshot') {
        setSuiteScreenshot(data.data);
      }
    };
    
    // 我们不在这里强制 setSuiteLogs([])，防止切换用例闪烁，后端新启动时会自动通过 log 推送开始信息
    
    return () => {
      // Don't close here if we want to keep it alive across renders unless runId changes
    };
  }, [selectedSuiteRun]);

  const collectPlaceholders = (doc: CaseDoc) => {
    const re = /\$\{([^}]+)\}/g;
    const locs: Array<{ key: string; where: string }> = [];
    const scan = (val: any, where: string) => {
      if (typeof val !== 'string' || val.indexOf('${') === -1) return;
      for (const m of val.matchAll(re)) {
        const k = (m[1] || '').trim();
        if (k) locs.push({ key: k, where });
      }
    };
    scan(doc.start_url, 'start_url');
    (doc.steps || []).forEach((s, idx) => {
      scan(s.selector, `steps[${idx}].selector`);
      scan(s.value, `steps[${idx}].value`);
      scan(s.intent, `steps[${idx}].intent`);
      scan((s as any).url, `steps[${idx}].url`);
    });
    return locs;
  };

  const builtInPlaceholders = new Set(['today_ymd', 'today_yyyyMMdd', 'today_mmdd']);

  const validateDataDriven = async (doc: CaseDoc, actionName: string) => {
    const locs = collectPlaceholders(doc);
    if (locs.length === 0) return true;
    const keys = Array.from(new Set(locs.map(x => x.key))).filter((key) => !builtInPlaceholders.has(key)).sort();
    if (keys.length === 0) return true;
    const variables = doc.variables || {};
    if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
      alert(`用例变量必须是 JSON 对象，才能${actionName}。`);
      setLeftTab('dataset');
      return false;
    }
    const dataset = doc.dataset || [];
    if (!Array.isArray(dataset)) {
      alert(`数据集必须是 JSON 数组，才能${actionName}。`);
      setLeftTab('dataset');
      return false;
    }
    const badRows: number[] = [];
    dataset.forEach((row: unknown, idx: number) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) badRows.push(idx);
    });
    if (badRows.length > 0) {
      alert(`数据集第 ${badRows.slice(0, 10).map(x => x + 1).join(', ')} 行不是对象，无法${actionName}。`);
      setLeftTab('dataset');
      return false;
    }
    if (dataset.length === 0) {
      const missingKeys = keys.filter((k) => !(k in variables));
      if (missingKeys.length > 0) {
        await confirmAction({
          title: `缺少用例变量`,
          description: `用例包含变量占位符：${keys.join(', ')}\n\n当前缺少：${missingKeys.join(', ')}\n\n请先在“数据集”页签配置用例变量，或添加包含这些字段的数据集。`,
          confirmText: '我知道了',
          destructive: false
        });
        setLeftTab('dataset');
        return false;
      }
      return true;
    }
    const missing: Array<{ row: number; key: string }> = [];
    dataset.forEach((row: Record<string, unknown>, idx: number) => {
      const merged = { ...variables, ...row };
      keys.forEach((k) => {
        if (!(k in merged)) missing.push({ row: idx, key: k });
      });
    });
    if (missing.length > 0) {
      const head = missing.slice(0, 12).map(m => `第${m.row + 1}行缺少 ${m.key}`).join('\n');
      await confirmAction({
        title: `数据集字段不完整`,
        description: `用例需要变量：${keys.join(', ')}\n\n${head}${missing.length > 12 ? `\n... 共 ${missing.length} 处缺失` : ''}\n\n请补齐数据集后再${actionName}。`,
        confirmText: '我知道了',
        destructive: false
      });
      setLeftTab('dataset');
      return false;
    }
    return true;
  };

  const handleRun = async () => {
    if (!selectedCase) return;
    if (!caseDoc) return;
    const ok = await validateDataDriven(caseDoc, '运行');
    if (!ok) return;
    
    setIsRunning(true);
    setLogs(['🚀 正在初始化测试环境...']);
    resetScreenshots();
    
    try {
      const res = await apiClient.post(`/api/run/${selectedCase.id}${selectedEnvId ? `?env_id=${selectedEnvId}` : ''}`);
      const sessionId = res.data.session_id;
      const runId = res.data.run_id || sessionId;
      setSelectedRunId(runId);
      
      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In dev mode, we proxy /ws to the backend
      const wsUrl = `${protocol}//${window.location.host}/ws/run/${sessionId}?token=${encodeURIComponent(authToken)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setLogs(prev => [...prev, data.message]);
        } else if (data.type === 'screenshot') {
          setScreenshot(data.data);
        } else if (data.type === 'status') {
          if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped' || data.status === 'timeout') {
            setIsRunning(false);
            setLogs(prev => [...prev, `🏁 执行结束，状态: ${formatStatus(data.status)}`]);
            ws.close();
            if (selectedCase) {
              fetchRuns(selectedCase.id, selectedCase);
            }
            loadRunDetail(runId);
          }
        }
      };
      
      ws.onerror = () => {
        setLogs(prev => [...prev, '❌ WebSocket 连接错误']);
        setIsRunning(false);
      };
      
    } catch (e: any) {
      setLogs(prev => [...prev, `❌ 启动失败: ${e.message}`]);
      setIsRunning(false);
    }
  };

  const handleApproveHeal = async (oldSel: string | null | undefined, newSel: string | null | undefined, stepIntent?: string | null) => {
    if (!selectedRun?.case_id || oldSel === null || oldSel === undefined || !newSel) return;
    const oldSelector = String(oldSel || '').trim();
    const newSelector = String(newSel || '').trim();
    const intent = String(stepIntent || '').trim();
    if (!newSelector) return;
    const key = oldSelector
      ? `${selectedRun.case_id}::${oldSelector}=>${newSelector}`
      : `${selectedRun.case_id}::intent:${intent}=>${newSelector}`;
    if (approvedHeals[key] || approvingHeals[key]) return;
    try {
      setApprovingHeals((prev) => ({ ...prev, [key]: true }));
      await apiClient.post(`/api/cases/${selectedRun.case_id}/heal/approve`, {
        old_selector: oldSelector,
        new_selector: newSelector,
        step_intent: intent
      });
      setApprovedHeals((prev) => ({ ...prev, [key]: true }));
      setLogs(prev => [...prev, `✅ 已将用例 ${selectedRun.case_id} 中的选择器更新为: ${newSelector}`]);
      if (selectedCase?.id === selectedRun.case_id) {
        const refreshed = await apiClient.get(`/api/cases/${selectedCase.id}`);
        setCaseDoc(refreshed.data);
        setLastSaved(JSON.stringify(refreshed.data));
        const scriptRes = await apiClient.get(`/api/cases/${selectedCase.id}/script`);
        setScriptContent(scriptRes.data.content || '');
      }
    } catch (e: any) {
      setLogs(prev => [...prev, `❌ 审核失败: ${e.response?.data?.error || e.message}`]);
    } finally {
      setApprovingHeals((prev) => ({ ...prev, [key]: false }));
    }
  };

  const isSuiteDirty = useMemo(() => {
    if (!suiteDoc) return false;
    if (!suiteLastSaved) return true;
    return JSON.stringify(suiteDoc) !== suiteLastSaved;
  }, [suiteDoc, suiteLastSaved]);

  const suiteRunVM = useMemo(() => {
    if (!selectedSuiteRun) return null;
    const caseIds = (selectedSuiteRun.case_ids && selectedSuiteRun.case_ids.length > 0)
      ? selectedSuiteRun.case_ids
      : (selectedSuiteRun.items || []).map((it) => it.case_id);
    const itemByCaseId = new Map<string, SuiteRunItem>();
    for (const it of (selectedSuiteRun.items || [])) {
      itemByCaseId.set(it.case_id, it);
    }
    const total = caseIds.length || selectedSuiteRun.summary?.total || 0;
    const doneCount = (selectedSuiteRun.items || []).filter((it) => it.status === 'completed' || it.status === 'failed' || it.status === 'stopped' || it.status === 'timeout').length;
    const runningItem = (selectedSuiteRun.items || []).find((it) => it.status === 'running');
    const currentCaseId = selectedSuiteRun.current_case_id || runningItem?.case_id || (doneCount < caseIds.length ? caseIds[doneCount] : null);
    const progressPct = total ? Math.round((doneCount / total) * 100) : 0;
    return { caseIds, itemByCaseId, total, doneCount, currentCaseId, progressPct };
  }, [selectedSuiteRun]);

  const suiteAvailableCases = useMemo(() => {
    if (!suiteDoc) return cases;
    const set = new Set(suiteDoc.case_ids || []);
    if (suiteDoc.setup_case_id) set.add(suiteDoc.setup_case_id);
    return cases.filter((c) => !set.has(c.id));
  }, [cases, suiteDoc]);

  const suiteMoveCase = (idx: number, dir: 'up' | 'down') => {
    if (!suiteDoc) return;
    const next = [...(suiteDoc.case_ids || [])];
    if (dir === 'up' && idx > 0) {
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    } else if (dir === 'down' && idx < next.length - 1) {
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    }
    setSuiteDoc({ ...suiteDoc, case_ids: next });
  };

  const suiteRemoveCase = (caseId: string) => {
    if (!suiteDoc) return;
    setSuiteDoc({ ...suiteDoc, case_ids: (suiteDoc.case_ids || []).filter((x) => x !== caseId) });
  };

  const suiteAddCase = () => {
    if (!suiteDoc) return;
    const cid = (suiteAddCaseId || '').trim();
    if (!cid) return;
    if (suiteDoc.setup_case_id && suiteDoc.setup_case_id === cid) return;
    if ((suiteDoc.case_ids || []).includes(cid)) return;
    setSuiteDoc({ ...suiteDoc, case_ids: [...(suiteDoc.case_ids || []), cid] });
    setSuiteAddCaseId('');
  };

  const openSuiteRunItem = (item: SuiteRunItem) => {
    const c = cases.find((x) => x.id === item.case_id) || { id: item.case_id, name: item.case_id, type: 'recorded' };
    setPendingRunToOpen({ case_id: item.case_id, run_id: item.run_id });
    setSelectedSuiteId(null);
    setSuiteDoc(null);
    setSelectedSuiteRunId(null);
    setSelectedSuiteRun(null);
    setSelectedCase(c);
  };

  const handleRestoreBackup = async () => {
    if (!selectedCase) return;
    if (!window.confirm("确定要恢复到上一个用例版本吗？(通常用于撤销误操作的 AI 修复建议)")) return;
    try {
      const res = await apiClient.post(`/api/cases/${selectedCase.id}/restore`);
      setLogs(prev => [...prev, `✅ ${res.data.message}`]);
      // 重新加载该用例
      const refreshed = await apiClient.get(`/api/cases/${selectedCase.id}`);
      setCaseDoc(refreshed.data);
      setLastSaved(JSON.stringify(refreshed.data));
    } catch (e: any) {
      setLogs(prev => [...prev, `❌ 恢复备份失败: ${e.response?.data?.error || e.message}`]);
      alert(`恢复备份失败: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleSave = async () => {
    if (!selectedCase || !caseDoc) return;
    const ok = await validateDataDriven(caseDoc, '保存');
    if (!ok) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/cases/${selectedCase.id}`, {
        start_url: caseDoc.start_url,
        steps: caseDoc.steps,
        variables: caseDoc.variables || {},
        dataset: caseDoc.dataset,
      });
      const refreshed = await apiClient.get(`/api/cases/${selectedCase.id}`);
      setCaseDoc(refreshed.data);
      setLastSaved(JSON.stringify(refreshed.data));
      const scriptRes = await apiClient.get(`/api/cases/${selectedCase.id}/script`);
      setScriptContent(scriptRes.data.content || '');
      setLogs((prev) => [...prev, '✅ 用例已保存']);
    } catch (e: any) {
      setLogs((prev) => [...prev, `❌ 保存失败: ${e.message}`]);
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (c?: TestCase) => {
    const target = c || selectedCase;
    if (!target) return;
    const current = target.name.endsWith('.json') ? target.name.slice(0, -5) : target.name;
    const next = await promptAction({
      title: '重命名用例',
      description: '输入新的用例名称（不含 .json）',
      initialValue: current,
      placeholder: '例如：login_flow',
      confirmText: '确认重命名'
    });
    if (!next || next.trim() === '') return;
    try {
      const res = await apiClient.post(`/api/cases/${target.id}/rename`, { name: next });
      await fetchCases();
      const updated = res.data?.case;
      if (updated?.id) {
        setSelectedCase(updated);
        setCaseDoc(updated);
        setSelectedRunId(null);
        setSelectedRun(null);
        fetchRuns(updated.id, updated);
      }
      setLogs((prev) => [...prev, `✅ 已重命名为 ${updated?.name || next}`]);
    } catch (e: any) {
      const msg = e.response?.data?.error || e.response?.data?.detail?.error || e.response?.data?.detail || e.message;
      setLogs((prev) => [...prev, `❌ 重命名失败: ${msg}`]);
    }
  };

  const handleEditTags = async (c?: TestCase) => {
    const target = c || selectedCase;
    if (!target) return;
    const currentTags = (target.tags || []).join(',');
    const next = await promptAction({
      title: '编辑用例标签',
      description: '输入用例的标签（多个标签用英文逗号分隔，清空输入框以删除所有标签）',
      initialValue: currentTags,
      placeholder: '例如：P0,登录模块,冒烟测试',
      confirmText: '保存标签'
    });
    if (next === null) return;
    try {
      const newTags = next.trim() === '' ? [] : next.split(',').map(s => s.trim()).filter(Boolean);
      // Fetch full case doc first to preserve steps
      const caseRes = await apiClient.get(`/api/cases/${target.id}`);
      const fullCase = caseRes.data;
      fullCase.tags = newTags;
      await apiClient.put(`/api/cases/${target.id}`, fullCase);
      await fetchCases();
      if (newTags.length === 0) {
        setLogs((prev) => [...prev, `✅ 用例 ${target.name} 的所有标签已清空`]);
      } else {
        setLogs((prev) => [...prev, `✅ 用例 ${target.name} 标签已更新为 [${newTags.join(', ')}]`]);
      }
    } catch (e: any) {
      setLogs((prev) => [...prev, `❌ 标签更新失败: ${e.message}`]);
    }
  };

  const requestAIFixSuggestion = async (force: boolean = false) => {
    if (!selectedRunId) return;
    setFixSuggestLoading(true);
    try {
      const res = await apiClient.post(`/api/runs/${selectedRunId}/ai_fix_suggest`, { force });
      const suggestion = res.data?.suggestion;
      if (suggestion) {
        setSelectedRun((prev) => prev ? ({ ...prev, ai_fix_suggestion: suggestion }) : prev);
        setLogs((prev) => [...prev, '✅ AI 修复建议已生成']);
      } else {
        setLogs((prev) => [...prev, '❌ AI 修复建议生成失败']);
      }
    } catch (e: any) {
      setLogs((prev) => [...prev, `❌ AI 修复建议生成失败: ${e.message}`]);
    } finally {
      setFixSuggestLoading(false);
    }
  };

  const applyAIFixSuggestion = async () => {
    if (!selectedRun?.case_id) return;
    const patchedSteps = selectedRun.ai_fix_suggestion?.patched_steps;
    if (!patchedSteps || patchedSteps.length === 0) {
      setLogs((prev) => [...prev, '❌ AI 未提供可直接应用的 steps 修改']);
      return;
    }
    setApplyFixLoading(true);
    try {
      const caseRes = await apiClient.get(`/api/cases/${selectedRun.case_id}`);
      const fullCase = caseRes.data;
      fullCase.steps = patchedSteps;
      await apiClient.put(`/api/cases/${selectedRun.case_id}`, fullCase);
      await fetchCases();
      setLogs((prev) => [...prev, '✅ 已应用 AI 修复建议到用例']);
    } catch (e: any) {
      setLogs((prev) => [...prev, `❌ 应用 AI 修复建议失败: ${e.message}`]);
    } finally {
      setApplyFixLoading(false);
    }
  };

  const handleMoveCasesToGroup = async (caseIds: string[], currentGroup?: string) => {
    if (caseIds.length === 0) return;
    const input = await promptAction({
      title: caseIds.length > 1 ? '批量移动分组' : '移动用例分组',
      description: allGroups.length > 0 ? `已有分组：${allGroups.join('、')}。留空则移动到未分组。` : '输入新的分组名称，留空则移动到未分组。',
      placeholder: '例如：登录模块',
      initialValue: currentGroup || '',
      confirmText: '移动'
    });
    if (input === null) return;
    const groupName = input.trim();
    try {
      await apiClient.post('/api/cases/batch_group', { case_ids: caseIds, group_name: groupName });
      await fetchCases();
      if (selectedCase && caseIds.includes(selectedCase.id)) {
        const refreshed = await apiClient.get(`/api/cases/${selectedCase.id}`);
        setSelectedCase(refreshed.data);
        setCaseDoc(refreshed.data);
      }
      resetCaseSelection();
      setLogs((prev) => [...prev, `✅ 已移动 ${caseIds.length} 个用例到 ${groupName || '未分组'}`]);
    } catch (e: any) {
      setLogs((prev) => [...prev, `❌ 移动分组失败: ${e.response?.data?.error || e.message}`]);
    }
  };

  const handleDeleteCase = async (c?: TestCase) => {
    const target = c || selectedCase;
    if (!target) return;
    const ok = await confirmAction({
      title: '删除用例',
      description: `确认删除用例 ${target.name} ？此操作不可恢复。`,
      confirmText: '删除用例',
      destructive: true
    });
    if (!ok) return;
    try {
      await apiClient.delete(`/api/cases/${target.id}`);
      await fetchCases();
      if (selectedCase?.id === target.id) {
        setSelectedCase(null);
        resetCaseEditor();
        resetScreenshots();
      }
      setLogs((prev) => [...prev, '✅ 用例已删除']);
    } catch (e: any) {
      setLogs((prev) => [...prev, `❌ 删除失败: ${e.message}`]);
    }
  };

  const handleGenerateCase = async () => {
    if (!generateForm.name.trim() || !generateForm.instruction.trim()) {
      alert('用例名称和自然语言指令不能为空！');
      return;
    }
    setGenerating(true);
    try {
      const res = await apiClient.post('/api/cases/generate', generateForm);
      if (res.data.status === 'ok') {
        const tokenText = formatTokenUsage(res.data.token_usage);
        if (tokenText) {
        setLogs((prev) => [...prev, `🧮 用例生成 Token消耗: ${tokenText}`]);
        }
        setShowGenerateModal(false);
        resetGenerateForm();
        await fetchCases();
        const newCase = { id: res.data.id, name: generateForm.name, type: 'recorded' };
        setSelectedCase(newCase);
      }
    } catch (e: any) {
      alert('生成失败: ' + (e.response?.data?.error || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleImportNlPreview = async () => {
    if (!importNlText.trim()) {
      setImportNlError('请输入要导入的自然语言用例内容');
      return;
    }
    setImportNlLoading(true);
    setImportNlError('');
    try {
      const res = await apiClient.post('/api/cases/import_nl/preview', {
        text: importNlText,
        default_group: importNlGroup,
        default_start_url: importNlStartUrl,
      });
      const items = (res.data.items || []) as NaturalLanguageImportItem[];
      setImportNlItems(items);
      setImportNlSelected(items.filter((item) => item.valid).map((item) => item.index));
      const tokenText = formatTokenUsage(res.data.token_usage);
      if (tokenText) setLogs((prev) => [...prev, `🧮 自然语言导入解析 Token消耗: ${tokenText}`]);
    } catch (e: any) {
      setImportNlError(e.response?.data?.error || e.message || '解析失败');
    } finally {
      setImportNlLoading(false);
    }
  };

  const handleImportNlConfirm = async () => {
    const selectedCases = importNlItems
      .filter((item) => item.valid && importNlSelected.includes(item.index))
      .map((item) => item.case);
    if (selectedCases.length === 0) {
      setImportNlError('请选择至少一个可导入的用例');
      return;
    }
    setImportNlLoading(true);
    setImportNlError('');
    try {
      const res = await apiClient.post('/api/cases/import_nl/confirm', { cases: selectedCases });
      await fetchCases();
      const imported = res.data.imported || [];
      const failed = res.data.failed || [];
      setLogs((prev) => [...prev, `✅ 自然语言导入完成：成功 ${imported.length} 条，失败 ${failed.length} 条`]);
      if (imported[0]?.id) {
        setSelectedCase({ id: imported[0].id, name: imported[0].name, type: 'json' });
      }
      setShowImportNlModal(false);
      resetImportNl();
    } catch (e: any) {
      setImportNlError(e.response?.data?.error || e.message || '导入失败');
    } finally {
      setImportNlLoading(false);
    }
  };

  const handleImportNlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportNlTextAndClearPreview(String(ev.target?.result || ''));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleStop = async () => {
    if (selectedRunId) {
      try {
        await apiClient.post(`/api/runs/${selectedRunId}/stop`);
        setLogs(prev => [...prev, '🛑 已向后端发送终止指令，正在结束进程...']);
      } catch (e: any) {
        setLogs(prev => [...prev, `⚠️ 终止进程失败: ${e.response?.data?.error || e.message}`]);
      }
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsRunning(false);
  };

  const handleExitReplay = () => {
    setSelectedRunId(null);
    setSelectedRun(null);
    resetScreenshots();
    setLogs([]);
  };

  const filteredRunLogs = useMemo(() => {
    if (runLogFilter === 'all') return logs;
    return logs.filter((log) => getLogKind(log) === runLogFilter);
  }, [logs, runLogFilter]);

  const runLogStats = useMemo(() => {
    const base = { all: logs.length, error: 0, warning: 0, ai: 0, success: 0 };
    logs.forEach((log) => {
      const kind = getLogKind(log);
      if (kind === 'error' || kind === 'warning' || kind === 'ai' || kind === 'success') base[kind] += 1;
    });
    return base;
  }, [logs]);

  const diagnosticStats = selectedRun ? [
    { label: '耗时', value: selectedRun.duration_ms ? `${Math.round((selectedRun.duration_ms || 0) / 1000)}s` : '—' },
    { label: '日志', value: String(selectedRun.logs?.length || 0) },
    { label: '截图', value: String(selectedRun.screenshots?.length || 0) },
    { label: '自愈', value: String(selectedRun.heal_events?.length || 0) },
    { label: 'Token', value: formatTokenUsage(selectedRun.token_usage) || '—' },
  ] : [];

  const isReplayMode = !!selectedRunId && !isRunning;
  const activeCaseForRun = selectedCase || (selectedRun ? cases.find((c) => c.id === selectedRun.case_id) || null : null);
  const mainCaseContext = selectedCase || (runDetailStandalone && selectedRun ? activeCaseForRun : null);
  const mainTitle = mainCaseContext?.name || (selectedRun ? `运行记录 ${selectedRun.id}` : '未选择用例');
  const mainCaseId = mainCaseContext?.id || selectedRun?.case_id || '';

  return (
    <div className="flex h-screen bg-[#f7f7f8] dark:bg-black text-zinc-900 dark:text-zinc-100 antialiased overflow-hidden">
      {!authUser && (
        <AuthGate
          authMode={authMode}
          username={authUsername}
          password={authPassword}
          submitting={authSubmitting}
          error={authError}
          onModeChange={setAuthMode}
          onUsernameChange={setAuthUsername}
          onPasswordChange={setAuthPassword}
          onErrorClear={() => setAuthError('')}
          onSubmit={() => void submitAuth()}
        />
      )}
      {/* Sidebar */}
      <CaseSidebar
        authUser={authUser}
        theme={theme}
        sidebarNav={sidebarNav}
        sidebarScrollRef={sidebarScrollRef}
        caseQuery={caseQuery}
        allTags={allTags}
        selectedTag={selectedTag}
        caseSelectMode={caseSelectMode}
        selectedCaseIds={selectedCaseIds}
        selectedCaseIdSet={selectedCaseIdSet}
        caseGroups={caseGroups}
        collapsedGroups={collapsedGroups}
        filteredCases={filteredCases}
        selectedCase={selectedCase}
        suites={suites}
        selectedSuiteId={selectedSuiteId}
        runSelectMode={runSelectMode}
        selectedRunIds={selectedRunIds}
        runSource={runSource}
        visibleRuns={visibleRuns}
        runFailureFilter={runFailureFilter}
        runFailureCategories={runFailureCategories}
        runsLoading={runsLoading}
        selectedRunId={selectedRunId}
        selectedRunIdSet={selectedRunIdSet}
        setTheme={setTheme}
        setShowGenerateModal={setShowGenerateModal}
        setShowImportNlModal={setShowImportNlModal}
        scrollSidebarTo={scrollSidebarTo}
        setCaseSelectMode={setCaseSelectMode}
        setSelectedCaseIds={setSelectedCaseIds}
        fetchCases={fetchCases}
        setCaseQuery={setCaseQuery}
        setSelectedTag={setSelectedTag}
        handleMoveCasesToGroup={handleMoveCasesToGroup}
        setCollapsedGroups={setCollapsedGroups}
        toggleCaseSelected={toggleCaseSelected}
        setSelectedSuiteId={setSelectedSuiteId}
        setSuiteDoc={setSuiteDoc}
        setSelectedSuiteRunId={setSelectedSuiteRunId}
        setSelectedSuiteRun={setSelectedSuiteRun}
        setSelectedCase={setSelectedCase}
        handleEditTags={handleEditTags}
        handleRename={handleRename}
        handleDeleteCase={handleDeleteCase}
        createSuite={createSuite}
        fetchSuites={fetchSuites}
        loadSuite={loadSuite}
        deleteSuite={deleteSuite}
        selectAllVisibleRuns={selectAllVisibleRuns}
        clearSelectedRuns={clearSelectedRuns}
        handleBatchDeleteRuns={handleBatchDeleteRuns}
        exitRunSelectMode={exitRunSelectMode}
        setRunFailureFilter={setRunFailureFilter}
        setRunSelectMode={setRunSelectMode}
        fetchRuns={fetchRuns}
        fetchAllRuns={fetchAllRuns}
        toggleRunSelected={toggleRunSelected}
        loadRunDetail={loadRunDetail}
        handleDeleteRun={handleDeleteRun}
        loadSettings={loadSettings}
        setShowSettings={setShowSettings}
        logout={logout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 min-w-0">
        {selectedSuiteRun ? (
          <SuiteRunDetailPanel
            selectedSuiteRun={selectedSuiteRun}
            suiteRunVM={suiteRunVM}
            cases={cases}
            suiteLogs={suiteLogs}
            suiteLogsEndRef={suiteLogsEndRef}
            suiteScreenshot={suiteScreenshot}
            onBack={() => { setSelectedSuiteRunId(null); setSelectedSuiteRun(null); }}
            openSuiteRunItem={openSuiteRunItem}
          />
        ) : mainCaseContext || (runDetailStandalone && selectedRun) ? (
          <>
            {/* Header Bar */}
            <div className="h-14 border-b border-zinc-200 bg-white px-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex flex-col leading-tight">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-zinc-900 truncate max-w-[520px]">{mainTitle}</div>
                    {isReplayMode && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-zinc-200 text-zinc-600 bg-zinc-50">
                        回放
                      </span>
                    )}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${isDirty ? 'border-amber-500 text-amber-500' : 'border-zinc-200 text-zinc-600'}`}>
                      {isDirty ? '未保存' : '已保存'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    {`CaseID: ${mainCaseId}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedEnvId}
                  onChange={(e) => setSelectedEnvId(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-[#10a37f]/50"
                >
                  <option value="">默认环境</option>
                  {envs.map(env => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
                {!isReplayMode && mainCaseContext && (
                  <>
                      <button
                        onClick={handleRestoreBackup}
                        title="如果你刚刚点击了错误的 AI 修复建议，可以点击这里撤销"
                        className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border border-zinc-200"
                      >
                        <History className="w-4 h-4" /> 撤销修复
                      </button>
                      <button
                        onClick={addStep}
                        disabled={!caseDoc}
                        className="flex items-center gap-2 bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-900 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border border-zinc-200"
                      >
                      <Plus className="w-4 h-4" /> 新增步骤
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!caseDoc || !isDirty || saving}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                        !caseDoc || !isDirty || saving
                          ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                          : 'bg-[#10a37f] hover:bg-[#0e8a6a] text-white border-transparent'
                      }`}
                    >
                      <Save className="w-4 h-4" /> {saving ? '保存中' : '保存'}
                    </button>
                  </>
                )}
                {isReplayMode && (
                  <button
                    onClick={() => { if (runDetailStandalone) { setSelectedRunId(null); setSelectedRun(null); setRunDetailStandalone(false); setLogs([]); resetScreenshots(); } else { handleExitReplay(); } }}
                    className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border border-zinc-200"
                  >
                    {runDetailStandalone ? '返回历史' : '返回编辑'}
                  </button>
                )}
                {!(isRunning || selectedRun?.status === 'running') ? (
                  <button 
                    onClick={handleRun}
                    className="flex items-center gap-2 bg-[#10a37f] hover:bg-[#0e8a6a] text-white px-5 py-1.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" /> 运行测试
                  </button>
                ) : (
                  <button 
                    onClick={handleStop}
                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-zinc-100 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors shadow-md shadow-black/20 animate-pulse"
                  >
                    <XCircle className="w-4 h-4" /> 停止运行
                  </button>
                )}
              </div>
            </div>

            {/* Content Area - Split View */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left Panel: Script Content / Logs */}
              <div className="flex-1 flex flex-col border-r border-zinc-200 bg-white min-w-0">
                {/* Script View */}
                <div className={`${isReplayMode ? 'h-full' : 'h-2/3'} flex flex-col border-b border-zinc-200 min-h-0`}>
                  {isReplayMode ? (
                    <div className="px-4 py-2 bg-zinc-50 text-xs font-semibold text-zinc-600 flex items-center justify-between border-b border-zinc-200">
                      <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5" />
                        运行回放
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {selectedRun ? `${formatStatus(selectedRun.status)} ${formatRunTime(selectedRun.started_at)}` : selectedRunId}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-zinc-50 text-xs font-semibold text-zinc-600 flex items-center justify-between border-b border-zinc-200">
                      <div className="flex items-center gap-2">
                        <FileJson className="w-3.5 h-3.5" />
                        {leftTab === 'editor' ? '用例编辑器' : leftTab === 'dataset' ? '变量与数据集' : '生成脚本 (Python)'}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setLeftTab('editor')}
                          className={`px-2 py-1 rounded-xl border text-xs transition-colors ${leftTab === 'editor' ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-900'}`}
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => setLeftTab('dataset')}
                          className={`px-2 py-1 rounded-xl border text-xs transition-colors ${leftTab === 'dataset' ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-900'}`}
                        >
                          变量/数据
                        </button>
                        <button
                          onClick={() => setLeftTab('python')}
                          className={`px-2 py-1 rounded-xl border text-xs transition-colors ${leftTab === 'python' ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-900'}`}
                        >
                          脚本
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 overflow-auto p-4">
                    {isReplayMode ? (
                      selectedRun ? (
                        <div className="space-y-4 text-sm">
                          <RunDiagnosticsPanel run={selectedRun} stats={diagnosticStats} />

                          {selectedRun.status === 'failed' ? (
                            <RunFailureReasonCard reason={selectedRun.failure_reason} />
                          ) : null}

                          <RunLogPanel
                            filter={runLogFilter}
                            filteredLogs={filteredRunLogs}
                            stats={runLogStats}
                            onFilterChange={setRunLogFilter}
                          />

                          <RunHealEventsPanel
                            run={selectedRun}
                            selectedRunId={selectedRunId}
                            approvedHeals={approvedHeals}
                            approvingHeals={approvingHeals}
                            onOpenCompare={handleOpenHealCompare}
                            onOpenScreenshot={openRunScreenshot}
                            onApproveHeal={handleApproveHeal}
                          />
                          <RunTokenPanel run={selectedRun} />
                          <AIFixSuggestionPanel
                            suggestion={selectedRun.ai_fix_suggestion}
                            fixSuggestLoading={fixSuggestLoading}
                            applyFixLoading={applyFixLoading}
                            onGenerate={() => requestAIFixSuggestion(false)}
                            onForceRefresh={() => requestAIFixSuggestion(true)}
                            onApply={applyAIFixSuggestion}
                          />
                          <div className="text-xs text-zinc-600">
                            回放模式仅展示运行结果；如需编辑用例点击右上角「返回编辑」。
                          </div>
                        </div>
                      ) : (
                        <div className="text-zinc-600 italic">加载中...</div>
                      )
                    ) : (
                      leftTab === 'python' ? (
                        <CodeBlock
                          code={scriptContent}
                          language="python"
                          className="custom-scrollbar text-[13px] font-mono"
                        />
                      ) : leftTab === 'dataset' ? (
                        !caseDoc ? (
                          <div className="text-zinc-600 italic">加载中...</div>
                        ) : (
                          <DatasetEditor
                            key={caseDoc.id}
                            variables={caseDoc.variables || {}}
                            dataset={caseDoc.dataset || []}
                            onVariablesChange={(vars) => setCaseDoc({ ...caseDoc, variables: vars })}
                            onDatasetChange={(ds) => setCaseDoc({ ...caseDoc, dataset: ds })}
                          />
                        )
                      ) : (
                        !caseDoc ? (
                          <div className="text-zinc-600 italic">加载中...</div>
                        ) : (
                          <CaseStepEditor
                            caseDoc={caseDoc}
                            onCaseDocChange={setCaseDoc}
                            onUpdateStep={updateStep}
                            onRemoveStep={removeStep}
                            onDuplicateStep={duplicateStep}
                            onMoveStep={moveStep}
                          />
                        )
                      )
                    )}
                  </div>
                </div>
                
                {/* Terminal / Logs View */}
                {!isReplayMode && (
                  <div className="h-1/3 flex flex-col min-h-0 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black">
                    <div className="px-4 py-2.5 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-xl flex items-center justify-center border ${isRunning ? 'border-[#10a37f]/25 bg-[#10a37f]/10 text-[#0e8a6a] dark:text-[#10a37f]' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'}`}>
                          <Terminal className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="tracking-wide">实时执行日志</span>
                          <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500">Live execution stream</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRunning && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10a37f]/20 bg-[#10a37f]/10 px-2 py-1 text-[10px] font-medium text-[#0e8a6a] dark:text-[#10a37f]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10a37f] animate-pulse" />
                            LIVE
                          </span>
                        )}
                        <span className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 text-[10px] font-mono font-medium text-zinc-500 dark:text-zinc-400">
                          {logs.length} lines
                        </span>
                      </div>
                    </div>
                    <LogStream items={logs} emptyText="点击右上角「运行测试」后会在这里实时滚动输出" endRef={liveLogsEndRef} />
                  </div>
                )}
              </div>

              <RunScreenshotPanel
                isReplayMode={isReplayMode}
                isRunning={isRunning}
                screenshot={screenshot}
                selectedRunId={selectedRunId}
                selectedRun={selectedRun}
                selectedShotFile={selectedShotFile}
                shotCache={shotCache}
                screenshotsContainerRef={screenshotsContainerRef}
                onSelectShotFile={setSelectedShotFile}
                onScreenshotChange={setScreenshot}
                loadScreenshotFile={loadScreenshotFile}
              />
            </div>
          </>
        ) : suiteDoc ? (
          <SuiteEditorPanel
            suiteDoc={suiteDoc}
            cases={cases}
            envs={envs}
            isSuiteDirty={isSuiteDirty}
            suiteAddCaseId={suiteAddCaseId}
            suiteAvailableCases={suiteAvailableCases}
            suiteRuns={suiteRuns}
            suiteRunsLoading={suiteRunsLoading}
            selectedSuiteRunId={selectedSuiteRunId}
            onSuiteDocChange={setSuiteDoc}
            onSuiteAddCaseIdChange={setSuiteAddCaseId}
            onSaveSuite={saveSuite}
            onRunSuite={runSuite}
            onAddCase={suiteAddCase}
            onMoveCase={suiteMoveCase}
            onRemoveCase={suiteRemoveCase}
            onRefreshRuns={fetchSuiteRuns}
            onOpenRun={loadSuiteRunDetail}
            onDeleteRun={handleDeleteSuiteRun}
          />
        ) : (
          <EmptyMainPanel />
        )}
      </div>
      
      {/* Add custom keyframes for scanning effect */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(-10px); }
          100% { transform: translateY(800px); }
        }
      `}} />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          apiBase={apiBase}
          apiKey={apiKey}
          apiKeySet={apiKeySet}
          modelName={modelName}
          envs={envs}
          prompts={prompts}
          activePromptFile={activePromptFile}
          settingsTab={settingsTab}
          savingSettings={savingSettings}
          testingSettings={testingSettings}
          settingsTestResult={settingsTestResult}
          onApiBaseChange={setApiBase}
          onApiKeyChange={setApiKey}
          onModelNameChange={setModelName}
          onEnvsChange={setEnvs}
          onPromptsChange={setPrompts}
          onActivePromptFileChange={setActivePromptFile}
          onSettingsTabChange={setSettingsTab}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
          onTestConnection={testSettingsConnection}
        />
      )}

      {confirmModal && (
        <ConfirmModal options={confirmModal} onClose={closeConfirm} />
      )}

      {promptModal && (
        <PromptModal
          options={promptModal}
          value={promptValue}
          onValueChange={setPromptValue}
          onClose={closePrompt}
        />
      )}

      {showCreateSuiteModal && (
        <CreateSuiteModal
          name={createSuiteName}
          envId={createSuiteEnvId}
          envs={envs}
          creating={creatingSuite}
          onNameChange={setCreateSuiteName}
          onEnvIdChange={setCreateSuiteEnvId}
          onClose={() => setShowCreateSuiteModal(false)}
          onConfirm={confirmCreateSuite}
        />
      )}

      {showImportNlModal && (
        <NaturalLanguageImportModal
          text={importNlText}
          group={importNlGroup}
          startUrl={importNlStartUrl}
          items={importNlItems}
          selected={importNlSelected}
          loading={importNlLoading}
          error={importNlError}
          onTextChange={setImportNlTextAndClearPreview}
          onGroupChange={setImportNlGroup}
          onStartUrlChange={setImportNlStartUrl}
          onSelectedChange={setImportNlSelected}
          onFileChange={handleImportNlFile}
          onPreview={handleImportNlPreview}
          onConfirm={handleImportNlConfirm}
          onClose={() => setShowImportNlModal(false)}
        />
      )}

      {/* Generate Case Modal */}
      {showGenerateModal && (
        <GenerateCaseModal
          form={generateForm}
          generating={generating}
          onFormChange={setGenerateForm}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerateCase}
        />
      )}

      {comparingHealEvent && (
        <HealCompareModal
          event={comparingHealEvent}
          images={compareImages}
          loading={compareImagesLoading}
          onClose={closeHealCompare}
          onOpenImage={openImageViewer}
        />
      )}

      {imageViewer && (
        <ImageViewerModal
          title={imageViewer.title}
          src={imageViewer.src}
          scale={viewerScale}
          offset={viewerOffset}
          dragging={viewerDragging}
          onZoomIn={() => setViewerScale((s) => Math.min(5, s * 1.2))}
          onZoomOut={() => setViewerScale((s) => Math.max(0.2, s / 1.2))}
          onReset={resetViewerTransform}
          onClose={closeImageViewer}
          onWheel={onViewerWheel}
          onMouseDown={onViewerMouseDown}
          onMouseMove={onViewerMouseMove}
          onMouseUp={stopViewerDrag}
        />
      )}
    </div>
  );
}

export default App;
