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

/* 연타 방지 — 화면 비활성만으로는 부족하다. 링크프라이스는 과다 호출 시 사전 안내 없이
   차단한다. 마지막 수집이 이 간격 안이면 부르지 않고 남은 시간을 돌려준다.
   1분 — 연타는 막되 확인하려 누를 때 기다리지 않는 선이다(김반장 확정 2026-09-22,
   10분이라 확인 중에 막히셨다). 자동 갱신은 하루 1회라 이 간격에 걸리지 않는다. */
const COOLDOWN_MS = 60 * 1000;
/* 자격증명이 없어 Firestore 에 시각이 안 남을 때를 위한 같은 인스턴스 안의 최소 방어 */
let lastFetchedAtMs = 0;

/* 서버 쪽 Firestore 접속 자격증명.
   저장소의 scripts/*.js 는 개발자 PC 의 firebase-tools 로그인(configstore)을 읽어 쓰는데
   그것은 이 PC 에만 있는 값이라 Vercel 에서는 못 쓴다. CMS 화면은 클라이언트 SDK 로
   접속하므로 서버 쪽 접속은 이 함수가 처음이다 — 물려쓸 기존 환경변수가 없다.
   이름을 하나로 못 박지 않고 흔히 쓰는 몇 가지를 다 받는다. 값은 서비스 계정 JSON
   전문이거나 그것을 base64 로 감싼 것이면 된다. */
const CRED_VARS = ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_KEY',
  'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS_JSON'];

function credRaw() {
  for (let i = 0; i < CRED_VARS.length; i++) {
    const v = process.env[CRED_VARS[i]];
    if (v && String(v).trim()) return { name: CRED_VARS[i], value: String(v).trim() };
  }
  return null;
}

function parseCred(value) {
  const text = value.charAt(0) === '{' ? value : Buffer.from(value, 'base64').toString('utf8');
  return JSON.parse(text);
}

function db(found) {
  if (!found) return null;
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(parseCred(found.value)) });
  }
  return admin.firestore();
}

module.exports = async function handler(req, res) {
  const startedAt = new Date().toISOString();
  const found = credRaw();

  /* ?check=1 — 링크프라이스를 부르지 않고 자격증명 상태만 본다.
     상태를 보려고 외부 호출을 일으키지 않기 위한 자리다. */
  if (req && req.query && req.query.check) {
    let ok = false, why = null;
    if (found) { try { parseCred(found.value); ok = true; } catch (e) { why = String((e && e.message) || e); } }
    return res.status(200).json({
      mode: 'check', credential: found ? found.name : null, parsed: ok, parse_error: why,
      accepted_env: CRED_VARS, cooldown_sec: COOLDOWN_MS / 1000, checked_at: startedAt,
    });
  }

  let store = null;
  try { store = db(found); }
  catch (e) {
    return res.status(500).json({
      ok: false, skipped: true, reason: 'bad_credentials',
      credential: found ? found.name : null, message: String((e && e.message) || e), checked_at: startedAt,
    });
  }
  const ref = store ? store.collection(DOC_PATH[0]).doc(DOC_PATH[1]) : null;

  let prevCount = 0;
  let prevFetchedMs = lastFetchedAtMs;
  if (ref) {
    try {
      const snap = await ref.get();
      if (snap.exists) {
        const d = snap.data();
        prevCount = Number(d.count) || 0;
        const t = Date.parse(d.fetched_at || '');
        if (!isNaN(t)) prevFetchedMs = Math.max(prevFetchedMs, t);
      }
    } catch (e) {
      // 이전 값을 못 읽어도 수집은 계속한다 — 검사 기준만 0 이 된다.
    }
  }

  const sinceMs = prevFetchedMs ? (Date.now() - prevFetchedMs) : Infinity;
  if (sinceMs < COOLDOWN_MS) {
    return res.status(429).json({
      ok: false, skipped: true, reason: 'cooldown',
      retry_after_sec: Math.ceil((COOLDOWN_MS - sinceMs) / 1000),
      count: prevCount, fetched_at: new Date(prevFetchedMs).toISOString(),
    });
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
    lastFetchedAtMs = Date.parse(startedAt);
    return res.status(200).json({
      ok: false, skipped: true, reason: 'no_credentials',
      accepted_env: CRED_VARS, count: count, checked_at: startedAt,
    });
  }

  lastFetchedAtMs = Date.parse(startedAt);
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
