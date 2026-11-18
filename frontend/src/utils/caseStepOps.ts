import type { CaseDoc, CaseStep } from '../types';

/**
 * Pure, side-effect free step mutation helpers used by useCaseEditor.
 * Extracted so that step add/remove/update/duplicate/move/disable logic
 * can be unit tested without a React host.
 */

export const DEFAULT_NEW_STEP: CaseStep = {
  type: 'click',
  selector: '',
  intent: '',
  value: '',
};

/** Returns a new CaseDoc with a fresh step appended. */
export const addStepOp = (doc: CaseDoc): CaseDoc => ({
  ...doc,
  steps: [...doc.steps, { ...DEFAULT_NEW_STEP }],
});

/** Returns a new CaseDoc with the step at `idx` shallow-merged with `patch`. */
export const updateStepOp = (doc: CaseDoc, idx: number, patch: Partial<CaseStep>): CaseDoc => {
  const steps = doc.steps.map((step, i) => (i === idx ? { ...step, ...patch } : step));
  return { ...doc, steps };
};

/** Returns a new CaseDoc with the step at `idx` removed. */
export const removeStepOp = (doc: CaseDoc, idx: number): CaseDoc => ({
  ...doc,
  steps: doc.steps.filter((_, i) => i !== idx),
});

/** Returns a new CaseDoc with the step at `idx` duplicated immediately after itself. */
export const duplicateStepOp = (doc: CaseDoc, idx: number): CaseDoc => {
  const steps = [...doc.steps];
  steps.splice(idx + 1, 0, { ...steps[idx] });
  return { ...doc, steps };
};

/** Returns a new CaseDoc with the step at `idx` swapped up or down by one position. */
export const moveStepOp = (doc: CaseDoc, idx: number, dir: 'up' | 'down'): CaseDoc => {
  const steps = [...doc.steps];
  if (dir === 'up' && idx > 0) {
    [steps[idx - 1], steps[idx]] = [steps[idx], steps[idx - 1]];
  } else if (dir === 'down' && idx < steps.length - 1) {
    [steps[idx + 1], steps[idx]] = [steps[idx], steps[idx + 1]];
  }
  return { ...doc, steps };
};

/** Returns a new CaseDoc with the `disabled` flag toggled on the step at `idx`. */
export const toggleDisableStepOp = (doc: CaseDoc, idx: number): CaseDoc =>
  updateStepOp(doc, idx, { disabled: !doc.steps[idx]?.disabled });
