'use strict';
/**
 * PricePick Demo — 자동 발송 기록(notif_logs) 샘플 채우기 (김반장 2026-11-06)
 *
 * CMS 「알림 관리 → 발송 기록 → 자동 발송」 탭을 실제 운영처럼 보이게 하는 샘플이다.
 *  - 100건, 최근 14일, 한국 10:00~21:59 사이(야간 22:00~08:00 미발송 정책 — 베트남 시간으로 봐도 08:00~19:59)
 *  - 알림 종류: 자동 알림 문구 표 「사용 중」 중 단독으로 나가는 알림만(구매 적립이 가장 많음).
 *    취소 범위 토막·회수 예정 덧붙임은 다른 알림 본문의 일부라 따로 기록하지 않는다.
 *  - 대상 회원: users 컬렉션에 실제로 있는 회원(탈퇴·실계정 제외). 닉네임 없는 회원도 섞인다.
 *  - 결과: 성공 90 · 실패 7 · 미처리 3. 사유는 실패·미처리만.
 *
 * 다시 돌려도 쌓이지 않는다 — 샘플 문서는 id 가 「sample__」로 시작하고 sample:true 를 단다.
 * 돌릴 때마다 기존 샘플을 지우고 새로 넣는다. 앱이 남기는 실제 기록(id 「<uid>__<알림 key>」)은 건드리지 않는다.
 *
 * Run:   node scripts/seed-notif-logs.js            (지우고 다시 넣기)
 *        node scripts/seed-notif-logs.js --dry-run  (넣을 내용만 출력)
 *        node scripts/seed-notif-logs.js --remove   (샘플만 지우기)
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DRY = process.argv.includes('--dry-run');
const REMOVE = process.argv.includes('--remove');

// ── Auth (firebase-tools OAuth2, seed-additive.js 와 같은 방식) ──
const FT_CONFIG = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
const FT_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FT_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
let ftConfig;
try {
  ftConfig = JSON.parse(fs.readFileSync(FT_CONFIG, 'utf8'));
  console.log('[auth]', ftConfig.user.email);
} catch (e) { console.error('[auth] Failed:', e.message); process.exit(1); }
const adcPath = path.join(__dirname, '..', '.adc.json');
fs.writeFileSync(adcPath, JSON.stringify({
  type: 'authorized_user', client_id: FT_CLIENT_ID, client_secret: FT_CLIENT_SECRET,
  refresh_token: ftConfig.tokens.refresh_token,
}));
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
initializeApp({ credential: applicationDefault(), projectId: 'pricepick-demo' });
const db = getFirestore();

const REAL_UIDS = new Set(['sHStx0O2IrRFb5Gpyqs49GZe3un1', 'bNtAkD1PtTejGRdnV4WN2kRjTVC2']);
const TOTAL = 100;

// 고정 씨앗 난수 — 다시 돌려도 같은 분포가 나온다
let seed = 20261106;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function int(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }
function won(n) { return n.toLocaleString('ko-KR'); }

const MALLS = ['쿠팡', '11번가', 'G마켓', '알리익스프레스', '아이허브', '무신사'];
const POINT_REASONS = [['쿠팡 구경 출석체크', 10], ['가입 축하 포인트', 500], ['친구초대 보상', 300], ['선물 상자', 50], ['티켓→포인트 교환', 100], ['운영자 지급', 1000]];
const DEBT = (n) => ' 보유하신 티켓이 모자라 ' + n + '장은 회수 예정으로 남았습니다. 다음에 티켓을 받으실 때 자동으로 차감됩니다.';

// 자동 알림 문구 표(CMS NTPL_DEF) 기본 문구와 같은 꼴로 만든다. weight = 비중
const KINDS = [
  { key: 'purchase_pending',   weight: 26, make: () => { const m = pick(MALLS); return [m + ' 구매로 티켓 적립', won(int(8, 180) * 1000) + '원 · 구매 확정 대기']; } },
  { key: 'purchase_confirmed', weight: 22, make: () => { const m = pick(MALLS); return [m + ' 구매로 티켓 적립', won(int(8, 180) * 1000) + '원 · 적립 완료']; } },
  { key: 'point_earn',         weight: 18, make: () => { const r = pick(POINT_REASONS); return [r[0], '+' + won(r[1]) + 'P 적립']; } },
  { key: 'cancel_pre',         weight: 7,  make: () => { const m = pick(MALLS), a = int(10, 120) * 1000;
      const scope = rnd() < 0.6 ? m + ' ' + won(a) + '원 구매 취소' : m + ' ' + won(a) + '원 중 ' + won(Math.round(a * 0.4 / 10) * 10) + '원 취소';
      return ['적립 예정 티켓 취소', scope + ' · 적립 예정이던 랜덤 티켓 ' + int(1, 4) + '장이 취소되었습니다.']; } },
  { key: 'claw_full',          weight: 6,  make: () => { const m = pick(MALLS), a = int(10, 120) * 1000, n = int(1, 3);
      return ['지급 티켓 환수', m + ' ' + won(a) + '원 구매 취소 · 지급된 티켓 ' + n + '장이 환수되었습니다.' + (rnd() < 0.3 ? DEBT(1) : '')]; } },
  { key: 'claw_partial',       weight: 4,  make: () => { const m = pick(MALLS), a = int(30, 150) * 1000;
      return ['지급 티켓 부분 환수', m + ' ' + won(a) + '원 중 ' + won(Math.round(a * 0.3 / 10) * 10) + '원 취소 · 티켓 1장이 환수되었습니다. 남은 ' + int(1, 3) + '장은 그대로 사용하실 수 있습니다.']; } },
  { key: 'gifticon_purchase',  weight: 10, make: () => ['기프티콘 구매 완료', '티켓 ' + int(1, 6) + '장 사용'] },
  { key: 'invite_done',        weight: 4,  make: () => ['친구 초대 완료', '초대 보상 지급'] },
  { key: 'prize_win',          weight: 3,  make: () => ['경품 추첨에 당첨되셨어요!', '당첨을 축하해요! 경품 수령 정보를 1:1 문의로 보내주세요.'] },
];
const FAIL_REASONS = ['기기 토큰 만료', '앱 삭제', '수신 거부', '네트워크 오류'];

function weightedKinds(n) {
  const sum = KINDS.reduce((s, k) => s + k.weight, 0);
  const out = [];
  KINDS.forEach((k) => { for (let i = 0; i < Math.round(k.weight / sum * n); i++) out.push(k); });
  while (out.length < n) out.push(KINDS[0]);
  out.length = n;
  return shuffle(out);
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

async function removeSamples() {
  const snap = await db.collection('notif_logs').where('sample', '==', true).get();
  const docs = snap.docs.filter((d) => d.id.indexOf('sample__') === 0);
  for (let i = 0; i < docs.length; i += 400) {
    const b = db.batch();
    docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    if (!DRY) await b.commit();
  }
  console.log('[remove] 기존 샘플', docs.length, '건' + (DRY ? ' (dry-run, 지우지 않음)' : ' 삭제'));
}

async function main() {
  await removeSamples();
  if (REMOVE) process.exit(0);

  const us = await db.collection('users').get();
  const members = us.docs
    .filter((d) => !REAL_UIDS.has(d.id) && (d.data().status || 'active') !== 'withdrawn')
    .map((d) => ({ id: d.id, nickname: d.data().nickname || '' }));
  if (!members.length) { console.error('회원이 없습니다'); process.exit(1); }
  const noNick = members.filter((m) => !m.nickname);
  console.log('[users] 대상 후보', members.length, '명 (닉네임 없음', noNick.length, '명)');

  const kinds = weightedKinds(TOTAL);
  const results = shuffle([].concat(Array(90).fill('ok'), Array(7).fill('fail'), Array(3).fill('pending')));
  const now = new Date();
  const rows = kinds.map((k, i) => {
    // 최근 14일(오늘 포함). 시각은 한국 10:00~21:59(= 베트남 08:00~19:59) — 어느 쪽 시간대로 봐도
    // 야간 22:00~08:00 에 걸리지 않는다. 오늘이면 지금 시각을 넘지 않게
    let d;
    do {
      d = new Date(now);
      d.setUTCDate(d.getUTCDate() - int(0, 13));
      d.setUTCHours(int(10, 21) - 9, int(0, 59), int(0, 59), 0);
    } while (d > now);
    // 닉네임 없는 회원을 일부러 섞는다(전체의 약 1/8)
    const m = (noNick.length && i % 8 === 3) ? pick(noNick) : pick(members);
    const tb = k.make();
    const result = results[i];
    return {
      id: 'sample__' + String(i + 1).padStart(3, '0'),
      data: {
        user_id: m.id, nickname: m.nickname, item_key: 'sample:' + (i + 1), tpl_key: k.key,
        title: tb[0], body: tb[1], sent_at: Timestamp.fromDate(d),
        result, reason: result === 'fail' ? pick(FAIL_REASONS) : result === 'pending' ? '푸시 토큰 없음' : '',
        logged_at: FieldValue.serverTimestamp(), sample: true,
      },
      _when: d,
    };
  });

  const byKind = {}, byResult = {}, byReason = {}, byDay = {};
  rows.forEach((r) => {
    byKind[r.data.tpl_key] = (byKind[r.data.tpl_key] || 0) + 1;
    byResult[r.data.result] = (byResult[r.data.result] || 0) + 1;
    if (r.data.reason) byReason[r.data.reason] = (byReason[r.data.reason] || 0) + 1;
    const day = new Date(r._when.getTime() + 9 * 3600000).toISOString().slice(0, 10); // 한국 날짜
    byDay[day] = (byDay[day] || 0) + 1;
  });
  console.log(JSON.stringify({ total: rows.length, byKind, byResult, byReason, byDay,
    noNickname: rows.filter((r) => !r.data.nickname).length,
    members: new Set(rows.map((r) => r.data.user_id)).size }, null, 2));

  if (DRY) { console.log('[dry-run] 쓰지 않음'); process.exit(0); }
  const b = db.batch();
  rows.forEach((r) => b.set(db.collection('notif_logs').doc(r.id), r.data));
  await b.commit();
  console.log('[write] notif_logs 샘플', rows.length, '건');
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
