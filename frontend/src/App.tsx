import { useMemo, useState, useEffect, useRef } from 'react';
import { AlertTriangle, Play, FileJson, Terminal, SquareTerminal, RefreshCw, XCircle, Plus, Save, Pencil, Trash2, History, RotateCw, Settings, MonitorPlay, Loader2, Search, Tag, Eye, Activity, ZoomIn, ZoomOut, UserRound, KeyRound, ListChecks, Check, Sun, Moon } from 'lucide-react';
import axios from 'axios';
import CodeBlock from './components/CodeBlock';
import DatasetEditor from './components/DatasetEditor';

interface TestCase {
  id: string;
  name: string;
  type: string;
  tags?: string[];
  updated_at?: number;
}

interface FailureReason {
  category: string;
  message: string;
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
  failure_reason?: FailureReason | null;
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
  failure_reason?: FailureReason | null;
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
  dataset?: any[];
}

interface EnvConfig {
  id: string;
  name: string;
  base_url: string;
}

function App() {
  const [authToken, setAuthToken] = useState<string>(() => localStorage.getItem('auth_token') || '');
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'setup'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const axiosInterceptorRef = useRef<{ req?: number; res?: number } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const v = localStorage.getItem('theme');
    if (v === 'dark' || v === 'light') return v;
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

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
  const [leftTab, setLeftTab] = useState<'editor' | 'dataset' | 'python'>('editor');
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [lastSaved, setLastSaved] = useState<string>('');
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runFailureFilter, setRunFailureFilter] = useState<string>('');
  const [runSelectMode, setRunSelectMode] = useState(false);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [pendingRunToOpen, setPendingRunToOpen] = useState<{ case_id: string; run_id: string } | null>(null);
  const [selectedShotFile, setSelectedShotFile] = useState<string | null>(null);
  const [shotCache, setShotCache] = useState<Record<string, string>>({});
  const shotCacheRef = useRef<Record<string, string>>({});
  const [approvingHeals, setApprovingHeals] = useState<Record<string, boolean>>({});
  const [approvedHeals, setApprovedHeals] = useState<Record<string, boolean>>({});
  const screenshotsContainerRef = useRef<HTMLDivElement>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
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
  const [generating, setGenerating] = useState(false);
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
  const [sidebarNav, setSidebarNav] = useState<'cases' | 'suites' | 'runs'>('cases');
  
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

  const selectedRunIdSet = useMemo(() => new Set(selectedRunIds), [selectedRunIds]);
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRunSelectMode(false);
    setSelectedRunIds([]);
  }, [selectedCase?.id]);

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
    if (axiosInterceptorRef.current) return;
    const req = axios.interceptors.request.use((config) => {
      const t = localStorage.getItem('auth_token');
      if (t) {
        config.headers = config.headers || {};
        (config.headers as any).Authorization = `Bearer ${t}`;
      }
      return config;
    });
    const res = axios.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err?.response?.status === 401) {
          localStorage.removeItem('auth_token');
          setAuthToken('');
          setAuthUser(null);
          setAuthReady(true);
        }
        return Promise.reject(err);
      }
    );
    axiosInterceptorRef.current = { req, res };
    return () => {
      try {
        if (axiosInterceptorRef.current?.req !== undefined) axios.interceptors.request.eject(axiosInterceptorRef.current.req);
        if (axiosInterceptorRef.current?.res !== undefined) axios.interceptors.response.eject(axiosInterceptorRef.current.res);
      } catch {
      } finally {
        axiosInterceptorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (authToken) localStorage.setItem('auth_token', authToken);
    else localStorage.removeItem('auth_token');
  }, [authToken]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (!authToken) {
      setAuthUser(null);
      setAuthReady(true);
      return;
    }
    setAuthReady(false);
    axios.get('/api/auth/me').then((res) => {
      setAuthUser(res.data?.username || null);
      setAuthReady(true);
    }).catch(() => {
      setAuthToken('');
      setAuthUser(null);
      setAuthReady(true);
    });
  }, [authToken]);

  const submitAuth = async () => {
    const username = authUsername.trim();
    const password = authPassword;
    if (!username || !password) return;
    setAuthSubmitting(true);
    setAuthError('');
    try {
      if (authMode === 'setup') {
        try {
          await axios.post('/api/auth/setup', { username, password });
        } catch (e: any) {
          if (e?.response?.status === 409) {
            setAuthMode('login');
          } else {
            throw e;
          }
        }
      }
      const res = await axios.post('/api/auth/login', { username, password });
      setAuthToken(res.data?.token || '');
      setAuthUser(res.data?.username || username);
      setAuthReady(true);
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || '登录失败';
      if (e?.response?.status === 409) {
        setAuthMode('login');
        setAuthError('系统已初始化，请直接登录。');
      } else {
        setAuthError(String(msg));
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const logout = () => {
    setAuthToken('');
    setAuthUser(null);
    setAuthReady(true);
    setSelectedCase(null);
    setCaseDoc(null);
    setSuites([]);
    setCases([]);
    setSelectedRunId(null);
    setSelectedRun(null);
    setRuns([]);
    setSuiteRuns([]);
    setSelectedSuiteId(null);
    setSuiteDoc(null);
    setSelectedSuiteRunId(null);
    setSelectedSuiteRun(null);
    setLogs([]);
    setScreenshot(null);
    setSuiteLogs([]);
    setSuiteScreenshot(null);
  };

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
    if (!authReady || !authUser) return;
    fetchCases();
    fetchSuites();
    loadSettings();
  }, [authReady, authUser]);

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

  const runFailureCategories = useMemo(() => {
    const set = new Set<string>();
    runs.forEach((r) => {
      const c = r.failure_reason?.category;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [runs]);

  const visibleRuns = useMemo(() => {
    if (!runFailureFilter) return runs;
    return runs.filter((r) => (r.failure_reason?.category || '') === runFailureFilter);
  }, [runs, runFailureFilter]);

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

  const toggleRunSelected = (runId: string) => {
    setSelectedRunIds((prev) => (prev.includes(runId) ? prev.filter((x) => x !== runId) : [...prev, runId]));
  };

  const selectAllVisibleRuns = () => {
    setSelectedRunIds(visibleRuns.map((r) => r.id));
  };

  const clearSelectedRuns = () => {
    setSelectedRunIds([]);
  };

  const exitRunSelectMode = () => {
    setRunSelectMode(false);
    setSelectedRunIds([]);
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
      await axios.post('/api/runs/batch_delete', { run_ids: selectedRunIds });
      if (selectedRunId && selectedRunIdSet.has(selectedRunId)) {
        setSelectedRunId(null);
        setSelectedRun(null);
        setLogs([]);
        setScreenshot(null);
        setSelectedShotFile(null);
      }
      if (selectedCase) {
        fetchRuns(selectedCase.id);
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
        const results = await Promise.allSettled(selectedRunIds.map((rid) => axios.delete(`/api/runs/${rid}`)));
        const failedCount = results.filter((r) => r.status === 'rejected').length;
        if (selectedRunId && selectedRunIdSet.has(selectedRunId)) {
          setSelectedRunId(null);
          setSelectedRun(null);
          setLogs([]);
          setScreenshot(null);
          setSelectedShotFile(null);
        }
        if (selectedCase) {
          fetchRuns(selectedCase.id);
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

  const validateDataDriven = async (doc: CaseDoc, actionName: string) => {
    const locs = collectPlaceholders(doc);
    if (locs.length === 0) return true;
    const keys = Array.from(new Set(locs.map(x => x.key))).sort();
    const dataset = doc.dataset || [];
    if (!Array.isArray(dataset)) {
      alert(`数据集必须是 JSON 数组，才能${actionName}。`);
      setLeftTab('dataset');
      return false;
    }
    const badRows: number[] = [];
    dataset.forEach((row, idx) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) badRows.push(idx);
    });
    if (badRows.length > 0) {
      alert(`数据集第 ${badRows.slice(0, 10).map(x => x + 1).join(', ')} 行不是对象，无法${actionName}。`);
      setLeftTab('dataset');
      return false;
    }
    if (dataset.length === 0) {
      await confirmAction({
        title: `缺少数据集`,
        description: `用例包含变量占位符：${keys.join(', ')}\n\n请先在“数据集”页签配置数据（JSON/CSV）。`,
        confirmText: '我知道了',
        destructive: false
      });
      setLeftTab('dataset');
      return false;
    }
    const missing: Array<{ row: number; key: string }> = [];
    dataset.forEach((row: any, idx: number) => {
      keys.forEach((k) => {
        if (!(k in row)) missing.push({ row: idx, key: k });
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
    setScreenshot(null);
    
    try {
      const res = await axios.post(`/api/run/${selectedCase.id}${selectedEnvId ? `?env_id=${selectedEnvId}` : ''}`);
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
    const ok = await validateDataDriven(caseDoc, '保存');
    if (!ok) return;
    setSaving(true);
    try {
      await axios.put(`/api/cases/${selectedCase.id}`, {
        start_url: caseDoc.start_url,
        steps: caseDoc.steps,
        dataset: caseDoc.dataset,
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

  const handleGenerateCase = async () => {
    if (!generateForm.name.trim() || !generateForm.instruction.trim()) {
      alert('用例名称和自然语言指令不能为空！');
      return;
    }
    setGenerating(true);
    try {
      const res = await axios.post('/api/cases/generate', generateForm);
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

  const isReplayMode = !!selectedRunId && !isRunning;

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
    <div className="flex h-screen bg-[#f7f7f8] dark:bg-black text-zinc-900 dark:text-zinc-100 antialiased overflow-hidden">
      {!authUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f7f7f8] dark:bg-black">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_25%_20%,rgba(16,163,127,0.08),transparent_55%),radial-gradient(circle_at_70%_0%,rgba(0,0,0,0.06),transparent_55%)]" />
          <div className="relative w-[420px] max-w-[92vw] px-4">
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-[0_12px_48px_rgba(0,0,0,0.08)]">
              <div className="px-8 pt-8 pb-7">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#10a37f]/10 border border-[#10a37f]/20 flex items-center justify-center">
                      <SquareTerminal className="w-5 h-5 text-[#10a37f]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">SOLO 测试控制台</div>
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">登录后才能访问任何数据</div>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 flex gap-1">
                    <button
                      onClick={() => { setAuthMode('login'); setAuthError(''); }}
                      className={`px-3 py-1.5 text-xs rounded-xl transition ${authMode === 'login' ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                    >
                      登录
                    </button>
                    <button
                      onClick={() => { setAuthMode('setup'); setAuthError(''); }}
                      className={`px-3 py-1.5 text-xs rounded-xl transition ${authMode === 'setup' ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                    >
                      初始化
                    </button>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="space-y-3">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-3 flex items-center text-zinc-400">
                        <UserRound className="w-4 h-4" />
                      </div>
                      <input
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-10 pr-3 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#10a37f]/15 focus:border-[#10a37f]/50"
                        placeholder="用户名"
                        autoFocus
                      />
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-3 flex items-center text-zinc-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-10 pr-3 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#10a37f]/15 focus:border-[#10a37f]/50"
                        placeholder="密码"
                        onKeyDown={(e) => { if (e.key === 'Enter') void submitAuth(); }}
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                      {authError}
                    </div>
                  )}

                  <button
                    onClick={() => void submitAuth()}
                    disabled={authSubmitting || !authUsername.trim() || !authPassword}
                    className="w-full bg-[#10a37f] hover:bg-[#0e8a6a] disabled:opacity-50 disabled:hover:bg-[#10a37f] text-white text-sm font-semibold px-4 py-3 rounded-2xl flex items-center justify-center gap-2"
                  >
                    {authSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>验证中…</span>
                      </>
                    ) : (
                      <span>{authMode === 'setup' ? '初始化并登录' : '登录'}</span>
                    )}
                  </button>

                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {authMode === 'setup' ? '首次使用：创建第一个账号（仅一次）' : '提示：如果已初始化，请直接登录'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar */}
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
                <button onClick={fetchCases} className="p-1 hover:bg-zinc-100 rounded-md text-zinc-500 hover:text-zinc-900 transition" title="刷新用例">
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

              <ul className="rounded-xl border border-zinc-200 divide-y divide-zinc-200 bg-white">
                {filteredCases.map((c) => (
                  <li key={c.id} className="stagger-item">
                    <div
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        selectedCase?.id === c.id
                          ? 'bg-[#10a37f]/10 text-zinc-900'
                          : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    >
                      <button
                        onClick={() => { setSelectedSuiteId(null); setSuiteDoc(null); setSelectedSuiteRunId(null); setSelectedSuiteRun(null); setSelectedCase(c); }}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left"
                      >
                        <FileJson className="w-4 h-4 opacity-70 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{c.name}</span>
                          {c.tags && c.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {c.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="text-[9px] bg-zinc-100 text-zinc-600 px-1 rounded-sm border border-zinc-200">{tag}</span>
                              ))}
                              {c.tags.length > 3 && <span className="text-[9px] text-zinc-500">+{c.tags.length - 3}</span>}
                            </div>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditTags(c); }}
                        className={`p-1.5 rounded-md border transition-colors ${
                          selectedCase?.id === c.id
                            ? 'border-[#10a37f]/25 bg-[#10a37f]/10 text-[#0e8a6a]'
                            : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 text-zinc-500'
                        }`}
                        title="编辑标签"
                      >
                        <Tag className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRename(c); }}
                        className={`p-1.5 rounded-md border transition-colors ${
                          selectedCase?.id === c.id
                            ? 'border-[#10a37f]/25 bg-[#10a37f]/10 text-[#0e8a6a]'
                            : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 text-zinc-500'
                        }`}
                        title="改名"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCase(c); }}
                        className={`p-1.5 rounded-md border transition-colors ${
                          selectedCase?.id === c.id
                            ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700'
                            : 'border-transparent hover:border-rose-200 hover:bg-rose-50 text-zinc-500 hover:text-rose-700'
                        }`}
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
                {filteredCases.length === 0 && (
                  <div className="text-sm text-zinc-500 p-4 text-center border border-dashed border-zinc-200 rounded-xl mt-3 bg-white">
                    未找到匹配用例<br/><span className="text-xs mt-1 block">可点击顶部「新建用例」通过自然语言创建</span>
                  </div>
                )}
              </ul>
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
                    {selectedCase && runs.length > 0 && (
                      <select
                        value={runFailureFilter}
                        onChange={(e) => setRunFailureFilter(e.target.value)}
                        className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-700 outline-none focus:border-[#10a37f]/50"
                        title="按失败原因过滤"
                      >
                        <option value="">全部</option>
                        {runFailureCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => setRunSelectMode(true)}
                      disabled={!selectedCase || runs.length === 0}
                      className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
                      title="批量选择"
                    >
                      <ListChecks className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (selectedCase) fetchRuns(selectedCase.id); }}
                      disabled={!selectedCase || runsLoading}
                      className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
                      title="刷新"
                    >
                      <RotateCw className={`w-4 h-4 ${runsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
              {!selectedCase ? (
                <div className="text-xs text-zinc-600 px-2">选择用例后展示</div>
              ) : runs.length === 0 ? (
                <div className="text-xs text-zinc-600 px-2">暂无运行记录</div>
              ) : (
                <div className="space-y-1 px-2 pb-2">
                  {visibleRuns.length === 0 ? (
                    <div className="text-xs text-zinc-600 px-2 py-2">无匹配记录</div>
                  ) : visibleRuns.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => (runSelectMode ? toggleRunSelected(r.id) : loadRunDetail(r.id))}
                      className={`group w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md border text-xs cursor-pointer ${
                        selectedRunId === r.id
                          ? 'bg-[#10a37f]/10 border-[#10a37f]/25 text-zinc-900'
                          : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {runSelectMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleRunSelected(r.id); }}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selectedRunIdSet.has(r.id)
                                ? 'bg-[#10a37f] border-[#10a37f]'
                                : 'bg-white border-zinc-300 hover:border-zinc-400'
                            }`}
                            title={selectedRunIdSet.has(r.id) ? '取消选择' : '选择'}
                          >
                            {selectedRunIdSet.has(r.id) && <Check className="w-3 h-3 text-white" />}
                          </button>
                        )}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'completed' ? 'bg-emerald-500' : r.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        <span className="truncate">{formatRunTime(r.started_at)} {formatStatus(r.status || 'running')}</span>
                        {r.status === 'failed' && r.failure_reason?.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700 font-mono">
                            {r.failure_reason.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-zinc-500 font-mono">{formatTokenUsage(r.token_usage)}</span>
                        <span className="text-[10px] text-zinc-500">{r.duration_ms ? `${Math.round(r.duration_ms / 1000)}s` : ''}</span>
                        {!runSelectMode && (
                          <button
                            onClick={(e) => handleDeleteRun(e, r.id)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-700 transition-opacity p-0.5 rounded"
                            title="删除记录"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 min-w-0">
        {selectedSuiteRun ? (
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
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#10a37f]/25 text-[#0e8a6a] bg-[#10a37f]/10 truncate max-w-[260px]">
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
                      className="h-full bg-[#10a37f]"
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
                  <div className="text-2xl font-semibold text-[#10a37f] mt-1">{selectedSuiteRun.summary?.heal_total || 0}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Token</div>
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
                  <div className="w-20 text-right font-mono">Token</div>
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
                    const canOpen = !!it?.run_id && (status === 'completed' || status === 'failed');
                    return (
                      <div key={`${cid}_${idx}`} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-zinc-50 transition-colors">
                        <div className="w-8 text-xs text-zinc-500 font-mono">{String(idx + 1).padStart(2, '0')}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-zinc-900 truncate flex items-center gap-2">
                            {cases.find((c) => c.id === cid)?.name || cid}
                            {selectedSuiteRun?.setup_case_id && cid === selectedSuiteRun.setup_case_id && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#10a37f]/25 text-[#0e8a6a] bg-[#10a37f]/10 shrink-0">
                                前置
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate">{it?.run_id ? `RunID: ${it.run_id}` : cid}</div>
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
                <div className="mt-6 flex h-[400px] rounded-2xl border border-zinc-200 overflow-hidden bg-white">
                  {/* Logs */}
                  <div className="w-1/3 flex flex-col border-r border-zinc-200 min-h-0 bg-white">
                    <div className="px-4 py-2 text-xs font-semibold text-zinc-600 border-b border-zinc-200 flex items-center gap-2 shrink-0">
                      <Terminal className="w-3.5 h-3.5" /> 实时日志
                    </div>
                    <div className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed">
                      {suiteLogs.length === 0 ? (
                        <div className="text-zinc-400 italic">等待日志输出...</div>
                      ) : (
                        suiteLogs.map((log, i) => {
                          let colorClass = "text-zinc-700";
                          if (log.includes("✅")) colorClass = "text-emerald-500";
                          if (log.includes("❌") || log.includes("FAILED")) colorClass = "text-rose-500";
                          if (log.includes("🚑") || log.includes("⚠️")) colorClass = "text-amber-500";
                          if (log.includes("🤖") || log.includes("✨")) colorClass = "text-[#10a37f]";
                          return <div key={i} className={`mb-1 break-words ${colorClass}`}>{log}</div>;
                        })
                      )}
                      <div ref={logsEndRef} />
                    </div>
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
        ) : selectedCase ? (
          <>
            {/* Header Bar */}
            <div className="h-14 border-b border-zinc-200 bg-white px-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex flex-col leading-tight">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-zinc-900 truncate max-w-[520px]">{selectedCase.name}</div>
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
                    {`CaseID: ${selectedCase.id}`}
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
                {!isReplayMode && (
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
                    onClick={handleExitReplay}
                    className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border border-zinc-200"
                  >
                    返回编辑
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
                <div className="h-2/3 flex flex-col border-b border-zinc-200 min-h-0">
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
                        {leftTab === 'editor' ? '用例编辑器' : leftTab === 'dataset' ? '数据集' : '生成脚本 (Python)'}
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
                          数据集
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
                          <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                            <div className="text-xs text-zinc-500 flex justify-between items-center">
                              <div>RunID: <span className="font-mono text-zinc-900">{selectedRun.id}</span></div>
                              <div className={`px-2 py-1 rounded-md ${selectedRun.status === 'passed' || selectedRun.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : selectedRun.status === 'failed' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                {formatStatus(selectedRun.status)}
                              </div>
                            </div>
                            <div className="text-xs text-zinc-500 flex flex-wrap gap-4">
                              <div>开始: <span className="text-zinc-900">{formatRunTime(selectedRun.started_at)}</span></div>
                              {selectedRun.duration_ms ? (
                                <div>耗时: <span className="text-zinc-900">{Math.round((selectedRun.duration_ms || 0) / 1000)}s</span></div>
                              ) : null}
                            </div>
                            <div className="text-xs text-zinc-500 flex flex-wrap gap-4">
                              <div>截图数: <span className="text-zinc-900">{selectedRun.screenshots?.length || 0}</span></div>
                              <div>日志行: <span className="text-zinc-900">{selectedRun.logs?.length || 0}</span></div>
                            </div>
                            <div className="text-xs text-zinc-500">
                              Token: <span className="text-zinc-900 font-mono">{formatTokenUsage(selectedRun.token_usage)}</span>
                            </div>
                            {selectedRun.status === 'failed' && selectedRun.failure_reason?.category && (
                              <div className="text-xs text-zinc-500 mt-2">
                                失败原因: <span className="text-rose-700 font-mono">{selectedRun.failure_reason.category}</span>
                                {selectedRun.failure_reason.message ? (
                                  <div className="mt-1 text-[11px] text-zinc-600 font-mono break-words">{selectedRun.failure_reason.message}</div>
                                ) : null}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-zinc-200">
                            <div className="text-xs font-semibold text-zinc-500 mb-3">
                              自愈记录（{selectedRun.heal_events?.length || 0}）
                            </div>
                            {(!selectedRun.heal_events || selectedRun.heal_events.length === 0) ? (
                              <div className="text-xs text-zinc-500">本次运行未发生自愈</div>
                            ) : (
                              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                                {selectedRun.heal_events.map((e, idx) => (
                                  <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-xl-full ${e.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                      <div className="text-xs text-zinc-900 truncate flex-1">{e.intent || '自愈'}</div>
                                      <div className="text-[10px] text-zinc-500 font-mono shrink-0">{e.source || ''}</div>
                                    </div>
                                    <div className="mt-1 text-[10px] text-zinc-500 font-mono">
                                      {formatTokenUsage(e.token_usage)}
                                    </div>
                                    <div className="mt-1 text-[11px] text-zinc-500 font-mono break-all">
                                      {e.original_selector || ''}
                                    </div>
                                    {(e.new_selector || e.new_id) && (
                                      <div className="mt-1 text-[11px] text-zinc-600 font-mono break-all">
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
                                          className="text-[10px] px-2 py-1 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-medium flex items-center gap-1 transition-colors"
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
                                          className="text-[10px] px-2 py-1 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700"
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
                                          className="text-[10px] px-2 py-1 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700"
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
                                                ? 'border-emerald-200 text-emerald-700 bg-emerald-50 cursor-default'
                                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
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
                          <div className="pt-3 border-t border-zinc-200">
                            <div className="text-xs font-semibold text-zinc-500 mb-2">
                              Token 明细（{selectedRun.token_summary?.tests?.[0]?.llm_events?.length || 0}）
                            </div>
                            {(!selectedRun.token_summary?.tests?.[0]?.llm_events || selectedRun.token_summary.tests[0].llm_events.length === 0) ? (
                              <div className="text-xs text-zinc-500">本次运行未记录到 Token 明细</div>
                            ) : (
                              <div className="space-y-1 max-h-40 overflow-auto pr-1">
                                {selectedRun.token_summary.tests[0].llm_events.slice(-30).reverse().map((ev: any, i: number) => (
                                  <div key={i} className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-[10px] text-zinc-500 font-mono truncate">{ev.kind || 'llm'}</div>
                                      <div className="text-[10px] text-zinc-500 font-mono shrink-0">{formatTokenUsage(ev.token_usage)}</div>
                                    </div>
                                    {ev.message && (
                                      <div className="text-[10px] text-zinc-600 truncate break-words whitespace-pre-wrap mt-1 leading-relaxed">{ev.message}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="pt-3 border-t border-zinc-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-semibold text-zinc-500">
                                AI 修复建议
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => requestAIFixSuggestion(false)}
                                  disabled={fixSuggestLoading}
                                  className="text-[10px] px-2 py-1 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                                >
                                  {fixSuggestLoading ? '生成中...' : '生成'}
                                </button>
                                <button
                                  onClick={() => requestAIFixSuggestion(true)}
                                  disabled={fixSuggestLoading}
                                  className="text-[10px] px-2 py-1 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                                >
                                  强制刷新
                                </button>
                              </div>
                            </div>
                            {selectedRun.ai_fix_suggestion ? (
                              <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
                                {selectedRun.ai_fix_suggestion.root_cause && (
                                  <div className="text-xs text-zinc-700">
                                    根因：<span className="text-zinc-900">{selectedRun.ai_fix_suggestion.root_cause}</span>
                                  </div>
                                )}
                                <div className="text-[10px] text-zinc-500 font-mono">
                                  {formatTokenUsage(selectedRun.ai_fix_suggestion.token_usage)}
                                </div>
                                {selectedRun.ai_fix_suggestion.explanation && (
                                  <div className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap">
                                    {selectedRun.ai_fix_suggestion.explanation}
                                  </div>
                                )}
                                {selectedRun.ai_fix_suggestion.suggestions && selectedRun.ai_fix_suggestion.suggestions.length > 0 && (
                                  <div className="space-y-1">
                                    {selectedRun.ai_fix_suggestion.suggestions.map((s, i) => (
                                      <div key={i} className="text-xs text-zinc-600">
                                        - {s}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    onClick={applyAIFixSuggestion}
                                    disabled={applyFixLoading || !selectedRun.ai_fix_suggestion.patched_steps}
                                    className="text-[10px] px-2 py-1 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  >
                                    {applyFixLoading ? '应用中...' : '应用到用例'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-500">尚未生成修复建议</div>
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
                            dataset={caseDoc.dataset || []}
                            onChange={(ds) => setCaseDoc({ ...caseDoc, dataset: ds })}
                          />
                        )
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
                                className="col-span-5 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15"
                              />
                            </div>
                            <div className="text-xs text-zinc-500">steps</div>
                            <div className="space-y-2">
                              {caseDoc.steps.map((s, idx) => (
                                <div key={idx} className={`rounded-xl border border-zinc-200 bg-white p-4 space-y-3 shadow-sm hover:bg-zinc-50 transition-colors ${s.disabled ? 'opacity-50 grayscale' : ''}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs text-zinc-400 font-mono">Step {idx + 1}</div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => moveStep(idx, 'up')} disabled={idx === 0} className="text-xs text-zinc-500 hover:text-[#0e8a6a] disabled:opacity-30">↑</button>
                                      <button onClick={() => moveStep(idx, 'down')} disabled={idx === caseDoc.steps.length - 1} className="text-xs text-zinc-500 hover:text-[#0e8a6a] disabled:opacity-30">↓</button>
                                      <button onClick={() => duplicateStep(idx)} className="text-xs text-[#0e8a6a] hover:text-[#0e8a6a]">复制</button>
                                      <button onClick={() => updateStep(idx, { disabled: !s.disabled })} className="text-xs text-zinc-500 hover:text-[#0e8a6a]">{s.disabled ? '启用' : '禁用'}</button>
                                      <button onClick={() => removeStep(idx)} className="text-xs text-rose-700 hover:text-rose-800">删除</button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <select
                                      value={s.type}
                                      onChange={(e) => updateStep(idx, { type: e.target.value as StepType })}
                                      className="bg-white border border-zinc-200 rounded-xl px-2 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50"
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
                                        className="col-span-2 bg-white border border-zinc-200 rounded-xl px-2 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50"
                                      >
                                        <option value="text">页面包含文本</option>
                                        <option value="url">URL 包含</option>
                                        <option value="visible">元素可见</option>
                                      </select>
                                    ) : (
                                      <input
                                        value={s.intent || ''}
                                        onChange={(e) => updateStep(idx, { intent: e.target.value })}
                                        className="col-span-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50"
                                        placeholder="意图（建议写清楚，如：点击登录按钮）"
                                      />
                                    )}
                                  </div>
                                  {(!s.type || !['wait', 'scroll', 'press_key'].includes(s.type) || (s.type === 'assert' && s.assert_type === 'visible')) && (
                                    <input
                                      value={s.selector || ''}
                                      onChange={(e) => updateStep(idx, { selector: e.target.value })}
                                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50 font-mono"
                                      placeholder="selector（Playwright 支持）"
                                    />
                                  )}
                                  {(['input', 'wait', 'select_option', 'press_key', 'scroll'].includes(s.type || '') || (s.type === 'assert' && s.assert_type !== 'visible')) && (
                                    <input
                                      value={s.value || ''}
                                      onChange={(e) => updateStep(idx, { value: e.target.value })}
                                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50 font-mono"
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
                <div className="h-1/3 flex flex-col min-h-0 bg-zinc-50 border-t border-zinc-200">
                  <div className="px-4 py-2 bg-zinc-50 text-xs font-semibold text-zinc-600 flex items-center gap-2 border-b border-zinc-200 tracking-wider uppercase">
                    <Terminal className="w-3.5 h-3.5" /> 实时执行日志
                  </div>
                  <div className="flex-1 overflow-auto p-4 bg-transparent font-mono text-[13px] leading-relaxed custom-scrollbar">
                    {logs.length === 0 ? (
                      <div className="text-zinc-400 italic">点击右上角「运行测试」开始监控日志...</div>
                    ) : (
                      logs.map((log, i) => {
                        let colorClass = "text-zinc-700";
                        if (log.includes("✅")) colorClass = "text-emerald-500";
                        if (log.includes("❌") || log.includes("FAILED")) colorClass = "text-rose-500";
                        if (log.includes("🚑") || log.includes("⚠️")) colorClass = "text-amber-500";
                        if (log.includes("🤖") || log.includes("✨")) colorClass = "text-[#10a37f]";
                        
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
              <div className="w-[65%] flex flex-col bg-zinc-50 min-w-0 border-l border-zinc-200">
                <div className="px-4 py-2 bg-zinc-50 text-[11px] font-semibold text-zinc-600 tracking-wider uppercase flex items-center gap-2 border-b border-zinc-200 shrink-0 relative z-10">
                  {isReplayMode ? '视觉回放' : '实时画面'}
                </div>
                <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-transparent relative">
                  <div className="flex-1 p-4 flex items-center justify-center overflow-hidden min-h-0">
                    {screenshot ? (
                      <div className="relative group rounded-xl shadow-[0_18px_50px_rgba(0,0,0,0.12)] border border-zinc-200 w-full h-full flex items-center justify-center bg-white min-h-0 overflow-hidden transition-all duration-300 hover:border-zinc-300">
                        <img
                          src={`data:image/jpeg;base64,${screenshot}`}
                          alt="Current Screen"
                          className="max-w-full max-h-full object-contain"
                        />
                        {isRunning && !isReplayMode && (
                          <>
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                              <span className="text-[10px] font-mono text-[#10a37f] tracking-widest uppercase opacity-90">REC</span>
                              <span className="w-2 h-2 rounded-full bg-[#10a37f] animate-pulse"></span>
                            </div>
                            <div 
                              className="absolute inset-0 pointer-events-none opacity-20 animate-shimmer"
                              style={{
                                background: 'linear-gradient(90deg, transparent 0%, rgba(16, 163, 127, 0.04) 20%, rgba(16, 163, 127, 0.10) 50%, rgba(16, 163, 127, 0.04) 80%, transparent 100%)',
                                backgroundSize: '200% 100%'
                              }}
                            ></div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-center flex flex-col items-center opacity-60">
                        <SquareTerminal className="w-16 h-16 mb-4 text-zinc-500" />
                        <p className="text-zinc-500 text-sm">{isReplayMode ? '该次运行没有截图' : '等待执行时回传实时画面...'}</p>
                      </div>
                    )}
                  </div>

                  {isReplayMode && selectedRunId && selectedRun?.screenshots && selectedRun.screenshots.length > 0 && (
                    <div className="border-t border-zinc-200 bg-white px-4 py-3 relative z-20 shrink-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                          截图缩略条（{selectedRun.screenshots.length}）
                          {selectedShotFile && (
                            <span className="text-[10px] text-[#0e8a6a] font-mono bg-[#10a37f]/10 px-2 py-0.5 rounded-md border border-[#10a37f]/20 normal-case tracking-normal">
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
                            className="p-1 rounded bg-white hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 border border-zinc-200 disabled:opacity-30 transition-colors"
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
                            className="p-1 rounded bg-white hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 border border-zinc-200 disabled:opacity-30 transition-colors"
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
                                  ? 'border-[#10a37f] shadow-sm scale-[1.02]' 
                                  : 'border-zinc-200 hover:border-zinc-300 hover:scale-[1.02] opacity-70 hover:opacity-100 bg-white'
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
                                <div className="w-full h-full flex items-center justify-center bg-zinc-100 relative overflow-hidden">
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-4 h-4 border-2 border-zinc-300 border-t-[#10a37f] rounded-full animate-spin"></div>
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
                  onChange={(e) => setSuiteDoc({ ...suiteDoc, env_id: e.target.value })}
                  className="bg-white border border-zinc-200 rounded-xl px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-[#10a37f]/50"
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
                      ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                      : 'bg-[#10a37f] hover:bg-[#0e8a6a] text-white border-transparent'
                  }`}
                >
                  <Save className="w-4 h-4" /> 保存套件
                </button>
                <button
                  onClick={runSuite}
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
                      setSuiteDoc({ ...suiteDoc, setup_case_id: next, case_ids: nextCaseIds });
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
                    onChange={(e) => setSuiteAddCaseId(e.target.value)}
                    className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#10a37f]/50"
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
                            onClick={() => suiteMoveCase(idx, 'up')}
                            disabled={idx === 0}
                            className="text-xs text-zinc-500 hover:text-[#0e8a6a] disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-zinc-100"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => suiteMoveCase(idx, 'down')}
                            disabled={idx === (suiteDoc.case_ids || []).length - 1}
                            className="text-xs text-zinc-500 hover:text-[#0e8a6a] disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-zinc-100"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => suiteRemoveCase(cid)}
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
                    onClick={() => fetchSuiteRuns(suiteDoc.id)}
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
                        onClick={() => loadSuiteRunDetail(r.id)}
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
                            onClick={(e) => handleDeleteSuiteRun(e, r.id)}
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
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-center p-10 rounded-3xl border border-zinc-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
              <div className="w-12 h-12 rounded-2xl bg-[#10a37f]/10 border border-[#10a37f]/20 flex items-center justify-center mb-6">
                <SquareTerminal className="w-6 h-6 text-[#10a37f]" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 mb-2">SOLO 测试控制台</h2>
              <p className="text-sm text-zinc-500">请选择一个用例或套件开始</p>
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.16)] w-full max-w-2xl p-8 flex flex-col relative overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between mb-5 shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#10a37f]" />
                    控制台设置
                  </h2>
                  <div className="flex bg-zinc-100 border border-zinc-200 rounded-xl p-1">
                    <button
                      onClick={() => setSettingsTab('env')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${settingsTab === 'env' ? 'bg-white text-zinc-900 border border-zinc-200 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
                    >
                      环境变量
                    </button>
                    <button
                      onClick={() => setSettingsTab('prompts')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${settingsTab === 'prompts' ? 'bg-white text-zinc-900 border border-zinc-200 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
                    >
                      Prompt 预设
                    </button>
                  </div>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-zinc-900 transition-colors hover:bg-zinc-100 p-1.5 rounded-full">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                {settingsTab === 'env' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider">OPENAI_API_BASE</label>
                <input
                  type="text"
                  value={apiBase}
                  onChange={e => setApiBase(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider">OPENAI_MODEL_NAME</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                  placeholder="gpt-4o-mini"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider">OPENAI_API_KEY</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                    placeholder="sk-..."
                  />
                  <button
                    onClick={testSettingsConnection}
                    disabled={testingSettings || !apiKey || !apiBase}
                    className="px-4 py-2.5 bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {testingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : '连接测试'}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70"></span>此 Key 仅保存在本地 .env 文件中，用于 AI 自愈链路。</p>
                {settingsTestResult && (
                  <div className={`mt-3 text-xs px-3 py-2 rounded-xl border flex items-center gap-2 ${settingsTestResult.ok ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-rose-200 text-rose-700 bg-rose-50'}`}>
                    {settingsTestResult.ok ? '✅' : '❌'} {settingsTestResult.message}
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-200 pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider">多环境配置 (Environments)</label>
                  <button
                    onClick={() => setEnvs([...envs, { id: `env_${Date.now()}`, name: '新环境', base_url: '' }])}
                    className="text-xs text-[#10a37f] hover:text-[#0e8a6a] font-medium transition-colors"
                  >
                    + 添加环境
                  </button>
                </div>
                <div className="space-y-3 max-h-48 overflow-auto pr-2">
                  {envs.length === 0 ? (
                    <div className="text-xs text-zinc-400 italic text-center py-4">暂无环境配置</div>
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
                          className="w-1/3 bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 transition-colors placeholder:text-zinc-400"
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
                          className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 transition-colors placeholder:text-zinc-400"
                          placeholder="Base URL"
                        />
                        <button
                          onClick={() => {
                            const newEnvs = envs.filter((_, idx) => idx !== i);
                            setEnvs(newEnvs);
                          }}
                          className="text-zinc-400 hover:text-rose-700 p-1.5 rounded-md hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
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
              <div className="flex flex-col h-[600px] space-y-4 pt-4 border-t border-zinc-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider">选择 Prompt 文件</label>
                  <select
                    value={activePromptFile}
                    onChange={e => setActivePromptFile(e.target.value)}
                    className="bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:border-[#10a37f]/50"
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
                      className="w-full h-full bg-white border border-zinc-200 rounded-xl p-4 text-sm font-mono text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all resize-none"
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

          <div className="mt-6 flex justify-end gap-3 shrink-0 border-t border-zinc-200 pt-5">
              <button
                onClick={() => setShowSettings(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all"
              >
                取消
              </button>
              <button
                onClick={testSettingsConnection}
                disabled={testingSettings || savingSettings || !apiKey || !apiBase}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {testingSettings ? <RotateCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                测试连接
              </button>
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[#10a37f] hover:bg-[#0e8a6a] flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {savingSettings ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.16)] w-full max-w-lg p-7 flex flex-col relative overflow-hidden">

            <div className="flex items-start justify-between mb-5 relative z-10">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-2 rounded-2xl border ${confirmModal.destructive ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-[#10a37f]/20 bg-[#10a37f]/10 text-[#0e8a6a]'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-zinc-900">{confirmModal.title}</div>
                  {confirmModal.description && <div className="text-sm text-zinc-600 mt-1 leading-relaxed">{confirmModal.description}</div>}
                </div>
              </div>
              <button
                onClick={() => closeConfirm(false)}
                className="text-zinc-500 hover:text-zinc-900 transition-colors hover:bg-zinc-100 p-2 rounded-full"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-2 flex justify-end gap-3 relative z-10">
              <button
                onClick={() => closeConfirm(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all"
              >
                取消
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className={`px-6 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-all ${
                  confirmModal.destructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#10a37f] hover:bg-[#0e8a6a]'
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.16)] w-full max-w-xl p-8 flex flex-col relative overflow-hidden">

            <div className="flex items-start justify-between mb-6 relative z-10">
              <div>
                <div className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-[#10a37f]" />
                  {promptModal.title}
                </div>
                {promptModal.description && <div className="text-sm text-zinc-600 mt-1">{promptModal.description}</div>}
              </div>
              <button
                onClick={() => closePrompt(null)}
                className="text-zinc-500 hover:text-zinc-900 transition-colors hover:bg-zinc-100 p-2 rounded-full"
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
                className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-3 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                placeholder={promptModal.placeholder || ''}
                autoFocus
              />
            </div>

            <div className="mt-8 flex justify-end gap-3 relative z-10">
              <button
                onClick={() => closePrompt(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all"
              >
                取消
              </button>
              <button
                onClick={() => { const v = promptValue.trim(); closePrompt(v ? v : ''); }}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[#10a37f] hover:bg-[#0e8a6a] flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {promptModal.confirmText || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateSuiteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.16)] w-full max-w-xl p-8 flex flex-col relative overflow-hidden">

            <div className="flex items-start justify-between mb-6 relative z-10">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
                  <SquareTerminal className="w-5 h-5 text-[#10a37f]" />
                  新建测试套件
                </h2>
                <div className="text-sm text-zinc-600 mt-1">将多个用例组合成一次回归计划（顺序执行，失败继续跑）。</div>
              </div>
              <button
                onClick={() => { if (!creatingSuite) setShowCreateSuiteModal(false); }}
                disabled={creatingSuite}
                className="text-zinc-500 hover:text-zinc-900 transition-colors hover:bg-zinc-100 p-2 rounded-full disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 relative z-10">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider">套件名称</label>
                <input
                  type="text"
                  value={createSuiteName}
                  onChange={(e) => setCreateSuiteName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void confirmCreateSuite(); }}
                  className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-3 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                  placeholder="例如：Smoke 回归 / 登录链路"
                  disabled={creatingSuite}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider">运行环境（统一）</label>
                <select
                  value={createSuiteEnvId}
                  onChange={(e) => setCreateSuiteEnvId(e.target.value)}
                  disabled={creatingSuite}
                  className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-3 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all"
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
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={confirmCreateSuite}
                disabled={creatingSuite || !createSuiteName.trim()}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[#10a37f] hover:bg-[#0e8a6a] flex items-center gap-2 transition-all disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-[0_18px_60px_rgba(0,0,0,0.16)] w-full max-w-4xl p-10 flex flex-col relative overflow-hidden">
            
            <div className="relative z-10 flex items-start justify-between mb-8">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900 flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-[#10a37f]/10 rounded-xl border border-[#10a37f]/20">
                    <SquareTerminal className="w-6 h-6 text-[#10a37f]" />
                  </div>
                  自然语言生成用例 (NL2Case)
                </h2>
                <p className="text-sm text-zinc-600 pl-14">通过大语言模型，将人类自然语言描述自动转化为结构化的自动化测试用例。</p>
              </div>
              <button onClick={() => setShowGenerateModal(false)} disabled={generating} className="text-zinc-500 hover:text-zinc-900 transition-colors hover:bg-zinc-100 p-2 rounded-full disabled:opacity-50">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="relative z-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider pl-1">用例名称</label>
                  <input
                    type="text"
                    value={generateForm.name}
                    onChange={e => setGenerateForm({ ...generateForm, name: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-3.5 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                    placeholder="例如：登录并验证欢迎提示"
                    disabled={generating}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider pl-1">初始 URL (Start URL)</label>
                  <input
                    type="text"
                    value={generateForm.start_url}
                    onChange={e => setGenerateForm({ ...generateForm, start_url: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-3.5 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                    placeholder="例如：https://example.com/login"
                    disabled={generating}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider pl-1">自然语言操作步骤</label>
                <textarea
                  value={generateForm.instruction}
                  onChange={e => setGenerateForm({ ...generateForm, instruction: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-2xl px-5 py-4 text-base text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400 min-h-[280px] custom-scrollbar resize-none leading-relaxed"
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
                className="px-6 py-3 rounded-xl text-base font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleGenerateCase}
                disabled={generating}
                className="px-8 py-3 rounded-xl text-base font-medium text-white bg-[#10a37f] hover:bg-[#0e8a6a] flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {generating ? <RotateCw className="w-5 h-5 animate-spin" /> : <Terminal className="w-5 h-5" />}
                {generating ? 'AI 拆解生成中...' : '开始生成用例'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Heal Compare Modal */}
      {comparingHealEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-7xl h-[85vh] flex flex-col shadow-[0_18px_60px_rgba(0,0,0,0.35)] overflow-hidden relative">
            {/* Header */}
            <div className="p-4 border-b border-zinc-200 flex justify-between items-start bg-white shrink-0">
              <div className="flex-1 mr-8">
                <h3 className="text-lg text-zinc-900 font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#10a37f]" />
                  自愈记录审计: {comparingHealEvent.intent || '未知意图'}
                </h3>
                <div className="text-[13px] text-zinc-600 mt-2 flex flex-col gap-1.5 font-mono bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                  <div className="flex items-start gap-2">
                    <span className="text-rose-700 shrink-0 select-none">[-] 旧选择器:</span>
                    <span className="line-through decoration-rose-500/40 text-rose-700 break-all">{comparingHealEvent.original_selector}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-700 shrink-0 select-none">[+] 新选择器:</span>
                    <span className="text-emerald-700 break-all">{comparingHealEvent.new_selector || `[ai-id="${comparingHealEvent.new_id}"]`}</span>
                  </div>
                  {comparingHealEvent.reason && (
                    <div className="mt-1 pt-1.5 border-t border-zinc-200 text-zinc-600 font-sans text-xs flex gap-2">
                      <span className="shrink-0">🤖 决策原因:</span>
                      <span>{comparingHealEvent.reason}</span>
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => { setComparingHealEvent(null); setCompareImages({ before: null, after: null }); }}
                className="text-zinc-500 hover:text-zinc-900 transition-colors p-2 hover:bg-zinc-100 rounded-full shrink-0"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex flex-1 overflow-hidden bg-zinc-50 p-6 gap-6 relative">
              {compareImagesLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                  <Loader2 className="w-8 h-8 text-[#10a37f] animate-spin mb-4" />
                  <span className="text-sm text-zinc-600">正在加载高清对比截图...</span>
                </div>
              )}
              
              {/* Before View */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                  <span className="text-sm font-medium text-zinc-700">自愈前 (元素定位失败)</span>
                </div>
                <div className="flex-1 relative border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm group">
                  {compareImages.before ? (
                    <img
                      src={`data:image/jpeg;base64,${compareImages.before}`}
                      className="object-contain w-full h-full p-2 cursor-zoom-in"
                      alt="Before Heal"
                      onClick={() => openImageViewer(compareImages.before as string, '自愈前')}
                    />
                  ) : !compareImagesLoading ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm">暂无自愈前截图</div>
                  ) : null}
                </div>
              </div>

              {/* VS Divider */}
              <div className="flex flex-col items-center justify-center shrink-0 w-8">
                <div className="h-full w-px bg-zinc-200"></div>
                <div className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-500 z-10 my-4 shadow-sm">VS</div>
                <div className="h-full w-px bg-zinc-200"></div>
              </div>

              {/* After View */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-sm font-medium text-zinc-700">自愈后 (AI 寻素并执行成功)</span>
                </div>
                <div className="flex-1 relative border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm group">
                  {compareImages.after ? (
                    <img
                      src={`data:image/jpeg;base64,${compareImages.after}`}
                      className="object-contain w-full h-full p-2 cursor-zoom-in"
                      alt="After Heal"
                      onClick={() => openImageViewer(compareImages.after as string, '自愈后')}
                    />
                  ) : !compareImagesLoading ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm">暂无自愈后截图</div>
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
                className="p-2 rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/15"
                title="放大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewerScale((s) => Math.max(0.2, s / 1.2))}
                className="p-2 rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/15"
                title="缩小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setViewerScale(1); setViewerOffset({ x: 0, y: 0 }); }}
                className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-[12px] text-white hover:bg-white/15"
                title="重置"
              >
                重置
              </button>
              <button
                onClick={() => { setImageViewer(null); stopViewerDrag(); }}
                className="p-2 rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/15"
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
            <div className="w-full h-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
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
