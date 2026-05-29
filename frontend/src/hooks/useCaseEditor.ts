import { useMemo, useState } from 'react';
import type { CaseDoc, CaseStep } from '../types';

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
    if (!caseDoc) return;
    setCaseDoc({
      ...caseDoc,
      steps: [...caseDoc.steps, { type: 'click', selector: '', intent: '', value: '' }],
    });
  };

  const updateStep = (idx: number, patch: Partial<CaseStep>) => {
    if (!caseDoc) return;
    const steps = caseDoc.steps.map((step, i) => (i === idx ? { ...step, ...patch } : step));
    setCaseDoc({ ...caseDoc, steps });
  };

  const removeStep = (idx: number) => {
    if (!caseDoc) return;
    setCaseDoc({ ...caseDoc, steps: caseDoc.steps.filter((_, i) => i !== idx) });
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
  };
}
