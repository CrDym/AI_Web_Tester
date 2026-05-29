import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRunDate, formatRunTime, formatStatus, formatTokenUsage } from '../formatters.js';

test('formatStatus maps known run statuses', () => {
  assert.equal(formatStatus('completed'), '已完成');
  assert.equal(formatStatus('failed'), '执行失败');
  assert.equal(formatStatus('timeout'), '已超时');
  assert.equal(formatStatus('custom'), 'custom');
  assert.equal(formatStatus(null), '');
});

test('formatTokenUsage renders compact token usage', () => {
  assert.equal(formatTokenUsage({ total_tokens: 12, prompt_tokens: 8, completion_tokens: 4 }), '12 (P8/C4)');
  assert.equal(formatTokenUsage({ prompt_tokens: 3 }), '0 (P3/C0)');
  assert.equal(formatTokenUsage({}), '');
  assert.equal(formatTokenUsage(null), '');
});

test('formatRunTime and formatRunDate handle empty values', () => {
  assert.equal(formatRunTime(null), '');
  assert.equal(formatRunDate(null), '');
});
