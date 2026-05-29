import assert from 'node:assert/strict';
import test from 'node:test';
import { getFailureLabel, getFailureSeverityClass, getLogKind, getLogTone } from '../runUi.js';

test('getLogKind classifies common log markers', () => {
  assert.equal(getLogKind('✅ done'), 'success');
  assert.equal(getLogKind('❌ failed'), 'error');
  assert.equal(getLogKind('warning: slow'), 'warning');
  assert.equal(getLogKind('🤖 AI healing'), 'ai');
  assert.equal(getLogKind('plain output'), 'normal');
});

test('getLogTone returns visual metadata for all kinds', () => {
  assert.equal(getLogTone('✅ ok').icon, '✓');
  assert.equal(getLogTone('FAILED case').icon, '×');
  assert.equal(getLogTone('⚠️ careful').icon, '!');
  assert.equal(getLogTone('✨ model').icon, 'AI');
});

test('failure helpers provide stable labels and severity classes', () => {
  assert.equal(getFailureLabel({ category: 'selector', label: '定位失败', message: 'x' }), '定位失败');
  assert.equal(getFailureLabel({ category: 'timeout', message: 'x' }), 'timeout');
  assert.match(getFailureSeverityClass('high'), /rose/);
  assert.match(getFailureSeverityClass('medium'), /amber/);
  assert.match(getFailureSeverityClass('low'), /zinc/);
});
