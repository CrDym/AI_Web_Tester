import { useMemo, useState, useEffect, useRef } from 'react';
import { AlertTriangle, Play, FileJson, Terminal, SquareTerminal, RefreshCw, XCircle, Plus, Save, Pencil, Trash2, History, RotateCw, Settings, MonitorPlay, Loader2, Search, Tag, Eye, Activity, ZoomIn, ZoomOut } from 'lucide-react';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface TestCase {
  id: string;
  name: string;
  type: string;
  tags?: string[];
  updated_at?: number;
}

interface RunSummary {
  id: string;
  case_id?: string;
  type?: string;
  status?: string;
  started_at?: number;
  ended_at?: number | null;
  duration_ms?: number | null;
  token_usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  explore?: any;
}

interface HealEvent {
  ts: number;
  intent?: string | null;
  original_selector?: string | null;
  new_id?: string | null;
  new_selector?: string | null;
  reason?: string | null;
  success?: boolean;
  source?: string | null;
  token_usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  model?: string | null;
  before_file?: string | null;
  after_file?: string | null;
}

interface AIFixSuggestion {
  created_at?: number;
  root_cause?: string;
  explanation?: string;
  suggestions?: string[];
  patched_steps?: CaseStep[] | null;
  token_usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  model?: string | null;
}

interface RunDetail {
  id: string;
  case_id: string;
  status: string;
  started_at: number;
  ended_at?: number | null;
  duration_ms?: number | null;
  logs?: string[];
  screenshots?: Array<{ file: string; ts: number }>;
  heal_events?: HealEvent[];
  ai_fix_suggestion?: AIFixSuggestion;
  token_usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  token_summary?: any;
  explore?: any;
}

interface SuiteSummary {
  id: string;
  name: string;
  env_id?: string | null;
  case_count?: number;
  updated_at?: number | null;
}

interface SuiteDoc {
  id: string;
  name: string;
  env_id?: string | null;
  setup_case_id?: string | null;
  case_ids: string[];
  created_at?: number;
  updated_at?: number;
}

