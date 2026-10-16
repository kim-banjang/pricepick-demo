'use strict';
/* 쇼핑 적립 ASP — CMS(ASP 매체 메뉴)가 부르는 서버. CMS DEMO 관리자 로그인 토큰이 있어야 한다.
 *
 *   GET  /api/asp-admin/overview                    → 매체·회원·구매·전환·쇼핑몰·FAQ 한 번에 (재시도 시각이 된 전환도 보낸다)
 *   POST /api/asp-admin/retry   { transaction_id }  → 운영자 재요청 — 같은 거래번호로 지금 한 번 (06)
 *   POST /api/asp-admin/media   { code, patch }     → 매체 설정 (코인 이름 · 전환 비율 · 상태 …)
 *   POST /api/asp-admin/layout  { code, layout }    → 쇼핑몰 노출 순서 · 점검중 · 숨김 · 말풍선
 *   POST /api/asp-admin/faq     { items }           → 자주 묻는 질문
 *   GET  /api/asp-admin/csv?media=TOPTOON&month=YYYY-MM → 월간 지급 내역 CSV (07)
 */
const A = require('../_lib/asp');
const H = require('../_lib/http');

function deps(req) { return { fetch: globalThis.fetch, now: () => Date.now(), origin: H.origin(req) }; }

module.exports = async function handler(req, res) {
  const op = H.opOf(req);
  try {
    const admin = await H.requireAdmin(req);
    const store = H.store();
    const body = req.method === 'POST' ? await H.jsonBody(req) : {};
    if (op === 'overview') {
      await A.retryDue(store, deps(req), { limit: 3 }).catch(err => console.error('[asp-admin] retryDue', err));
      return H.send(res, 200, Object.assign({ ok: true, admin: admin.user }, await A.adminOverview(store, Date.now())));
    }
    if (op === 'retry' && req.method === 'POST') {
      const c = await A.manualRetry(store, String(body.transaction_id || ''), deps(req));
      return H.send(res, 200, { ok: true, conv: { transaction_id: c.transaction_id, status: c.status, code: c.code, message: c.message } });
    }
    if (op === 'media' && req.method === 'POST') {
      return H.send(res, 200, { ok: true, media: await A.updateMedia(store, String(body.code || ''), body.patch || {}, Date.now()) });
    }
    if (op === 'layout' && req.method === 'POST') {
      return H.send(res, 200, { ok: true, layout: await A.saveLayout(store, String(body.code || ''), body.layout, Date.now()) });
    }
    if (op === 'faq' && req.method === 'POST') {
      return H.send(res, 200, { ok: true, items: await A.saveFaq(store, body.items, Date.now()) });
    }
    if (op === 'csv') {
      const q = req.query || {};
      const out = await A.monthlyCsv(store, String(q.media || 'TOPTOON'), String(q.month || ''));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="' + out.filename + '"');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(out.csv);
    }
    return H.send(res, 404, { ok: false, error: 'not_found' });
  } catch (e) { return H.sendError(res, e); }
};
