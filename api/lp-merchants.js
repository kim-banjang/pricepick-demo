/* 링크프라이스 광고주 조회 오픈 API 수집 — 하루 1회 (Vercel Cron)
 *
 *   GET /api/lp-merchants
 *
 * 왜 서버가 필요한가: 링크프라이스 엔드포인트가 http 다. https 로 열리는 CMS 에서
 * 직접 부르면 혼합 콘텐츠로 막히고 CORS 도 보장되지 않는다. 그래서 여기서 대신 부른다.
 *
 * 인증 키는 없다. 매체 아이디를 경로에 넣는 GET 한 번이 전부다.
 *
 * 수집한 값은 Firestore settings/linkprice_merchants 에 통째로 넣는다. CMS 는 지금도
 * 카탈로그를 Firestore 에서 읽으므로 읽는 쪽 구조가 그대로다. 화면을 열 때마다
 * 링크프라이스를 부르지 않으므로 호출량이 하루 한 번으로 고정된다.
 */

const AFFILIATE_ID = process.env.LINKPRICE_AFFILIATE_ID || 'A100706012';
const ENDPOINT = 'http://api.linkprice.com/ci/service/all_merchant/'
  + AFFILIATE_ID + '/apr/cps/detail';
const DOC_PATH = ['settings', 'linkprice_merchants'];

/* 빈 응답·급감으로 기존 데이터를 날리지 않는다. 직전 건수의 이 비율 미만이면 건너뛴다. */
const MIN_COUNT = 1;
const MIN_RATIO = 0.5;

function db() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return admin.firestore();
}

module.exports = async function handler(req, res) {
  const startedAt = new Date().toISOString();
  const store = db();
  const ref = store ? store.collection(DOC_PATH[0]).doc(DOC_PATH[1]) : null;

  let prevCount = 0;
  if (ref) {
    try {
      const snap = await ref.get();
      if (snap.exists) prevCount = Number(snap.data().count) || 0;
    } catch (e) {
      // 이전 값을 못 읽어도 수집은 계속한다 — 검사 기준만 0 이 된다.
    }
  }

  let list;
  try {
    const upstream = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!upstream.ok) throw new Error('upstream ' + upstream.status);
    list = await upstream.json();
  } catch (e) {
    return res.status(502).json({
      ok: false, skipped: true, reason: 'fetch_failed',
      message: String((e && e.message) || e), prev_count: prevCount, checked_at: startedAt,
    });
  }

  if (!Array.isArray(list)) {
    return res.status(502).json({
      ok: false, skipped: true, reason: 'not_an_array', prev_count: prevCount, checked_at: startedAt,
    });
  }

  const count = list.length;
  if (count < MIN_COUNT || (prevCount > 0 && count < prevCount * MIN_RATIO)) {
    return res.status(200).json({
      ok: false, skipped: true, reason: 'suspicious_count',
      count: count, prev_count: prevCount, checked_at: startedAt,
    });
  }

  const merchants = {};
  list.forEach(function (m) {
    const id = m && m.merchant_id;
    if (id) merchants[id] = m;
  });

  if (!ref) {
    return res.status(200).json({
      ok: false, skipped: true, reason: 'no_credentials',
      count: count, checked_at: startedAt,
    });
  }

  try {
    await ref.set({
      source: 'linkprice-open-api',
      endpoint: ENDPOINT,
      affiliate_id: AFFILIATE_ID,
      fetched_at: startedAt,
      count: count,
      merchants: merchants,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false, skipped: true, reason: 'write_failed',
      message: String((e && e.message) || e), count: count, checked_at: startedAt,
    });
  }

  return res.status(200).json({ ok: true, count: count, prev_count: prevCount, fetched_at: startedAt });
};
