'use strict';
/* 쇼핑 적립 ASP 규칙 시험 — node tests/asp/run.js
   연동 문서 v0.1 의 시험 8가지(08)와 06 재시도 규칙을 서버 로직 그대로 돌린다. 네트워크·Firebase 없이 돈다. */
process.env.ASP_TEST_SECRET = 'test-secret';
const assert = require('assert');
const A = require('../../api/_lib/asp');
const MK = require('../../api/_lib/asp-mock');
const { FakeStore } = require('./fake-store');

let pass = 0;
const results = [];
async function t(name, fn) {
  try { await fn(); pass++; results.push('  ok   ' + name); }
  catch (e) { results.push('  FAIL ' + name + '\n       ' + (e && e.stack || e).split('\n').slice(0, 3).join('\n       ')); process.exitCode = 1; }
}

/* 시계와 가짜 네트워크 — 우리 서버 → 탑툰 흉내(coinApi)를 같은 프로세스에서 잇는다 */
function world() {
  const store = new FakeStore();
  const clock = { now: Date.parse('2026-10-16T01:15:22Z'), mockSkew: 0, delayScale: 1 / 200 };
  const calls = [];
  const fetch = async (url, opts) => {
    calls.push({ url, body: opts.body, headers: opts.headers });
    const out = await MK.coinApi(store, opts.body, opts.headers, clock.now + clock.mockSkew);
    if (out.delayMs) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, out.delayMs * clock.delayScale);
        opts.signal.addEventListener('abort', () => { clearTimeout(timer); const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
      });
    }
    return { status: 200, text: async () => JSON.stringify(out.json) };
  };
  const deps = { fetch, now: () => clock.now, origin: 'https://demo.test', timeoutMs: 10000 * clock.delayScale };
  return { store, clock, calls, deps };
}

async function enter(w, mk, nick) {
  await MK.ensureTtMember(w.store, mk, nick, w.clock.now);
  const u = await MK.signedEntryUrl(w.store, { mk, nick }, 'https://demo.test', w.clock.now);
  const e = A.verifyEntry(u.url.split('?')[1], w.clock.now);
  await A.upsertMemberOnEntry(w.store, e, w.clock.now);
  return A.readSession(A.makeSession(e, w.clock.now), w.clock.now);
}
async function buyAndConfirm(w, s, amount) {
  const media = await A.getMedia(w.store, 'TOPTOON');
  const malls = A.buildMalls(await A.loadAppSettings(w.store), media);
  const c = await A.createClick(w.store, s, malls[0].code, w.clock.now);
  const o = await MK.postback(w.store, c.click_id, amount, w.clock.now);
  await A.confirmOrder(w.store, o.order_id, w.clock.now);
  return o;
}
async function member(w, s) { return (await w.store.collection(A.C.MEMBERS).doc(s.memberId).get()).data(); }
async function ttCoins(w, mk) { return (await w.store.collection(MK.M.MEMBERS).doc(mk).get()).data().coins; }