interface SuiteRunItem {
  case_id: string;
  run_id: string;
  status: string;
  duration_ms?: number | null;
  heal_count?: number;
  token_usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

interface SuiteRunDetail {
  id: string;
  suite_id: string;
  suite_name: string;
  env_id?: string | null;
  status: string;
  started_at: number;
  ended_at?: number | null;
  duration_ms?: number | null;
  setup_case_id?: string | null;
  case_ids?: string[];
  current_index?: number | null;
  current_case_id?: string | null;
  items: SuiteRunItem[];
  summary?: { total?: number; passed?: number; failed?: number; heal_total?: number; token_prompt?: number; token_completion?: number; token_total?: number };
}

interface SuiteRunSummary {
  id: string;
  suite_id?: string;
  suite_name?: string;
  env_id?: string | null;
  status?: string;
  started_at?: number;
  ended_at?: number | null;
  duration_ms?: number | null;
  summary?: { total?: number; passed?: number; failed?: number; heal_total?: number; token_prompt?: number; token_completion?: number; token_total?: number };
}

interface ConfirmModalOptions {
  title: string;
  description?: string;
  confirmText?: string;
  destructive?: boolean;
}

interface PromptModalOptions {
  title: string;
  description?: string;
  confirmText?: string;
  placeholder?: string;
  initialValue?: string;
}

type StepType = 'click' | 'input' | 'wait' | 'assert' | 'hover' | 'select_option' | 'double_click' | 'right_click' | 'press_key' | 'scroll';

interface CaseStep {
  type: StepType;
  selector: string;
  intent?: string | null;
  value?: string | null;
  url?: string | null;
  snapshot?: string | null;
  assert_type?: 'text' | 'url' | 'visible' | null;
  disabled?: boolean;
}

interface CaseDoc {
  id: string;
  name: string;
  start_url?: string | null;
  steps: CaseStep[];
  tags?: string[];
}

interface EnvConfig {
  id: string;
  name: string;
  base_url: string;
}

function App() {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [caseQuery, setCaseQuery] = useState('');
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
  const [caseDoc, setCaseDoc] = useState<CaseDoc | null>(null);
  const [scriptContent, setScriptContent] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  
  const [suiteLogs, setSuiteLogs] = useState<string[]>([]);
  const [suiteScreenshot, setSuiteScreenshot] = useState<string | null>(null);
  const suiteWsRef = useRef<{ ws: WebSocket, runId: string } | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [leftTab, setLeftTab] = useState<'editor' | 'python'>('editor');
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [lastSaved, setLastSaved] = useState<string>('');
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [exploreRuns, setExploreRuns] = useState<RunSummary[]>([]);
  const [pendingRunToOpen, setPendingRunToOpen] = useState<{ case_id: string; run_id: string } | null>(null);
  const [selectedShotFile, setSelectedShotFile] = useState<string | null>(null);
  const [shotCache, setShotCache] = useState<Record<string, string>>({});
  const shotCacheRef = useRef<Record<string, string>>({});
  const [approvingHeals, setApprovingHeals] = useState<Record<string, boolean>>({});
  const [approvedHeals, setApprovedHeals] = useState<Record<string, boolean>>({});
  const screenshotsContainerRef = useRef<HTMLDivElement>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showExploreModal, setShowExploreModal] = useState(false);
  const [showCreateSuiteModal, setShowCreateSuiteModal] = useState(false);
  const [createSuiteName, setCreateSuiteName] = useState('');
  const [createSuiteEnvId, setCreateSuiteEnvId] = useState<string>('');
  const [creatingSuite, setCreatingSuite] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalOptions | null>(null);
  const confirmResolverRef = useRef<((ok: boolean) => void) | null>(null);
  const [promptModal, setPromptModal] = useState<PromptModalOptions | null>(null);
  const promptResolverRef = useRef<((val: string | null) => void) | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [generateForm, setGenerateForm] = useState({ name: '', start_url: '', instruction: '' });
  const [exploreForm, setExploreForm] = useState({ name: '', start_url: '', goal: '', done_hint: '', max_steps: 12 });
  const [generating, setGenerating] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [apiBase, setApiBase] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('gpt-4o-mini');
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [activePromptFile, setActivePromptFile] = useState<string>('');
  const [settingsTab, setSettingsTab] = useState<'env' | 'prompts'>('env');
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingSettings, setTestingSettings] = useState(false);
  const [settingsTestResult, setSettingsTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [envs, setEnvs] = useState<EnvConfig[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  
  // 自愈对比大盘状态
  const [comparingHealEvent, setComparingHealEvent] = useState<HealEvent | null>(null);
  const [compareImages, setCompareImages] = useState<{before: string | null, after: string | null}>({before: null, after: null});
  const [compareImagesLoading, setCompareImagesLoading] = useState(false);
  const [imageViewer, setImageViewer] = useState<{ src: string; title: string } | null>(null);
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const viewerDraggingRef = useRef(false);
  const viewerDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const viewerOffsetStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 新增用例搜索与过滤状态
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [fixSuggestLoading, setFixSuggestLoading] = useState(false);
  const [applyFixLoading, setApplyFixLoading] = useState(false);

  const fetchCases = async () => {
    try {
      const res = await axios.get('/api/cases');
      setCases(res.data);
      // 提取所有可用的 tag
      const tags = new Set<string>();
      res.data.forEach((c: TestCase) => {
        c.tags?.forEach(t => tags.add(t));
      });
      setAllTags(Array.from(tags).sort());
    } catch (e) {
      console.error('Failed to fetch cases', e);
    }
  };

  const fetchExploreRuns = async () => {
    try {
      const res = await axios.get('/api/runs');
      const list = (res.data || []) as RunSummary[];
      const explores = list.filter((r) => r.type === 'explore' || (r.case_id || '').startsWith('explore:'));
      setExploreRuns(explores.slice(0, 50));
    } catch (e) {
      setExploreRuns([]);
    }
  };

  const fetchSuites = async () => {
    try {
      const res = await axios.get('/api/suites');
      setSuites(res.data || []);
    } catch (e) {
      setSuites([]);
    }
  };

  const confirmAction = (opts: ConfirmModalOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmModal(opts);
    });
  };

  const closeConfirm = (ok: boolean) => {
    setConfirmModal(null);
    const r = confirmResolverRef.current;
    confirmResolverRef.current = null;
    if (r) r(ok);
  };

  const promptAction = (opts: PromptModalOptions) => {
    return new Promise<string | null>((resolve) => {
      promptResolverRef.current = resolve;
      setPromptValue(opts.initialValue || '');
      setPromptModal(opts);
    });
  };

  const closePrompt = (val: string | null) => {
    setPromptModal(null);
    const r = promptResolverRef.current;
    promptResolverRef.current = null;
    if (r) r(val);
  };

  const loadSuite = async (suiteId: string) => {
    try {
      setSelectedSuiteId(suiteId);
      setSelectedCase(null);
      setCaseDoc(null);
      setScriptContent('');
      setSelectedRunId(null);
      setSelectedRun(null);
      setScreenshot(null);
      setLogs([]);
      setSelectedShotFile(null);
      setSelectedSuiteRunId(null);
      setSelectedSuiteRun(null);
      const res = await axios.get(`/api/suites/${suiteId}`);
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
      const res = await axios.post('/api/suites', { name, env_id: createSuiteEnvId || null, case_ids: [] });
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
      await axios.delete(`/api/suites/${suiteId}`);
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
      await axios.put(`/api/suites/${suiteDoc.id}`, {
        name: suiteDoc.name,
        env_id: suiteDoc.env_id || null,
        setup_case_id: suiteDoc.setup_case_id || null,
        case_ids: suiteDoc.case_ids || []
      });
      const refreshed = await axios.get(`/api/suites/${suiteDoc.id}`);
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
      const res = await axios.get('/api/suite_runs', { params: { suite_id: suiteId } });
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
      const res = await axios.get(`/api/suite_runs/${suiteRunId}`);
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
      const res = await axios.post(`/api/suites/${suiteDoc.id}/run`, null, { params: { env_id: suiteDoc.env_id || null } });
      const suiteRunId = res.data?.suite_run_id;
      if (suiteRunId) {
        await fetchSuiteRuns(suiteDoc.id);
        await loadSuiteRunDetail(suiteRunId);
      }
    } catch (e: any) {
      alert('运行套件失败: ' + (e.response?.data?.error || e.message));
    }
  };

  const loadSettings = async () => {
    try {
      const res = await axios.get('/api/config');
      setApiBase(res.data.OPENAI_API_BASE || '');
      setApiKey(res.data.OPENAI_API_KEY || '');
      setModelName(res.data.OPENAI_MODEL_NAME || 'gpt-4o-mini');
      const envRes = await axios.get('/api/environments');
      setEnvs(envRes.data || []);
      const promptRes = await axios.get('/api/prompts');
      setPrompts(promptRes.data || {});
      if (promptRes.data && Object.keys(promptRes.data).length > 0) {
        setActivePromptFile(Object.keys(promptRes.data)[0]);
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.post('/api/config', {
        OPENAI_API_BASE: apiBase,
        OPENAI_API_KEY: apiKey,
        OPENAI_MODEL_NAME: modelName
      });
      await axios.post('/api/environments', envs);
      for (const [filename, content] of Object.entries(prompts)) {
        await axios.put(`/api/prompts/${filename}`, { content });
      }
      setShowSettings(false);
      setLogs(prev => [...prev, '✅ 配置已保存']);
    } catch (e: any) {
      setLogs(prev => [...prev, `❌ 配置保存失败: ${e.message}`]);
    } finally {
      setSavingSettings(false);
    }
  };

  const testSettingsConnection = async () => {
    setTestingSettings(true);
    setSettingsTestResult(null);
    try {
      const res = await axios.post('/api/config/test', {
        OPENAI_API_BASE: apiBase,
        OPENAI_API_KEY: apiKey,
        OPENAI_MODEL_NAME: modelName
      });
      if (res.data?.status === 'success') {
        const tokenText = formatTokenUsage(res.data.token_usage);
        setSettingsTestResult({ ok: true, message: tokenText ? `${res.data.message} · Token ${tokenText}` : res.data.message });
      }
    } catch (e: any) {
      setSettingsTestResult({ ok: false, message: e.response?.data?.error || e.message });
    } finally {
      setTestingSettings(false);
    }
  };

  useEffect(() => {
    fetchCases();
    fetchSuites();
    loadSettings();
    fetchExploreRuns();
  }, []);

  const filteredCases = useMemo(() => {
    let result = cases;
    if (selectedTag) {
      result = result.filter(c => c.tags && c.tags.includes(selectedTag));
    }
    const q = caseQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q));
    }
    return result;
  }, [cases, caseQuery, selectedTag]);

  const fetchRuns = async (caseId: string) => {
    setRunsLoading(true);
    try {
      const res = await axios.get('/api/runs', { params: { case_id: caseId } });
      setRuns(res.data || []);
    } catch (e) {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

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
      await axios.delete(`/api/suite_runs/${runId}`);
      if (selectedSuiteRunId === runId) {
        setSelectedSuiteRunId(null);
        setSelectedSuiteRun(null);
        setLogs([]);
        setScreenshot(null);
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
      await axios.delete(`/api/runs/${runId}`);
      if (selectedRunId === runId) {
        setSelectedRunId(null);
        setSelectedRun(null);
        setLogs([]);
        setScreenshot(null);
        setSelectedShotFile(null);
      }
      if (selectedCase) {
        fetchRuns(selectedCase.id);
      }
    } catch (err: any) {
      alert('删除失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const loadRunDetail = async (runId: string) => {
    try {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsRunning(false);

      const res = await axios.get(`/api/runs/${runId}`);
      const detail: RunDetail = res.data;
      // 如果后端实际仍在运行，则将 isRunning 设为 true 以显示停止按钮
      if (detail.status === 'running') {
        setIsRunning(true);
      }
      
      setSelectedRunId(runId);
      setSelectedRun(detail);
      setLogs(detail.logs || []);

      if (detail.screenshots && detail.screenshots.length > 0) {
        void prefetchScreenshots(runId, detail.screenshots);
      }

      const last = detail.screenshots && detail.screenshots.length > 0 ? detail.screenshots[detail.screenshots.length - 1] : null;
      if (last?.file) {
        setSelectedShotFile(last.file);
        const cacheKey = `${runId}/${last.file}`;
        if (shotCacheRef.current[cacheKey]) {
          setScreenshot(shotCacheRef.current[cacheKey]);
        } else {
          const imgRes = await axios.get(`/api/runs/${runId}/screenshots/${last.file}`);
          const b64 = imgRes.data?.data || null;
          setScreenshot(b64);
          if (b64) {
            setShotCache((prev) => {
              const next = { ...prev, [cacheKey]: b64 };
              shotCacheRef.current = next;
              return next;
            });
          }
        }
      } else {
        setScreenshot(null);
        setSelectedShotFile(null);
      }
    } catch (e: any) {
      setLogs([`❌ 回放加载失败: ${e.message}`]);
      setScreenshot(null);
      setSelectedRun(null);
      setSelectedShotFile(null);
    }
  };

  useEffect(() => {
    if (!selectedCase) return;
    if (selectedCase.type === 'explore') return;
    const pending = pendingRunToOpen && pendingRunToOpen.case_id === selectedCase.id ? pendingRunToOpen : null;
    setLogs([]);
    setScreenshot(null);
    setScriptContent('');
    setCaseDoc(null);
    setLeftTab('editor');
    setSelectedRunId(null);
    setSelectedRun(null);
    axios.get(`/api/cases/${selectedCase.id}`).then(res => {
      setCaseDoc(res.data);
      setLastSaved(JSON.stringify(res.data));
      return axios.get(`/api/cases/${selectedCase.id}/script`);
    }).then(res => {
      setScriptContent(res.data.content || '');
      fetchRuns(selectedCase.id);
      if (pending) {
        loadRunDetail(pending.run_id).finally(() => setPendingRunToOpen(null));
      } else {
        setSelectedRunId(null);
      }
    }).catch(e => {
      setScriptContent('Failed to load case: ' + e.message);
    });
  }, [selectedCase]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, suiteLogs]);

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
    const wsUrl = `${protocol}//${window.location.host}/ws/run/${runId}`;
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

  const handleRun = async () => {
    if (!selectedCase) return;
    
    setIsRunning(true);
    setLogs(['🚀 正在初始化测试环境...']);
    setScreenshot(null);
    
    try {
      const res = await axios.post(`/api/run/${selectedCase.id}${selectedEnvId ? `?env_id=${selectedEnvId}` : ''}`);
      const sessionId = res.data.session_id;
      const runId = res.data.run_id || sessionId;
      setSelectedRunId(runId);
      
      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In dev mode, we proxy /ws to the backend
      const wsUrl = `${protocol}//${window.location.host}/ws/run/${sessionId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setLogs(prev => [...prev, data.message]);
        } else if (data.type === 'screenshot') {
          setScreenshot(data.data);
        } else if (data.type === 'status') {
          if (data.status === 'completed' || data.status === 'failed') {
            setIsRunning(false);
            setLogs(prev => [...prev, `🏁 执行结束，状态: ${formatStatus(data.status)}`]);
            ws.close();
            if (selectedCase) {
              fetchRuns(selectedCase.id);
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
      await axios.post(`/api/cases/${selectedRun.case_id}/heal/approve`, {
        old_selector: oldSelector,
        new_selector: newSelector,
        step_intent: intent
      });
      setApprovedHeals((prev) => ({ ...prev, [key]: true }));
      setLogs(prev => [...prev, `✅ 已将用例 ${selectedRun.case_id} 中的选择器更新为: ${newSelector}`]);
      if (selectedCase?.id === selectedRun.case_id) {
        const refreshed = await axios.get(`/api/cases/${selectedCase.id}`);
        setCaseDoc(refreshed.data);
        setLastSaved(JSON.stringify(refreshed.data));
        const scriptRes = await axios.get(`/api/cases/${selectedCase.id}/script`);
        setScriptContent(scriptRes.data.content || '');
      }
    } catch (e: any) {
      setLogs(prev => [...prev, `❌ 审核失败: ${e.response?.data?.error || e.message}`]);
    } finally {
      setApprovingHeals((prev) => ({ ...prev, [key]: false }));
    }
  };

  const isDirty = useMemo(() => {
    if (!caseDoc) return false;
    if (!lastSaved) return true;
    return JSON.stringify(caseDoc) !== lastSaved;
  }, [caseDoc, lastSaved]);

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
    const doneCount = (selectedSuiteRun.items || []).filter((it) => it.status === 'completed' || it.status === 'failed').length;
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

  const addStep = () => {
    if (!caseDoc) return;
    setCaseDoc({
      ...caseDoc,
      steps: [...caseDoc.steps, { type: 'click', selector: '', intent: '', value: '' }],
    });
  };

  const updateStep = (idx: number, patch: Partial<CaseStep>) => {
    if (!caseDoc) return;
    const steps = caseDoc.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setCaseDoc({ ...caseDoc, steps });
  };

  const removeStep = (idx: number) => {
    if (!caseDoc) return;
    const steps = caseDoc.steps.filter((_, i) => i !== idx);
    setCaseDoc({ ...caseDoc, steps });
  };

  const duplicateStep = (idx: number) => {
    if (!caseDoc) return;
    const steps = [...caseDoc.steps];
    steps.splice(idx + 1, 0, { ...steps[idx] });
    setCaseDoc({ ...caseDoc, steps });
  };

  const moveStep = (idx: number, dir: 'up' | 'down') => {
    if (!caseDoc) return;
    const steps = [...caseDoc.steps];
    if (dir === 'up' && idx > 0) {
      [steps[idx - 1], steps[idx]] = [steps[idx], steps[idx - 1]];
    } else if (dir === 'down' && idx < steps.length - 1) {
      [steps[idx + 1], steps[idx]] = [steps[idx], steps[idx + 1]];
    }
    setCaseDoc({ ...caseDoc, steps });
  };

  const handleRestoreBackup = async () => {
    if (!selectedCase) return;
    if (!window.confirm("确定要恢复到上一个用例版本吗？(通常用于撤销误操作的 AI 修复建议)")) return;
    try {
      const res = await axios.post(`/api/cases/${selectedCase.id}/restore`);
      setLogs(prev => [...prev, `✅ ${res.data.message}`]);
      // 重新加载该用例
      const refreshed = await axios.get(`/api/cases/${selectedCase.id}`);
      setCaseDoc(refreshed.data);
      setLastSaved(JSON.stringify(refreshed.data));
    } catch (e: any) {
      setLogs(prev => [...prev, `❌ 恢复备份失败: ${e.response?.data?.error || e.message}`]);
      alert(`恢复备份失败: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleSave = async () => {
    if (!selectedCase || !caseDoc) return;
    setSaving(true);
    try {
      await axios.put(`/api/cases/${selectedCase.id}`, {
        start_url: caseDoc.start_url,
        steps: caseDoc.steps,
      });
      const refreshed = await axios.get(`/api/cases/${selectedCase.id}`);
      setCaseDoc(refreshed.data);
      setLastSaved(JSON.stringify(refreshed.data));
      const scriptRes = await axios.get(`/api/cases/${selectedCase.id}/script`);
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
      const res = await axios.post(`/api/cases/${target.id}/rename`, { name: next });
      await fetchCases();
      const updated = res.data?.case;
      if (updated?.id) {
        setSelectedCase(updated);
      }
      setLogs((prev) => [...prev, `✅ 已重命名为 ${next}`]);
    } catch (e: any) {
      setLogs((prev) => [...prev, `❌ 重命名失败: ${e.message}`]);
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
      const caseRes = await axios.get(`/api/cases/${target.id}`);
      const fullCase = caseRes.data;
      fullCase.tags = newTags;
      await axios.put(`/api/cases/${target.id}`, fullCase);
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
      const res = await axios.post(`/api/runs/${selectedRunId}/ai_fix_suggest`, { force });
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
      const caseRes = await axios.get(`/api/cases/${selectedRun.case_id}`);
      const fullCase = caseRes.data;
      fullCase.steps = patchedSteps;
      await axios.put(`/api/cases/${selectedRun.case_id}`, fullCase);
      await fetchCases();
      setLogs((prev) => [...prev, '✅ 已应用 AI 修复建议到用例']);
    } catch (e: any) {
      setLogs((prev) => [...prev, `❌ 应用 AI 修复建议失败: ${e.message}`]);
    } finally {
      setApplyFixLoading(false);
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
      await axios.delete(`/api/cases/${target.id}`);
      await fetchCases();
      if (selectedCase?.id === target.id) {
        setSelectedCase(null);
        setCaseDoc(null);
        setScriptContent('');
        setScreenshot(null);
      }
      setLogs((prev) => [...prev, '✅ 用例已删除']);
    } catch (e: any) {
      setLogs((prev) => [...prev, `❌ 删除失败: ${e.message}`]);
    }
  };

  const handleDeleteExploreRun = async (r: RunSummary) => {
    if (!r?.id) return;
    const name = (r.explore?.case_name || '').trim() || (typeof r.case_id === 'string' && r.case_id.startsWith('explore:') ? r.case_id.slice('explore:'.length) : r.id);
    const ok = await confirmAction({
      title: '删除探索记录',
      description: r.status === 'running'
        ? `该探索记录当前标记为 running。\n\n- 如果仍在执行，删除会失败（为了避免留下后台进程）。\n- 如果是“假 running”（例如服务重启导致状态没更新），可以尝试删除用于清理。\n\n确认删除探索记录「${name}」？仅删除本次探索的运行记录与截图，不会删除已生成的用例。`
        : `确认删除探索记录「${name}」？仅删除本次探索的运行记录与截图，不会删除已生成的用例。`,
      confirmText: '删除记录',
      destructive: true
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/runs/${r.id}`);
      await fetchExploreRuns();
      if (selectedRunId === r.id) {
        setSelectedRunId(null);
        setSelectedRun(null);
        setScreenshot(null);
        setSelectedShotFile(null);
        if (selectedCase?.type === 'explore') {
          setSelectedCase(null);
          setCaseDoc(null);
          setScriptContent('');
        }
      }
      setLogs((prev) => [...prev, '✅ 探索记录已删除']);
    } catch (e: any) {
      setLogs((prev) => [...prev, `❌ 删除探索记录失败: ${e.response?.data?.error || e.message}`]);
    }
  };

  const handleGenerateCase = async () => {
    if (!generateForm.name.trim() || !generateForm.instruction.trim()) {
      alert('用例名称和自然语言指令不能为空！');
      return;
    }
    setGenerating(true);
    try {
      const res = await axios.post('http://localhost:8000/api/cases/generate', generateForm);
      if (res.data.status === 'ok') {
        const tokenText = formatTokenUsage(res.data.token_usage);
        if (tokenText) {
          setLogs((prev) => [...prev, `🧮 用例生成 Token: ${tokenText}`]);
        }
        setShowGenerateModal(false);
        setGenerateForm({ name: '', start_url: '', instruction: '' });
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

  const handleExplore = async () => {
    if (!exploreForm.name.trim() || !exploreForm.start_url.trim() || !exploreForm.goal.trim()) {
      alert('用例名称、初始 URL 和目标描述不能为空！');
      return;
    }
    setExploring(true);
    setIsRunning(true);
    setLogs(['🧭 探索模式启动中...']);
    setScreenshot(null);
    setSelectedRun(null);
    try {
      const res = await axios.post('/api/explore', { ...exploreForm, max_steps: Number(exploreForm.max_steps) || 12 });
      const sessionId = res.data.session_id;
      const runId = res.data.run_id || sessionId;
      
      setSelectedCase({ id: 'explore_temp', name: `[探索] ${exploreForm.name}`, type: 'explore' });
      setCaseDoc({ id: 'explore_temp', name: exploreForm.name, start_url: exploreForm.start_url, steps: [] });
      setLeftTab('editor');
      
      setSelectedRunId(runId);
      setShowExploreModal(false);
      void fetchExploreRuns();

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/run/${sessionId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setLogs(prev => [...prev, data.message]);
        } else if (data.type === 'screenshot') {
          setScreenshot(data.data);
        } else if (data.type === 'status') {
          if (data.status === 'completed' || data.status === 'failed') {
            setIsRunning(false);
            setExploring(false);
            setLogs(prev => [...prev, `🏁 探索结束，状态: ${formatStatus(data.status)}`]);
            void fetchExploreRuns();
            ws.close();
            void (async () => {
              try {
                const detail = await axios.get(`/api/runs/${runId}`);
                const genId = detail.data?.explore?.generated_case_id;
                if (genId) {
                  setLogs(prev => [...prev, `✅ 已生成用例: ${genId}`]);
                  await fetchCases();
                  setSelectedCase({ id: genId, name: exploreForm.name, type: 'recorded' });
                  void fetchExploreRuns();
                } else if (data.status === 'completed') {
                  setLogs(prev => [...prev, `⚠️ 探索完成，但未找到生成的用例记录`]);
                }
              } catch {
              }
            })();
          }
        }
      };

      ws.onerror = () => {
        setLogs(prev => [...prev, '❌ WebSocket 连接错误']);
        setIsRunning(false);
        setExploring(false);
      };
    } catch (e: any) {
      setLogs(prev => [...prev, `❌ 启动失败: ${e.response?.data?.error || e.message}`]);
      setIsRunning(false);
      setExploring(false);
    }
  };

  const handleStop = async () => {
    if (selectedRunId) {
      try {
        await axios.post(`/api/runs/${selectedRunId}/stop`);
        setLogs(prev => [...prev, '🛑 已向后端发送终止指令，正在结束进程...']);
      } catch (e: any) {
        setLogs(prev => [...prev, `⚠️ 终止进程失败: ${e.response?.data?.error || e.message}`]);
      }
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsRunning(false);
    setExploring(false);
  };

  const handleExitReplay = () => {
    setSelectedRunId(null);
    setSelectedRun(null);
    setScreenshot(null);
    setLogs([]);
    setSelectedShotFile(null);
  };

  const formatRunTime = (ts?: number | null) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const formatTokenUsage = (u?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null) => {
    if (!u) return '';
    const t = u.total_tokens ?? 0;
    const p = u.prompt_tokens ?? 0;
    const c = u.completion_tokens ?? 0;
    if (!t && !p && !c) return '';
    return `${t} (P${p}/C${c})`;
  };

  const formatStatus = (status: string | undefined | null) => {
    if (!status) return '';
    switch (status.toLowerCase()) {
      case 'completed': return '已完成';
      case 'failed': return '执行失败';
      case 'running': return '运行中';
      case 'pending': return '等待中';
      default: return status;
    }
  };

  const isReplayMode = !!selectedRunId && (!isRunning || selectedCase?.type === 'explore');

  const formatShotTime = (ms?: number) => {
    if (!ms) return '';
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  useEffect(() => {
    shotCacheRef.current = shotCache;
  }, [shotCache]);

  const loadScreenshotFile = async (runId: string, file: string) => {
    const cacheKey = `${runId}/${file}`;
    if (shotCacheRef.current[cacheKey]) return shotCacheRef.current[cacheKey];
    const imgRes = await axios.get(`/api/runs/${runId}/screenshots/${file}`);
    const b64 = imgRes.data?.data || '';
    if (b64) {
      setShotCache((prev) => {
        const next = { ...prev, [cacheKey]: b64 };
        shotCacheRef.current = next;
        return next;
      });
    }
    return b64;
  };

  const prefetchScreenshots = async (runId: string, screenshots: { file: string }[]) => {
    const concurrency = 4;
    for (let i = 0; i < screenshots.length; i += concurrency) {
      const batch = screenshots.slice(i, i + concurrency);
      await Promise.all(batch.map(s => loadScreenshotFile(runId, s.file)));
    }
  };

  const handleOpenHealCompare = async (e: HealEvent) => {
    setComparingHealEvent(e);
    setCompareImagesLoading(true);
    setCompareImages({ before: null, after: null });
    try {
      const beforeB64 = e.before_file ? await loadScreenshotFile(selectedRunId!, e.before_file) : null;
      const afterB64 = e.after_file ? await loadScreenshotFile(selectedRunId!, e.after_file) : null;
      setCompareImages({ before: beforeB64, after: afterB64 });
    } catch (err) {
      console.error("加载对比截图失败", err);
    } finally {
      setCompareImagesLoading(false);
    }
  };

  const openImageViewer = (b64: string, title: string) => {
    setImageViewer({ src: `data:image/jpeg;base64,${b64}`, title });
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
  };

  const onViewerWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;
    const factor = delta > 0 ? 0.9 : 1.1;
    setViewerScale((prev) => Math.min(5, Math.max(0.2, prev * factor)));
  };

  const onViewerMouseDown = (e: React.MouseEvent) => {
    viewerDraggingRef.current = true;
    viewerDragStartRef.current = { x: e.clientX, y: e.clientY };
    viewerOffsetStartRef.current = { ...viewerOffset };
  };

  const onViewerMouseMove = (e: React.MouseEvent) => {
    if (!viewerDraggingRef.current) return;
    const dx = e.clientX - viewerDragStartRef.current.x;
    const dy = e.clientY - viewerDragStartRef.current.y;
    setViewerOffset({ x: viewerOffsetStartRef.current.x + dx, y: viewerOffsetStartRef.current.y + dy });
  };

  const stopViewerDrag = () => {
    viewerDraggingRef.current = false;
  };

  return (
    <div className="flex h-screen bg-[#0a0e17]/80 backdrop-blur-xl text-zinc-300 antialiased overflow-hidden">
      {/* Sidebar */}
      <div className="w-[320px] shrink-0 bg-[#030712]/80 backdrop-blur-xl border-r border-[#00e5ff]/20 flex flex-col shadow-[4px_0_24px_rgba(0,229,255,0.05)] z-20">
        <div className="px-5 py-4 border-b border-[#00e5ff]/20 bg-[#030712]/50 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SquareTerminal className="text-[#00e5ff] w-5 h-5 drop-shadow-[0_0_8px_rgba(99,102,241,0.45)]" />
              <div className="flex flex-col">
                <h1 className="text-sm font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] to-[#00ff41] leading-tight font-mono drop-shadow-[0_0_10px_rgba(0,229,255,0.3)]">SOLO TEST</h1>
                <div className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">System Active</div>
              </div>
            </div>
            <button onClick={() => { loadSettings(); setShowSettings(true); }} className="p-2 hover:bg-[#00e5ff]/10 rounded-xl text-zinc-400 hover:text-[#00e5ff] transition" title="设置">
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="w-full bg-zinc-800/50 hover:bg-zinc-700/80 text-zinc-200 text-sm font-medium px-3 py-2 rounded-xl flex items-center justify-center gap-2 transition-all border border-zinc-700/50 hover:border-zinc-600"
              title="使用自然语言生成测试用例"
            >
              <Plus className="w-4 h-4 text-[#00e5ff]" />
              <span>NL2Case <span className="text-xs text-zinc-400 font-normal ml-1">自然语言生成用例</span></span>
            </button>
            <button
              onClick={() => setShowExploreModal(true)}
              className="w-full bg-zinc-800/50 hover:bg-zinc-700/80 text-zinc-200 text-sm font-medium px-3 py-2 rounded-xl flex items-center justify-center gap-2 transition-all border border-zinc-700/50 hover:border-zinc-600"
              title="跑通新页面流程并生成可回归用例"
            >
              <MonitorPlay className="w-4 h-4 text-emerald-400" />
              <span>探索模式 <span className="text-xs text-zinc-400 font-normal ml-1">自动跑通新页面</span></span>
            </button>
          </div>
        </div>
        
        <div className="p-3 flex-1 flex flex-col overflow-hidden">
          <div className="mt-4">
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">探索用例（运行记录）</div>
              <button
                onClick={fetchExploreRuns}
                className="p-1 hover:bg-[#00e5ff]/10 rounded-md text-zinc-400 hover:text-[#00e5ff] transition"
                title="刷新探索记录"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <ul className="rounded-xl border border-[#1f2937] divide-y divide-zinc-800 bg-black/20 overflow-hidden">
              {exploreRuns.map((r) => {
                const name = (r.explore?.case_name || '').trim() || (typeof r.case_id === 'string' && r.case_id.startsWith('explore:') ? r.case_id.slice('explore:'.length) : r.id);
                const active = selectedCase?.type === 'explore' && selectedRunId === r.id;
                const statusText = r.status ? formatStatus(r.status) : '';
                const canDelete = true;
                return (
                  <li key={r.id}>
                    <div
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        active ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' : 'text-zinc-400 hover:bg-[#00e5ff]/10 hover:text-zinc-200'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedSuiteId(null);
                          setSuiteDoc(null);
                          setSelectedSuiteRunId(null);
                          setSelectedSuiteRun(null);
                          setCaseDoc(null);
                          setScriptContent('');
                          setSelectedCase({ id: 'explore_temp', name: `[探索] ${name}`, type: 'explore' });
                          setSelectedRunId(r.id);
                          loadRunDetail(r.id);
                        }}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left"
                      >
                        <MonitorPlay className="w-4 h-4 opacity-80 shrink-0 text-emerald-400" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate">
                            {statusText}{r.started_at ? ` · ${formatRunTime(r.started_at)}` : ''}
                          </div>
                        </div>
                      </button>
                      {r.explore?.generated_case_id && (
                        <span className="text-[10px] px-2 py-1 rounded-lg border border-[#00e5ff]/30 bg-[#00e5ff]/10 text-indigo-300 font-mono">
                          已生成
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDeleteExploreRun(r); }}
                        disabled={!canDelete}
                        className={`p-1.5 rounded-md border transition-colors ${
                          canDelete ? 'border-transparent hover:border-rose-900 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400' : 'border-transparent text-zinc-700 cursor-not-allowed'
                        }`}
                        title={r.status === 'running' ? '尝试删除（若仍在运行会失败）' : '删除探索记录'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
              {exploreRuns.length === 0 && (
                <div className="text-xs text-zinc-600 p-3 text-center">暂无探索记录</div>
              )}
            </ul>
          </div>

          <div className="mt-5 flex items-center justify-between px-1 mb-2">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              普通用例
            </div>
            <button onClick={fetchCases} className="p-1 hover:bg-[#00e5ff]/10 rounded-md text-zinc-400 hover:text-[#00e5ff] transition" title="刷新用例">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={caseQuery}
                onChange={(e) => setCaseQuery(e.target.value)}
                placeholder="搜索用例名称 / ID"
                className="w-full bg-[#0a0e17]/80 backdrop-blur-xl border border-[#1f2937] rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#00e5ff]/70 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors ${!selectedTag ? 'bg-indigo-500/20 text-indigo-300 border border-[#00e5ff]/30' : 'bg-[#00e5ff]/5 text-zinc-400 hover:bg-[#00e5ff]/20 hover:text-zinc-200 border border-transparent'}`}
                >
                  全部
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                    className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors ${tag === selectedTag ? 'bg-indigo-500/20 text-indigo-300 border border-[#00e5ff]/30' : 'bg-[#00e5ff]/5 text-zinc-400 hover:bg-[#00e5ff]/20 hover:text-zinc-200 border border-transparent'}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <ul className="overflow-y-auto rounded-xl border border-[#1f2937] divide-y divide-zinc-800 bg-black/20">
            {filteredCases.map((c) => (
              <li key={c.id} className="stagger-item">
                <div
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    selectedCase?.id === c.id 
                      ? 'bg-[#00e5ff]/15 text-indigo-200 border-[#00e5ff]/30' 
                      : 'text-zinc-400 hover:bg-[#00e5ff]/10 hover:text-zinc-200'
                  }`}
                >
                  <button
                    onClick={() => { setSelectedSuiteId(null); setSuiteDoc(null); setSelectedSuiteRunId(null); setSelectedSuiteRun(null); setSelectedCase(c); }}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left"
                  >
                    <FileJson className={`w-4 h-4 opacity-70 shrink-0 ${c.tags?.includes('explore') ? 'text-emerald-400' : ''}`} />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{c.name}</span>
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex gap-1 mt-0.5">
                          {c.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[9px] bg-zinc-800 text-zinc-400 px-1 rounded-sm">{tag}</span>
                          ))}
                          {c.tags.length > 3 && <span className="text-[9px] text-zinc-500">+{c.tags.length - 3}</span>}
                        </div>
                      )}
                      {(!c.tags || c.tags.length === 0) ? null : (c.tags.includes('explore') ? (
                        <div className="text-[10px] text-emerald-400/80 font-medium mt-0.5">探索生成</div>
                      ) : null)}
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditTags(c); }}
                    className={`p-1.5 rounded-md border transition-colors ${
                      selectedCase?.id === c.id
                        ? 'border-indigo-400/30 bg-indigo-500/20 text-indigo-200'
                        : 'border-transparent hover:border-zinc-700 hover:bg-[#00e5ff]/10 text-zinc-500'
                    }`}
                    title="编辑标签"
                  >
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRename(c); }}
                    className={`p-1.5 rounded-md border transition-colors ${
                      selectedCase?.id === c.id
                        ? 'border-indigo-400/30 bg-indigo-500/20 text-indigo-200'
                        : 'border-transparent hover:border-zinc-700 hover:bg-[#00e5ff]/10 text-zinc-500'
                    }`}
                    title="改名"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCase(c); }}
                    className={`p-1.5 rounded-md border transition-colors ${
                      selectedCase?.id === c.id
                        ? 'border-indigo-400/30 bg-indigo-500/20 hover:bg-rose-500/40 hover:text-rose-200 hover:border-rose-400/30 text-indigo-200'
                        : 'border-transparent hover:border-rose-900 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400'
                    }`}
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {filteredCases.length === 0 && (
              <div className="text-sm text-zinc-500 p-4 text-center border border-dashed border-[#1f2937] rounded-xl mt-3 bg-black/10">
                未找到匹配用例<br/><span className="text-xs mt-1 block">可点击顶部「新建用例」通过自然语言创建</span>
              </div>
            )}
          </ul>

          <div className="mt-4 pt-3 border-t border-[#1f2937]">
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <SquareTerminal className="w-4 h-4" /> 套件
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={createSuite}
                  className="p-2 rounded-xl hover:bg-[#00e5ff]/10 text-zinc-400 hover:text-[#00e5ff]"
                  title="新建套件"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={fetchSuites}
                  className="p-2 rounded-xl hover:bg-[#00e5ff]/10 text-zinc-400 hover:text-[#00e5ff]"
                  title="刷新套件"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 px-2 custom-scrollbar">
              {suites.length === 0 ? (
                <div className="text-xs text-zinc-600 px-1">暂无套件</div>
              ) : (
                suites.map((s) => (
                  <div
                    key={s.id}
                    className={`group w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md border text-xs cursor-pointer ${
                      selectedSuiteId === s.id
                        ? 'bg-[#00e5ff]/15 border-[#00e5ff]/30 text-indigo-200'
                        : 'bg-transparent border-[#1f2937] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                    onClick={() => loadSuite(s.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{s.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono truncate">{s.id}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSuite(s.id); }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-500 transition-opacity p-0.5 rounded"
                      title="删除套件"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1f2937]">
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4" /> 运行历史
              </div>
              <button
                onClick={() => selectedCase && fetchRuns(selectedCase.id)}
                disabled={!selectedCase || runsLoading}
                className="p-2 rounded-xl hover:bg-[#00e5ff]/10 text-zinc-400 hover:text-[#00e5ff] disabled:opacity-50"
                title="刷新"
              >
                <RotateCw className={`w-4 h-4 ${runsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {!selectedCase ? (
              <div className="text-xs text-zinc-600 px-2">选择用例后展示</div>
            ) : runs.length === 0 ? (
              <div className="text-xs text-zinc-600 px-2">暂无运行记录</div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 px-2 custom-scrollbar">
                {runs.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => loadRunDetail(r.id)}
                    className={`group w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md border text-xs cursor-pointer ${
                      selectedRunId === r.id
                        ? 'bg-zinc-800 border-[#00e5ff] text-zinc-200'
                        : 'bg-transparent border-[#1f2937] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'completed' ? 'bg-emerald-500' : r.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                      <span className="truncate">{formatRunTime(r.started_at)} {formatStatus(r.status || 'running')}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[#00e5ff]/80 font-mono">{formatTokenUsage(r.token_usage)}</span>
                      <span className="text-[10px] text-zinc-500">{r.duration_ms ? `${Math.round(r.duration_ms / 1000)}s` : ''}</span>
                      <button
                        onClick={(e) => handleDeleteRun(e, r.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-500 transition-opacity p-0.5 rounded"
                        title="删除记录"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full bg-[#030712]/90 min-w-0">
        {selectedSuiteRun ? (
          <>
            <div className="h-14 border-b border-[#1f2937] bg-[#0a0e17]/80 backdrop-blur-xl px-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex flex-col leading-tight">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-zinc-200 truncate max-w-[520px]">{selectedSuiteRun.suite_name}</div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      (selectedSuiteRun.status || '') === 'completed' ? 'border-emerald-500/50 text-emerald-500' : 
                      (selectedSuiteRun.status || '') === 'failed' ? 'border-rose-500/50 text-rose-500' : 'border-amber-500/50 text-amber-500'
                    }`}>
                      {formatStatus(selectedSuiteRun.status)}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#1f2937] text-zinc-500">
                      {suiteRunVM?.doneCount || 0}/{suiteRunVM?.total || 0}
                    </span>
                    {selectedSuiteRun.status === 'running' && suiteRunVM?.currentCaseId && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#00e5ff]/30 text-indigo-300 bg-[#00e5ff]/10 truncate max-w-[260px]">
                        当前：{suiteRunVM.currentCaseId}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">SuiteRunID: {selectedSuiteRun.id}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setSelectedSuiteRunId(null); setSelectedSuiteRun(null); }}
                  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border border-[#1f2937]"
                >
                  返回
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {suiteRunVM && (
                <div className="mb-6">
                  <div className="h-2 rounded-full bg-black/30 border border-[#1f2937] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-blue-500"
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
                <div className="rounded-2xl border border-[#1f2937] bg-black/20 p-4">
                  <div className="text-xs text-zinc-500">总用例</div>
                  <div className="text-2xl font-semibold text-zinc-200 mt-1">{suiteRunVM?.total || 0}</div>
                </div>
                <div className="rounded-2xl border border-[#1f2937] bg-black/20 p-4">
                  <div className="text-xs text-zinc-500">通过</div>
                  <div className="text-2xl font-semibold text-emerald-500 mt-1">{selectedSuiteRun.summary?.passed || 0}</div>
                </div>
                <div className="rounded-2xl border border-[#1f2937] bg-black/20 p-4">
                  <div className="text-xs text-zinc-500">失败</div>
                  <div className="text-2xl font-semibold text-rose-500 mt-1">{selectedSuiteRun.summary?.failed || 0}</div>
                </div>
                <div className="rounded-2xl border border-[#1f2937] bg-black/20 p-4">
                  <div className="text-xs text-zinc-500">自愈次数</div>
                  <div className="text-2xl font-semibold text-[#00e5ff] mt-1">{selectedSuiteRun.summary?.heal_total || 0}</div>
                </div>
                <div className="rounded-2xl border border-[#1f2937] bg-black/20 p-4">
                  <div className="text-xs text-zinc-500">Token</div>
                  <div className="text-2xl font-semibold text-indigo-300 mt-1">{selectedSuiteRun.summary?.token_total || 0}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#1f2937] overflow-hidden">
                <div className="px-4 py-3 bg-[#0a0e17]/80 backdrop-blur-xl border-b border-[#1f2937] text-sm font-semibold text-zinc-200">
                  用例明细
                </div>
                <div className="px-4 py-2 bg-black/30 border-b border-[#1f2937] text-[11px] text-zinc-500 flex items-center gap-3">
                  <div className="w-8 font-mono">#</div>
                  <div className="flex-1 min-w-0">用例</div>
                  <div className="w-20 text-right">耗时</div>
                  <div className="w-16 text-right">自愈</div>
                  <div className="w-20 text-right font-mono">Token</div>
                  <div className="w-16 text-right">状态</div>
                  <div className="w-[92px] text-right">操作</div>
                </div>
                <div className="divide-y divide-zinc-800">
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
                    const canOpen = !!it?.run_id && (status === 'completed' || status === 'failed');
                    return (
                      <div key={`${cid}_${idx}`} className="flex items-center gap-3 px-4 py-3 bg-black/20 hover:bg-[#00e5ff]/10 transition-colors">
                        <div className="w-8 text-xs text-zinc-500 font-mono">{String(idx + 1).padStart(2, '0')}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-zinc-200 truncate flex items-center gap-2">
                            {cases.find((c) => c.id === cid)?.name || cid}
                            {selectedSuiteRun?.setup_case_id && cid === selectedSuiteRun.setup_case_id && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#00e5ff]/30 text-indigo-300 bg-[#00e5ff]/10 shrink-0">
                                前置
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate">{it?.run_id ? `RunID: ${it.run_id}` : cid}</div>
                        </div>
                        <div className="text-xs text-zinc-500 w-20 text-right">{durationText}</div>
                        <div className="text-xs text-zinc-500 w-16 text-right">{healText}</div>
                        <div className="text-xs text-[#00e5ff]/80 w-20 text-right font-mono">{tokenText}</div>
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
                          className="text-xs px-3 py-1.5 rounded-xl border border-[#1f2937] text-zinc-300 hover:bg-[#00e5ff]/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed w-[92px] text-center"
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
                <div className="mt-6 flex h-[400px] rounded-2xl border border-[#1f2937] overflow-hidden bg-[#0a0e17]/80 backdrop-blur-xl">
                  {/* Logs */}
                  <div className="w-1/3 flex flex-col border-r border-[#1f2937] min-h-0 bg-[#0a0e17]/80 backdrop-blur-xl">
                    <div className="px-4 py-2 text-xs font-semibold text-zinc-400 border-b border-[#1f2937] flex items-center gap-2 shrink-0">
                      <Terminal className="w-3.5 h-3.5" /> 实时日志
                    </div>
                    <div className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed">
                      {suiteLogs.length === 0 ? (
                        <div className="text-zinc-600 italic">等待日志输出...</div>
                      ) : (
                        suiteLogs.map((log, i) => {
                          let colorClass = "text-zinc-300";
                          if (log.includes("✅")) colorClass = "text-emerald-500";
                          if (log.includes("❌") || log.includes("FAILED")) colorClass = "text-rose-500";
                          if (log.includes("🚑") || log.includes("⚠️")) colorClass = "text-amber-500";
                          if (log.includes("🤖") || log.includes("✨")) colorClass = "text-[#00e5ff]";
                          return <div key={i} className={`mb-1 break-words ${colorClass}`}>{log}</div>;
                        })
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                  {/* Screenshot */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="px-4 py-2 text-xs font-semibold text-zinc-400 border-b border-[#1f2937] flex items-center gap-2 shrink-0">
                      <MonitorPlay className="w-3.5 h-3.5" /> 实时视觉监控
                    </div>
                    <div className="flex-1 p-4 flex items-center justify-center overflow-hidden bg-[#030712]/90 relative min-h-0">
                      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                      {suiteScreenshot ? (
                        <div className="relative group rounded-xl shadow-2xl shadow-black/80 border border-[#00e5ff]/10 w-full h-full flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-hidden">
                          <img src={`data:image/jpeg;base64,${suiteScreenshot}`} alt="Current Screen" className="max-w-full max-h-full object-contain" />
                          <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <div className="w-[150%] h-[150%] absolute -top-[25%] -left-[25%] animate-[spin_8s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,rgba(99,102,241,0.05)_0%,rgba(99,102,241,0)_50%,rgba(99,102,241,0.05)_100%)] opacity-30 mix-blend-screen"></div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-zinc-600 flex flex-col items-center gap-2 relative z-10">
                          <Loader2 className="w-6 h-6 animate-spin text-zinc-700" />
                          等待测试画面...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : selectedCase ? (
          <>
            {/* Header Bar */}
            <div className="h-14 border-b border-[#1f2937] bg-[#0a0e17]/80 backdrop-blur-xl px-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex flex-col leading-tight">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-zinc-200 truncate max-w-[520px]">{selectedCase.name}</div>
                    {isReplayMode && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#1f2937] text-zinc-400 bg-[#030712]/90">
                        {selectedCase?.type === 'explore' ? '探索' : '回放'}
                      </span>
                    )}
                    {selectedCase?.type !== 'explore' && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${isDirty ? 'border-amber-500 text-amber-500' : 'border-[#1f2937] text-zinc-500'}`}>
                        {isDirty ? '未保存' : '已保存'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    {selectedCase?.type === 'explore' ? '自动探索模式' : `CaseID: ${selectedCase.id}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedCase?.type !== 'explore' && (
                  <select
                    value={selectedEnvId}
                    onChange={(e) => setSelectedEnvId(e.target.value)}
                    className="bg-[#0a0e17]/80 backdrop-blur-xl border border-[#1f2937] rounded-xl px-2 py-1.5 text-sm text-zinc-300 outline-none focus:border-indigo-400"
                  >
                    <option value="">默认环境</option>
                    {envs.map(env => (
                      <option key={env.id} value={env.id}>{env.name}</option>
                    ))}
                  </select>
                )}
                {!isReplayMode && selectedCase?.type !== 'explore' && (
                  <>
                      <button
                        onClick={handleRestoreBackup}
                        title="如果你刚刚点击了错误的 AI 修复建议，可以点击这里撤销"
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border border-[#1f2937]"
                      >
                        <History className="w-4 h-4" /> 撤销修复
                      </button>
                      <button
                        onClick={addStep}
                        disabled={!caseDoc}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border border-[#1f2937]"
                      >
                      <Plus className="w-4 h-4" /> 新增步骤
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!caseDoc || !isDirty || saving}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                        !caseDoc || !isDirty || saving
                          ? 'bg-[#030712]/90 text-zinc-500 border-[#1f2937] cursor-not-allowed'
                          : 'bg-[#00e5ff] hover:bg-[#00e5ff] hover:shadow-[0_0_15px_rgba(0,229,255,0.4)] text-black font-bold tracking-wide border-[#00e5ff]'
                      }`}
                    >
                      <Save className="w-4 h-4" /> {saving ? '保存中' : '保存'}
                    </button>
                  </>
                )}
                {isReplayMode && selectedCase?.type !== 'explore' && (
                  <button
                    onClick={handleExitReplay}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border border-[#1f2937]"
                  >
                    返回编辑
                  </button>
                )}
                {!(isRunning || selectedRun?.status === 'running') ? (
                  selectedCase?.type !== 'explore' && (
                    <button 
                      onClick={handleRun}
                      className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-zinc-100 px-5 py-1.5 rounded-xl text-sm font-medium transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] border border-white/10"
                    >
                      <Play className="w-4 h-4 fill-current" /> 运行测试
                    </button>
                  )
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
              <div className="flex-1 flex flex-col border-r border-[#1f2937] bg-[#030712]/90 min-w-0">
                {/* Script View */}
                <div className="h-2/3 flex flex-col border-b border-[#1f2937] min-h-0">
                  {isReplayMode ? (
                    <div className="px-4 py-2 bg-[#0a0e17]/80 backdrop-blur-xl text-xs font-semibold text-zinc-400 flex items-center justify-between border-b border-[#1f2937]">
                      <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5" />
                        {selectedCase?.type === 'explore' ? '探索运行详情' : '运行回放'}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {selectedRun ? `${formatStatus(selectedRun.status)} ${formatRunTime(selectedRun.started_at)}` : selectedRunId}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-[#0a0e17]/80 backdrop-blur-xl text-xs font-semibold text-zinc-400 flex items-center justify-between border-b border-[#1f2937]">
                      <div className="flex items-center gap-2">
                        <FileJson className="w-3.5 h-3.5" />
                        {leftTab === 'editor' ? '用例编辑器' : '生成脚本 (Python)'}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setLeftTab('editor')}
                          className={`px-2 py-1 rounded-xl border text-xs ${leftTab === 'editor' ? 'bg-zinc-800 border-[#1f2937] text-zinc-200' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'}`}
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => setLeftTab('python')}
                          className={`px-2 py-1 rounded-xl border text-xs ${leftTab === 'python' ? 'bg-zinc-800 border-[#1f2937] text-zinc-200' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'}`}
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
                          <div className="bg-[#0a0e17]/80 backdrop-blur-xl rounded-xl border border-[#1f2937] p-4 space-y-3">
                            <div className="text-xs text-zinc-500 flex justify-between items-center">
                              <div>RunID: <span className="font-mono text-zinc-300">{selectedRun.id}</span></div>
                              <div className={`px-2 py-1 rounded-md ${selectedRun.status === 'passed' || selectedRun.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : selectedRun.status === 'failed' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                {formatStatus(selectedRun.status)}
                              </div>
                            </div>
                            <div className="text-xs text-zinc-500 flex flex-wrap gap-4">
                              <div>开始: <span className="text-zinc-300">{formatRunTime(selectedRun.started_at)}</span></div>
                              {selectedRun.duration_ms ? (
                                <div>耗时: <span className="text-zinc-300">{Math.round((selectedRun.duration_ms || 0) / 1000)}s</span></div>
                              ) : null}
                            </div>
                            <div className="text-xs text-zinc-500 flex flex-wrap gap-4">
                              <div>截图数: <span className="text-zinc-300">{selectedRun.screenshots?.length || 0}</span></div>
                              <div>日志行: <span className="text-zinc-300">{selectedRun.logs?.length || 0}</span></div>
                            </div>
                            <div className="text-xs text-zinc-500">
                              Token: <span className="text-indigo-300 font-mono">{formatTokenUsage(selectedRun.token_usage)}</span>
                            </div>
                          </div>
                          
                          {selectedRun.explore?.generated_case_id && (
                            <div className="bg-[#00e5ff]/10 border border-[#00e5ff]/30 rounded-xl p-4 flex items-center justify-between">
                              <div>
                                <div className="text-xs font-semibold text-[#00e5ff] mb-1">已成功生成普通用例</div>
                                <div className="text-[11px] text-[#00e5ff]/70 font-mono">{selectedRun.explore.generated_case_id}</div>
                              </div>
                              <button
                                onClick={() => {
                                  const c = cases.find(x => x.id === selectedRun.explore.generated_case_id);
                                  if (c) {
                                    setSelectedSuiteId(null);
                                    setSuiteDoc(null);
                                    setSelectedSuiteRunId(null);
                                    setSelectedSuiteRun(null);
                                    setSelectedCase({ id: c.id, name: c.name, type: c.type });
                                    setSelectedRunId(null);
                                  } else {
                                    alert('用例尚未加载，请先刷新用例列表');
                                  }
                                }}
                                className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-medium rounded-lg transition-colors border border-[#00e5ff]/30"
                              >
                                去查看
                              </button>
                            </div>
                          )}

                          <div className="pt-2 border-t border-[#1f2937]">
                            <div className="text-xs font-semibold text-zinc-500 mb-3">
                              自愈记录（{selectedRun.heal_events?.length || 0}）
                            </div>
                            {(!selectedRun.heal_events || selectedRun.heal_events.length === 0) ? (
                              <div className="text-xs text-zinc-600">本次运行未发生自愈</div>
                            ) : (
                              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                                {selectedRun.heal_events.map((e, idx) => (
                                  <div key={idx} className="rounded-xl border border-[#1f2937] bg-[#0a0e17]/80 backdrop-blur-xl p-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-xl-full ${e.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                      <div className="text-xs text-zinc-300 truncate flex-1">{e.intent || '自愈'}</div>
                                      <div className="text-[10px] text-zinc-600 font-mono shrink-0">{e.source || ''}</div>
                                    </div>
                                    <div className="mt-1 text-[10px] text-[#00e5ff]/80 font-mono">
                                      {formatTokenUsage(e.token_usage)}
                                    </div>
                                    <div className="mt-1 text-[11px] text-zinc-500 font-mono break-all">
                                      {e.original_selector || ''}
                                    </div>
                                    {(e.new_selector || e.new_id) && (
                                      <div className="mt-1 text-[11px] text-zinc-400 font-mono break-all">
                                        {e.new_selector ? e.new_selector : `id:${e.new_id}`}
                                      </div>
                                    )}
                                    {e.reason && (
                                      <div className="mt-1 text-[11px] text-zinc-600 break-words">
                                        {e.reason}
                                      </div>
                                    )}
                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                      {e.before_file && e.after_file && selectedRunId && (
                                        <button
                                          onClick={() => handleOpenHealCompare(e)}
                                          className="text-[10px] px-2 py-1 rounded-xl border border-[#00e5ff]/50 bg-[#00e5ff]/10 hover:bg-indigo-500/20 text-indigo-300 font-medium flex items-center gap-1 transition-colors"
                                        >
                                          <Eye className="w-3 h-3" /> 对比视图
                                        </button>
                                      )}
                                      {e.before_file && selectedRunId && !e.after_file && (
                                        <button
                                          onClick={async () => {
                                            const b64 = await loadScreenshotFile(selectedRunId, e.before_file as string);
                                            if (b64) {
                                              setSelectedShotFile(e.before_file as string);
                                              setScreenshot(b64);
                                            }
                                          }}
                                          className="text-[10px] px-2 py-1 rounded-xl border border-[#1f2937] hover:border-indigo-400 text-zinc-300"
                                        >
                                          自愈前截图
                                        </button>
                                      )}
                                      {e.after_file && selectedRunId && !e.before_file && (
                                        <button
                                          onClick={async () => {
                                            const b64 = await loadScreenshotFile(selectedRunId, e.after_file as string);
                                            if (b64) {
                                              setSelectedShotFile(e.after_file as string);
                                              setScreenshot(b64);
                                            }
                                          }}
                                          className="text-[10px] px-2 py-1 rounded-xl border border-[#1f2937] hover:border-indigo-400 text-zinc-300"
                                        >
                                          自愈后截图
                                        </button>
                                      )}
                                      {e.success && (e.new_selector || e.new_id) && (() => {
                                        const oldSelector = (e.original_selector || '').trim();
                                        // 修复：AI 找不到稳定 selector 时，不能使用临时的 ai-id 占位，否则下次必定报错
                                        // 如果 new_selector 是空，说明大模型只返回了临时坐标/ID，这种不稳定的定位不应该被保存回用例
                                        const newSelector = (e.new_selector || '').trim();
                                        const intent = (e.intent || '').trim();
                                        if (!selectedRun?.case_id || !newSelector || (!oldSelector && !intent)) return null;
                                        const key = oldSelector
                                          ? `${selectedRun.case_id}::${oldSelector}=>${newSelector}`
                                          : `${selectedRun.case_id}::intent:${intent}=>${newSelector}`;
                                        const approved = !!approvedHeals[key];
                                        const approving = !!approvingHeals[key];
                                        return (
                                          <button
                                            onClick={() => handleApproveHeal(oldSelector, newSelector, intent)}
                                            disabled={approved || approving}
                                            className={`text-[10px] px-2 py-1 rounded-xl border ml-auto transition-colors ${
                                              approved
                                                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 cursor-default'
                                                : 'border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10'
                                            } ${approving ? 'opacity-70' : ''} disabled:opacity-60`}
                                          >
                                            {approved ? '已批准' : approving ? '审批中...' : '批准更新'}
                                          </button>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="pt-3 border-t border-[#1f2937]">
                            <div className="text-xs font-semibold text-zinc-500 mb-2">
                              Token 明细（{selectedRun.token_summary?.tests?.[0]?.llm_events?.length || 0}）
                            </div>
                            {(!selectedRun.token_summary?.tests?.[0]?.llm_events || selectedRun.token_summary.tests[0].llm_events.length === 0) ? (
                              <div className="text-xs text-zinc-600">本次运行未记录到 Token 明细</div>
                            ) : (
                              <div className="space-y-1 max-h-40 overflow-auto pr-1">
                                {selectedRun.token_summary.tests[0].llm_events.slice(-30).reverse().map((ev: any, i: number) => (
                                  <div key={i} className="rounded-xl border border-[#1f2937] bg-[#0a0e17]/80 backdrop-blur-xl px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-[10px] text-zinc-400 font-mono truncate">{ev.kind || 'llm'}</div>
                                      <div className="text-[10px] text-[#00e5ff]/80 font-mono shrink-0">{formatTokenUsage(ev.token_usage)}</div>
                                    </div>
                                    {ev.message && (
                                      <div className="text-[10px] text-zinc-600 truncate break-words whitespace-pre-wrap mt-1 leading-relaxed">{ev.message}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="pt-3 border-t border-[#1f2937]">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-semibold text-zinc-500">
                                AI 修复建议
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => requestAIFixSuggestion(false)}
                                  disabled={fixSuggestLoading}
                                  className="text-[10px] px-2 py-1 rounded-xl border border-[#00e5ff]/40 text-indigo-300 hover:bg-[#00e5ff]/10 disabled:opacity-50"
                                >
                                  {fixSuggestLoading ? '生成中...' : '生成'}
                                </button>
                                <button
                                  onClick={() => requestAIFixSuggestion(true)}
                                  disabled={fixSuggestLoading}
                                  className="text-[10px] px-2 py-1 rounded-xl border border-[#1f2937] text-zinc-400 hover:bg-[#00e5ff]/10 disabled:opacity-50"
                                >
                                  强制刷新
                                </button>
                              </div>
                            </div>
                            {selectedRun.ai_fix_suggestion ? (
                              <div className="rounded-xl border border-[#1f2937] bg-[#0a0e17]/80 backdrop-blur-xl p-3 space-y-2">
                                {selectedRun.ai_fix_suggestion.root_cause && (
                                  <div className="text-xs text-zinc-300">
                                    根因：<span className="text-zinc-200">{selectedRun.ai_fix_suggestion.root_cause}</span>
                                  </div>
                                )}
                                <div className="text-[10px] text-[#00e5ff]/80 font-mono">
                                  {formatTokenUsage(selectedRun.ai_fix_suggestion.token_usage)}
                                </div>
                                {selectedRun.ai_fix_suggestion.explanation && (
                                  <div className="text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">
                                    {selectedRun.ai_fix_suggestion.explanation}
                                  </div>
                                )}
                                {selectedRun.ai_fix_suggestion.suggestions && selectedRun.ai_fix_suggestion.suggestions.length > 0 && (
                                  <div className="space-y-1">
                                    {selectedRun.ai_fix_suggestion.suggestions.map((s, i) => (
                                      <div key={i} className="text-xs text-zinc-400">
                                        - {s}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    onClick={applyAIFixSuggestion}
                                    disabled={applyFixLoading || !selectedRun.ai_fix_suggestion.patched_steps}
                                    className="text-[10px] px-2 py-1 rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                                  >
                                    {applyFixLoading ? '应用中...' : '应用到用例'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-600">尚未生成修复建议</div>
                            )}
                          </div>
                          <div className="text-xs text-zinc-600">
                            回放模式仅展示运行结果；如需编辑用例点击右上角「返回编辑」。
                          </div>
                        </div>
                      ) : (
                        <div className="text-zinc-600 italic">加载中...</div>
                      )
                    ) : (
                      leftTab === 'python' ? (
                        <SyntaxHighlighter
                          language="python"
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            background: 'transparent',
                            fontSize: '0.875rem',
                            fontFamily: "'Fira Code', monospace"
                          }}
                          className="custom-scrollbar"
                        >
                          {scriptContent}
                        </SyntaxHighlighter>
                      ) : (
                        !caseDoc ? (
                          <div className="text-zinc-600 italic">加载中...</div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-6 gap-2 items-center">
                              <div className="col-span-1 text-xs text-zinc-500">start_url</div>
                              <input
                                value={caseDoc.start_url || ''}
                                onChange={(e) => setCaseDoc({ ...caseDoc, start_url: e.target.value })}
                                placeholder="可选：运行前先 page.goto(...)"
                                className="col-span-5 bg-[#0a0e17]/80 backdrop-blur-xl border border-[#1f2937] rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#1f6feb]"
                              />
                            </div>
                            <div className="text-xs text-zinc-500">steps</div>
                            <div className="space-y-2">
                              {caseDoc.steps.map((s, idx) => (
                                <div key={idx} className={`rounded-xl border border-[#1f2937]/60 bg-[#0a0e17]/80 backdrop-blur-xl p-4 space-y-3 shadow-sm hover:border-zinc-700 transition-colors ${s.disabled ? 'opacity-50 grayscale' : ''}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs text-zinc-400 font-mono">Step {idx + 1}</div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => moveStep(idx, 'up')} disabled={idx === 0} className="text-xs text-zinc-500 hover:text-[#00e5ff] disabled:opacity-30">↑</button>
                                      <button onClick={() => moveStep(idx, 'down')} disabled={idx === caseDoc.steps.length - 1} className="text-xs text-zinc-500 hover:text-[#00e5ff] disabled:opacity-30">↓</button>
                                      <button onClick={() => duplicateStep(idx)} className="text-xs text-[#00e5ff] hover:text-[#00e5ff]">复制</button>
                                      <button onClick={() => updateStep(idx, { disabled: !s.disabled })} className="text-xs text-zinc-400 hover:text-[#00e5ff]">{s.disabled ? '启用' : '禁用'}</button>
                                      <button onClick={() => removeStep(idx)} className="text-xs text-rose-500 hover:text-[#00e5ff]">删除</button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <select
                                      value={s.type}
                                      onChange={(e) => updateStep(idx, { type: e.target.value as StepType })}
                                      className="bg-[#030712]/90 border border-[#1f2937] rounded-xl px-2 py-2 text-sm text-zinc-200 outline-none focus:border-[#00e5ff]"
                                    >
                                      <option value="click">click</option>
                                      <option value="input">input</option>
                                      <option value="wait">wait</option>
                                      <option value="assert">assert</option>
                                      <option value="hover">hover</option>
                                      <option value="select_option">select option</option>
                                      <option value="double_click">double click</option>
                                      <option value="right_click">right click</option>
                                      <option value="press_key">press key</option>
                                      <option value="scroll">scroll</option>
                                    </select>
                                    {s.type === 'assert' ? (
                                      <select
                                        value={s.assert_type || 'text'}
                                        onChange={(e) => updateStep(idx, { assert_type: e.target.value as any })}
                                        className="col-span-2 bg-[#030712]/90 border border-[#1f2937] rounded-xl px-2 py-2 text-sm text-zinc-200 outline-none focus:border-[#00e5ff]"
                                      >
                                        <option value="text">页面包含文本</option>
                                        <option value="url">URL 包含</option>
                                        <option value="visible">元素可见</option>
                                      </select>
                                    ) : (
                                      <input
                                        value={s.intent || ''}
                                        onChange={(e) => updateStep(idx, { intent: e.target.value })}
                                        className="col-span-2 bg-[#030712]/90 border border-[#1f2937] rounded-xl px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00e5ff]"
                                        placeholder="意图（建议写清楚，如：点击登录按钮）"
                                      />
                                    )}
                                  </div>
                                  {(!s.type || !['wait', 'scroll', 'press_key'].includes(s.type) || (s.type === 'assert' && s.assert_type === 'visible')) && (
                                    <input
                                      value={s.selector || ''}
                                      onChange={(e) => updateStep(idx, { selector: e.target.value })}
                                      className="w-full bg-[#030712]/90 border border-[#1f2937] rounded-xl px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00e5ff] font-mono"
                                      placeholder="selector（Playwright 支持）"
                                    />
                                  )}
                                  {(['input', 'wait', 'select_option', 'press_key', 'scroll'].includes(s.type || '') || (s.type === 'assert' && s.assert_type !== 'visible')) && (
                                    <input
                                      value={s.value || ''}
                                      onChange={(e) => updateStep(idx, { value: e.target.value })}
                                      className="w-full bg-[#030712]/90 border border-[#1f2937] rounded-xl px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00e5ff] font-mono"
                                      placeholder={
                                        s.type === 'wait' ? '等待毫秒数，例如 1000' : 
                                        s.type === 'scroll' ? '滚动方向 (up/down)' :
                                        s.type === 'press_key' ? '按键名称 (如 Enter, Escape)' :
                                        s.type === 'select_option' ? '选项的 value 或 text' :
                                        s.type === 'assert' ? '预期包含的内容' : '输入值'
                                      }
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
                
                {/* Terminal / Logs View */}
                <div className="h-1/3 flex flex-col min-h-0 bg-[#0a0e17]/90 backdrop-blur-xl border-t border-[#00e5ff]/10">
                  <div className="px-4 py-2 bg-[#030712]/50 text-xs font-semibold text-[#00e5ff] flex items-center gap-2 border-b border-[#00e5ff]/10 tracking-wider uppercase">
                    <Terminal className="w-3.5 h-3.5" /> LIVE EXECUTION LOGS
                  </div>
                  <div className="flex-1 overflow-auto p-4 bg-transparent font-mono text-[13px] leading-relaxed custom-scrollbar">
                    {logs.length === 0 ? (
                      <div className="text-zinc-600 italic">点击右上角「运行测试」开始监控日志...</div>
                    ) : (
                      logs.map((log, i) => {
                        let colorClass = "text-zinc-300";
                        if (log.includes("✅")) colorClass = "text-emerald-500";
                        if (log.includes("❌") || log.includes("FAILED")) colorClass = "text-rose-500";
                        if (log.includes("🚑") || log.includes("⚠️")) colorClass = "text-amber-500";
                        if (log.includes("🤖") || log.includes("✨")) colorClass = "text-[#00e5ff]";
                        
                        return (
                          <div key={i} className={`mb-1 break-words ${colorClass}`}>
                            {log}
                          </div>
                        );
                      })
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>

              {/* Right Panel: Vision / Screenshot */}
              <div className="w-[65%] flex flex-col bg-[#030712]/60 backdrop-blur-md min-w-0 border-l border-[#00e5ff]/10">
                <div className="px-4 py-2 bg-[#0a0e17]/80 text-[11px] font-bold text-[#00e5ff] tracking-[0.2em] uppercase flex items-center gap-2 border-b border-[#00e5ff]/20 shrink-0 shadow-[0_4px_20px_rgba(0,229,255,0.05)] relative z-10">
                  {isReplayMode ? 'VISUAL REPLAY' : 'LIVE VISION FEED'}
                </div>
                <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-transparent relative">
                    <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#00e5ff 1px, transparent 1px), linear-gradient(90deg, #00e5ff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                  <div className="flex-1 p-4 flex items-center justify-center overflow-hidden min-h-0">
                    {screenshot ? (
                      <div className="relative group rounded-xl shadow-[0_0_40px_rgba(0,229,255,0.08)] border border-[#00e5ff]/20 w-full h-full flex items-center justify-center bg-[#0a0e17]/60 backdrop-blur-md min-h-0 overflow-hidden transition-all duration-500 hover:border-[#00e5ff]/50 hover:shadow-[0_0_50px_rgba(0,229,255,0.15)]">
                        <img
                          src={`data:image/jpeg;base64,${screenshot}`}
                          alt="Current Screen"
                          className="max-w-full max-h-full object-contain"
                        />
                        {isRunning && !isReplayMode && (
                          <>
                            {/* Subtle pulse glow around the border */}
                            <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_20px_rgba(0,229,255,0.1)] pointer-events-none animate-pulse-slow"></div>
                            {/* Minimal corner indicators to show "recording" state */}
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                              <span className="text-[10px] font-mono text-[#00ff41] tracking-widest uppercase opacity-80">REC</span>
                              <span className="w-2 h-2 rounded-full bg-[#00ff41] shadow-[0_0_8px_#00ff41] animate-pulse"></span>
                            </div>
                            {/* Refined subtle shimmer effect instead of heavy scanline */}
                            <div 
                              className="absolute inset-0 pointer-events-none opacity-30 animate-shimmer"
                              style={{
                                background: 'linear-gradient(90deg, transparent 0%, rgba(0, 229, 255, 0.05) 20%, rgba(0, 229, 255, 0.15) 50%, rgba(0, 229, 255, 0.05) 80%, transparent 100%)',
                                backgroundSize: '200% 100%'
                              }}
                            ></div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-center flex flex-col items-center opacity-40">
                        <SquareTerminal className="w-16 h-16 mb-4 text-zinc-500" />
                        <p className="text-zinc-400 text-sm">{isReplayMode ? '该次运行没有截图' : '等待执行时回传实时画面...'}</p>
                      </div>
                    )}
                  </div>

                  {isReplayMode && selectedRunId && selectedRun?.screenshots && selectedRun.screenshots.length > 0 && (
                    <div className="border-t border-[#00e5ff]/10 bg-zinc-950/80 backdrop-blur-xl px-4 py-3 relative z-20 shrink-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                          截图缩略条（{selectedRun.screenshots.length}）
                          {selectedShotFile && (
                            <span className="text-[10px] text-[#00e5ff] font-mono bg-[#00e5ff]/10 px-2 py-0.5 rounded-md border border-[#00e5ff]/30 normal-case tracking-normal">
                              {selectedShotFile}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const currentIndex = selectedRun.screenshots!.findIndex(s => s.file === selectedShotFile);
                              if (currentIndex > 0) {
                                const prev = selectedRun.screenshots![currentIndex - 1];
                                setSelectedShotFile(prev.file);
                                loadScreenshotFile(selectedRunId, prev.file).then(b64 => b64 && setScreenshot(b64));
                                const container = screenshotsContainerRef.current;
                                if (container) {
                                  const btn = container.children[currentIndex - 1] as HTMLElement;
                                  if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                }
                              }
                            }}
                            disabled={!selectedShotFile || selectedRun.screenshots!.findIndex(s => s.file === selectedShotFile) === 0}
                            className="p-1 rounded bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 text-zinc-400 hover:text-[#00e5ff] disabled:opacity-30 disabled:hover:bg-[#00e5ff]/10 transition-colors"
                            title="上一张"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                          </button>
                          <button
                            onClick={() => {
                              const currentIndex = selectedRun.screenshots!.findIndex(s => s.file === selectedShotFile);
                              if (currentIndex >= 0 && currentIndex < selectedRun.screenshots!.length - 1) {
                                const next = selectedRun.screenshots![currentIndex + 1];
                                setSelectedShotFile(next.file);
                                loadScreenshotFile(selectedRunId, next.file).then(b64 => b64 && setScreenshot(b64));
                                const container = screenshotsContainerRef.current;
                                if (container) {
                                  const btn = container.children[currentIndex + 1] as HTMLElement;
                                  if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                }
                              }
                            }}
                            disabled={!selectedShotFile || selectedRun.screenshots!.findIndex(s => s.file === selectedShotFile) === selectedRun.screenshots!.length - 1}
                            className="p-1 rounded bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 text-zinc-400 hover:text-[#00e5ff] disabled:opacity-30 disabled:hover:bg-[#00e5ff]/10 transition-colors"
                            title="下一张"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                          </button>
                        </div>
                      </div>
                      <div ref={screenshotsContainerRef} className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar items-center min-h-[72px]">
                        {selectedRun.screenshots.map((s) => {
                          const cacheKey = `${selectedRunId}/${s.file}`;
                          const cached = shotCache[cacheKey];
                          const active = selectedShotFile === s.file;
                          return (
                            <button
                              key={s.file}
                              onMouseEnter={() => { void loadScreenshotFile(selectedRunId, s.file); }}
                              onClick={async () => {
                                setSelectedShotFile(s.file);
                                const b64 = await loadScreenshotFile(selectedRunId, s.file);
                                if (b64) setScreenshot(b64);
                              }}
                              className={`shrink-0 w-24 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                                active 
                                  ? 'border-[#00e5ff] shadow-[0_0_10px_rgba(99,102,241,0.5)] scale-[1.02]' 
                                  : 'border-white/10 hover:border-[#00e5ff]/50 hover:scale-[1.02] opacity-60 hover:opacity-100 bg-zinc-900/50'
                              }`}
                              title={formatShotTime(s.ts)}
                            >
                              {cached ? (
                                <div className="w-full h-full relative">
                                  <img
                                    src={`data:image/jpeg;base64,${cached}`}
                                    alt={s.file}
                                    className="w-full h-full object-cover transition-opacity duration-200 opacity-100"
                                  />
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-[#030712]/90 relative overflow-hidden">
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-4 h-4 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin"></div>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : suiteDoc ? (
          <>
            <div className="h-14 border-b border-[#1f2937] bg-[#0a0e17]/80 backdrop-blur-xl px-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex flex-col leading-tight">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-zinc-200 truncate max-w-[520px]">{suiteDoc.name}</div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${isSuiteDirty ? 'border-amber-500 text-amber-500' : 'border-[#1f2937] text-zinc-500'}`}>
                      {isSuiteDirty ? '未保存' : '已保存'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#1f2937] text-zinc-500">
                      {suiteDoc.case_ids?.length || 0} cases
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">SuiteID: {suiteDoc.id}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={suiteDoc.env_id || ''}
                  onChange={(e) => setSuiteDoc({ ...suiteDoc, env_id: e.target.value })}
                  className="bg-[#0a0e17]/80 backdrop-blur-xl border border-[#1f2937] rounded-xl px-2 py-1.5 text-sm text-zinc-300 outline-none focus:border-indigo-400"
                >
                  <option value="">默认环境</option>
                  {envs.map(env => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
                <button
                  onClick={saveSuite}
                  disabled={!isSuiteDirty}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                    !isSuiteDirty
                      ? 'bg-[#030712]/90 text-zinc-500 border-[#1f2937] cursor-not-allowed'
                      : 'bg-[#00e5ff] hover:bg-[#00e5ff] hover:shadow-[0_0_15px_rgba(0,229,255,0.4)] text-black font-bold tracking-wide border-[#00e5ff]'
                  }`}
                >
                  <Save className="w-4 h-4" /> 保存套件
                </button>
                <button
                  onClick={runSuite}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-zinc-100 px-5 py-1.5 rounded-xl text-sm font-medium transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] border border-white/10"
                >
                  <Play className="w-4 h-4 fill-current" /> 运行套件
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              <div className="rounded-2xl border border-[#1f2937] bg-black/20 p-4">
                <div className="text-sm font-semibold text-zinc-200 mb-3">前置用例（可选）</div>
                <div className="flex items-center gap-3">
                  <select
                    value={suiteDoc.setup_case_id || ''}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      const nextCaseIds = next ? (suiteDoc.case_ids || []).filter((x) => x !== next) : (suiteDoc.case_ids || []);
                      setSuiteDoc({ ...suiteDoc, setup_case_id: next, case_ids: nextCaseIds });
                    }}
                    className="flex-1 bg-[#0a0e17]/80 backdrop-blur-xl border border-[#1f2937] rounded-xl px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-400"
                  >
                    <option value="">无（每个用例自己处理登录）</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-zinc-500 mt-2">运行套件时会先执行该用例，并把登录态（cookie）共享给后续用例；前置用例失败将终止本次套件运行。</div>
              </div>

              <div className="rounded-2xl border border-[#1f2937] bg-black/20 p-4">
                <div className="text-sm font-semibold text-zinc-200 mb-3">添加用例到套件</div>
                <div className="flex items-center gap-3">
                  <select
                    value={suiteAddCaseId}
                    onChange={(e) => setSuiteAddCaseId(e.target.value)}
                    className="flex-1 bg-[#0a0e17]/80 backdrop-blur-xl border border-[#1f2937] rounded-xl px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-400"
                  >
                    <option value="">选择一个用例...</option>
                    {suiteAvailableCases.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={suiteAddCase}
                    disabled={!suiteAddCaseId}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                      !suiteAddCaseId
                        ? 'bg-[#030712]/90 text-zinc-500 border-[#1f2937] cursor-not-allowed'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-[#1f2937]'
                    }`}
                  >
                    添加
                  </button>
                </div>
                <div className="text-xs text-zinc-500 mt-2">套件内不允许重复用例；执行按顺序串行运行，失败继续跑。</div>
              </div>

              <div className="rounded-2xl border border-[#1f2937] overflow-hidden">
                <div className="px-4 py-3 bg-[#0a0e17]/80 backdrop-blur-xl border-b border-[#1f2937] text-sm font-semibold text-zinc-200 flex items-center justify-between">
                  <div>套件用例列表（有序）</div>
                  <div className="text-xs text-zinc-500">{suiteDoc.case_ids?.length || 0} items</div>
                </div>
                <div className="divide-y divide-zinc-800">
                  {(suiteDoc.case_ids || []).length === 0 ? (
                    <div className="p-6 text-sm text-zinc-500">暂无用例，先从上方添加。</div>
                  ) : (
                    (suiteDoc.case_ids || []).map((cid, idx) => (
                      <div key={cid} className="flex items-center gap-3 px-4 py-3 bg-black/20 hover:bg-[#00e5ff]/10 transition-colors">
                        <div className="w-8 text-xs text-zinc-500 font-mono">{String(idx + 1).padStart(2, '0')}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-zinc-200 truncate">{cases.find((c) => c.id === cid)?.name || cid}</div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate">{cid}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => suiteMoveCase(idx, 'up')}
                            disabled={idx === 0}
                            className="text-xs text-zinc-400 hover:text-[#00e5ff] disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-[#00e5ff]/10"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => suiteMoveCase(idx, 'down')}
                            disabled={idx === (suiteDoc.case_ids || []).length - 1}
                            className="text-xs text-zinc-400 hover:text-[#00e5ff] disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-[#00e5ff]/10"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => suiteRemoveCase(cid)}
                            className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10"
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#1f2937] overflow-hidden">
                <div className="px-4 py-3 bg-[#0a0e17]/80 backdrop-blur-xl border-b border-[#1f2937] text-sm font-semibold text-zinc-200 flex items-center justify-between">
                  <div>套件运行历史</div>
                  <button
                    onClick={() => fetchSuiteRuns(suiteDoc.id)}
                    disabled={suiteRunsLoading}
                    className="p-2 rounded-xl hover:bg-[#00e5ff]/10 text-zinc-400 hover:text-[#00e5ff] disabled:opacity-50"
                    title="刷新"
                  >
                    <RotateCw className={`w-4 h-4 ${suiteRunsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="divide-y divide-zinc-800">
                  {suiteRunsLoading ? (
                    <div className="p-6 text-sm text-zinc-500">加载中...</div>
                  ) : suiteRuns.length === 0 ? (
                    <div className="p-6 text-sm text-zinc-500">暂无套件运行记录</div>
                  ) : (
                    suiteRuns.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => loadSuiteRunDetail(r.id)}
                        className={`cursor-pointer flex items-center justify-between gap-3 px-4 py-3 bg-black/20 hover:bg-[#00e5ff]/10 transition-colors group ${
                          selectedSuiteRunId === r.id ? 'bg-[#00e5ff]/10' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-zinc-200 truncate">{formatRunTime(r.started_at)} · {formatStatus(r.status || '')}</div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate">{r.id}</div>
                        </div>
                        <div className="text-xs text-zinc-500 shrink-0 flex flex-col items-end gap-1">
                          <div>{r.summary?.passed || 0}/{r.summary?.total || 0} · heal {r.summary?.heal_total || 0} · tok {r.summary?.token_total || 0}</div>
                          <button
                            onClick={(e) => handleDeleteSuiteRun(e, r.id)}
                            className="text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-md hover:bg-rose-500/10"
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
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00e5ff]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center p-12 rounded-3xl border border-[#00e5ff]/20 bg-[#0a0e17]/80 backdrop-blur-xl shadow-[0_0_50px_rgba(0,229,255,0.05)]">
              <SquareTerminal className="w-20 h-20 mb-8 text-[#00e5ff] drop-shadow-[0_0_20px_rgba(0,229,255,0.4)] animate-pulse-slow" />
              <h2 className="text-3xl font-bold font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] to-[#00ff41] mb-4 drop-shadow-[0_0_10px_rgba(0,229,255,0.2)]">SOLO TESTING INTERFACE</h2>
              <p className="text-sm font-mono text-zinc-400 flex items-center gap-3">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#00ff41] shadow-[0_0_10px_#00ff41] animate-pulse" />
                WAITING FOR INSTRUCTIONS
              </p>
            </div>
          </div>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-indigo-500/10 w-full max-w-2xl p-8 flex flex-col relative overflow-hidden max-h-[90vh]">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-[50px] pointer-events-none" />
              <div className="flex items-center justify-between mb-5 shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#00e5ff]" />
                    控制台设置
                  </h2>
                  <div className="flex bg-black/40 border border-[#00e5ff]/10 rounded-lg p-1">
                    <button
                      onClick={() => setSettingsTab('env')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${settingsTab === 'env' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      环境变量
                    </button>
                    <button
                      onClick={() => setSettingsTab('prompts')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${settingsTab === 'prompts' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Prompt 预设
                    </button>
                  </div>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 p-1.5 rounded-full">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                {settingsTab === 'env' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">OPENAI_API_BASE</label>
                <input
                  type="text"
                  value={apiBase}
                  onChange={e => setApiBase(e.target.value)}
                  className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">OPENAI_MODEL_NAME</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                  placeholder="gpt-4o-mini"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">OPENAI_API_KEY</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="flex-1 bg-black/40 border border-[#00e5ff]/10 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                    placeholder="sk-..."
                  />
                  <button
                    onClick={testSettingsConnection}
                    disabled={testingSettings || !apiKey || !apiBase}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {testingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : '连接测试'}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>此 Key 仅保存在本地 .env 文件中，用于 AI 自愈链路。</p>
                {settingsTestResult && (
                  <div className={`mt-3 text-xs px-3 py-2 rounded-xl border flex items-center gap-2 ${settingsTestResult.ok ? 'border-emerald-500/20 text-emerald-300 bg-emerald-500/10' : 'border-rose-500/20 text-rose-300 bg-rose-500/10'}`}>
                    {settingsTestResult.ok ? '✅' : '❌'} {settingsTestResult.message}
                  </div>
                )}
              </div>

              <div className="border-t border-[#00e5ff]/10 pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">多环境配置 (Environments)</label>
                  <button
                    onClick={() => setEnvs([...envs, { id: `env_${Date.now()}`, name: '新环境', base_url: '' }])}
                    className="text-xs text-[#00e5ff] hover:text-indigo-300 font-medium transition-colors"
                  >
                    + 添加环境
                  </button>
                </div>
                <div className="space-y-3 max-h-48 overflow-auto pr-2">
                  {envs.length === 0 ? (
                    <div className="text-xs text-zinc-600 italic text-center py-4">暂无环境配置</div>
                  ) : (
                    envs.map((env, i) => (
                      <div key={env.id} className="flex items-center gap-2 group">
                        <input
                          type="text"
                          value={env.name}
                          onChange={e => {
                            const newEnvs = [...envs];
                            newEnvs[i].name = e.target.value;
                            setEnvs(newEnvs);
                          }}
                          className="w-1/3 bg-black/40 border border-[#00e5ff]/10 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#00e5ff]/50 transition-colors placeholder:text-zinc-600"
                          placeholder="名称 (如 QA)"
                        />
                        <input
                          type="text"
                          value={env.base_url}
                          onChange={e => {
                            const newEnvs = [...envs];
                            newEnvs[i].base_url = e.target.value;
                            setEnvs(newEnvs);
                          }}
                          className="flex-1 bg-black/40 border border-[#00e5ff]/10 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#00e5ff]/50 transition-colors placeholder:text-zinc-600"
                          placeholder="Base URL"
                        />
                        <button
                          onClick={() => {
                            const newEnvs = envs.filter((_, idx) => idx !== i);
                            setEnvs(newEnvs);
                          }}
                          className="text-zinc-600 hover:text-rose-400 p-1.5 rounded-md hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col h-[600px] space-y-4 pt-4 border-t border-[#00e5ff]/10">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">选择 Prompt 文件</label>
                  <select
                    value={activePromptFile}
                    onChange={e => setActivePromptFile(e.target.value)}
                    className="bg-black/40 border border-[#00e5ff]/10 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50"
                  >
                    {Object.keys(prompts).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  {activePromptFile ? (
                    <textarea
                      value={prompts[activePromptFile] || ''}
                      onChange={e => setPrompts({ ...prompts, [activePromptFile]: e.target.value })}
                      className="w-full h-full bg-black/40 border border-[#00e5ff]/10 rounded-xl p-4 text-sm font-mono text-zinc-300 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none shadow-inner"
                      spellCheck="false"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                      没有找到 Prompt 预设文件
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 shrink-0 border-t border-[#00e5ff]/10 pt-5">
              <button
                onClick={() => setShowSettings(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 border border-transparent hover:border-[#00e5ff]/10 transition-all"
              >
                取消
              </button>
              <button
                onClick={testSettingsConnection}
                disabled={testingSettings || savingSettings || !apiKey || !apiBase}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-200 bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 border border-[#00e5ff]/10 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {testingSettings ? <RotateCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                测试连接
              </button>
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-zinc-100 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 flex items-center gap-2 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] disabled:opacity-50 disabled:shadow-none"
              >
                {savingSettings ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-indigo-500/20 w-full max-w-lg p-7 flex flex-col relative overflow-hidden">
            <div className={`absolute -top-24 -right-24 w-56 h-56 rounded-full blur-[70px] pointer-events-none ${confirmModal.destructive ? 'bg-rose-500/15' : 'bg-indigo-500/20'}`} />
            <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-blue-500/10 rounded-full blur-[70px] pointer-events-none" />

            <div className="flex items-start justify-between mb-5 relative z-10">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-2 rounded-2xl border ${confirmModal.destructive ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-[#00e5ff]/30 bg-[#00e5ff]/10 text-indigo-300'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-zinc-200">{confirmModal.title}</div>
                  {confirmModal.description && <div className="text-sm text-zinc-500 mt-1 leading-relaxed">{confirmModal.description}</div>}
                </div>
              </div>
              <button
                onClick={() => closeConfirm(false)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 p-2 rounded-full"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-2 flex justify-end gap-3 relative z-10">
              <button
                onClick={() => closeConfirm(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 border border-transparent hover:border-[#00e5ff]/10 transition-all"
              >
                取消
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className={`px-6 py-2.5 rounded-xl text-sm font-medium text-zinc-100 flex items-center gap-2 transition-all duration-300 border ${
                  confirmModal.destructive
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 border-white/10 shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:shadow-[0_0_25px_rgba(244,63,94,0.35)]'
                    : 'bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)]'
                }`}
              >
                {confirmModal.destructive ? <Trash2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {confirmModal.confirmText || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-indigo-500/20 w-full max-w-xl p-8 flex flex-col relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-indigo-500/20 rounded-full blur-[70px] pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-blue-500/10 rounded-full blur-[70px] pointer-events-none" />

            <div className="flex items-start justify-between mb-6 relative z-10">
              <div>
                <div className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-[#00e5ff]" />
                  {promptModal.title}
                </div>
                {promptModal.description && <div className="text-sm text-zinc-500 mt-1">{promptModal.description}</div>}
              </div>
              <button
                onClick={() => closePrompt(null)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 p-2 rounded-full"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 relative z-10">
              <input
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = promptValue.trim();
                    closePrompt(v ? v : '');
                  }
                }}
                className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-3 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                placeholder={promptModal.placeholder || ''}
                autoFocus
              />
            </div>

            <div className="mt-8 flex justify-end gap-3 relative z-10">
              <button
                onClick={() => closePrompt(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 border border-transparent hover:border-[#00e5ff]/10 transition-all"
              >
                取消
              </button>
              <button
                onClick={() => { const v = promptValue.trim(); closePrompt(v ? v : ''); }}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-zinc-100 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 flex items-center gap-2 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] disabled:opacity-50 disabled:shadow-none"
              >
                <Save className="w-4 h-4" />
                {promptModal.confirmText || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateSuiteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-indigo-500/20 w-full max-w-xl p-8 flex flex-col relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-indigo-500/20 rounded-full blur-[70px] pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-blue-500/10 rounded-full blur-[70px] pointer-events-none" />

            <div className="flex items-start justify-between mb-6 relative z-10">
              <div>
                <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 flex items-center gap-2">
                  <SquareTerminal className="w-5 h-5 text-[#00e5ff]" />
                  新建测试套件
                </h2>
                <div className="text-sm text-zinc-500 mt-1">将多个用例组合成一次回归计划（顺序执行，失败继续跑）。</div>
              </div>
              <button
                onClick={() => { if (!creatingSuite) setShowCreateSuiteModal(false); }}
                disabled={creatingSuite}
                className="text-zinc-500 hover:text-zinc-200 transition-colors bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 p-2 rounded-full disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 relative z-10">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">套件名称</label>
                <input
                  type="text"
                  value={createSuiteName}
                  onChange={(e) => setCreateSuiteName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void confirmCreateSuite(); }}
                  className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-3 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                  placeholder="例如：Smoke 回归 / 登录链路"
                  disabled={creatingSuite}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">运行环境（统一）</label>
                <select
                  value={createSuiteEnvId}
                  onChange={(e) => setCreateSuiteEnvId(e.target.value)}
                  disabled={creatingSuite}
                  className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-3 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
                >
                  <option value="">默认环境</option>
                  {envs.map((env) => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 relative z-10">
              <button
                onClick={() => setShowCreateSuiteModal(false)}
                disabled={creatingSuite}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 border border-transparent hover:border-[#00e5ff]/10 transition-all disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={confirmCreateSuite}
                disabled={creatingSuite || !createSuiteName.trim()}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-zinc-100 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 flex items-center gap-2 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] disabled:opacity-50 disabled:shadow-none"
              >
                {creatingSuite ? <RotateCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                创建套件
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Case Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-indigo-500/20 w-full max-w-4xl p-10 flex flex-col relative overflow-hidden">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-zinc-900/50 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="relative z-10 flex items-start justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-[#00e5ff]/10 rounded-xl border border-[#00e5ff]/30">
                    <SquareTerminal className="w-6 h-6 text-[#00e5ff]" />
                  </div>
                  自然语言生成用例 (NL2Case)
                </h2>
                <p className="text-sm text-zinc-500 pl-14">通过大语言模型，将人类自然语言描述自动转化为结构化的自动化测试用例。</p>
              </div>
              <button onClick={() => setShowGenerateModal(false)} disabled={generating} className="text-zinc-500 hover:text-zinc-200 transition-colors bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 p-2 rounded-full disabled:opacity-50">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="relative z-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider pl-1">用例名称</label>
                  <input
                    type="text"
                    value={generateForm.name}
                    onChange={e => setGenerateForm({ ...generateForm, name: e.target.value })}
                    className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-3.5 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                    placeholder="例如：登录并验证欢迎提示"
                    disabled={generating}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider pl-1">初始 URL (Start URL)</label>
                  <input
                    type="text"
                    value={generateForm.start_url}
                    onChange={e => setGenerateForm({ ...generateForm, start_url: e.target.value })}
                    className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-3.5 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                    placeholder="例如：https://example.com/login"
                    disabled={generating}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider pl-1">自然语言操作步骤</label>
                <textarea
                  value={generateForm.instruction}
                  onChange={e => setGenerateForm({ ...generateForm, instruction: e.target.value })}
                  className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-4 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner min-h-[280px] custom-scrollbar resize-none leading-relaxed"
                  placeholder={`请输入您的测试步骤，大模型会自动拆解为结构化动作。

例如：
1. 点击右上角的登录按钮
2. 在账号输入框输入 admin
3. 密码输入 123456
4. 点击确认登录按钮
5. 断言页面上出现了“欢迎回来”的提示文本`}
                  disabled={generating}
                />
              </div>
            </div>

            <div className="relative z-10 mt-10 flex justify-end gap-4">
              <button
                onClick={() => setShowGenerateModal(false)}
                disabled={generating}
                className="px-6 py-3 rounded-xl text-base font-medium text-zinc-400 bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 border border-transparent hover:border-[#00e5ff]/10 transition-all disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleGenerateCase}
                disabled={generating}
                className="px-8 py-3 rounded-xl text-base font-medium text-zinc-100 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 flex items-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] disabled:opacity-50 disabled:shadow-none"
              >
                {generating ? <RotateCw className="w-5 h-5 animate-spin" /> : <Terminal className="w-5 h-5" />}
                {generating ? 'AI 拆解生成中...' : '开始生成用例'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExploreModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-indigo-500/20 w-full max-w-4xl p-10 flex flex-col relative overflow-hidden">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#00e5ff]/15 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-[#00e5ff]/10 rounded-xl border border-[#00e5ff]/30">
                    <MonitorPlay className="w-6 h-6 text-[#00e5ff]" />
                  </div>
                  探索模式（跑通后生成用例）
                </h2>
                <p className="text-sm text-zinc-500 pl-14">用于全新页面/全新流程：AI 先探索跑通并生成可回归的 steps（含 selector 与 intent）。</p>
              </div>
              <button onClick={() => { if (!exploring) setShowExploreModal(false); }} disabled={exploring} className="text-zinc-500 hover:text-zinc-200 transition-colors bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 p-2 rounded-full disabled:opacity-50">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="relative z-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider pl-1">用例名称</label>
                  <input
                    type="text"
                    value={exploreForm.name}
                    onChange={e => setExploreForm({ ...exploreForm, name: e.target.value })}
                    className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-3.5 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                    placeholder="例如：授权链路（探索生成）"
                    disabled={exploring}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider pl-1">初始 URL (Start URL)</label>
                  <input
                    type="text"
                    value={exploreForm.start_url}
                    onChange={e => setExploreForm({ ...exploreForm, start_url: e.target.value })}
                    className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-3.5 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                    placeholder="例如：https://example.com"
                    disabled={exploring}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider pl-1">目标（Goal）</label>
                <textarea
                  value={exploreForm.goal}
                  onChange={e => setExploreForm({ ...exploreForm, goal: e.target.value })}
                  className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-4 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner min-h-[200px] custom-scrollbar resize-none leading-relaxed"
                  placeholder={`描述你希望 AI 跑通的流程目标。\n\n例如：\n1. 打开授权页面\n2. 搜索“AI小车”\n3. 勾选并点击确认授权`}
                  disabled={exploring}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider pl-1">成功标志（可选）</label>
                  <input
                    type="text"
                    value={exploreForm.done_hint}
                    onChange={e => setExploreForm({ ...exploreForm, done_hint: e.target.value })}
                    className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-3.5 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                    placeholder="例如：同步成功 / 授权成功"
                    disabled={exploring}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider pl-1">最大步数</label>
                  <input
                    type="number"
                    value={exploreForm.max_steps}
                    onChange={e => setExploreForm({ ...exploreForm, max_steps: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-[#00e5ff]/10 rounded-2xl px-5 py-3.5 text-base text-zinc-200 focus:outline-none focus:border-[#00e5ff]/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                    min={3}
                    max={50}
                    disabled={exploring}
                  />
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-10 flex justify-end gap-4">
              <button
                onClick={() => setShowExploreModal(false)}
                disabled={exploring}
                className="px-6 py-3 rounded-xl text-base font-medium text-zinc-400 bg-[#00e5ff]/5 hover:bg-[#00e5ff]/20 border border-transparent hover:border-[#00e5ff]/10 transition-all disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleExplore}
                disabled={exploring}
                className="px-8 py-3 rounded-xl text-base font-medium text-zinc-100 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 flex items-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] disabled:opacity-50 disabled:shadow-none"
              >
                {exploring ? <RotateCw className="w-5 h-5 animate-spin" /> : <MonitorPlay className="w-5 h-5" />}
                {exploring ? '探索中...' : '开始探索并生成用例'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Heal Compare Modal */}
      {comparingHealEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-[#0a0e17]/80 backdrop-blur-xl border border-[#1f2937] rounded-2xl w-full max-w-7xl h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
            {/* Header */}
            <div className="p-4 border-b border-[#1f2937] flex justify-between items-start bg-zinc-950 shrink-0">
              <div className="flex-1 mr-8">
                <h3 className="text-lg text-zinc-100 font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#00e5ff]" />
                  自愈记录审计: {comparingHealEvent.intent || '未知意图'}
                </h3>
                <div className="text-[13px] text-zinc-400 mt-2 flex flex-col gap-1.5 font-mono bg-black/40 p-3 rounded-lg border border-[#1f2937]/50">
                  <div className="flex items-start gap-2">
                    <span className="text-rose-400/80 shrink-0 select-none">[-] 旧选择器:</span>
                    <span className="line-through decoration-rose-500/50 text-rose-300 break-all">{comparingHealEvent.original_selector}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400/80 shrink-0 select-none">[+] 新选择器:</span>
                    <span className="text-emerald-300 break-all">{comparingHealEvent.new_selector || `[ai-id="${comparingHealEvent.new_id}"]`}</span>
                  </div>
                  {comparingHealEvent.reason && (
                    <div className="mt-1 pt-1.5 border-t border-[#1f2937]/50 text-zinc-500 font-sans text-xs flex gap-2">
                      <span className="shrink-0">🤖 决策原因:</span>
                      <span>{comparingHealEvent.reason}</span>
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => { setComparingHealEvent(null); setCompareImages({ before: null, after: null }); }}
                className="text-zinc-500 hover:text-zinc-200 transition-colors p-2 hover:bg-[#00e5ff]/10 rounded-full shrink-0"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex flex-1 overflow-hidden bg-black/50 p-6 gap-6 relative">
              {compareImagesLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0e17]/80 backdrop-blur-xl/80 backdrop-blur-sm">
                  <Loader2 className="w-8 h-8 text-[#00e5ff] animate-spin mb-4" />
                  <span className="text-sm text-zinc-400">正在加载高清对比截图...</span>
                </div>
              )}
              
              {/* Before View */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
                  <span className="text-sm font-medium text-zinc-300">自愈前 (元素定位失败)</span>
                </div>
                <div className="flex-1 relative border border-[#1f2937] rounded-xl overflow-hidden bg-[#030712]/90 shadow-inner group">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                  {compareImages.before ? (
                    <img
                      src={`data:image/jpeg;base64,${compareImages.before}`}
                      className="object-contain w-full h-full p-2 cursor-zoom-in"
                      alt="Before Heal"
                      onClick={() => openImageViewer(compareImages.before as string, '自愈前')}
                    />
                  ) : !compareImagesLoading ? (
                    <div className="flex items-center justify-center h-full text-zinc-600 text-sm">暂无自愈前截图</div>
                  ) : null}
                </div>
              </div>

              {/* VS Divider */}
              <div className="flex flex-col items-center justify-center shrink-0 w-8">
                <div className="h-full w-px bg-zinc-800/50"></div>
                <div className="w-8 h-8 rounded-full bg-zinc-900 border border-[#1f2937] flex items-center justify-center text-[10px] font-bold text-zinc-500 z-10 my-4 shadow-lg shadow-black">VS</div>
                <div className="h-full w-px bg-zinc-800/50"></div>
              </div>

              {/* After View */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                  <span className="text-sm font-medium text-zinc-300">自愈后 (AI 寻素并执行成功)</span>
                </div>
                <div className="flex-1 relative border border-[#1f2937] rounded-xl overflow-hidden bg-[#030712]/90 shadow-inner group">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                  {compareImages.after ? (
                    <img
                      src={`data:image/jpeg;base64,${compareImages.after}`}
                      className="object-contain w-full h-full p-2 cursor-zoom-in"
                      alt="After Heal"
                      onClick={() => openImageViewer(compareImages.after as string, '自愈后')}
                    />
                  ) : !compareImagesLoading ? (
                    <div className="flex items-center justify-center h-full text-zinc-600 text-sm">暂无自愈后截图</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {imageViewer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-200 font-medium truncate">{imageViewer.title}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewerScale((s) => Math.min(5, s * 1.2))}
                className="p-2 rounded-xl border border-[#1f2937] bg-black/40 text-zinc-300 hover:bg-[#00e5ff]/10"
                title="放大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewerScale((s) => Math.max(0.2, s / 1.2))}
                className="p-2 rounded-xl border border-[#1f2937] bg-black/40 text-zinc-300 hover:bg-[#00e5ff]/10"
                title="缩小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setViewerScale(1); setViewerOffset({ x: 0, y: 0 }); }}
                className="px-3 py-2 rounded-xl border border-[#1f2937] bg-black/40 text-[12px] text-zinc-300 hover:bg-[#00e5ff]/10"
                title="重置"
              >
                重置
              </button>
              <button
                onClick={() => { setImageViewer(null); stopViewerDrag(); }}
                className="p-2 rounded-xl border border-[#1f2937] bg-black/40 text-zinc-300 hover:bg-[#00e5ff]/10"
                title="关闭"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div
            className="w-full h-full pt-16 pb-6 px-6"
            onWheel={onViewerWheel}
            onMouseDown={onViewerMouseDown}
            onMouseMove={onViewerMouseMove}
            onMouseUp={stopViewerDrag}
            onMouseLeave={stopViewerDrag}
          >
            <div className="w-full h-full overflow-hidden rounded-2xl border border-[#1f2937] bg-black/40">
              <div className="w-full h-full flex items-center justify-center">
                <img
                  src={imageViewer.src}
                  className="select-none"
                  style={{
                    transform: `translate(${viewerOffset.x}px, ${viewerOffset.y}px) scale(${viewerScale})`,
                    transformOrigin: 'center',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    cursor: viewerDraggingRef.current ? 'grabbing' : 'grab'
                  }}
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
