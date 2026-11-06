'use strict';
/**
 * PricePick Demo — 예약 → 발송완료 수동 발송 샘플 3건 (김반장 2026-11-06)
 *
 * 발송 기록에 「예약으로 걸었다가 실제로 나간 건」이 화면에서 어떻게 보이는지 확인하려는 샘플이다.
 * CMS 가 만드는 것과 같은 구조로 넣는다:
 *   - 예약 등록: notiSendConfirmed() — status 'scheduled', schedule_at 'YYYY-MM-DDTHH:mm'(문자열), created_at(Timestamp)
 *   - 발송완료 처리: loadNotifications() 의 예약 넘김 — status 'sent', sent_at = Timestamp(schedule_at),
 *     recipient_uids · recipient_count 를 그 시점 조건으로 다시 센 값, marketing_only true
 * 성공·실패·미처리는 CMS 가 문서 id + 회원 id 로 정하는 값이라 문서에 적지 않는다(notiRecipientsOf).
 * 실패·미처리가 한 건 이상 나오도록 문서 id 끝의 번호를 골라 둔다.
 *
 * 다시 돌려도 쌓이지 않는다 — 문서 id 가 「sample_sched_」로 시작하고 sample:true 를 단다. 돌릴 때마다 지우고 새로 넣는다.
 *
 * Run:   node scripts/seed-scheduled-sent.js            (지우고 다시 넣기)
 *        node scripts/seed-scheduled-sent.js --dry-run  (넣을 내용만 출력)
 *        node scripts/seed-scheduled-sent.js --remove   (샘플만 지우기)
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DRY = process.argv.includes('--dry-run');
const REMOVE = process.argv.includes('--remove');

// ── Auth (seed-additive.js 와 같은 방식) ──
const ft = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
const adcPath = path.join(__dirname, '..', '.adc.json');
fs.writeFileSync(adcPath, JSON.stringify({ type: 'authorized_user',
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token: ft.tokens.refresh_token }));
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
initializeApp({ credential: applicationDefault(), projectId: 'pricepick-demo' });
const db = getFirestore();

// 예약 등록 시각 · 예약(=발송) 시각 · 제목 · 본문 · 대상 조건. 시각은 이 맥의 현지 시각으로 읽는다(CMS 화면도 브라우저 현지 시각으로 그린다)
const SAMPLES = [
  { reg: '2026-11-01T14:20', at: '2026-11-03T09:00', title: '이번 주 추첨 마감 D-1', body: '{닉네임}님, 이번 주 경품 추첨이 내일 마감돼요. 보유 티켓 {보유티켓}장으로 지금 응모해 보세요.', target: 'all' },
  { reg: '2026-10-28T17:05', at: '2026-11-01T10:00', title: '티켓 만료 안내', body: '보유하신 티켓 중 곧 만료되는 티켓이 있어요. 만료 전에 기프티콘으로 바꿔 보세요.', target: 'purchased' },
  // 3번은 지시 날짜(10/25 → 10/30)로는 신규 가입 7일 이내 회원 3명이 모두 수신 미동의라 대상 0명이 된다.
  // 회원 데이터는 바꾸지 않고, 수신 동의 회원이 신규 가입 7일 이내에 드는 날짜(9/22 가입 회원)로 옮겼다(2026-11-06).
  { reg: '2026-09-20T11:40', at: '2026-09-25T20:00', title: '신규 가입 환영 안내', body: '{닉네임}님, 프라이스픽 가입을 환영해요. 쇼핑몰에서 구매하면 랜덤 티켓이 쌓여요.', target: 'new7' },
];
const TARGET_KO = { all: '전체 회원', purchased: '구매 이력 있는 회원', new7: '신규 가입(7일 이내)' };

// CMS notiHash 와 같은 식 — 같은 문서 id · 회원 id 면 화면도 같은 결과를 그린다
function notiHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; } return h >>> 0; }
function statusOf(docId, uid) { const b = notiHash(docId + '|' + uid) % 100; return b < 5 ? 'fail' : (b < 8 ? 'pending' : 'ok'); }
const ms = (v) => v ? (v.toDate ? v.toDate().getTime() : new Date(v).getTime()) : 0;

async function removeSamples() {
  const snap = await db.collection('notifications').where('sample', '==', true).get();
  const docs = snap.docs.filter((d) => d.id.indexOf('sample_sched_') === 0);
  if (!DRY) { const b = db.batch(); docs.forEach((d) => b.delete(d.ref)); if (docs.length) await b.commit(); }
  console.log('[remove] 기존 샘플', docs.length, '건' + (DRY ? ' (dry-run)' : ' 삭제'));
}

(async () => {
  await removeSamples();
  if (REMOVE) process.exit(0);
  const [us, pb] = await Promise.all([db.collection('users').get(), db.collection('postbacks').get()]);
  const bought = new Set(); pb.forEach((d) => { const u = d.data().user_id; if (u) bought.add(u); });
  // CMS notiTargetSplit 과 같은 기준 — 조건에 맞고 마케팅 수신 동의(notif_marketing === true)한 회원
  const users = us.docs.map((d) => ({ id: d.id, mkt: d.data().notif_marketing === true, created: ms(d.data().created_at) }));
  const out = [];
  SAMPLES.forEach((s, n) => {
    const sendMs = new Date(s.at).getTime();
    const hit = users.filter((u) => s.target === 'all' ? true : s.target === 'purchased' ? bought.has(u.id)
      : (u.created && u.created <= sendMs && u.created >= sendMs - 7 * 86400000));
    const uids = hit.filter((u) => u.mkt).map((u) => u.id);
    // 실패·미처리가 한 건 이상 나오는 문서 id 를 고른다(대상이 아주 적으면 못 고를 수 있다)
    let id = '', c = null;
    for (let k = 1; k < 200; k++) {
      id = 'sample_sched_' + (n + 1) + '_' + k;
      c = { ok: 0, fail: 0, pending: 0 };
      uids.forEach((u) => c[statusOf(id, u)]++);
      if (c.fail >= 1 && c.pending >= 1) break;
    }
    out.push({ id, s, uids, c, matched: hit.length });
  });
  out.forEach((o) => console.log(JSON.stringify({ id: o.id, title: o.s.title, target: TARGET_KO[o.s.target], 조건에_맞는_회원: o.matched, 대상_수신동의: o.uids.length, 성공: o.c.ok, 실패: o.c.fail, 미처리: o.c.pending, 예약등록: o.s.reg, 발송: o.s.at })));
  // 받을 회원이 0명인 건은 넣지 않는다 — 0명 발송은 CMS 가 막는 경우라(2026-11-06) 샘플로 넣으면 틀린 모습이 된다
  const skip = out.filter((o) => !o.uids.length);
  skip.forEach((o) => console.log('[skip] 대상 0명이라 넣지 않음:', o.s.title, '·', TARGET_KO[o.s.target], '· 조건에 맞는 회원', o.matched, '명 중 수신 동의 0명'));
  const put = out.filter((o) => o.uids.length);
  if (DRY) { console.log('[dry-run] 쓰지 않음'); process.exit(0); }
  const b = db.batch();
  put.forEach((o) => b.set(db.collection('notifications').doc(o.id), {
    title: o.s.title, body: o.s.body, channel: 'push', target: o.s.target,
    recipient_count: o.uids.length, recipient_uids: o.uids, marketing_only: true,
    status: 'sent', schedule_at: o.s.at, sent_at: Timestamp.fromDate(new Date(o.s.at)),
    created_at: Timestamp.fromDate(new Date(o.s.reg)), sample: true,
  }));
  await b.commit();
  console.log('[write] notifications 샘플', put.length, '건');
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
