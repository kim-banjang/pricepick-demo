'use strict';
/* 쇼핑 적립 ASP — 회원 화면(/asp/)이 부르는 서버
 *
 *   POST /api/asp/enter     { q: 진입 주소의 ?뒤 문자열 }  → 서명·시각 검증(03·05) 후 자체 세션 쿠키
 *   GET  /api/asp/me                                       → 잔액·적립 예정·내역·쇼핑몰·FAQ (재시도 시각이 된 전환도 같이 보낸다)
 *   POST /api/asp/click     { mall: 쇼핑몰 코드 }           → 이동 기록 + sub_id
 *   POST /api/asp/convert                                   → 티켓 보류 → 탑툰 코인 지급 API 호출 → 반영 (04·06)
 *
 * 세션: asp_s 쿠키(HttpOnly · Secure · SameSite=Lax · Path=/api/asp, 6시간). 진입 주소의 서명값은 다시 쓰지 않는다.
 */
const A = require('../_lib/asp');
const H = require('../_lib/http');

const COOKIE = 'asp_s';

function deps(req) { return { fetch: globalThis.fetch, now: () => Date.now(), origin: H.origin(req) }; }

function session(req) {
  const s = A.readSession(H.cookies(req)[COOKIE], Date.now());
  if (!s) throw new A.AspError('no_session', '탑툰 무료충전소에서 다시 들어와 주세요', 401);
  return s;
}

module.exports = async function handler(req, res) {
  const op = H.opOf(req);
  try {
    const store = H.store();
    if (op === 'enter') {
      if (req.method !== 'POST') return H.send(res, 405, { ok: false, error: 'method' });
      const body = await H.jsonBody(req);
      const e = A.verifyEntry(body.q, Date.now());
      const media = await A.getMedia(store, e.media);
      if (!media || media.status === 'stop') throw new A.AspError('media_stopped', '지금은 이용할 수 없습니다', 409);
      const m = await A.upsertMemberOnEntry(store, e, Date.now());
      const token = A.makeSession(e, Date.now());
      return H.send(res, 200, { ok: true, first: m.created, nick: e.nick },
        { 'Set-Cookie': `${COOKIE}=${token}; Path=/api/asp; HttpOnly; Secure; SameSite=Lax; Max-Age=21600` });
    }
    if (op === 'me') {
      const s = session(req);
      await A.retryDue(store, deps(req), { memberId: s.memberId, limit: 2 }).catch(err => console.error('[asp] retryDue', err));
      return H.send(res, 200, Object.assign({ ok: true }, await A.memberView(store, s, Date.now())));
    }
    if (op === 'click') {
      if (req.method !== 'POST') return H.send(res, 405, { ok: false, error: 'method' });
      const s = session(req);
      const body = await H.jsonBody(req);
      const c = await A.createClick(store, s, String(body.mall || ''), Date.now());
      return H.send(res, 200, { ok: true, click_id: c.click_id, sub_id: c.sub_id, out_url: c.out_url, mall: c.mall_code, mall_name: c.mall_name, route: c.route, demo: A.isDemo() });
    }
    if (op === 'convert') {
      if (req.method !== 'POST') return H.send(res, 405, { ok: false, error: 'method' });
      const s = session(req);
      const conv = await A.convert(store, s, deps(req));
      const view = await A.memberView(store, s, Date.now());
      return H.send(res, 200, Object.assign({ ok: true, conv: { transaction_id: conv.transaction_id, status: conv.status, coins: conv.coins,
        tickets: conv.tickets, code: conv.code, next_retry_at: conv.next_retry_at || null } }, view));
    }
    if (op === 'logout') {
      return H.send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/api/asp; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
    }
    return H.send(res, 404, { ok: false, error: 'not_found' });
  } catch (e) { return H.sendError(res, e); }
};
