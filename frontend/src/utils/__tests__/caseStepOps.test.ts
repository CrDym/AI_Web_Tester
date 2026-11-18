import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addStepOp,
  duplicateStepOp,
  moveStepOp,
  removeStepOp,
  toggleDisableStepOp,
  updateStepOp,
} from '../caseStepOps.js';
import type { CaseDoc } from '../../types.js';

const baseDoc = (): CaseDoc => ({
  id: 'case-1',
  name: 'Login flow',
  steps: [
    { type: 'click', selector: '#login', intent: '点击登录按钮', value: '' },
    { type: 'input', selector: '#user', intent: '输入用户名', value: 'alice' },
    { type: 'input', selector: '#pass', intent: '输入密码', value: 'secret' },
  ],
});

test('addStepOp appends a fresh default click step and preserves existing steps', () => {
  const before = baseDoc();
  const after = addStepOp(before);

  assert.equal(after.steps.length, before.steps.length + 1);
  assert.deepEqual(after.steps[before.steps.length], {
    type: 'click',
    selector: '',
    intent: '',
    value: '',
  });
  // existing steps untouched
  assert.deepEqual(after.steps[0], before.steps[0]);
  assert.deepEqual(after.steps[1], before.steps[1]);
});

test('addStepOp does not mutate the source document', () => {
  const before = baseDoc();
  const snapshot = JSON.stringify(before);
  addStepOp(before);
  assert.equal(JSON.stringify(before), snapshot);
});

test('updateStepOp merges a patch into the targeted step only', () => {
  const before = baseDoc();
  const after = updateStepOp(before, 1, { selector: '#username', value: 'bob' });

  assert.equal(after.steps.length, before.steps.length);
  assert.equal(after.steps[0], before.steps[0]);
  assert.equal(after.steps[2], before.steps[2]);
  assert.equal(after.steps[1].selector, '#username');
  assert.equal(after.steps[1].value, 'bob');
  // unpatched fields preserved
  assert.equal(after.steps[1].type, 'input');
  assert.equal(after.steps[1].intent, '输入用户名');
});

test('updateStepOp toggles disabled flag via patch', () => {
  const before = baseDoc();
  const after = updateStepOp(before, 0, { disabled: true });
  assert.equal(after.steps[0].disabled, true);
  assert.equal(before.steps[0].disabled, undefined);
});

test('removeStepOp removes the targeted step and keeps order', () => {
  const before = baseDoc();
  const after = removeStepOp(before, 1);

  assert.equal(after.steps.length, before.steps.length - 1);
  assert.equal(after.steps[0].selector, '#login');
  assert.equal(after.steps[1].selector, '#pass');
});

test('removeStepOp on the last step leaves the rest intact', () => {
  const before = baseDoc();
  const after = removeStepOp(before, before.steps.length - 1);
  assert.equal(after.steps.length, 2);
  assert.equal(after.steps[0].selector, '#login');
  assert.equal(after.steps[1].selector, '#user');
});

test('duplicateStepOp inserts a shallow copy immediately after the source', () => {
  const before = baseDoc();
  const after = duplicateStepOp(before, 1);

  assert.equal(after.steps.length, before.steps.length + 1);
  assert.deepEqual(after.steps[2], before.steps[1]);
  assert.deepEqual(after.steps[1], before.steps[1]);
  // tail preserved
  assert.equal(after.steps[3].selector, '#pass');
});

test('duplicateStepOp copy is a shallow clone (mutating copy does not affect original field)', () => {
  const before = baseDoc();
  const after = duplicateStepOp(before, 0);
  after.steps[1].selector = '#changed';
  // original doc step still intact
  assert.equal(before.steps[0].selector, '#login');
});

test('toggleDisableStepOp flips disabled from undefined -> true -> false', () => {
  const before = baseDoc();
  const on = toggleDisableStepOp(before, 0);
  assert.equal(on.steps[0].disabled, true);

  const off = toggleDisableStepOp(on, 0);
  assert.equal(off.steps[0].disabled, false);
});

test('toggleDisableStepOp leaves other steps untouched', () => {
  const before = baseDoc();
  const after = toggleDisableStepOp(before, 1);
  assert.equal(after.steps[0].disabled, undefined);
  assert.equal(after.steps[2].disabled, undefined);
});

test('moveStepOp up swaps the step with its predecessor', () => {
  const before = baseDoc();
  const after = moveStepOp(before, 1, 'up');
  assert.equal(after.steps[0].selector, '#user');
  assert.equal(after.steps[1].selector, '#login');
});

test('moveStepOp down swaps the step with its successor', () => {
  const before = baseDoc();
  const after = moveStepOp(before, 0, 'down');
  assert.equal(after.steps[0].selector, '#user');
  assert.equal(after.steps[1].selector, '#login');
});

test('moveStepOp is a no-op at the upper boundary', () => {
  const before = baseDoc();
  const after = moveStepOp(before, 0, 'up');
  assert.deepEqual(after.steps, before.steps);
});

test('moveStepOp is a no-op at the lower boundary', () => {
  const before = baseDoc();
  const after = moveStepOp(before, before.steps.length - 1, 'down');
  assert.deepEqual(after.steps, before.steps);
});

test('all ops return a new document object (referential integrity)', () => {
  const before = baseDoc();
  assert.notEqual(addStepOp(before), before);
  assert.notEqual(updateStepOp(before, 0, { selector: '#x' }), before);
  assert.notEqual(removeStepOp(before, 0), before);
  assert.notEqual(duplicateStepOp(before, 0), before);
  assert.notEqual(toggleDisableStepOp(before, 0), before);
});
