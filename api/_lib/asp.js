'use strict';
/* 쇼핑 적립 ASP — 도메인 규칙 (매체 공용, 첫 매체 탑툰)
 *
 * 이 파일이 데모의 본체다. 개발팀은 여기 적힌 규칙을 운영 서버로 그대로 옮긴다.
 * 근거 문서: 탑툰 연동 문서 v0.1 (2026-10-16) — 절 번호를 주석에 단다.
 *
 * 저장소: Firestore, 서버 전용 컬렉션 asp_* (아래 C). 클라이언트 SDK 규칙은 열지 않는다.
 *   모든 읽기·쓰기는 서버 함수(api/asp, api/asp-admin, api/asp-mock)가 서비스 계정으로 한다.
 *   복합 색인이 필요한 쿼리는 쓰지 않는다(단일 필드 조건 + 메모리 정렬) — 색인 배포 없이 돈다.
 * 시각: 모든 *_at 필드는 Unix 밀리초 숫자. 화면·외부 전달용 문자열만 KST ISO 8601 로 만든다.
 * store: firebase-admin Firestore 인스턴스(또는 시험용 가짜). 함수는 store 를 인자로 받는다.
 */
const crypto = require('crypto');

const C = {
  MEDIA: 'asp_media',            // 매체 설정 (문서 ID = 매체 코드)
  MEMBERS: 'asp_members',        // 매체 회원 (문서 ID = 매체코드_회원식별값). 프라이스픽 앱 회원과 섞지 않는다
  CLICKS: 'asp_clicks',          // 적립몰 → 쇼핑몰 이동 기록 (문서 ID = click_id)
  ORDERS: 'asp_orders',          // 구매 적립 (포스트백 1건 = 1문서)
  CONVS: 'asp_conversions',      // 코인 전환 (문서 ID = transaction_id)
  LEDGER: 'asp_ticket_tx',       // 티켓 원장 — 잔액이 바뀌는 모든 일을 한 줄씩
  COUNTERS: 'asp_counters',      // 거래번호 일련번호
  SETTINGS: 'asp_settings',      // 매체 공용 설정 (faq)
};

const ENTRY_TTL_SEC = 600;                 // 03 — ts 와 현재 시각 차이 10분 초과면 거절
const COIN_TIMEOUT_MS = 10000;             // 06 — 10초 안에 응답 없으면 시간 초과
const RETRY_DELAYS_SEC = [60, 300, 1800];  // 06 — 1분 · 5분 · 30분 뒤 재시도 (최대 3회)
const LEASE_MS = 25000;                    // 같은 전환을 두 곳에서 동시에 보내지 않게 잡아 두는 시간
const CLICK_TTL_MS = 24 * 3600 * 1000;     // 이동 후 24시간 안 구매만 적립
const SESSION_TTL_SEC = 6 * 3600;          // 진입 후 자체 세션 유효 시간
const DEFAULT_TICKET_WON = 10;             // settings/ticket_value.bronze 를 못 읽을 때 (티켓 1장 = 10원, 2026-10-14)
const MK_RE = /^[A-Za-z0-9_-]{1,64}$/;     // 03 — mk 형식
const ENVS = ['pc', 'mweb', 'aos', 'ios'];
const TX_RE = /^[A-Za-z0-9]{1,40}$/;
/* 연동 문서 05 의 예시 토큰. 운영 토큰은 환경변수 ASP_TOKEN_{매체코드} 로만 넣는다.
   데모는 환경변수가 없을 때 이 값으로 돈다 — ASP_ALLOW_TEST_TOKEN=off 면 막힌다. */
const DEMO_TEST_TOKEN = 'test_7f3a9c2e5b1d';

const FINAL_FAIL = { '1001': '없는 회원', '1002': '지급할 수 없는 회원', '2001': '서명 오류', '2003': '요청 형식 오류' };
const RESULT_TEXT = Object.assign({ '0000': '지급 완료', '2002': '요청 시각 만료', '9999': '일시적 시스템 오류',
  TIMEOUT: '응답 시간 초과 (10초)', NETWORK: '연결 실패', BADRES: '응답 형식 오류' }, FINAL_FAIL);

const MEDIA_DEFAULTS = {
  TOPTOON: {
    code: 'TOPTOON', name: '탑툰', status: 'live', coin_name: '탑툰 코인', coin_rate: 22,
    entry: '무료충전소', fallback_rate: 0.5,
    /* 데모는 탑툰 흉내 API(api/asp-mock/coin)로 보낸다. 운영은 탑툰이 회신한 주소(09-2). */
    coin_api_url: '/api/asp-mock/coin',
    layout: null,
  },
};

const DEFAULT_FAQ = [
  { q: '티켓은 언제 확정되나요?', a: '쇼핑몰과 구매일에 따라 달라요. 쿠팡은 구매가 확정되면, 그 외 쇼핑몰은 구매한 달의 다다음 달 6일에 확정돼요. 건별 확정 예정일은 적립내역에서 확인할 수 있어요.', on: true },
  { q: '{전환단위}장이 안 되는 티켓은 어떻게 되나요?', a: '그대로 남아 있어요. 다음에 티켓이 쌓이면 {전환단위}장 단위로 함께 전환할 수 있어요.', on: true },
  { q: '랜덤 티켓은 몇 장이 되나요?', a: '구매 1건마다 랜덤 티켓 1장이 먼저 쌓이고, 구매가 확정되는 날 구매 금액에 맞는 장수로 바뀌어요. 확정 전에는 장수를 알려 드리지 않아요.', on: true },
  { q: '구매했는데 적립내역에 보이지 않아요.', a: '이 화면의 쇼핑몰 바로가기로 이동한 뒤 24시간 안에 구매한 건만 적립돼요. 일부 쇼핑몰은 앱에서 구매하면 적립되지 않을 수 있어요.', on: true },
  { q: '미적립은 왜 생기나요?', a: '쇼핑몰에서 구매가 확정되지 않은 경우예요. 주문 취소나 반품, 적립 제외 상품 구매, 이 화면을 거치지 않은 구매, 일부 쇼핑몰 앱에서의 구매가 해당돼요.', on: true },
  { q: '{코인명} 전환에 실패했어요.', a: '쇼핑 적립 티켓은 그대로 남아 있어요. 잠시 후 적립몰에서 다시 전환해 주세요.', on: true },
];

