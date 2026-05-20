export interface TestCase {
  id: string;
  name: string;
  type: string;
  group_name?: string;
  aliases?: string[];
  tags?: string[];
  updated_at?: number;
}

export interface FailureReason {
  category: string;
  label?: string;
  severity?: 'low' | 'medium' | 'high' | string;
  message: string;
  suggestion?: string;
  failed_step_index?: number | null;
  failed_step_no?: number | null;
}

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface LlmTokenEvent {
  kind?: string;
  message?: string;
  token_usage?: TokenUsage;
}

export interface TokenSummary {
  tests?: Array<{
    llm_events?: LlmTokenEvent[];
  }>;
}

export interface RunSummary {
  id: string;
  case_id?: string;
  type?: string;
  status?: string;
  started_at?: number;
  ended_at?: number | null;
  duration_ms?: number | null;
  token_usage?: TokenUsage;
  failure_reason?: FailureReason | null;
}

export interface HealEvent {
  ts: number;
  intent?: string | null;
  original_selector?: string | null;
  new_id?: string | null;
  new_selector?: string | null;
  reason?: string | null;
  success?: boolean;
  source?: string | null;
  token_usage?: TokenUsage | null;
  model?: string | null;
  before_file?: string | null;
  after_file?: string | null;
}

export interface AIFixSuggestion {
  created_at?: number;
  root_cause?: string;
  explanation?: string;
  suggestions?: string[];
  patched_steps?: CaseStep[] | null;
  token_usage?: TokenUsage | null;
  model?: string | null;
}

export interface RunDetail {
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
  token_usage?: TokenUsage;
  token_summary?: TokenSummary;
  failure_reason?: FailureReason | null;
}

export interface SuiteSummary {
  id: string;
  name: string;
  env_id?: string | null;
  case_count?: number;
  updated_at?: number | null;
}

export interface SuiteDoc {
  id: string;
  name: string;
  env_id?: string | null;
  setup_case_id?: string | null;
  case_ids: string[];
  created_at?: number;
  updated_at?: number;
}

export interface SuiteRunItem {
  case_id: string;
  run_id: string;
  status: string;
  duration_ms?: number | null;
  heal_count?: number;
  token_usage?: TokenUsage;
}

export interface SuiteRunDetail {
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

export interface SuiteRunSummary {
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

export interface ConfirmModalOptions {
  title: string;
  description?: string;
  confirmText?: string;
  destructive?: boolean;
}

export interface PromptModalOptions {
  title: string;
  description?: string;
  confirmText?: string;
  placeholder?: string;
  initialValue?: string;
}

export type StepType = 'click' | 'input' | 'wait' | 'assert' | 'hover' | 'select_option' | 'set_checked' | 'double_click' | 'right_click' | 'press_key' | 'scroll';

export interface CaseStep {
  type: StepType;
  selector: string;
  intent?: string | null;
  value?: string | null;
  url?: string | null;
  snapshot?: string | null;
  assert_type?: 'text' | 'url' | 'visible' | null;
  disabled?: boolean;
}

export interface CaseDoc {
  id: string;
  name: string;
  start_url?: string | null;
  steps: CaseStep[];
  tags?: string[];
  variables?: Record<string, unknown>;
  dataset?: Record<string, unknown>[];
}

export interface EnvConfig {
  id: string;
  name: string;
  base_url: string;
}
