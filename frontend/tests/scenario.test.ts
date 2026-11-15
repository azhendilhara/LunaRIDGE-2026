import test from 'node:test';
import assert from 'node:assert/strict';
import { utcDate, scenarioKey, LatestRequest } from '../src/utils/scenario.ts';

test('naive timestamps mean UTC in Colombo and cross UTC midnight', () => {
  process.env.TZ = 'Asia/Colombo';
  assert.equal(utcDate('2026-11-13T20:30:00').toISOString(), '2026-11-13T20:30:00.000Z');
  assert.equal(utcDate('2026-11-14T02:00:00+05:30').getTime(), utcDate('2026-11-13T20:30:00Z').getTime());
  assert.equal(new Date(utcDate('2026-11-13T23:30').getTime() + 3600000).toISOString(), '2026-11-14T00:30:00.000Z');
});

test('every scenario input participates in stale-result identity', () => {
  const original = { latitude: -89.9, height: 2, step: '1h' };
  const key = scenarioKey(original);
  original.height = 20;
  assert.notEqual(key, scenarioKey(original));
  assert.equal(key, scenarioKey({ step: '1h', height: 2, latitude: -89.9 }));
});

test('older success, error and finalizer cannot commit after newer submission or unmount', async () => {
  const gate = new LatestRequest();
  const old = gate.begin();
  const newest = gate.begin();
  assert.equal(gate.isCurrent(old), false);
  assert.equal(gate.isCurrent(newest), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(newest), false);
});
