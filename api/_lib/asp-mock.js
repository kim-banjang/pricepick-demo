'use strict';
/* 탑툰 흉내 — 데모 전용. 운영에는 옮기지 않는다.
 *
 * 탑툰이 만들 두 가지를 대신한다.
 *   1) 진입 주소 서명 (연동 문서 03·05) — 탑툰 서버 역할
 *   2) 코인 지급 API (04·05·06) — 탑툰이 지켜야 할 동작을 그대로: 서명·시각 검증, 결과 코드, 같은 거래번호 재요청 시 처음 결과 그대로
 * 그 밖에 쇼핑몰·제휴망이 할 일(포스트백, 구매 확정)을 시연용으로 흉내 낸다.
 *
 * 저장: asp_mock_tt_members(탑툰 회원·코인 잔액), asp_mock_tt_tx(탑툰 지급 기록), asp_mock_tt_state(응답 방식)
 */
const crypto = require('crypto');
const A = require('./asp');

const M = { MEMBERS: 'asp_mock_tt_members', TX: 'asp_mock_tt_tx', STATE: 'asp_mock_tt_state' };
const MODES = ['ok', 'error', 'timeout'];
const TIMEOUT_DELAY_MS = 11000;   // 우리 쪽 대기(10초)보다 길게 — 응답 지연 시험(08-8)

/* 시연용 탑툰 회원. 0404 는 탑툰에 없는 회원(1001), 0003 은 탈퇴 회원(1002) */
const PRESETS = [
  { mk: 'tt_demo_0001', nick: '웹툰덕후', status: 'active', note: '적립 회원' },
  { mk: 'tt_demo_0002', nick: '첫방문', status: 'active', note: '처음 들어오는 회원' },
  { mk: 'tt_demo_0003', nick: '탈퇴예정', status: 'withdrawn', note: '코인 지급 불가 — 1002' },
  { mk: 'tt_demo_0404', nick: '없는회원', status: null, note: '탑툰에 없는 회원 — 1001' },
];

async function getMode(store) {
  const s = await store.collection(M.STATE).doc('main').get();
  const m = s.exists && s.data().mode;
  return MODES.indexOf(m) >= 0 ? m : 'ok';
}
async function setMode(store, mode, now) {
  if (MODES.indexOf(mode) < 0) A.fail('bad_mode', '응답 방식이 올바르지 않습니다');
  await store.collection(M.STATE).doc('main').set({ mode, updated_at: now });
  return mode;
}

async function ensureTtMember(store, mk, nick, now) {
  const preset = PRESETS.find(p => p.mk === mk);
  if (preset && preset.status === null) return null;          // 탑툰에 없는 회원은 만들지 않는다
  const ref = store.collection(M.MEMBERS).doc(mk);
  const snap = await ref.get();
  if (snap.exists) return snap.data();
  const doc = { mk, nick: nick || (preset && preset.nick) || '', status: (preset && preset.status) || 'active', coins: 0, created_at: now };
  await ref.set(doc);
  return doc;
}

/* 탑툰 서버가 무료충전소 링크를 만드는 일 (03). variant: ok · badsig · expired */
async function signedEntryUrl(store, p, origin, now) {
  const mk = String(p.mk || '');
  if (!A.MK_RE.test(mk)) A.fail('bad_param', 'mk 형식이 올바르지 않습니다');
  const preset = PRESETS.find(x => x.mk === mk);
  const nick = String(p.nick || (preset && preset.nick) || '').slice(0, 20);
  await ensureTtMember(store, mk, nick, now);
  const ts = Math.floor(now / 1000) - (p.variant === 'expired' ? A.ENTRY_TTL_SEC + 60 : 0);
  const params = { media: 'TOPTOON', mk, env: ['pc', 'mweb', 'aos', 'ios'].indexOf(p.env) >= 0 ? p.env : 'aos', ts: String(ts) };
  if (nick) params.nick = nick;
  let sig = A.signEntry(params, A.tokenFor('TOPTOON'));
  if (p.variant === 'badsig') sig = sig.slice(0, -1) + (sig.slice(-1) === '0' ? '1' : '0');
  const q = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&') + '&sig=' + sig;
  return { url: origin + '/asp/?' + q, base: A.entryBase(params), sig, variant: p.variant || 'ok' };
}

function kst(ms) { return A.kstIso(ms); }
function resp(result, code, message, txid, extra) { return Object.assign({ result, code, message, transaction_id: txid || '' }, extra || {}); }

