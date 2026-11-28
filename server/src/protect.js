// PingOne Protect behavioral risk: an optional, real second signal on /api/call.
// The verdict stays with the registry and the text classifier; Protect only informs.
// Enabled only when all three env vars are set; any failure degrades to "absent" (fail-open).
// Uses global fetch (Node >=22): one fewer dependency, and the tests inject a fetchImpl anyway.

const TIMEOUT_MS = 10000;

export function protectConfig(env = process.env) {
  const { PINGONE_PROTECT_ENV_ID: envId, PINGONE_PROTECT_WORKER_CLIENT_ID: clientId, PINGONE_PROTECT_WORKER_SECRET: secret, PINGONE_PROTECT_REGION: region } = env;
  if (!envId || !clientId || !secret) return null;
  return { envId, clientId, secret, region: region || 'com' };
}

export class ProtectClient {
  constructor(cfg, { fetchImpl = fetch, now = Date.now } = {}) {
    this.cfg = cfg;
    this.fetch = fetchImpl;
    this.now = now;
    this.token = null; this.tokenExpires = 0;
  }

  async getToken() {
    if (this.token && this.now() < this.tokenExpires - 60_000) return this.token;
    const { clientId, secret, envId, region } = this.cfg;
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
    const res = await this.fetch(`https://auth.pingone.${region}/${envId}/as/token`, {
      method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) throw new Error(`worker token failed (${res.status})`);
    this.token = data.access_token;
    this.tokenExpires = this.now() + (data.expires_in ?? 3600) * 1000;
    return this.token;
  }

  // event: { ip, userAgent, userId } — built by the caller from the request + mock key custodian.
  async evaluate({ ip, userAgent, userId }) {
    const token = await this.getToken();
    const base = `https://api.pingone.${this.cfg.region}/v1/environments/${this.cfg.envId}/riskEvaluations`;
    const event = {
      ...(ip ? { ip } : {}),
      user: { id: String(userId || 'anonymous-agent'), type: 'EXTERNAL', name: String(userId || 'anonymous-agent') },
      ...(userAgent ? { browser: { userAgent } } : {}),
      flow: { type: 'AUTHENTICATION' },
      targetResource: { id: 'ai-guard-demo-lab', name: 'AI Guard demo lab: try-a-call-as-a-key' },
    };
    const res = await this.fetch(base, {
      method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ event }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (res.status !== 200 && res.status !== 201)) throw new Error(`risk evaluation failed (${res.status})`);
    // Real Protect response shape (measured on the tenant, 2026-11-27): result.level / result.score,
    // per-signal levels in details. The old result.riskLevel shape was a guess from the BFF demo.
    if (!data?.result?.level) throw new Error(`risk evaluation failed (${res.status})`);
    const d = data.details ?? {};
    const reasons = Object.entries({
      anonymousNetwork: d.anonymousNetworkDetected === true,
      impossibleTravel: d.impossibleTravel === true,
      ipVelocity: d.ipVelocityByUser?.level && d.ipVelocityByUser.level !== 'LOW' ? d.ipVelocityByUser.level : null,
      userVelocity: d.userVelocityByIp?.level && d.userVelocityByIp.level !== 'LOW' ? d.userVelocityByIp.level : null,
      bot: d.botDetection?.level && d.botDetection.level !== 'LOW' ? d.botDetection.level : null,
    }).filter(([, v]) => v).map(([k, v]) => (v === true ? k : `${k}:${v}`));
    return {
      riskLevel: data.result.level,
      score: typeof data.result.score === 'number' ? data.result.score : null,
      recommendedAction: data.result.recommendedAction ?? null,
      reasons: reasons.slice(0, 10),
      mode: 'real',
    };
  }
}

// Best-effort: never throws, never blocks the demo. Returns undefined when disabled or failed.
export async function protectEvaluate(client, event, log = console) {
  if (!client) return undefined;
  try { return await client.evaluate(event); }
  catch (e) { log.warn?.(`[protect] evaluation failed (${e?.response?.status ?? e?.cause ?? e?.message}); call proceeds without it`); return undefined; }
}
