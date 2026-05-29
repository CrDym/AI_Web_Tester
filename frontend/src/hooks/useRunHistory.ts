import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import type { RunSummary, TestCase } from '../types';

export function useRunHistory(selectedCase: TestCase | null) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [allRuns, setAllRuns] = useState<RunSummary[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runFailureFilter, setRunFailureFilter] = useState<string>('');
  const [runSelectMode, setRunSelectMode] = useState(false);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);

  const selectedRunIdSet = useMemo(() => new Set(selectedRunIds), [selectedRunIds]);

  const fetchAllRuns = async () => {
    setRunsLoading(true);
    try {
      const res = await apiClient.get('/api/runs', { params: { include_all: true } });
      setAllRuns(res.data || []);
    } catch (e) {
      setAllRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  const fetchRuns = async (caseId: string, currentCase?: TestCase | null) => {
    const targetCase = currentCase || selectedCase;
    setRunsLoading(true);
    try {
      const res = await apiClient.get('/api/runs', { params: { case_id: caseId } });
      let nextRuns = res.data || [];
      const allRes = (!nextRuns || nextRuns.length === 0 || targetCase)
        ? await apiClient.get('/api/runs', { params: { include_all: true } })
        : null;
      if ((!nextRuns || nextRuns.length === 0) && targetCase) {
        const ids = new Set([targetCase.id, targetCase.name, ...(targetCase.aliases || [])]);
        const expanded = new Set<string>();
        ids.forEach((id) => {
          if (!id) return;
          expanded.add(id);
          if (id.endsWith('.json')) expanded.add(id.slice(0, -5));
          else expanded.add(`${id}.json`);
        });
        nextRuns = (allRes?.data || []).filter((r: RunSummary) => r.case_id && expanded.has(r.case_id));
      }
      if ((!nextRuns || nextRuns.length === 0) && targetCase && targetCase.name.includes('浏览器录制')) {
        nextRuns = (allRes?.data || []).filter((r: RunSummary) => (r.case_id || '').startsWith('case_'));
      }
      setRuns(nextRuns || []);
      setAllRuns((prev) => {
        const map = new Map<string, RunSummary>();
        [...prev, ...(nextRuns || [])].forEach((r) => map.set(r.id, r));
        return Array.from(map.values()).sort((a, b) => (b.started_at || 0) - (a.started_at || 0));
      });
    } catch (e) {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  const runSource = selectedCase ? runs : allRuns;

  const runFailureCategories = useMemo(() => {
    const set = new Set<string>();
    runSource.forEach((r) => {
      const category = r.failure_reason?.category;
      const label = r.failure_reason?.label || category;
      if (category) set.add(`${category}::${label}`);
    });
    return Array.from(set).sort((a, b) => a.split('::')[1].localeCompare(b.split('::')[1]));
  }, [runSource]);

  const visibleRuns = useMemo(() => {
    if (!runFailureFilter) return runSource;
    return runSource.filter((r) => (r.failure_reason?.category || '') === runFailureFilter);
  }, [runSource, runFailureFilter]);

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

  return {
    runs,
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
  };
}