/* 앱(app/index.html)이 아는 쇼핑몰 기본 목록 — settings 를 못 읽을 때만 쓴다 */
const FALLBACK_MALLS = [
  ['coupang_direct', '쿠팡'], ['lp:gmarket', 'G마켓'], ['lp:11st', '11번가'], ['lp:auction', '옥션'],
  ['lp:lotteon', '롯데온'], ['lp:hmall', 'Hmall'], ['lp:emart', '이마트몰'],
];

/* ───────────── 공통 ───────────── */

class AspError extends Error {
  constructor(code, message, status) { super(message || code); this.code = code; this.status = status || 400; }
}
const fail = (code, message, status) => { throw new AspError(code, message, status); };

function hmacHex(key, s) { return crypto.createHmac('sha256', key).update(s, 'utf8').digest('hex'); }
function safeEq(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function fromB64url(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
const KST = 9 * 3600 * 1000;
function kstIso(ms) { return new Date(ms + KST).toISOString().slice(0, 19) + '+09:00'; }
function kstYmd(ms) { return new Date(ms + KST).toISOString().slice(0, 10).replace(/-/g, ''); }
function kstParts(ms) { const d = new Date(ms + KST); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
function kstMidnight(y, m, d) { return Date.UTC(y, m - 1, d) - KST; }
function memberId(media, mk) { return media + '_' + mk; }
function maskMk(mk) { const s = String(mk || ''); return s.length <= 6 ? s.slice(0, 2) + '****' : s.slice(0, 3) + '****' + s.slice(-4); }
function rand(n) { return crypto.randomBytes(n).toString('hex'); }

function tokenFor(media) {
  const v = process.env['ASP_TOKEN_' + media];
  if (v && String(v).trim()) return String(v).trim();
  if (process.env.ASP_ALLOW_TEST_TOKEN === 'off') return null;
  return DEMO_TEST_TOKEN;
}
function tokenHint(media) { const t = tokenFor(media); return t ? t.slice(-4) : null; }
function usingTestToken(media) { return tokenFor(media) === DEMO_TEST_TOKEN; }
function isDemo() { return process.env.ASP_DEMO !== 'off'; }

/* ───────────── 매체 설정 ───────────── */

async function getMedia(store, code) {
  const ref = store.collection(C.MEDIA).doc(code);
  const snap = await ref.get();
  if (snap.exists) return Object.assign({}, MEDIA_DEFAULTS[code] || {}, snap.data());
  if (MEDIA_DEFAULTS[code]) {
    const doc = Object.assign({}, MEDIA_DEFAULTS[code], { created_at: Date.now(), updated_at: Date.now() });
    await ref.set(doc);
    return doc;
  }
  return null;
}

async function listMedia(store) {
  const snap = await store.collection(C.MEDIA).get();
  const out = {};
  snap.forEach(d => { out[d.id] = Object.assign({}, MEDIA_DEFAULTS[d.id] || {}, d.data()); });
  for (const code of Object.keys(MEDIA_DEFAULTS)) if (!out[code]) out[code] = await getMedia(store, code);
  return Object.values(out);
}

const MEDIA_EDITABLE = { name: 'text', status: ['live', 'ready', 'stop'], coin_name: 'text', coin_rate: 'int', entry: 'text', fallback_rate: 'num', coin_api_url: 'text' };
async function updateMedia(store, code, patch, now) {
  if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(String(code || ''))) fail('bad_code', '매체 코드는 영문 대문자·숫자 2~20자입니다');
  const clean = {};
  for (const k of Object.keys(patch || {})) {
    const rule = MEDIA_EDITABLE[k]; if (!rule) continue;
    const v = patch[k];
    if (rule === 'text') clean[k] = String(v == null ? '' : v).slice(0, 200);
    else if (rule === 'int') { const n = parseInt(v, 10); if (!(n >= 1 && n <= 10000)) fail('bad_rate', '전환 비율은 1 이상 정수입니다'); clean[k] = n; }
    else if (rule === 'num') { const n = Number(v); if (!(n >= 0 && n <= 20)) fail('bad_rate', '기본 적립률은 0~20% 입니다'); clean[k] = Math.round(n * 100) / 100; }
    else if (Array.isArray(rule)) { if (rule.indexOf(v) < 0) fail('bad_status', '상태 값이 올바르지 않습니다'); clean[k] = v; }
  }
  const ref = store.collection(C.MEDIA).doc(code);
  const snap = await ref.get();
  const base = snap.exists ? snap.data() : Object.assign({ code, created_at: now }, MEDIA_DEFAULTS[code] || { name: code, status: 'ready', coin_name: '', coin_rate: 22, entry: '', fallback_rate: 0.5, coin_api_url: '' });
  await ref.set(Object.assign({}, base, clean, { code, updated_at: now }));
  return getMedia(store, code);
}

async function saveLayout(store, code, layout, now) {
  if (!Array.isArray(layout) || layout.length > 200) fail('bad_layout', '노출 목록이 올바르지 않습니다');
  const seen = {};
  const clean = layout.map(x => {
    const c = String((x && x.code) || '');
    if (!c || seen[c]) fail('bad_layout', '쇼핑몰 코드가 비었거나 겹칩니다');
    seen[c] = 1;
    const st = ['on', 'maint', 'hide'].indexOf(x.st) >= 0 ? x.st : 'on';
    return { code: c, st, bubble: String(x.bubble || '').slice(0, 12) };
  });
  await getMedia(store, code);
  await store.collection(C.MEDIA).doc(code).set({ layout: clean, updated_at: now }, { merge: true });
  return clean;
}

async function getFaq(store) {
  const snap = await store.collection(C.SETTINGS).doc('faq').get();
  const items = snap.exists && Array.isArray(snap.data().items) ? snap.data().items : DEFAULT_FAQ;
  return items;
}
async function saveFaq(store, items, now) {
  if (!Array.isArray(items) || items.length > 50) fail('bad_faq', '질문 목록이 올바르지 않습니다');
  const clean = items.map(x => ({ q: String(x.q || '').slice(0, 200), a: String(x.a || '').slice(0, 2000), on: x.on !== false }))
    .filter(x => x.q && x.a);
  await store.collection(C.SETTINGS).doc('faq').set({ items: clean, updated_at: now });
  return clean;
}
function fillFaq(text, media) {
  return String(text).replace(/\{코인명\}/g, media.coin_name || '코인').replace(/\{전환단위\}/g, String(media.coin_rate || ''));
}

/* ───────────── 03 · 05 회원 진입 검증 ───────────── */

function entryBase(params) {
  return Object.keys(params).filter(k => k !== 'sig').sort().map(k => k + '=' + params[k]).join('&');
}
function signEntry(params, token) { return hmacHex(token, entryBase(params)); }

/* rawQuery: 진입 주소의 ?뒤 문자열 그대로. 반환 { media, mk, nick, env } 또는 AspError */
function verifyEntry(rawQuery, nowMs) {
  const sp = new URLSearchParams(String(rawQuery || '').replace(/^\?/, ''));
  const params = {};
  for (const [k, v] of sp) {
    if (Object.prototype.hasOwnProperty.call(params, k)) fail('bad_param', '같은 파라미터가 두 번 들어왔습니다');
    params[k] = v;
  }
  const media = params.media;
  if (!media || !MEDIA_DEFAULTS[media]) fail('unknown_media', '등록되지 않은 매체입니다');
  const token = tokenFor(media);
  if (!token) fail('no_token', '연동 토큰이 설정되지 않았습니다', 500);
  for (const k of ['mk', 'env', 'ts', 'sig']) if (!params[k]) fail('bad_param', k + ' 가 없습니다');
  if (!MK_RE.test(params.mk)) fail('bad_param', 'mk 형식이 올바르지 않습니다');
  if (ENVS.indexOf(params.env) < 0) fail('bad_param', 'env 값이 올바르지 않습니다');
  if (params.nick != null && [...params.nick].length > 20) fail('bad_param', 'nick 은 20자까지입니다');
  if (!/^\d{9,11}$/.test(params.ts)) fail('bad_param', 'ts 형식이 올바르지 않습니다');
  if (!/^[0-9a-f]{64}$/.test(params.sig)) fail('bad_sig', '서명 형식이 올바르지 않습니다');
  if (!safeEq(signEntry(params, token), params.sig)) fail('bad_sig', '서명이 맞지 않습니다');
  if (Math.abs(nowMs / 1000 - Number(params.ts)) > ENTRY_TTL_SEC) fail('expired', '진입 주소의 유효 시간이 지났습니다');
  return { media, mk: params.mk, nick: params.nick || '', env: params.env };
}

/* ───────────── 자체 세션 (진입 검증 뒤 적립 페이지 안 이동) ───────────── */

function sessionSecret() {
  if (process.env.ASP_SESSION_SECRET) return process.env.ASP_SESSION_SECRET;
  /* 데모: 별도 비밀값을 따로 넣지 않으려고 서버에만 있는 서비스 계정 값에서 끌어낸다.
     운영은 ASP_SESSION_SECRET 를 따로 둔다. */
  const base = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.ASP_TEST_SECRET;
  if (!base) throw new AspError('no_session_secret', '세션 비밀값이 없습니다', 500);
  return crypto.createHash('sha256').update('asp-session|' + base).digest('hex');
}
function makeSession(s, nowMs) {
  const payload = b64url(JSON.stringify({ v: 1, m: s.media, k: s.mk, n: s.nick || '', x: Math.floor(nowMs / 1000) + SESSION_TTL_SEC }));
  return payload + '.' + b64url(crypto.createHmac('sha256', sessionSecret()).update(payload).digest());
}
function readSession(value, nowMs) {
  if (!value || typeof value !== 'string' || value.indexOf('.') < 0) return null;
  const [payload, mac] = value.split('.');
  const want = b64url(crypto.createHmac('sha256', sessionSecret()).update(payload).digest());
  if (!safeEq(want, mac)) return null;
  let j; try { j = JSON.parse(fromB64url(payload)); } catch (_) { return null; }
  if (!j || j.v !== 1 || !(j.x > nowMs / 1000)) return null;
  return { media: j.m, mk: j.k, nick: j.n, memberId: memberId(j.m, j.k) };
}

async function upsertMemberOnEntry(store, e, now) {
  const ref = store.collection(C.MEMBERS).doc(memberId(e.media, e.mk));
  return store.runTransaction(async t => {
    const snap = await t.get(ref);
    if (!snap.exists) {
      const doc = { media: e.media, mk: e.mk, nick: e.nick || '', env: e.env, first_at: now, last_at: now, visits: 1,
        available: 0, held: 0, coins_total: 0, tickets_converted: 0, tickets_confirmed: 0, orders_pending: 0, active_tx: null };
      t.set(ref, doc);
      return Object.assign({ created: true }, doc);
    }
    const d = snap.data();
    const patch = { env: e.env, last_at: now, visits: (d.visits || 0) + 1 };
    if (e.nick) patch.nick = e.nick;
    t.update(ref, patch);
    return Object.assign({ created: false }, d, patch);
  });
}

/* ───────────── 쇼핑몰 목록 (CMS DEMO 「티켓 적립 설정」이 정본) ───────────── */

let SEED_CACHE = null;
function seedMerchants() {
  if (SEED_CACHE) return SEED_CACHE;
  try { SEED_CACHE = require('../../cms/data/lp-merchant-detail.json').merchants || {}; } catch (_) { SEED_CACHE = {}; }
  return SEED_CACHE;
}
function pct(v) { const n = parseFloat(String(v == null ? '' : v).replace('%', '')); return isFinite(n) ? n : null; }

/* CMS DEMO 설정 4건은 자주 바뀌지 않아 함수 인스턴스 안에서 60초 동안 다시 쓴다.
   데모 Firebase 는 무료 요금제(하루 읽기 5만 건)라 화면 조회마다 4건씩 읽지 않으려는 것. */
const APP_TTL_MS = 60000;
const APP_CACHE = new WeakMap();
async function loadAppSettings(store) {
  const hit = APP_CACHE.get(store);
  if (hit && Date.now() - hit.at < APP_TTL_MS) return hit.val;
  const get = id => store.collection('settings').doc(id).get().then(s => (s.exists ? s.data() : {})).catch(() => ({}));
  const [acc, live, cat, tv] = await Promise.all([get('ticket_accrual'), get('linkprice_merchants'), get('linkprice_catalog'), get('ticket_value')]);
  const ticketWon = Number(tv.bronze) > 0 ? Number(tv.bronze) : DEFAULT_TICKET_WON;
  const val = { acc, live: live.merchants || {}, cat: cat.merchants || [], ticketWon };
  APP_CACHE.set(store, { at: Date.now(), val });
  return val;
}

/* 반환: [{ code, name, logo, rate, fee_rate, click_url, route, coupang, st, bubble }] — 매체 노출 설정(layout) 적용 순서 */
function buildMalls(app, media) {
  const acc = app.acc || {};
  const applied = acc.applied || {}, logos = acc.logos || {}, rates = acc.rates || {}, fees = acc.fees || {};
  let live = app.live || {};
  if (!Object.keys(live).length) live = seedMerchants();
  const cat = {}; (app.cat || []).forEach(x => { if (x && x['머천트ID']) cat[x['머천트ID']] = x; });
  const fb = Number(media.fallback_rate) >= 0 ? Number(media.fallback_rate) : 0.5;
  const rateOf = code => (typeof rates[code] === 'number' && rates[code] > 0 ? rates[code] : fb);

  const list = [{ code: 'coupang_direct', name: '쿠팡', logo: logos.coupang_direct || '', rate: rateOf('coupang_direct'),
    fee_rate: typeof fees.coupang_direct === 'number' ? fees.coupang_direct : null, click_url: '', route: '쿠팡 파트너스', coupang: true }];
  const codes = Object.keys(applied).filter(c => applied[c] === true && c.indexOf('lp:') === 0);
  const src = codes.length ? codes : FALLBACK_MALLS.slice(1).map(x => x[0]);
  src.forEach(code => {
    const id = code.slice(3), a = live[id] || {}, c = cat[id] || {};
    const fallbackName = (FALLBACK_MALLS.find(x => x[0] === code) || [])[1];
    list.push({ code, name: a.merchant_name || c['머천트명'] || fallbackName || id, logo: logos[code] || '', rate: rateOf(code),
      fee_rate: pct(a.max_commission_mobile), click_url: a.click_url || '', route: '링크프라이스', coupang: false });
  });

  const layout = Array.isArray(media.layout) ? media.layout : null;
  const byCode = {}; list.forEach(m => { byCode[m.code] = m; });
  const out = [];
  if (layout) {
    layout.forEach(x => { const m = byCode[x.code]; if (!m) return; out.push(Object.assign({}, m, { st: x.st || 'on', bubble: x.bubble || '' })); delete byCode[x.code]; });
  }
  list.forEach(m => { if (byCode[m.code]) out.push(Object.assign({}, m, { st: 'on', bubble: !layout && m.coupang ? '가장 빨리 받아요' : '' })); });
  return out;
}
function publicMall(m) { return { code: m.code, name: m.name, logo: m.logo, st: m.st, bubble: m.bubble, coupang: !!m.coupang }; }

/* ───────────── 클릭 (적립몰 → 쇼핑몰) ───────────── */

function subIdOf(media, clickId) { return 'asp-' + media + '-' + clickId; }

async function createClick(store, sess, mallCode, now) {
  const media = await getMedia(store, sess.media);
  const app = await loadAppSettings(store);
  const mall = buildMalls(app, media).find(m => m.code === mallCode);
  if (!mall) fail('unknown_mall', '없는 쇼핑몰입니다', 404);
  if (mall.st !== 'on') fail('mall_unavailable', '지금 ' + mall.name + ' 점검 중이에요. 잠시 후 다시 이용해 주세요', 409);
  const d = new Date(now + KST).toISOString();
  const clickId = 'C' + d.slice(0, 19).replace(/[-T:]/g, '') + rand(2);
  const subId = subIdOf(sess.media, clickId);
  /* 링크프라이스: 광고주 기본링크(click_url)에 u_id 로 sub_id 를 싣는다.
     쿠팡: 쿠팡 파트너스 딥링크 API 를 subId=sub_id 로 불러 받은 주소를 쓴다(데모는 호출하지 않음). */
  const outUrl = mall.click_url ? mall.click_url + (mall.click_url.indexOf('?') >= 0 ? '&' : '?') + 'u_id=' + encodeURIComponent(subId) : null;
  const doc = { click_id: clickId, sub_id: subId, media: sess.media, mk: sess.mk, member_id: sess.memberId, mall_code: mall.code,
    mall_name: mall.name, route: mall.route, rate: mall.rate, fee_rate: mall.fee_rate, ticket_won: app.ticketWon, out_url: outUrl, at: now };
  await store.collection(C.CLICKS).doc(clickId).set(doc);
  return doc;
}

/* ───────────── 구매 적립 (포스트백 → 예정 → 확정/미적립) ───────────── */

function expectAt(mallCode, orderedAt) {
  if (mallCode === 'coupang_direct') return orderedAt + 7 * 86400000;   // 쿠팡: 구매 확정 (연동 D+7)
  const p = kstParts(orderedAt);                                           // 그 외: 구매한 달의 다다음 달 6일
  const m = p.m + 2, y = p.y + Math.floor((m - 1) / 12), mm = ((m - 1) % 12) + 1;
  return kstMidnight(y, mm, 6);
}
function ticketsOf(amount, rate, ticketWon) { return Math.max(0, Math.floor((amount * rate / 100) / (ticketWon || DEFAULT_TICKET_WON))); }

function ledgerRow(t, store, row) { t.set(store.collection(C.LEDGER).doc(), row); }

/* 포스트백 1건을 받는다. sub_id 로 클릭을 찾아 매체 회원을 가린다.
   운영: 기존 포스트백 수신기에서 sub_id 가 'asp-' 로 시작하면 이 함수로 넘긴다. */
async function receiveOrder(store, p, now) {
  const subId = String(p.sub_id || '');
  const m = /^asp-([A-Z][A-Z0-9_]+)-(C\d{14}[0-9a-f]{4})$/.exec(subId);
  if (!m) fail('bad_sub_id', 'ASP sub_id 가 아닙니다');
  const amount = Math.round(Number(p.amount));
  if (!(amount > 0 && amount < 100000000)) fail('bad_amount', '구매 금액이 올바르지 않습니다');
  const orderNo = String(p.order_no || '').slice(0, 60);
  if (!orderNo) fail('bad_order', '주문번호가 없습니다');
  const orderedAt = Number(p.ordered_at) || now;
  const clickRef = store.collection(C.CLICKS).doc(m[2]);
  const click = await clickRef.get();
  if (!click.exists) fail('unknown_click', '이동 기록이 없습니다', 404);
  const c = click.data();
  if (orderedAt < c.at || orderedAt - c.at > CLICK_TTL_MS) fail('click_expired', '이동 후 24시간이 지난 구매입니다', 409);
  const id = (c.route === '쿠팡 파트너스' ? 'cp' : 'lp') + '_' + orderNo.replace(/[^A-Za-z0-9_-]/g, '');
  const ref = store.collection(C.ORDERS).doc(id);
  const mref = store.collection(C.MEMBERS).doc(c.member_id);
  return store.runTransaction(async t => {
    const [snap, msnap] = [await t.get(ref), await t.get(mref)];
    if (snap.exists) return Object.assign({ duplicate: true }, snap.data());    // 같은 포스트백 재수신 — 한 번만 적립
    if (!msnap.exists) fail('unknown_member', '매체 회원이 없습니다', 404);
    const doc = { order_id: id, media: c.media, mk: c.mk, member_id: c.member_id, nick: msnap.data().nick || '', click_id: c.click_id,
      sub_id: subId, mall_code: c.mall_code, mall_name: c.mall_name, route: c.route, order_no: orderNo, amount,
      rate: c.rate, ticket_won: c.ticket_won, tickets_expected: ticketsOf(amount, c.rate, c.ticket_won),
      fee: c.fee_rate != null ? Math.round(amount * c.fee_rate / 100) : null,
      status: 'pending', tickets: null, ordered_at: orderedAt, expect_at: expectAt(c.mall_code, orderedAt),
      received_at: now, confirmed_at: null, missed_at: null, miss_reason: null, source: p.source || 'postback' };
    t.set(ref, doc);
    t.update(mref, { orders_pending: (msnap.data().orders_pending || 0) + 1 });
    return doc;
  });
}

/* 확정: 예정 → 확정, 티켓 지급. 운영은 확정 기준일 배치(쿠팡 구매 확정 / 다다음 달 6일)가 부른다. */
async function confirmOrder(store, orderId, now) {
  const ref = store.collection(C.ORDERS).doc(orderId);
  return store.runTransaction(async t => {
    const snap = await t.get(ref);
    if (!snap.exists) fail('unknown_order', '없는 구매입니다', 404);
    const o = snap.data();
    if (o.status !== 'pending') return o;
    const mref = store.collection(C.MEMBERS).doc(o.member_id);
    const msnap = await t.get(mref);
    const mb = msnap.data();
    const n = o.tickets_expected;
    const avail = (mb.available || 0) + n;
    t.update(ref, { status: 'confirmed', tickets: n, confirmed_at: now });
    t.update(mref, { available: avail, tickets_confirmed: (mb.tickets_confirmed || 0) + n, orders_pending: Math.max(0, (mb.orders_pending || 0) - 1) });
    ledgerRow(t, store, { member_id: o.member_id, media: o.media, mk: o.mk, kind: 'confirm', d_available: n, d_held: 0,
      available: avail, held: mb.held || 0, ref: orderId, at: now });
    return Object.assign({}, o, { status: 'confirmed', tickets: n, confirmed_at: now });
  });
}

async function missOrder(store, orderId, reason, now) {
  const ref = store.collection(C.ORDERS).doc(orderId);
  return store.runTransaction(async t => {
    const snap = await t.get(ref);
    if (!snap.exists) fail('unknown_order', '없는 구매입니다', 404);
    const o = snap.data();
    if (o.status !== 'pending') return o;
    const mref = store.collection(C.MEMBERS).doc(o.member_id);
    const msnap = await t.get(mref);
    t.update(ref, { status: 'missed', tickets: 0, missed_at: now, miss_reason: reason || '구매 미확정' });
    t.update(mref, { orders_pending: Math.max(0, (msnap.data().orders_pending || 0) - 1) });
    return Object.assign({}, o, { status: 'missed', missed_at: now, miss_reason: reason || '구매 미확정' });
  });
}

/* ───────────── 04 · 06 코인 전환 ───────────── */

/* 06 — 전환 요청: 티켓을 보류하고 거래번호를 만든다. 보류된 티켓은 다른 전환에 못 쓴다. */
async function startConversion(store, sess, now) {
  const mref = store.collection(C.MEMBERS).doc(sess.memberId);
  const mediaDoc = await getMedia(store, sess.media);
  if (!mediaDoc || mediaDoc.status !== 'live') fail('media_stopped', '지금은 전환할 수 없습니다', 409);
  const rate = mediaDoc.coin_rate;
  const day = kstYmd(now);
  const cref = store.collection(C.COUNTERS).doc('conv_' + day);
  return store.runTransaction(async t => {
    const msnap = await t.get(mref);
    const csnap = await t.get(cref);
    if (!msnap.exists) fail('unknown_member', '회원 정보가 없습니다', 404);
    const mb = msnap.data();
    if (mb.active_tx) fail('in_progress', '처리 중인 전환이 있습니다', 409);
    const coins = Math.floor((mb.available || 0) / rate);
    if (coins < 1) fail('not_enough', '전환할 티켓이 부족합니다', 409);
    const tickets = coins * rate;
    const seq = (csnap.exists ? csnap.data().n || 0 : 0) + 1;
    const txid = 'PPT' + day + String(seq).padStart(6, '0');
    const avail = mb.available - tickets, held = (mb.held || 0) + tickets;
    const conv = { transaction_id: txid, media: sess.media, mk: sess.mk, member_id: sess.memberId, nick: mb.nick || '',
      coins, tickets, coin_rate: rate, status: 'requested', code: null, message: null, attempts: [], retries: 0,
      requested_at: now, next_retry_at: now, lease_until: now + LEASE_MS, toptoon_tx_id: null, paid_at: null,
      created_at: now, updated_at: now };
    t.set(cref, { n: seq });
    t.update(mref, { available: avail, held, active_tx: txid });
    t.set(store.collection(C.CONVS).doc(txid), conv);
    ledgerRow(t, store, { member_id: sess.memberId, media: sess.media, mk: sess.mk, kind: 'hold', d_available: -tickets, d_held: tickets,
      available: avail, held, ref: txid, at: now });
    return conv;
  });
}

/* 04 — 탑툰 코인 지급 API 호출. 본문은 한 번 만든 문자열을 서명과 전송에 같이 쓴다. */
async function callCoinApi(conv, media, deps) {
  const token = tokenFor(conv.media);
  const url = /^https?:\/\//.test(media.coin_api_url || '') ? media.coin_api_url : (deps.origin || '') + (media.coin_api_url || '');
  const body = JSON.stringify({ transaction_id: conv.transaction_id, member_key: conv.mk, coin: conv.coins, requested_at: kstIso(conv.requested_at) });
  const ts = String(Math.floor(deps.now() / 1000));
  const sig = hmacHex(token, ts + '.' + body);
  const started = deps.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), deps.timeoutMs || COIN_TIMEOUT_MS);
  try {
    const res = await deps.fetch(url, { method: 'POST', signal: ac.signal, body,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-PP-Media': conv.media, 'X-PP-Timestamp': ts, 'X-PP-Signature': sig } });
    const text = await res.text();
    let j = null; try { j = JSON.parse(text); } catch (_) { /* 아래에서 BADRES */ }
    const ms = deps.now() - started;
    if (!j || typeof j.code !== 'string' || j.transaction_id !== conv.transaction_id) return { code: 'BADRES', ms, http: res.status };
    return { code: j.code, ms, http: res.status, json: j };
  } catch (e) {
    const ms = deps.now() - started;
    return { code: (e && e.name === 'AbortError') ? 'TIMEOUT' : 'NETWORK', ms, error: String((e && e.message) || e) };
  } finally { clearTimeout(timer); }
}

/* 같은 전환을 한 곳에서만 보내도록 잡는다. 이미 끝났거나 다른 곳이 잡고 있으면 null */
async function claim(store, txid, now, opts) {
  const ref = store.collection(C.CONVS).doc(txid);
  return store.runTransaction(async t => {
    const snap = await t.get(ref);
    if (!snap.exists) return null;
    const c = snap.data();
    const ok = opts && opts.manual ? ['requested', 'retrying', 'stuck'] : ['requested', 'retrying'];
    if (ok.indexOf(c.status) < 0) return null;
    if (c.lease_until && c.lease_until > now) return null;
    if (!(opts && opts.manual) && c.next_retry_at > now) return null;
    t.update(ref, { lease_until: now + LEASE_MS });
    return c;
  });
}

/* 응답 하나를 반영한다. 06 의 표 그대로:
   0000 → 차감 확정 / 1001·1002·2001·2003 → 실패 확정·티켓 되돌림 / 9999·시간 초과 → 같은 거래번호로 재시도 */
async function applyResult(store, txid, r, now, opts) {
  const ref = store.collection(C.CONVS).doc(txid);
  return store.runTransaction(async t => {
    const snap = await t.get(ref);
    const c = snap.data();
    const mref = store.collection(C.MEMBERS).doc(c.member_id);
    const msnap = await t.get(mref);
    const mb = msnap.data();
    const attempt = { at: now, code: r.code, message: RESULT_TEXT[r.code] || (r.json && r.json.message) || '알 수 없는 코드', ms: r.ms || 0, manual: !!(opts && opts.manual) };
    const attempts = (c.attempts || []).concat([attempt]);
    const base = { attempts, code: r.code, message: attempt.message, lease_until: 0, updated_at: now };
    const clearActive = mb.active_tx === txid ? { active_tx: null } : {};

    if (r.code === '0000') {
      const held = Math.max(0, (mb.held || 0) - c.tickets);
      t.update(ref, Object.assign(base, { status: 'paid', toptoon_tx_id: (r.json && r.json.toptoon_tx_id) || null,
        paid_at: (r.json && Date.parse(r.json.paid_at)) || now, next_retry_at: null }));
      t.update(mref, Object.assign({ held, coins_total: (mb.coins_total || 0) + c.coins, tickets_converted: (mb.tickets_converted || 0) + c.tickets }, clearActive));
      ledgerRow(t, store, { member_id: c.member_id, media: c.media, mk: c.mk, kind: 'settle', d_available: 0, d_held: -c.tickets,
        available: mb.available || 0, held, ref: txid, at: now });
      return Object.assign({}, c, base, { status: 'paid' });
    }
    if (FINAL_FAIL[r.code]) {
      const held = Math.max(0, (mb.held || 0) - c.tickets), avail = (mb.available || 0) + c.tickets;
      t.update(ref, Object.assign(base, { status: 'failed', next_retry_at: null }));
      t.update(mref, Object.assign({ held, available: avail }, clearActive));
      ledgerRow(t, store, { member_id: c.member_id, media: c.media, mk: c.mk, kind: 'release', d_available: c.tickets, d_held: -c.tickets,
        available: avail, held, ref: txid, at: now });
      return Object.assign({}, c, base, { status: 'failed' });
    }
    /* 재시도 대상 — 9999 · TIMEOUT · NETWORK · BADRES · 2002(새 시각으로 이미 한 번 더 보낸 뒤) · 모르는 코드 */
    if (opts && opts.manual) {               // 운영자 재요청이 또 실패 — 운영자 확인 상태 유지
      t.update(ref, Object.assign(base, { status: 'stuck', next_retry_at: null }));
      if (clearActive.active_tx === null) t.update(mref, clearActive);
      return Object.assign({}, c, base, { status: 'stuck' });
    }
    const retries = c.status === 'requested' ? 0 : (c.retries || 0) + 1;    // 처음 요청 실패면 0, 재시도 실패면 +1
    if (retries >= RETRY_DELAYS_SEC.length) {
      t.update(ref, Object.assign(base, { status: 'stuck', retries, next_retry_at: null }));
      if (clearActive.active_tx === null) t.update(mref, clearActive);   // 티켓은 보류 그대로. 운영자가 같은 거래번호로 다시 요청한다
      return Object.assign({}, c, base, { status: 'stuck', retries });
    }
    const next = now + RETRY_DELAYS_SEC[retries] * 1000;
    t.update(ref, Object.assign(base, { status: 'retrying', retries, next_retry_at: next }));
    return Object.assign({}, c, base, { status: 'retrying', retries, next_retry_at: next });
  });
}

/* 한 번 보내고 반영한다. 2002 면 새 시각으로 그 자리에서 한 번 더 보낸다(06). */
async function attempt(store, conv, deps, opts) {
  const media = await getMedia(store, conv.media);
  let r = await callCoinApi(conv, media, deps);
  if (r.code === '2002') r = await callCoinApi(conv, media, deps);
  return applyResult(store, conv.transaction_id, r, deps.now(), opts);
}

/* 회원이 「전환」을 누른 흐름 전체: 보류 → 호출 → 반영 */
async function convert(store, sess, deps) {
  const conv = await startConversion(store, sess, deps.now());
  return attempt(store, conv, deps);          // startConversion 이 이미 잡아 두었다(lease)
}

/* 재시도 시각이 된 전환을 보낸다. 운영은 1분마다 도는 스케줄러가 부른다.
   데모(Vercel Hobby)는 분 단위 스케줄러가 없어 화면 조회(me·CMS) 때 같이 돌리고, 시연 화면에 「지금 보내기」를 둔다. */
async function retryDue(store, deps, opts) {
  const o = opts || {};
  const now = deps.now();
  let q = store.collection(C.CONVS);
  q = o.memberId ? q.where('member_id', '==', o.memberId) : q.where('status', 'in', ['requested', 'retrying']);
  const snap = await q.get();
  const due = [];
  snap.forEach(d => { const c = d.data(); if ((c.status === 'requested' || c.status === 'retrying') && c.next_retry_at <= now && !(c.lease_until > now)) due.push(c); });
  due.sort((a, b) => a.next_retry_at - b.next_retry_at);
  const done = [];
  for (const c of due.slice(0, o.limit || 3)) {
    const got = await claim(store, c.transaction_id, deps.now());
    if (got) done.push(await attempt(store, got, deps));
  }
  return done;
}

/* 운영자 재요청 — 같은 거래번호로 지금 한 번 보낸다 (06 「세 번 모두 실패하면 운영자가 확인 후」) */
async function manualRetry(store, txid, deps) {
  if (!TX_RE.test(String(txid || ''))) fail('bad_tx', '거래번호 형식이 올바르지 않습니다');
  const got = await claim(store, txid, deps.now(), { manual: true });
  if (!got) fail('not_retryable', '지금 다시 보낼 수 없는 전환입니다 (이미 끝났거나 처리 중)', 409);
  return attempt(store, got, deps, { manual: true });
}

/* 시연용 — 이 회원의 재시도 대기 건을 지금 보낼 수 있게 시각을 당긴다 */
async function pullRetriesNow(store, mid, now) {
  const snap = await store.collection(C.CONVS).where('member_id', '==', mid).get();
  const ids = [];
  snap.forEach(d => { const c = d.data(); if (c.status === 'retrying') ids.push(d.id); });
  for (const id of ids) await store.collection(C.CONVS).doc(id).update({ next_retry_at: now });
  return ids.length;
}

/* ───────────── 회원 화면 데이터 ───────────── */

async function memberView(store, sess, now) {
  const [mediaDoc, msnap, osnap, csnap, app, faq] = await Promise.all([
    getMedia(store, sess.media),
    store.collection(C.MEMBERS).doc(sess.memberId).get(),
    store.collection(C.ORDERS).where('member_id', '==', sess.memberId).get(),
    store.collection(C.CONVS).where('member_id', '==', sess.memberId).get(),
    loadAppSettings(store),
    getFaq(store),
  ]);
  if (!msnap.exists) fail('no_member', '다시 들어와 주세요', 401);
  const mb = msnap.data();
  const rate = mediaDoc.coin_rate;
  const orders = []; osnap.forEach(d => orders.push(d.data()));
  const convs = []; csnap.forEach(d => convs.push(d.data()));
  const pend = orders.filter(o => o.status === 'pending');
  const nextAt = pend.length ? Math.min.apply(null, pend.map(o => o.expect_at)) : null;
  const nextDay = nextAt ? kstYmd(nextAt) : null;
  const history = orders.map(o => ({
    kind: 'order', id: o.order_id, st: o.status === 'pending' ? 'pending' : o.status === 'confirmed' ? 'done' : 'miss',
    mall: o.mall_code, name: o.mall_name, at: o.ordered_at, amount: o.amount,
    tickets: o.status === 'confirmed' ? o.tickets : null,          // 확정 전 장수는 내보내지 않는다 (랜덤 티켓)
    expect_at: o.expect_at, confirmed_at: o.confirmed_at, reason: o.miss_reason,
  })).concat(convs.map(c => ({
    kind: 'conv', id: c.transaction_id, st: c.status === 'paid' ? 'conv' : c.status === 'failed' ? 'conv_fail' : 'conv_wait',
    at: c.requested_at, coins: c.coins, tickets: c.tickets, paid_at: c.paid_at, code: c.code,
  }))).sort((a, b) => b.at - a.at);
  const active = convs.filter(c => ['requested', 'retrying', 'stuck'].indexOf(c.status) >= 0).sort((a, b) => b.requested_at - a.requested_at)[0] || null;
  const last = convs.slice().sort((a, b) => b.updated_at - a.updated_at)[0] || null;
  return {
    media: { code: mediaDoc.code, name: mediaDoc.name, coin_name: mediaDoc.coin_name, coin_rate: rate, status: mediaDoc.status },
    member: { nick: mb.nick || '', mk_masked: maskMk(mb.mk), first_at: mb.first_at },
    balance: { available: mb.available || 0, held: mb.held || 0, convertible_coins: Math.floor((mb.available || 0) / rate),
      remainder: (mb.available || 0) % rate },
    pending: { count: pend.length, next_at: nextAt, next_count: nextDay ? pend.filter(o => kstYmd(o.expect_at) === nextDay).length : 0 },
    active: active && { transaction_id: active.transaction_id, status: active.status, coins: active.coins, tickets: active.tickets, next_retry_at: active.next_retry_at },
    last: last && { transaction_id: last.transaction_id, status: last.status, coins: last.coins, tickets: last.tickets, code: last.code, updated_at: last.updated_at },
    history,
    malls: buildMalls(app, mediaDoc).filter(m => m.st !== 'hide').map(publicMall),
    faq: faq.filter(f => f.on).map(f => ({ q: fillFaq(f.q, mediaDoc), a: fillFaq(f.a, mediaDoc) })),
    demo: isDemo(),
    now,
  };
}

/* ───────────── CMS 데이터 ───────────── */

async function adminOverview(store, now) {
  const [medias, msnap, osnap, csnap, app, faq] = await Promise.all([
    listMedia(store),
    store.collection(C.MEMBERS).orderBy('last_at', 'desc').limit(200).get(),
    store.collection(C.ORDERS).orderBy('ordered_at', 'desc').limit(200).get(),
    store.collection(C.CONVS).orderBy('requested_at', 'desc').limit(200).get(),
    loadAppSettings(store),
    getFaq(store),
  ]);
  const members = [], orders = [], convs = [];
  msnap.forEach(d => { const m = d.data(); members.push(Object.assign({ id: d.id, mk_masked: maskMk(m.mk) }, m)); });
  osnap.forEach(d => orders.push(d.data()));
  csnap.forEach(d => { const c = d.data(); delete c.lease_until; convs.push(c); });
  const p = kstParts(now), monthStart = kstMidnight(p.y, p.m, 1);
  const stats = {};
  medias.forEach(md => { stats[md.code] = { members: 0, buys: 0, gmv: 0, fee: 0, tickets: 0, pending: 0, pending_orders: 0, coins: 0, fails: 0 }; });
  members.forEach(m => { const s = stats[m.media]; if (s) s.members++; });
  orders.forEach(o => {
    const s = stats[o.media]; if (!s) return;
    if (o.ordered_at >= monthStart) { s.buys++; s.gmv += o.amount; s.fee += o.fee || 0; }
    if (o.status === 'confirmed' && o.confirmed_at >= monthStart) s.tickets += o.tickets || 0;
    if (o.status === 'pending') { s.pending += o.tickets_expected || 0; s.pending_orders++; }
  });
  convs.forEach(c => {
    const s = stats[c.media]; if (!s) return;
    if (c.status === 'paid' && (c.paid_at || 0) >= monthStart) s.coins += c.coins;
    if (c.status === 'stuck' || c.status === 'retrying') s.fails++;
  });
  return {
    media: medias.map(md => Object.assign({}, md, { token_hint: tokenHint(md.code), test_token: usingTestToken(md.code), stats: stats[md.code] })),
    malls: medias.reduce((acc, md) => { acc[md.code] = buildMalls(app, md).map(m => ({ code: m.code, name: m.name, logo: m.logo, route: m.route, st: m.st, bubble: m.bubble })); return acc; }, {}),
    members, orders, conversions: convs, faq, ticket_won: app.ticketWon,
    month_start: monthStart, now,
  };
}

/* 07 — 월간 지급 내역 CSV. 최종 결과(OK · FAIL)가 난 건만 넣는다. 처리 중·운영자 확인 건은 끝난 달에 들어간다. */
async function monthlyCsv(store, media, month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) fail('bad_month', '월은 YYYY-MM 형식입니다');
  const y = +m[1], mo = +m[2];
  const from = kstMidnight(y, mo, 1), to = kstMidnight(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1, 1);
  const snap = await store.collection(C.CONVS).where('media', '==', media).get();
  const rows = [];
  snap.forEach(d => {
    const c = d.data();
    if (c.status !== 'paid' && c.status !== 'failed') return;
    const doneAt = c.status === 'paid' ? (c.paid_at || c.updated_at) : c.updated_at;
    if (doneAt < from || doneAt >= to) return;
    rows.push(c);
  });
  rows.sort((a, b) => a.requested_at - b.requested_at);
  const q = v => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [['transaction_id', 'toptoon_tx_id', 'member_key', 'coin', 'requested_at', 'paid_at', 'result'].join(',')];
  rows.forEach(c => lines.push([c.transaction_id, c.toptoon_tx_id || '', c.mk, c.coins, kstIso(c.requested_at),
    c.status === 'paid' ? kstIso(c.paid_at || c.updated_at) : '', c.status === 'paid' ? 'OK' : 'FAIL'].map(q).join(',')));
  return { csv: '﻿' + lines.join('\r\n') + '\r\n', count: rows.length, filename: 'asp_' + media + '_' + y + String(mo).padStart(2, '0') + '.csv' };
}

module.exports = {
  C, AspError, fail, MEDIA_DEFAULTS, DEFAULT_FAQ, FINAL_FAIL, RESULT_TEXT, RETRY_DELAYS_SEC, ENTRY_TTL_SEC, COIN_TIMEOUT_MS, DEMO_TEST_TOKEN, MK_RE,
  hmacHex, safeEq, kstIso, kstYmd, kstMidnight, memberId, maskMk, tokenFor, usingTestToken, isDemo,
  getMedia, listMedia, updateMedia, saveLayout, getFaq, saveFaq, fillFaq,
  entryBase, signEntry, verifyEntry, makeSession, readSession, upsertMemberOnEntry,
  loadAppSettings, buildMalls, publicMall, createClick, subIdOf,
  expectAt, ticketsOf, receiveOrder, confirmOrder, missOrder,
  startConversion, callCoinApi, claim, applyResult, attempt, convert, retryDue, manualRetry, pullRetriesNow,
  memberView, adminOverview, monthlyCsv,
};
