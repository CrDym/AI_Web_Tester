import type { HealEvent, RunDetail } from '../types';

export interface HealApprovalCandidate {
  oldSelector: string;
  newSelector: string;
  intent: string;
  key: string;
}

export const getHealApprovalCandidate = (
  run: Pick<RunDetail, 'case_id'>,
  event: Pick<HealEvent, 'original_selector' | 'new_selector' | 'intent'>
): HealApprovalCandidate | null => {
  const oldSelector = (event.original_selector || '').trim();
  const newSelector = (event.new_selector || '').trim();
  const intent = (event.intent || '').trim();
  if (!run.case_id || !newSelector || (!oldSelector && !intent)) return null;

  const key = oldSelector
    ? `${run.case_id}::${oldSelector}=>${newSelector}`
    : `${run.case_id}::intent:${intent}=>${newSelector}`;

  return { oldSelector, newSelector, intent, key };
};
