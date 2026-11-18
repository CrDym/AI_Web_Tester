import { useMemo, useState } from 'react';
import type { CaseDoc, CaseStep } from '../types';
import {
  addStepOp,
  duplicateStepOp,
  moveStepOp,
  removeStepOp,
  toggleDisableStepOp,
  updateStepOp,
} from '../utils/caseStepOps';

export function useCaseEditor() {
  const [caseDoc, setCaseDoc] = useState<CaseDoc | null>(null);
  const [scriptContent, setScriptContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [leftTab, setLeftTab] = useState<'editor' | 'dataset' | 'python'>('editor');
  const [lastSaved, setLastSaved] = useState<string>('');

  const isDirty = useMemo(() => {
    if (!caseDoc) return false;
    if (!lastSaved) return true;
    return JSON.stringify(caseDoc) !== lastSaved;
  }, [caseDoc, lastSaved]);

  const resetCaseEditor = () => {
    setCaseDoc(null);
    setScriptContent('');
    setLastSaved('');
    setLeftTab('editor');
    setSaving(false);
  };

  const addStep = () => {
    setCaseDoc((doc) => (doc ? addStepOp(doc) : doc));
  };

  const updateStep = (idx: number, patch: Partial<CaseStep>) => {
    setCaseDoc((doc) => (doc ? updateStepOp(doc, idx, patch) : doc));
  };

  const removeStep = (idx: number) => {
    setCaseDoc((doc) => (doc ? removeStepOp(doc, idx) : doc));
  };

  const duplicateStep = (idx: number) => {
    setCaseDoc((doc) => (doc ? duplicateStepOp(doc, idx) : doc));
  };

  const moveStep = (idx: number, dir: 'up' | 'down') => {
    setCaseDoc((doc) => (doc ? moveStepOp(doc, idx, dir) : doc));
  };

  const toggleDisableStep = (idx: number) => {
    setCaseDoc((doc) => (doc ? toggleDisableStepOp(doc, idx) : doc));
  };

  return {
    caseDoc,
    setCaseDoc,
    scriptContent,
    setScriptContent,
    saving,
    setSaving,
    leftTab,
    setLeftTab,
    lastSaved,
    setLastSaved,
    isDirty,
    resetCaseEditor,
    addStep,
    updateStep,
    removeStep,
    duplicateStep,
    moveStep,
    toggleDisableStep,
  };
}
