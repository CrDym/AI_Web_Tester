import { useState } from 'react';
import { apiClient } from '../api/client';
import type { EnvConfig } from '../types';
import { formatTokenUsage } from '../utils/formatters';

export function useSettings(onLog: (message: string) => void) {
  const [showSettings, setShowSettings] = useState(false);
  const [apiBase, setApiBase] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [modelName, setModelName] = useState('gpt-4o-mini');
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [activePromptFile, setActivePromptFile] = useState<string>('');
  const [settingsTab, setSettingsTab] = useState<'env' | 'prompts'>('env');
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingSettings, setTestingSettings] = useState(false);
  const [settingsTestResult, setSettingsTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [envs, setEnvs] = useState<EnvConfig[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');

  const loadSettings = async () => {
    try {
      const res = await apiClient.get('/api/config');
      setApiBase(res.data.OPENAI_API_BASE || '');
      setApiKey('');
      setApiKeySet(!!res.data.OPENAI_API_KEY_SET);
      setModelName(res.data.OPENAI_MODEL_NAME || 'gpt-4o-mini');
      const envRes = await apiClient.get('/api/environments');
      setEnvs(envRes.data || []);
      const promptRes = await apiClient.get('/api/prompts');
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
      const configPayload: Record<string, string> = {
        OPENAI_API_BASE: apiBase,
        OPENAI_MODEL_NAME: modelName,
      };
      if (apiKey.trim()) configPayload.OPENAI_API_KEY = apiKey;
      await apiClient.post('/api/config', configPayload);
      if (apiKey.trim()) setApiKeySet(true);
      setApiKey('');
      const envRes = await apiClient.post('/api/environments', envs);
      if (Array.isArray(envRes.data?.environments)) setEnvs(envRes.data.environments);
      for (const [filename, content] of Object.entries(prompts)) {
        await apiClient.put(`/api/prompts/${filename}`, { content });
      }
      setShowSettings(false);
      onLog('✅ 配置已保存');
    } catch (e: any) {
      onLog(`❌ 配置保存失败: ${e.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const testSettingsConnection = async () => {
    setTestingSettings(true);
    setSettingsTestResult(null);
    try {
      const res = await apiClient.post('/api/config/test', {
        OPENAI_API_BASE: apiBase,
        OPENAI_API_KEY: apiKey,
        OPENAI_MODEL_NAME: modelName,
      });
      if (res.data?.status === 'success') {
        const tokenText = formatTokenUsage(res.data.token_usage);
        setSettingsTestResult({
          ok: true,
          message: tokenText ? `${res.data.message} · Token消耗 ${tokenText}` : res.data.message,
        });
      }
    } catch (e: any) {
      setSettingsTestResult({ ok: false, message: e.response?.data?.error || e.message });
    } finally {
      setTestingSettings(false);
    }
  };

  return {
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
  };
}
