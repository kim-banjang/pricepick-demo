'use strict';
/**
 * PricePick Demo — 기존 탈퇴 회원 데이터를 STG 탈퇴 방식에 맞춘다 (김반장 2026-11-10)
 *
 * STG 백엔드 탈퇴(userService.deleteUser · kakaoInfoClearedFields)는 닉네임·티켓·포인트를 남기고
 * 카카오 정보만 지운다. 데모 앱은 2026-07-10부터 닉네임까지 지워 왔다(app performWithdraw, 이번에 STG와 같게 고침).
 * 이미 탈퇴한 회원(users.status === 'withdrawn')을 다음과 같이 맞춘다.
 *   - 닉네임이 없고 가입일(created_at)이 있는 회원: 앱 가입 화면과 같은 방식(형용사+동물, 겹치면 숫자)으로 채운다.
 *     지워진 원래 닉네임은 되살릴 수 없어 새로 짓는다.
 *   - 카카오 닉네임·카카오 로그인 아이디(이메일)·카카오 회원번호를 지운다.
 *   - 카카오 연동 회원(linked_kakao)은 로그인 아이디(username)를 deleted_<회원id> 로 둔다. 연동 표시는 남긴다.
 *   - 티켓·포인트·상태·탈퇴 일시는 건드리지 않는다.
 * 바꾸기 전 문서 전체를 저장소 밖 백업 파일로 남긴다(--backup 경로, 기본 ~/dev/_backup-withdrawn-users-<날짜>.json).
 *
 * Run:   node scripts/align-withdrawn-to-stg.js --dry-run   (바꿀 내용만 출력)
 *        node scripts/align-withdrawn-to-stg.js             (백업 후 반영)
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DRY = process.argv.includes('--dry-run');
const bi = process.argv.indexOf('--backup');
const BACKUP = bi > 0 ? process.argv[bi + 1]
  : path.join(os.homedir(), 'dev', '_backup-withdrawn-users-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.json');

// ── Auth (seed-additive.js 와 같은 방식) ──
const ft = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
const adcPath = path.join(__dirname, '..', '.adc.json');
fs.writeFileSync(adcPath, JSON.stringify({ type: 'authorized_user',
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token: ft.tokens.refresh_token }));
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
initializeApp({ credential: applicationDefault(), projectId: 'pricepick-demo' });
const db = getFirestore();

// app/index.html NICK_ADJ · NICK_NOUN · randomNickname 과 같은 목록 · 규칙
const NICK_ADJ = ['알뜰한', '똑똑한', '현명한', '부지런한', '센스있는', '꼼꼼한', '씩씩한', '느긋한', '상큼한', '유쾌한', '차분한', '활기찬', '다정한', '재빠른', '당당한'];
const NICK_NOUN = ['판다', '너구리', '다람쥐', '고슴도치', '코알라', '햄스터', '수달', '펭귄', '여우', '고양이', '토끼', '부엉이', '물개', '비버'];
function randomNickname(withNumber) {
  let base = NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)] + NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
  if (withNumber) base += (1 + Math.floor(Math.random() * 98));
  return base;
}
function uniqueNickname(taken) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const c = randomNickname(attempt >= 3);
    if (!taken.has(c)) { taken.add(c); return c; }
  }
  const c = randomNickname(true) + Date.now().toString().slice(-4);
  taken.add(c);
  return c;
}

(async () => {
  const all = await db.collection('users').get();
  const taken = new Set();
  all.forEach((d) => { if (d.data().nickname) taken.add(d.data().nickname); });
  const wd = all.docs.filter((d) => d.data().status === 'withdrawn');

  const plan = wd.map((d) => {
    const u = d.data();
    const upd = {};
    const log = [];
    if (!u.nickname && u.created_at) { upd.nickname = uniqueNickname(taken); log.push('닉네임 ' + upd.nickname); }
    ['kakao_nickname', 'kakao_login_id', 'kakao_id'].forEach((k) => { if (k in u) { upd[k] = FieldValue.delete(); log.push(k + ' 삭제'); } });
    if (u.linked_kakao && u.username !== 'deleted_' + d.id) { upd.username = 'deleted_' + d.id; log.push('username deleted_<id>'); }
    return { id: d.id, before: u, upd, log };
  }).filter((p) => p.log.length);

  plan.forEach((p) => console.log(p.id, '·', p.log.join(' · ')));
  console.log('[plan] 탈퇴 회원', wd.length, '명 중 바꿀 회원', plan.length, '명 · 닉네임 채움',
    plan.filter((p) => p.upd.nickname).length, '명');
  if (DRY) { console.log('[dry-run] 쓰지 않음'); process.exit(0); }

  const ser = (v) => (v && typeof v.toDate === 'function') ? { _ts: v.toDate().toISOString() } : v;
  const backup = wd.map((d) => ({ id: d.id, data: Object.fromEntries(Object.entries(d.data()).map(([k, v]) => [k, ser(v)])) }));
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 1));
  console.log('[backup]', BACKUP, backup.length, '건');

  const b = db.batch();
  plan.forEach((p) => b.set(db.collection('users').doc(p.id), p.upd, { merge: true }));
  await b.commit();
  console.log('[write]', plan.length, '명 반영');
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