/* 탑툰 코인 지급 API (04). 반환 { json, delayMs } — HTTP 상태는 항상 200 */
async function coinApi(store, rawBody, headers, now) {
  const h = k => headers[k] || headers[k.toLowerCase()] || '';
  const token = A.tokenFor('TOPTOON');
  let body = null; try { body = JSON.parse(rawBody); } catch (_) { /* 2003 */ }
  const txid = body && typeof body.transaction_id === 'string' ? body.transaction_id : '';
  if (h('X-PP-Media') !== 'TOPTOON' || !/^\d{9,11}$/.test(h('X-PP-Timestamp')) || !/^[0-9a-f]{64}$/.test(h('X-PP-Signature')))
    return { json: resp('FAIL', '2003', '요청 형식 오류', txid) };
  const ts = h('X-PP-Timestamp');
  const mine = A.hmacHex(token, ts + '.' + rawBody);
  if (!A.safeEq(mine, h('X-PP-Signature'))) return { json: resp('FAIL', '2001', '서명 오류', txid) };
  if (Math.abs(now / 1000 - Number(ts)) > 300) return { json: resp('FAIL', '2002', '요청 시각 만료', txid) };
  if (!body || !/^[A-Za-z0-9]{1,40}$/.test(txid) || typeof body.member_key !== 'string' || !(Number.isInteger(body.coin) && body.coin >= 1) || typeof body.requested_at !== 'string')
    return { json: resp('FAIL', '2003', '요청 형식 오류', txid) };

  const txRef = store.collection(M.TX).doc(txid);
  const first = await txRef.get();
  if (first.exists) {                                        // 06 — 이미 처리한 거래번호: 처음 결과 그대로, 추가 지급 없음
    const d = first.data();
    await txRef.update({ replays: (d.replays || 0) + 1, last_replay_at: now });
    return { json: d.response, replay: true };
  }
  const mode = await getMode(store);
  if (mode === 'error') return { json: resp('FAIL', '9999', '일시적 시스템 오류', txid) };   // 저장하지 않는다 — 다음 재시도는 정상 처리될 수 있다

  const mRef = store.collection(M.MEMBERS).doc(body.member_key);
  const out = await store.runTransaction(async t => {
    const again = await t.get(txRef);
    if (again.exists) return { json: again.data().response, replay: true };
    const ms = await t.get(mRef);
    let response;
    if (!ms.exists) response = resp('FAIL', '1001', '없는 회원', txid);
    else if (ms.data().status !== 'active') response = resp('FAIL', '1002', '지급할 수 없는 회원', txid);
    else {
      const ttx = 'TT-' + String(crypto.randomInt(10000000, 99999999));
      response = resp('OK', '0000', '지급 완료', txid, { toptoon_tx_id: ttx, paid_at: kst(now) });
      t.update(mRef, { coins: (ms.data().coins || 0) + body.coin });
    }
    t.set(txRef, { transaction_id: txid, member_key: body.member_key, coin: body.coin, requested_at: body.requested_at,
      response, received_at: now, replays: 0, mode });
    return { json: response };
  });
  if (!out.replay && mode === 'timeout') out.delayMs = TIMEOUT_DELAY_MS;   // 지급은 했지만 응답이 늦는다
  return out;
}

/* 탑툰 쪽에서 보이는 것 + 우리 쪽 잔액 (시연 화면 오른쪽 기록판) */
async function state(store, mk) {
  const [mode, ttm, txs, mb] = await Promise.all([
    getMode(store),
    mk ? store.collection(M.MEMBERS).doc(mk).get() : null,
    mk ? store.collection(M.TX).where('member_key', '==', mk).get() : null,
    mk ? store.collection(A.C.MEMBERS).doc(A.memberId('TOPTOON', mk)).get() : null,
  ]);
  const tx = [];
  if (txs) txs.forEach(d => { const x = d.data(); tx.push({ transaction_id: x.transaction_id, coin: x.coin, code: x.response.code,
    toptoon_tx_id: x.response.toptoon_tx_id || null, received_at: x.received_at, replays: x.replays || 0 }); });
  tx.sort((a, b) => b.received_at - a.received_at);
  const m = mb && mb.exists ? mb.data() : null;
  return {
    mode, presets: PRESETS,
    toptoon: ttm && ttm.exists ? { mk, nick: ttm.data().nick, status: ttm.data().status, coins: ttm.data().coins || 0 } : null,
    toptoon_tx: tx.slice(0, 20),
    pricepick: m ? { available: m.available || 0, held: m.held || 0, orders_pending: m.orders_pending || 0, coins_total: m.coins_total || 0,
      active_tx: m.active_tx || null, visits: m.visits || 0 } : null,
  };
}

/* 쇼핑몰·제휴망 흉내: 적립몰에서 이동한 뒤 구매 → 포스트백 도착 */
async function postback(store, clickId, amount, now) {
  const c = await store.collection(A.C.CLICKS).doc(String(clickId || '')).get();
  if (!c.exists) A.fail('unknown_click', '이동 기록이 없습니다', 404);
  const orderNo = 'D' + new Date(now + 9 * 3600e3).toISOString().slice(2, 19).replace(/[-T:]/g, '') + crypto.randomBytes(2).toString('hex');
  return A.receiveOrder(store, { sub_id: c.data().sub_id, amount, order_no: orderNo, ordered_at: now, source: 'demo' }, now);
}

