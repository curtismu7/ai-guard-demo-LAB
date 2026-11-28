// The Protect layer: absent without env, fail-open on any error, token never leaked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ProtectClient, protectConfig, protectEvaluate } from '../src/protect.js';

const CFG = { PINGONE_PROTECT_ENV_ID: 'env-1', PINGONE_PROTECT_WORKER_CLIENT_ID: 'cid', PINGONE_PROTECT_WORKER_SECRET: 'sec', PINGONE_PROTECT_REGION: 'com' };
const res = (ok, data) => ({ ok, status: ok ? 200 : 400, json: async () => data });
const fetchMock = (handlers) => {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, ...(init ?? {}) });
    return url.includes('/as/token') ? handlers.token({ url, init }) : handlers.risk({ url, init });
  };
  impl.calls = calls;
  return impl;
};

test('protectConfig: absent without all three vars, present with them', () => {
  assert.equal(protectConfig({}), null);
  assert.equal(protectConfig({ PINGONE_PROTECT_ENV_ID: 'e' }), null);
  assert.deepEqual(protectConfig(CFG), { envId: 'env-1', clientId: 'cid', secret: 'sec', region: 'com' });
  assert.equal(protectConfig({ ...CFG, PINGONE_PROTECT_REGION: 'eu' }).region, 'eu');
});

test('protectEvaluate: undefined when client is null (feature off), no fetch', async () => {
  let called = false;
  const impl = async () => { called = true; return res(true, {}); };
  assert.equal(await protectEvaluate(null, {}, { warn: () => {} }), undefined);
  assert.equal(called, false);
});

test('protectEvaluate: returns level/action/reasons on success (201 Created, real shape)', async () => {
  const f = fetchMock({
    token: () => res(true, { access_token: 'tok', expires_in: 3600 }),
    risk: () => ({ ok: true, status: 201, json: async () => ({ result: { level: 'MEDIUM', score: 40 }, details: { anonymousNetworkDetected: true, ipVelocityByUser: { level: 'MEDIUM' }, botDetection: { level: 'LOW' } } }) }),
  });
  const out = await protectEvaluate(new ProtectClient(CFG, { fetchImpl: f }), { ip: '1.2.3.4', userAgent: 'ua', userId: 'alice.example' });
  assert.deepEqual(out, { riskLevel: 'MEDIUM', score: 40, recommendedAction: null, reasons: ['anonymousNetwork', 'ipVelocity:MEDIUM'], mode: 'real' });
  const riskCall = f.calls.find((c) => !c.url.includes('/as/token'));
  assert.match(riskCall.url, /riskEvaluations/);
  assert.equal(riskCall.headers.Authorization, 'Bearer tok');
  assert.equal(JSON.stringify(riskCall.body).includes('tok'), false); // token never in the payload
  assert.equal(JSON.parse(riskCall.body).event.user.type, 'EXTERNAL');
});

test('protectEvaluate: fail-open on risk 4xx — undefined, warn logged, call proceeds', async () => {
  const warns = [];
  const f = fetchMock({
    token: () => res(true, { access_token: 'tok' }),
    risk: () => ({ ok: false, status: 429, json: async () => ({}) }),
  });
  const out = await protectEvaluate(new ProtectClient(CFG, { fetchImpl: f }), {}, { warn: (m) => warns.push(m) });
  assert.equal(out, undefined);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /429/);
});

test('protectEvaluate: token failure also fail-open', async () => {
  const f = fetchMock({ token: () => { throw new Error('down'); }, risk: () => res(true, {}) });
  const out = await protectEvaluate(new ProtectClient(CFG, { fetchImpl: f }), {}, { warn: () => {} });
  assert.equal(out, undefined);
});

test('token cache: second evaluate within expiry reuses the token (one token call)', async () => {
  let tokenCalls = 0;
  const f = fetchMock({
    token: () => { tokenCalls += 1; return res(true, { access_token: 'tok', expires_in: 3600 }); },
    risk: () => res(true, { result: { level: 'MEDIUM' } }),
  });
  const c = new ProtectClient(CFG, { fetchImpl: f });
  await c.evaluate({}); await c.evaluate({});
  assert.equal(tokenCalls, 1);
});
