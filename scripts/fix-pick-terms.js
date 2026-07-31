'use strict';
/**
 * PricePick Demo — "픽" 용어 폐기 반영 (2026-07-31, 이동영 부장 요청)
 *
 * seed-demo.js 를 다시 돌리면 데모 데이터 전체가 WIPE 되므로, 이미 시드된
 * Firestore 문서 중 폐기 용어가 박힌 것만 골라 문자열 치환한다.
 * 여러 번 실행해도 결과가 같다(멱등).
 *
 * Run: node scripts/fix-pick-terms.js          (미리보기만)
 *      node scripts/fix-pick-terms.js --apply  (실제 반영)
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

const APPLY = process.argv.includes('--apply');

// 긴 것부터. 치환 후 '픽' 이 남지 않아야 한다(브랜드 '프라이스픽' 제외).
const RULES = [
  ['픽구매 링크를 통해', '바로가기 링크를 통해'],
  ['쿠팡 픽구매 티켓 2배', '쿠팡 구매 티켓 2배'],
  ['쿠팡 경유 픽구매 시', '쿠팡 경유 구매 시'],
  ['지금 픽하고', '지금 구매하고'],
  ['픽구매', '구매'],
];
const FIELDS = ['title', 'content', 'action'];

function fix(v) {
  if (typeof v !== 'string') return v;
  let out = v;
  for (const [a, b] of RULES) out = out.split(a).join(b);
  return out;
}
const leftover = (s) => (s || '').replace(/프라이스픽/g, '').includes('픽');

(async () => {
  let changed = 0, scanned = 0;
  for (const col of ['notices', 'admin_logs']) {
    const snap = await db.collection(col).get();
    for (const doc of snap.docs) {
      scanned++;
      const data = doc.data();
      const patch = {};
      for (const f of FIELDS) {
        if (typeof data[f] !== 'string') continue;
        const next = fix(data[f]);
        if (next !== data[f]) patch[f] = next;
      }
      if (!Object.keys(patch).length) continue;
      changed++;
      console.log(`\n[${col}/${doc.id}]`);
      for (const [f, v] of Object.entries(patch)) {
        console.log(`  - ${f}: ${JSON.stringify(data[f]).slice(0, 160)}`);
        console.log(`  + ${f}: ${JSON.stringify(v).slice(0, 160)}`);
        if (leftover(v)) console.log(`  ! 경고: '픽' 이 남아 있다 — 규칙 보강 필요`);
      }
      if (APPLY) await doc.ref.update(patch);
    }
  }
  console.log(`\n문서 ${scanned}건 검사 · 대상 ${changed}건 · ${APPLY ? '반영 완료' : '미리보기(반영하려면 --apply)'}`);
  process.exit(0);
})();
