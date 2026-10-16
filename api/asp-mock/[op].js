'use strict';
/* 탑툰 흉내 + 시연 장치 — 데모 전용 (ASP_DEMO=off 면 전부 닫힌다). 운영에는 옮기지 않는다.
 *
 *   POST /api/asp-mock/coin                 → 탑툰 코인 지급 API 흉내 (04) — 탑툰이 지켜야 할 동작의 기준 구현
 *   GET  /api/asp-mock/entry?mk=&variant=   → 탑툰 서버가 만드는 서명된 진입 주소 (03). variant: ok · badsig · expired
 *   GET  /api/asp-mock/state?mk=            → 탑툰 쪽 코인 잔액·지급 기록 + 프라이스픽 쪽 잔액
 *   POST /api/asp-mock/mode   { mode }      → 코인 API 응답 방식: ok(0000) · error(9999) · timeout(11초 뒤 응답)
 *   POST /api/asp-mock/postback { click_id, amount } → 쇼핑몰 구매 → 제휴망 포스트백 도착
 *   POST /api/asp-mock/sim    { action, mk } → confirm-all · miss-latest · retry-now · seed · reset
 */
const A = require('../_lib/asp');
const MK = require('../_lib/asp-mock');
const H = require('../_lib/http');

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async function handler(req, res) {
  const op = H.opOf(req);
  if (!A.isDemo()) return H.send(res, 404, { ok: false, error: 'not_found' });
  try {
    const store = H.store();
    const q = req.query || {};
    if (op === 'coin') {
      if (req.method !== 'POST') return H.send(res, 405, { ok: false, error: 'method' });
      const raw = await H.rawBody(req);
      const out = await MK.coinApi(store, raw, req.headers || {}, Date.now());
      if (out.delayMs) await sleep(out.delayMs);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify(out.json));
    }
    if (op === 'entry') return H.send(res, 200, Object.assign({ ok: true }, await MK.signedEntryUrl(store, q, H.origin(req), Date.now())));
    if (op === 'state') return H.send(res, 200, Object.assign({ ok: true }, await MK.state(store, q.mk ? String(q.mk) : '')));
    const body = req.method === 'POST' ? await H.jsonBody(req) : {};
    if (op === 'mode' && req.method === 'POST') return H.send(res, 200, { ok: true, mode: await MK.setMode(store, String(body.mode || ''), Date.now()) });
    if (op === 'postback' && req.method === 'POST') {
      const o = await MK.postback(store, body.click_id, body.amount, Date.now());
      return H.send(res, 200, { ok: true, order_id: o.order_id, duplicate: !!o.duplicate, expect_at: o.expect_at });
    }
    if (op === 'sim' && req.method === 'POST') {
      const d = { fetch: globalThis.fetch, now: () => Date.now(), origin: H.origin(req) };
      return H.send(res, 200, Object.assign({ ok: true }, await MK.sim(store, String(body.action || ''), String(body.mk || ''), d)));
    }
    return H.send(res, 404, { ok: false, error: 'not_found' });
  } catch (e) { return H.sendError(res, e); }
};
