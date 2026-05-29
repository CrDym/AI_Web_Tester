import { Loader2, RefreshCw, RotateCw, Save, Settings, Trash2, XCircle } from 'lucide-react';
import type { EnvConfig } from '../types';

type SettingsTab = 'env' | 'prompts';

interface SettingsModalProps {
  apiBase: string;
  apiKey: string;
  apiKeySet: boolean;
  modelName: string;
  envs: EnvConfig[];
  prompts: Record<string, string>;
  activePromptFile: string;
  settingsTab: SettingsTab;
  savingSettings: boolean;
  testingSettings: boolean;
  settingsTestResult: { ok: boolean; message: string } | null;
  onApiBaseChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelNameChange: (value: string) => void;
  onEnvsChange: (value: EnvConfig[]) => void;
  onPromptsChange: (value: Record<string, string>) => void;
  onActivePromptFileChange: (value: string) => void;
  onSettingsTabChange: (value: SettingsTab) => void;
  onClose: () => void;
  onSave: () => void;
  onTestConnection: () => void;
}

export default function SettingsModal({
  apiBase,
  apiKey,
  apiKeySet,
  modelName,
  envs,
  prompts,
  activePromptFile,
  settingsTab,
  savingSettings,
  testingSettings,
  settingsTestResult,
  onApiBaseChange,
  onApiKeyChange,
  onModelNameChange,
  onEnvsChange,
  onPromptsChange,
  onActivePromptFileChange,
  onSettingsTabChange,
  onClose,
  onSave,
  onTestConnection,
}: SettingsModalProps) {
  const promptFiles = Object.keys(prompts).sort();

  return (
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
                onClick={() => onSettingsTabChange('env')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${settingsTab === 'env' ? 'bg-white text-zinc-900 border border-zinc-200 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                环境变量
              </button>
              <button
                onClick={() => onSettingsTabChange('prompts')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${settingsTab === 'prompts' ? 'bg-white text-zinc-900 border border-zinc-200 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
              >
                提示词预设
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 transition-colors hover:bg-zinc-100 p-1.5 rounded-full">
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
                  onChange={e => onApiBaseChange(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wider">OPENAI_MODEL_NAME</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={e => onModelNameChange(e.target.value)}
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
                    onChange={e => onApiKeyChange(e.target.value)}
                    className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 focus:ring-2 focus:ring-[#10a37f]/15 transition-all placeholder:text-zinc-400"
                    placeholder={apiKeySet ? '已保存，留空表示不修改' : 'sk-...'}
                  />
                  <button
                    onClick={onTestConnection}
                    disabled={testingSettings || !apiKey || !apiBase}
                    className="px-4 py-2.5 bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {testingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : '连接测试'}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70"></span>
                  {apiKeySet ? '已保存 API Key；留空保存不会覆盖现有 Key。连接测试需重新输入 Key。' : '此 Key 仅保存在本地 .env 文件中，用于 AI 自愈链路。'}
                </p>
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
                    onClick={() => onEnvsChange([...envs, { id: `env_${Date.now()}`, name: '新环境', base_url: '' }])}
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
                            newEnvs[i] = { ...newEnvs[i], name: e.target.value };
                            onEnvsChange(newEnvs);
                          }}
                          className="w-1/3 bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 transition-colors placeholder:text-zinc-400"
                          placeholder="名称 (如 QA)"
                        />
                        <input
                          type="text"
                          value={env.base_url}
                          onChange={e => {
                            const newEnvs = [...envs];
                            newEnvs[i] = { ...newEnvs[i], base_url: e.target.value };
                            onEnvsChange(newEnvs);
                          }}
                          className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-[#10a37f]/50 transition-colors placeholder:text-zinc-400"
                          placeholder="Base URL"
                        />
                        <button
                          onClick={() => onEnvsChange(envs.filter((_, idx) => idx !== i))}
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
            <div className="h-[620px] grid grid-cols-[220px_1fr] gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 min-h-0">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-2 overflow-auto custom-scrollbar">
                {promptFiles.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400 text-center px-4">没有找到提示词预设文件</div>
                ) : promptFiles.map((f) => {
                  const active = activePromptFile === f;
                  const label = f.replace(/_system_prompt\.txt$/, '').replace(/_/g, ' ');
                  return (
                    <button
                      key={f}
                      onClick={() => onActivePromptFileChange(f)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 mb-1 border transition-all ${active ? 'bg-white dark:bg-zinc-950 border-[#10a37f]/30 shadow-sm text-zinc-900 dark:text-zinc-100' : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-white/70 dark:hover:bg-zinc-950/70'}`}
                    >
                      <div className="text-xs font-semibold truncate capitalize">{label}</div>
                      <div className="mt-0.5 text-[10px] font-mono text-zinc-400 truncate">{f}</div>
                    </button>
                  );
                })}
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{activePromptFile || '未选择提示词'}</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">编辑后点击底部“保存设置”生效；NL2Case 与自然语言导入均从这里读取。</div>
                  </div>
                  <div className="shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                    {(prompts[activePromptFile] || '').length} chars
                  </div>
                </div>
                {activePromptFile ? (
                  <textarea
                    value={prompts[activePromptFile] || ''}
                    onChange={e => onPromptsChange({ ...prompts, [activePromptFile]: e.target.value })}
                    className="flex-1 min-h-0 w-full bg-white dark:bg-zinc-950 p-4 text-[13px] leading-relaxed font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none transition-all resize-none custom-scrollbar"
                    spellCheck="false"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400 text-sm">请选择左侧提示词预设</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3 shrink-0 border-t border-zinc-200 pt-5">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all"
          >
            取消
          </button>
          <button
            onClick={onTestConnection}
            disabled={testingSettings || savingSettings || !apiKey || !apiBase}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {testingSettings ? <RotateCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            测试连接
          </button>
          <button
            onClick={onSave}
            disabled={savingSettings}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-[#10a37f] hover:bg-[#0e8a6a] flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {savingSettings ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