async function memberOrders(store, mid) {
  const snap = await store.collection(A.C.ORDERS).where('member_id', '==', mid).get();
  const out = []; snap.forEach(d => out.push(d.data()));
  return out;
}

/* 시연 동작 */
async function sim(store, action, mk, deps) {
  if (!A.MK_RE.test(String(mk || ''))) A.fail('bad_param', '회원을 고르세요');
  const mid = A.memberId('TOPTOON', mk);
  const now = deps.now();
  if (action === 'confirm-all') {
    const pend = (await memberOrders(store, mid)).filter(o => o.status === 'pending');
    for (const o of pend) await A.confirmOrder(store, o.order_id, deps.now());
    return { confirmed: pend.length };
  }
  if (action === 'miss-latest') {
    const pend = (await memberOrders(store, mid)).filter(o => o.status === 'pending').sort((a, b) => b.ordered_at - a.ordered_at);
    if (!pend.length) return { missed: 0 };
    await A.missOrder(store, pend[0].order_id, '주문 취소', now);
    return { missed: 1 };
  }
  if (action === 'retry-now') {
    const pulled = await A.pullRetriesNow(store, mid, now);
    const done = await A.retryDue(store, deps, { memberId: mid, limit: 5 });
    return { pulled, sent: done.map(c => ({ transaction_id: c.transaction_id, status: c.status, code: c.code })) };
  }
  if (action === 'seed') return seed(store, mk, deps);
  if (action === 'reset') return reset(store, mk);
  A.fail('bad_action', '모르는 동작입니다');
}

/* 예시 기록 — 프로토타입 화면과 같은 모양(예정 3 · 확정 2 · 미적립 1). 쇼핑몰은 지금 노출 중인 목록에서 고른다 */
async function seed(store, mk, deps) {
  const mid = A.memberId('TOPTOON', mk);
  const mb = await store.collection(A.C.MEMBERS).doc(mid).get();
  if (!mb.exists) A.fail('not_entered', '먼저 무료충전소에서 들어가 주세요', 409);
  const now = deps.now();
  const media = await A.getMedia(store, 'TOPTOON');
  const app = await A.loadAppSettings(store);
  const malls = A.buildMalls(app, media);
  const day = 86400000;
  const plan = [
    { ago: 2, amount: 30400, then: null }, { ago: 22, amount: 54000, then: null }, { ago: 34, amount: 156000, then: null },
    { ago: 50, amount: 18900, then: 'confirm' }, { ago: 62, amount: 72000, then: 'confirm' }, { ago: 74, amount: 41200, then: 'miss' },
  ];
  const made = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i], m = malls[i % malls.length];
    const at = now - p.ago * day - 600000;
    const cid = 'C' + new Date(at + 9 * 3600e3).toISOString().slice(0, 19).replace(/[-T:]/g, '') + crypto.randomBytes(2).toString('hex');
    const sub = A.subIdOf('TOPTOON', cid);
    await store.collection(A.C.CLICKS).doc(cid).set({ click_id: cid, sub_id: sub, media: 'TOPTOON', mk, member_id: mid, mall_code: m.code,
      mall_name: m.name, route: m.route, rate: m.rate, fee_rate: m.fee_rate, ticket_won: app.ticketWon, out_url: null, at, seeded: true });
    const o = await A.receiveOrder(store, { sub_id: sub, amount: p.amount, order_no: 'S' + cid.slice(1), ordered_at: at + 300000, source: 'seed' }, at + 400000);
    if (p.then === 'confirm') await A.confirmOrder(store, o.order_id, o.expect_at);
    if (p.then === 'miss') await A.missOrder(store, o.order_id, '구매 미확정', o.expect_at);
    made.push(o.order_id);
  }
  return { seeded: made.length };
}

async function reset(store, mk) {
  const mid = A.memberId('TOPTOON', mk);
  const refs = [store.collection(A.C.MEMBERS).doc(mid)];
  for (const col of [A.C.ORDERS, A.C.CLICKS, A.C.CONVS, A.C.LEDGER]) {
    const snap = await store.collection(col).where('member_id', '==', mid).get();
    snap.forEach(d => refs.push(d.ref));
  }
  const tx = await store.collection(M.TX).where('member_key', '==', mk).get();
  tx.forEach(d => refs.push(d.ref));
  for (let i = 0; i < refs.length; i += 400) {
    const b = store.batch();
    refs.slice(i, i + 400).forEach(r => b.delete(r));
    await b.commit();
  }
  const tt = store.collection(M.MEMBERS).doc(mk);
  if ((await tt.get()).exists) await tt.update({ coins: 0 });
  return { deleted: refs.length };
}

module.exports = { M, MODES, PRESETS, TIMEOUT_DELAY_MS, getMode, setMode, ensureTtMember, signedEntryUrl, coinApi, state, postback, sim };
