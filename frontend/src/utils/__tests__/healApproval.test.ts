import assert from 'node:assert/strict';
import test from 'node:test';
import { getHealApprovalCandidate } from '../healApproval.js';

test('getHealApprovalCandidate builds selector based approval key', () => {
  const candidate = getHealApprovalCandidate(
    { case_id: 'login.json' },
    { original_selector: ' #old ', new_selector: ' #new ', intent: '点击登录' }
  );

  assert.deepEqual(candidate, {
    oldSelector: '#old',
    newSelector: '#new',
    intent: '点击登录',
    key: 'login.json::#old=>#new',
  });
});

test('getHealApprovalCandidate supports intent-only events', () => {
  const candidate = getHealApprovalCandidate(
    { case_id: 'login.json' },
    { original_selector: '', new_selector: '#new', intent: '点击登录' }
  );

  assert.equal(candidate?.key, 'login.json::intent:点击登录=>#new');
});

test('getHealApprovalCandidate rejects unstable or incomplete events', () => {
  assert.equal(getHealApprovalCandidate({ case_id: 'x' }, { original_selector: '#old', new_selector: '', intent: '点击' }), null);
  assert.equal(getHealApprovalCandidate({ case_id: 'x' }, { original_selector: '', new_selector: '#new', intent: '' }), null);
  assert.equal(getHealApprovalCandidate({ case_id: '' }, { original_selector: '#old', new_selector: '#new', intent: '点击' }), null);
});
