import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import type { TestCase } from '../types';

export function useCaseLibrary() {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [caseQuery, setCaseQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [caseSelectMode, setCaseSelectMode] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);

  const selectedCaseIdSet = useMemo(() => new Set(selectedCaseIds), [selectedCaseIds]);

  const fetchCases = async () => {
    try {
      const res = await apiClient.get('/api/cases');
      const nextCases = res.data || [];
      setCases(nextCases);
      const tags = new Set<string>();
      nextCases.forEach((c: TestCase) => {
        c.tags?.forEach((t) => tags.add(t));
      });
      setAllTags(Array.from(tags).sort());
    } catch (e) {
      console.error('Failed to fetch cases', e);
    }
  };

  const filteredCases = useMemo(() => {
    let result = cases;
    if (selectedTag) {
      result = result.filter((c) => c.tags && c.tags.includes(selectedTag));
    }
    const q = caseQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => (
        (c.name || '').toLowerCase().includes(q) ||
        (c.id || '').toLowerCase().includes(q) ||
        (c.group_name || '').toLowerCase().includes(q)
      ));
    }
    return result;
  }, [cases, caseQuery, selectedTag]);

  const caseGroups = useMemo(() => {
    const map = new Map<string, TestCase[]>();
    filteredCases.forEach((c) => {
      const group = (c.group_name || '').trim() || '未分组';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(c);
    });
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '未分组') return 1;
      if (b === '未分组') return -1;
      return a.localeCompare(b, 'zh-Hans-CN');
    });
  }, [filteredCases]);

  const allGroups = useMemo(() => {
    const groups = new Set<string>();
    cases.forEach((c) => {
      const group = (c.group_name || '').trim();
      if (group) groups.add(group);
    });
    return Array.from(groups).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [cases]);

  const toggleCaseSelected = (caseId: string) => {
    setSelectedCaseIds((prev) => (prev.includes(caseId) ? prev.filter((x) => x !== caseId) : [...prev, caseId]));
  };

  const resetCaseSelection = () => {
    setSelectedCaseIds([]);
    setCaseSelectMode(false);
  };

  return {
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
  };
}
