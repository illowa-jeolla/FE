import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { isJeonnamJob, jeonnamRegionName, jeonnamRegions } from '../src/data/jeonnam.js';

const payload = { source: 'JUNNAM_PUBLIC_JOB', externalId: '8193', title: 'Test job' };
const saved = { ...payload, favoriteId: 42 };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

async function fixture(overrides = {}) {
  const session = new Map([['accessToken', 'test-token'], ['userId', 'test-user']]);
  const calls = [];
  const context = vm.createContext({ sessionStorage: { getItem: (key) => session.get(key) || null }, window: { addEventListener() {}, removeEventListener() {} } });
  const dependencies = {
    react: { useEffect() {}, useSyncExternalStore: (_, snapshot) => snapshot() },
    '../auth/session': { hasSession: () => Boolean(session.get('accessToken')) },
    '../api/jobs': {
      getFavoriteJobs: async (params) => { calls.push(['GET', params]); return { content: [], hasNext: false }; },
      favoriteJob: async (body) => { calls.push(['POST', body]); return saved; },
      unfavoriteJob: async (id) => { calls.push(['DELETE', id]); },
      ...overrides
    }
  };
  const source = await readFile(new URL('../src/hooks/useJobFavorites.js', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  return { api: module.namespace, snapshot: () => module.namespace.useJobFavorites(), calls, session };
}

test('add → delete by favoriteId → re-add; shared list immediately reflects each change', async () => {
  const f = await fixture();
  await f.api.refreshJobFavorites();
  await f.api.toggleJobFavorite(payload);
  assert.equal(f.snapshot().items[0].favoriteId, 42);
  await f.api.toggleJobFavorite(payload);
  assert.equal(f.snapshot().items.length, 0);
  await f.api.toggleJobFavorite(payload);
  assert.equal(f.snapshot().items.length, 1);
  assert.deepEqual(f.calls.filter(([method]) => method !== 'GET').map(([method, body]) => [method, method === 'DELETE' ? body : body.externalId]), [['POST', '8193'], ['DELETE', 42], ['POST', '8193']]);
});

test('rapid repeated clicks issue one POST and show pending optimistic state', async () => {
  const request = deferred(); let posts = 0;
  const f = await fixture({ favoriteJob: () => { posts += 1; return request.promise; } });
  await f.api.refreshJobFavorites();
  const first = f.api.toggleJobFavorite(payload);
  await f.api.toggleJobFavorite(payload);
  assert.equal(posts, 1);
  assert.equal(f.snapshot().items.length, 1);
  assert.equal(f.snapshot().pending.size, 1);
  request.resolve(saved); await first;
  assert.equal(f.snapshot().pending.size, 0);
});

test('failed add rolls back optimistic list and releases pending state', async () => {
  const f = await fixture({ favoriteJob: async () => { throw new Error('network failed'); } });
  await f.api.refreshJobFavorites();
  await assert.rejects(f.api.toggleJobFavorite(payload), /network failed/);
  assert.equal(f.snapshot().items.length, 0);
  assert.equal(f.snapshot().pending.size, 0);
});

test('failed delete restores saved favorite', async () => {
  const f = await fixture({ getFavoriteJobs: async () => ({ content: [saved], hasNext: false }), unfavoriteJob: async () => { throw new Error('delete failed'); } });
  await f.api.refreshJobFavorites();
  await assert.rejects(f.api.toggleJobFavorite(payload), /delete failed/);
  assert.equal(f.snapshot().items[0].favoriteId, 42);
});

test('reads later favorites pages so a saved item after page one is not duplicated', async () => {
  const pages = [];
  const firstPage = Array.from({ length: 20 }, (_, index) => ({ ...saved, externalId: String(index), favoriteId: index + 100 }));
  const f = await fixture({ getFavoriteJobs: async ({ page }) => { pages.push(page); return { content: page === 0 ? firstPage : [saved], totalElements: 21, hasNext: page === 0 }; } });
  await f.api.refreshJobFavorites();
  await f.api.toggleJobFavorite(payload);
  assert.deepEqual(pages, [0, 1]);
  assert.equal(f.snapshot().items.length, 20);
  assert.equal(f.calls[0][0], 'DELETE');
});

test('late list response does not overwrite a completed mutation', async () => {
  const late = deferred(); let reads = 0;
  const f = await fixture({ getFavoriteJobs: async () => ++reads === 1 ? { content: [], hasNext: false } : late.promise });
  await f.api.refreshJobFavorites();
  const refresh = f.api.refreshJobFavorites();
  await f.api.toggleJobFavorite(payload);
  late.resolve({ content: [], hasNext: false }); await refresh;
  assert.equal(f.snapshot().items.length, 1);
});

test('guest cannot mutate and account changes discard the previous shared list', async () => {
  const f = await fixture();
  await f.api.refreshJobFavorites(); await f.api.toggleJobFavorite(payload);
  f.session.clear();
  assert.equal(f.snapshot().items.length, 0);
  await assert.rejects(f.api.toggleJobFavorite(payload), /로그인/);
  f.session.set('accessToken', 'another-token'); f.session.set('userId', 'another-user');
  assert.equal(f.snapshot().ready, false);
});

test('failed initial favorites read cannot cause blind duplicate POST', async () => {
  const f = await fixture({ getFavoriteJobs: async () => { throw new Error('offline'); } });
  await assert.rejects(f.api.toggleJobFavorite(payload), /offline/);
  assert.equal(f.calls.length, 0);
});

test('only 22 Jeonnam city/county choices are accepted, including full names', () => {
  assert.equal(jeonnamRegions.length, 22);
  for (const name of jeonnamRegions) assert.equal(jeonnamRegionName(name), name);
  assert.equal(jeonnamRegionName('전라남도 화순군'), '화순');
  for (const name of ['전주', '군산', '남원', '광주', '전북특별자치도', '']) assert.equal(jeonnamRegionName(name), '');
});

test('mixed API data is filtered by workplace, never employer or title', () => {
  for (const address of ['전남 여수시 중앙로', '전라남도 화순군', '나주시', '보성']) assert.equal(isJeonnamJob({ address }), true, address);
  for (const address of ['전북 전주시', '전북특별자치도 군산시', '전라북도 남원시', '광주광역시', '서울특별시', '경기도 광주시', '', '미상']) assert.equal(isJeonnamJob({ address, title: '전남 채용', companyName: '여수기업' }), false, address);
  assert.equal(isJeonnamJob({ rawFields: { jobCategoryNm: '화순' } }), true);
  assert.equal(isJeonnamJob({ workplaceAddress: '전북 군산시', regionName: '여수' }), false);
});

test('favorite API uses the existing backend contract and leaves payload unchanged', async () => {
  const calls = [];
  const context = vm.createContext({ URLSearchParams });
  const module = new vm.SourceTextModule(await readFile(new URL('../src/api/jobs.js', import.meta.url), 'utf8'), { context });
  await module.link(() => new vm.SyntheticModule(['apiRequest'], function () {
    this.setExport('apiRequest', async (path, options) => { calls.push({ path, options }); });
  }, { context }));
  await module.evaluate();
  await module.namespace.favoriteJob(payload);
  await module.namespace.unfavoriteJob(42);
  await module.namespace.getFavoriteJobs({ page: 0, size: 20 });
  assert.equal(calls[0].path, '/api/v1/jobs/favorites');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
  assert.equal(calls[1].path, '/api/v1/jobs/favorites/42');
  assert.equal(calls[1].options.method, 'DELETE');
  assert.equal(calls[2].path, '/api/v1/jobs/favorites?page=0&size=20');
});