(async () => {
  console.log('연동 문서 05 — 서명 예시값');
  await t('진입 서명 예시 = e6ac45…', () => {
    const p = { media: 'TOPTOON', mk: 'a1b2c3d4e5', nick: '웹툰덕후', env: 'aos', ts: '1792112400' };
    assert.strictEqual(A.entryBase(p), 'env=aos&media=TOPTOON&mk=a1b2c3d4e5&nick=웹툰덕후&ts=1792112400');
    assert.strictEqual(A.signEntry(p, 'test_7f3a9c2e5b1d'), 'e6ac45027f2f9930fc621acc3234c71f6e4b7e4b270d0a6ed557c29c926c4ffd');
  });
  await t('코인 지급 서명 예시 = b07076…', () => {
    const body = '{"transaction_id":"PPT20261016000123","member_key":"a1b2c3d4e5","coin":3,"requested_at":"2026-10-16T10:15:22+09:00"}';
    assert.strictEqual(A.hmacHex('test_7f3a9c2e5b1d', '1792113322.' + body), 'b070766bdcf873ebba8387a7f54151cd21292613c196727833b03c19faab420e');
  });

  console.log('08 시험 1~3 — 회원 진입');
  await t('1 정상 진입 — 회원 식별, 세션 발급', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001', '웹툰덕후');
    assert.strictEqual(s.memberId, 'TOPTOON_tt_demo_0001');
    const m = await member(w, s);
    assert.strictEqual(m.visits, 1); assert.strictEqual(m.nick, '웹툰덕후');
    await enter(w, 'tt_demo_0001', '웹툰덕후');
    assert.strictEqual((await member(w, s)).visits, 2);
  });
  await t('2 서명이 틀린 진입 — bad_sig', async () => {
    const w = world();
    const u = await MK.signedEntryUrl(w.store, { mk: 'tt_demo_0001', variant: 'badsig' }, 'https://demo.test', w.clock.now);
    assert.throws(() => A.verifyEntry(u.url.split('?')[1], w.clock.now), e => e.code === 'bad_sig');
  });
  await t('3 만료된 진입 (10분 초과) — expired', async () => {
    const w = world();
    const u = await MK.signedEntryUrl(w.store, { mk: 'tt_demo_0001', variant: 'expired' }, 'https://demo.test', w.clock.now);
    assert.throws(() => A.verifyEntry(u.url.split('?')[1], w.clock.now), e => e.code === 'expired');
  });
  await t('진입 형식 오류 — mk·env·중복 파라미터', async () => {
    const w = world();
    const u = await MK.signedEntryUrl(w.store, { mk: 'tt_demo_0001' }, 'https://demo.test', w.clock.now);
    const q = u.url.split('?')[1];
    assert.throws(() => A.verifyEntry(q.replace('env=aos', 'env=tv'), w.clock.now), e => e.code === 'bad_param');
    assert.throws(() => A.verifyEntry(q + '&mk=x', w.clock.now), e => e.code === 'bad_param');
    assert.throws(() => A.verifyEntry(q.replace('media=TOPTOON', 'media=OTHER'), w.clock.now), e => e.code === 'unknown_media');
  });
  await t('세션 위조·만료 거절', async () => {
    const w = world();
    const tok = A.makeSession({ media: 'TOPTOON', mk: 'tt_demo_0001', nick: 'a' }, w.clock.now);
    assert.ok(A.readSession(tok, w.clock.now));
    assert.strictEqual(A.readSession(tok.slice(0, -2) + 'xx', w.clock.now), null);
    assert.strictEqual(A.readSession(tok, w.clock.now + 7 * 3600e3), null);
  });

  console.log('구매 적립 — 예정(랜덤 티켓) → 확정');
  await t('포스트백 → 적립 예정, 회원 화면에 장수 비공개', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001', '웹툰덕후');
    const media = await A.getMedia(w.store, 'TOPTOON');
    const malls = A.buildMalls(await A.loadAppSettings(w.store), media);
    assert.strictEqual(malls[0].code, 'coupang_direct'); assert.strictEqual(malls[0].bubble, '가장 빨리 받아요');
    const c = await A.createClick(w.store, s, malls[0].code, w.clock.now);
    assert.ok(/^asp-TOPTOON-C\d{14}[0-9a-f]{4}$/.test(c.sub_id));
    const o = await MK.postback(w.store, c.click_id, 30400, w.clock.now);
    assert.strictEqual(o.tickets_expected, 15);           // 30,400원 × 0.5% ÷ 10원 = 15장
    const v = await A.memberView(w.store, s, w.clock.now);
    assert.strictEqual(v.pending.count, 1);
    assert.strictEqual(v.history[0].tickets, null);
    assert.ok(!JSON.stringify(v).includes('tickets_expected'));
    await A.confirmOrder(w.store, o.order_id, w.clock.now);
    const v2 = await A.memberView(w.store, s, w.clock.now);
    assert.strictEqual(v2.balance.available, 15); assert.strictEqual(v2.history[0].tickets, 15); assert.strictEqual(v2.pending.count, 0);
  });
  await t('같은 포스트백 두 번 — 한 번만 적립', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    const c = await A.createClick(w.store, s, 'coupang_direct', w.clock.now);
    const p = { sub_id: c.sub_id, amount: 50000, order_no: 'X1', ordered_at: w.clock.now };
    await A.receiveOrder(w.store, p, w.clock.now);
    const again = await A.receiveOrder(w.store, p, w.clock.now);
    assert.ok(again.duplicate);
    assert.strictEqual((await member(w, s)).orders_pending, 1);
  });
  await t('이동 후 24시간 지난 구매 — 거절', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    const c = await A.createClick(w.store, s, 'coupang_direct', w.clock.now);
    await assert.rejects(A.receiveOrder(w.store, { sub_id: c.sub_id, amount: 1000, order_no: 'X2', ordered_at: w.clock.now + 25 * 3600e3 }, w.clock.now), e => e.code === 'click_expired');
  });
  await t('확정 예정일 — 쿠팡 D+7, 그 외 다다음 달 6일', () => {
    const at = Date.parse('2026-10-16T01:00:00Z');
    assert.strictEqual(A.kstIso(A.expectAt('lp:11st', at)), '2026-12-06T00:00:00+09:00');
    assert.strictEqual(A.kstIso(A.expectAt('lp:11st', Date.parse('2026-11-30T16:00:00Z'))), '2027-02-06T00:00:00+09:00');
    assert.strictEqual(A.expectAt('coupang_direct', at), at + 7 * 86400000);
  });

  console.log('08 시험 5~8 — 코인 지급');
  await t('5 코인 지급 정상 — 0000, 차감 확정', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    await buyAndConfirm(w, s, 100000);                    // 50장
    const c = await A.convert(w.store, s, w.deps);
    assert.strictEqual(c.status, 'paid'); assert.strictEqual(c.coins, 2); assert.strictEqual(c.tickets, 44);
    assert.strictEqual(c.transaction_id, 'PPT20261016000001');
    const m = await member(w, s);
    assert.deepStrictEqual([m.available, m.held, m.coins_total, m.active_tx], [6, 0, 2, null]);
    assert.strictEqual(await ttCoins(w, 'tt_demo_0001'), 2);
    const body = JSON.parse(w.calls[0].body);
    assert.deepStrictEqual(Object.keys(body), ['transaction_id', 'member_key', 'coin', 'requested_at']);
    assert.strictEqual(body.requested_at, '2026-10-16T10:15:22+09:00');
    const ledger = w.store.dump(A.C.LEDGER).map(x => x.kind).sort();
    assert.deepStrictEqual(ledger, ['confirm', 'hold', 'settle']);
  });
  await t('6 같은 거래번호 재요청 — 처음 결과 그대로, 추가 지급 없음', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    await buyAndConfirm(w, s, 100000);
    const c = await A.convert(w.store, s, w.deps);
    const again = await w.deps.fetch('x', { body: w.calls[0].body, headers: Object.assign({}, w.calls[0].headers), signal: new AbortController().signal });
    const j = JSON.parse(await again.text());
    assert.strictEqual(j.code, '0000'); assert.strictEqual(j.toptoon_tx_id, c.toptoon_tx_id);
    assert.strictEqual(await ttCoins(w, 'tt_demo_0001'), 2);
  });
  await t('7 없는 회원 지급 — 1001, 티켓 되돌림', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0404', '없는회원');
    await buyAndConfirm(w, s, 100000);
    const c = await A.convert(w.store, s, w.deps);
    assert.strictEqual(c.status, 'failed'); assert.strictEqual(c.code, '1001');
    const m = await member(w, s);
    assert.deepStrictEqual([m.available, m.held, m.active_tx], [50, 0, null]);
  });
  await t('탈퇴 회원 — 1002, 티켓 되돌림', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0003');
    await buyAndConfirm(w, s, 100000);
    const c = await A.convert(w.store, s, w.deps);
    assert.strictEqual(c.code, '1002'); assert.strictEqual((await member(w, s)).available, 50);
  });
  await t('8 응답 지연 (10초 초과) — 같은 거래번호로 재시도, 한 번만 지급', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    await buyAndConfirm(w, s, 100000);
    await MK.setMode(w.store, 'timeout', w.clock.now);
    const c = await A.convert(w.store, s, w.deps);
    assert.strictEqual(c.status, 'retrying'); assert.strictEqual(c.code, 'TIMEOUT');
    assert.strictEqual(await ttCoins(w, 'tt_demo_0001'), 2);                // 탑툰은 이미 지급
    let m = await member(w, s);
    assert.deepStrictEqual([m.available, m.held, m.active_tx], [6, 44, c.transaction_id]);
    assert.deepStrictEqual(await A.retryDue(w.store, w.deps, { memberId: s.memberId }), []);   // 1분 전에는 보내지 않는다
    w.clock.now += 60000;
    const done = await A.retryDue(w.store, w.deps, { memberId: s.memberId });
    assert.strictEqual(done[0].status, 'paid'); assert.strictEqual(done[0].transaction_id, c.transaction_id);
    assert.strictEqual(await ttCoins(w, 'tt_demo_0001'), 2);                // 추가 지급 없음
    m = await member(w, s);
    assert.deepStrictEqual([m.available, m.held, m.active_tx, m.coins_total], [6, 0, null, 2]);
  });
  await t('9999 계속 — 1분·5분·30분 재시도 뒤 운영자 확인, 운영자 재요청으로 지급', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    await buyAndConfirm(w, s, 100000);
    await MK.setMode(w.store, 'error', w.clock.now);
    let c = await A.convert(w.store, s, w.deps);
    assert.strictEqual(c.status, 'retrying');
    for (const wait of [60, 300, 1800]) {
      w.clock.now += wait * 1000 - 1;
      assert.strictEqual((await A.retryDue(w.store, w.deps, {})).length, 0);
      w.clock.now += 1;
      c = (await A.retryDue(w.store, w.deps, {}))[0];
    }
    assert.strictEqual(c.status, 'stuck'); assert.strictEqual(c.attempts.length, 4);
    let m = await member(w, s);
    assert.deepStrictEqual([m.available, m.held, m.active_tx], [6, 44, null]);   // 티켓은 보류 그대로
    await assert.rejects(A.manualRetry(w.store, 'NOPE', w.deps), e => e.code === 'not_retryable');
    const again = await A.manualRetry(w.store, c.transaction_id, w.deps);         // 아직 9999 — 그대로 운영자 확인
    assert.strictEqual(again.status, 'stuck');
    await MK.setMode(w.store, 'ok', w.clock.now);
    const ok = await A.manualRetry(w.store, c.transaction_id, w.deps);
    assert.strictEqual(ok.status, 'paid');
    m = await member(w, s);
    assert.deepStrictEqual([m.available, m.held, m.coins_total], [6, 0, 2]);
    assert.strictEqual(await ttCoins(w, 'tt_demo_0001'), 2);
  });
  await t('2002 — 새 시각으로 그 자리에서 한 번 더', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    await buyAndConfirm(w, s, 100000);
    w.clock.mockSkew = 400000;                                              // 탑툰 시계가 6분 넘게 앞섬
    let n = 0; const f = w.deps.fetch;
    w.deps.fetch = async (u, o) => { if (++n === 2) w.clock.mockSkew = 0; return f(u, o); };
    const c = await A.convert(w.store, s, w.deps);
    assert.strictEqual(n, 2); assert.strictEqual(c.status, 'paid');
  });
  await t('서명 오류 — 2001, 실패 확정', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    await buyAndConfirm(w, s, 100000);
    const f = w.deps.fetch;
    w.deps.fetch = (u, o) => f(u, Object.assign({}, o, { headers: Object.assign({}, o.headers, { 'X-PP-Signature': '0'.repeat(64) }) }));
    const c = await A.convert(w.store, s, w.deps);
    assert.strictEqual(c.code, '2001'); assert.strictEqual(c.status, 'failed');
  });
  await t('전환 막기 — 티켓 부족 · 처리 중 중복', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    await assert.rejects(A.convert(w.store, s, w.deps), e => e.code === 'not_enough');
    await buyAndConfirm(w, s, 200000);                                      // 100장
    await MK.setMode(w.store, 'error', w.clock.now);
    await A.convert(w.store, s, w.deps);
    await assert.rejects(A.convert(w.store, s, w.deps), e => e.code === 'in_progress');
  });

  console.log('07 월간 지급 내역 · CMS');
  await t('CSV — 열 순서, OK·FAIL 만', async () => {
    const w = world();
    const s1 = await enter(w, 'tt_demo_0001'); await buyAndConfirm(w, s1, 100000); await A.convert(w.store, s1, w.deps);
    const s2 = await enter(w, 'tt_demo_0404'); await buyAndConfirm(w, s2, 100000); await A.convert(w.store, s2, w.deps);
    const out = await A.monthlyCsv(w.store, 'TOPTOON', '2026-10');
    const lines = out.csv.replace('﻿', '').trim().split('\r\n');
    assert.strictEqual(lines[0], 'transaction_id,toptoon_tx_id,member_key,coin,requested_at,paid_at,result');
    assert.strictEqual(lines.length, 3);
    assert.ok(/^PPT20261016000001,TT-\d{8},tt_demo_0001,2,2026-10-16T10:15:22\+09:00,2026-10-16T10:15:22\+09:00,OK$/.test(lines[1]), lines[1]);
    assert.ok(/,tt_demo_0404,2,.*,,FAIL$/.test(lines[2]), lines[2]);
    assert.strictEqual((await A.monthlyCsv(w.store, 'TOPTOON', '2026-09')).count, 0);
  });
  await t('CMS 요약 — 회원·구매·전환 집계, 토큰 끝 4자리만', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001'); await buyAndConfirm(w, s, 100000); await A.convert(w.store, s, w.deps);
    const o = await A.adminOverview(w.store, w.clock.now);
    const st = o.media.find(m => m.code === 'TOPTOON').stats;
    assert.deepStrictEqual([st.members, st.buys, st.gmv, st.tickets, st.coins], [1, 1, 100000, 50, 2]);
    assert.ok(!JSON.stringify(o).includes('test_7f3a9c2e5b1d'));
    assert.strictEqual(o.media[0].token_hint, '5b1d');
  });
  await t('노출 설정 — 순서·점검중·숨김·말풍선이 회원 화면에 반영', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    await A.saveLayout(w.store, 'TOPTOON', [{ code: 'lp:11st', st: 'on', bubble: '추천' }, { code: 'coupang_direct', st: 'maint' }, { code: 'lp:gmarket', st: 'hide' }], w.clock.now);
    const v = await A.memberView(w.store, s, w.clock.now);
    assert.strictEqual(v.malls[0].code, 'lp:11st'); assert.strictEqual(v.malls[0].bubble, '추천');
    assert.strictEqual(v.malls[1].st, 'maint');
    assert.ok(!v.malls.some(m => m.code === 'lp:gmarket'));
    await assert.rejects(A.createClick(w.store, s, 'coupang_direct', w.clock.now), e => e.code === 'mall_unavailable');
  });
  await t('시연 — 예시 기록·초기화', async () => {
    const w = world();
    const s = await enter(w, 'tt_demo_0001');
    await MK.sim(w.store, 'seed', 'tt_demo_0001', w.deps);
    const v = await A.memberView(w.store, s, w.clock.now);
    assert.strictEqual(v.pending.count, 3); assert.strictEqual(v.balance.available, 9 + 36);
    assert.strictEqual(v.history.filter(h => h.st === 'miss').length, 1);
    const r = await MK.sim(w.store, 'reset', 'tt_demo_0001', w.deps);
    assert.ok(r.deleted > 10);
    assert.strictEqual((await w.store.collection(A.C.MEMBERS).doc(s.memberId).get()).exists, false);
  });

  console.log(results.join('\n'));
  console.log((process.exitCode ? '실패 있음' : '전부 통과') + ' — ' + pass + '건 통과');
})();
