import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cached, invalidateCache, setBackgroundRunner } from './index';

const tick = () => new Promise((r) => setTimeout(r, 0));

test('cached returns the stored value until it goes stale', async () => {
  let calls = 0;
  const fn = async () => ++calls;
  assert.equal(await cached('t:basic', { ttl: 60 }, fn), 1);
  assert.equal(await cached('t:basic', { ttl: 60 }, fn), 1);
  assert.equal(calls, 1);
});

test('concurrent misses share one upstream call', async () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 20));
    return 'v';
  };
  const results = await Promise.all([cached('t:dedupe', { ttl: 60 }, fn), cached('t:dedupe', { ttl: 60 }, fn), cached('t:dedupe', { ttl: 60 }, fn)]);
  assert.deepEqual(results, ['v', 'v', 'v']);
  assert.equal(calls, 1);
});

test('stale values are served while one background refresh runs', async () => {
  const tasks: Array<() => Promise<void>> = [];
  setBackgroundRunner((task) => tasks.push(task));
  let version = 0;
  const fn = async () => ++version;
  // ttl 0: immediately stale, but servable for staleTtl.
  assert.equal(await cached('t:swr', { ttl: 0, staleTtl: 60 }, fn), 1);
  assert.equal(await cached('t:swr', { ttl: 0, staleTtl: 60 }, fn), 1);
  assert.equal(await cached('t:swr', { ttl: 0, staleTtl: 60 }, fn), 1);
  assert.equal(tasks.length, 1, 'only one refresh is scheduled');
  await tasks[0]!();
  await tick();
  assert.equal(await cached('t:swr', { ttl: 60 }, fn), 2);
  setBackgroundRunner((task) => void task());
});

test('null results are not cached unless nullTtl is set', async () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    return null;
  };
  await cached('t:null', { ttl: 60 }, fn);
  await cached('t:null', { ttl: 60 }, fn);
  assert.equal(calls, 2);
  await cached('t:null2', { ttl: 60, nullTtl: 60 }, fn);
  await cached('t:null2', { ttl: 60, nullTtl: 60 }, fn);
  assert.equal(calls, 3);
});

test('invalidateCache drops keys by exact name and by prefix', async () => {
  let calls = 0;
  const fn = async () => ++calls;
  await cached('t:inv:a', { ttl: 60 }, fn);
  await cached('t:inv:b', { ttl: 60 }, fn);
  await invalidateCache('t:inv:*');
  await cached('t:inv:a', { ttl: 60 }, fn);
  await cached('t:inv:b', { ttl: 60 }, fn);
  assert.equal(calls, 4);
});
