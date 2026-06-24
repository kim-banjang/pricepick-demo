'use strict';
/**
 * PricePick Demo — Extended Seed (~20 users, diverse scenarios)
 * Auth: same firebase-tools OAuth2 pattern as seed.js
 *
 * Run: node scripts/seed-extended.js
 *
 * Field naming follows what app+CMS actually query:
 *   users          → linked_kakao(bool), nickname, status, created_at
 *   user_tickets   → user_id, grade, status, created_at
 *   gifticons      → status, required_count, validity_days, emoji
 *   gifticon_exchanges → user_id, gifticon_id, grade_used, count_used, exchanged_at
 *   postbacks      → user_id, purchase_amount, status, created_at
 *   ticket_transactions → user_id, ticket_grade, type, created_at
 *   point_transactions  → user_id, amount, type, reason, created_at
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Auth (same as seed.js) ──
const FIREBASE_TOOLS_CONFIG = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
const FT_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FT_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

let ftConfig;
try {
  ftConfig = JSON.parse(fs.readFileSync(FIREBASE_TOOLS_CONFIG, 'utf8'));
  console.log('[auth]', ftConfig.user.email);
} catch (e) {
  console.error('[auth] Failed:', e.message);
  process.exit(1);
}
const adcPath = path.join(__dirname, '..', '.adc.json');
fs.writeFileSync(adcPath, JSON.stringify({
  type: 'authorized_user',
  client_id: FT_CLIENT_ID,
  client_secret: FT_CLIENT_SECRET,
  refresh_token: ftConfig.tokens.refresh_token,
}));
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
initializeApp({ credential: applicationDefault(), projectId: 'pricepick-demo' });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// ── Helpers ──
const ts  = (d) => Timestamp.fromDate(new Date(d));
const ago = (n) => { const d = new Date(); d.setDate(d.getDate()-n); return Timestamp.fromDate(d); };
const future = (n) => { const d = new Date(); d.setDate(d.getDate()+n); return Timestamp.fromDate(d); };

function greedy(amount) {
  const u = Math.ceil(amount / 5000);
  const g = Math.floor(u / 20);
  const r = u % 20;
  const s = Math.floor(r / 10);
  const b = r % 10;
  return { gold: g, silver: s, bronze: b };
}

// ── Batch write helper ──
async function batchWrite(collection, docsMap) {
  const entries = Object.entries(docsMap);
  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch();
    for (const [id, data] of entries.slice(i, i+400)) {
      batch.set(db.collection(collection).doc(id), data);
    }
    await batch.commit();
  }
  console.log(`  [OK] ${collection}: ${entries.length}건`);
}

// ═══════════════════════════════════════════════════════
// DATA DEFINITIONS
// ═══════════════════════════════════════════════════════

// ── 2 new cheap gifticons for demo exchanges ──
const NEW_GIFTICONS = {
  'gif-ediya-2000': {
    category: '카페', brand: '이디야커피', name: '이디야 아메리카노',
    emoji: '☕', product_code: 'EDIYA-AMR-001', price: 2000,
    required_grade: 'bronze', required_count: 2,
    validity_days: 30, status: 'active',
    sale_end_at: null, created_at: ts('2026-03-01'),
  },
  'gif-gs25-3000': {
    category: '편의점', brand: 'GS25', name: 'GS25 3,000원 금액권',
    emoji: '🏬', product_code: 'GS25-3000-001', price: 3000,
    required_grade: 'bronze', required_count: 3,
    validity_days: 30, status: 'active',
    sale_end_at: null, created_at: ts('2026-03-01'),
  },
};

// ── Patch existing gifticons to add validity_days field ──
const EXISTING_GIFTICON_PATCH = {
  'gif-starbucks-4500': { validity_days: 30 },
  'gif-cu-3000':        { validity_days: 30 },
  'gif-baemin-10000':   { validity_days: 30 },
};

// ────────────────────────────────────────────
// USERS (15 new)
// ────────────────────────────────────────────
const USERS = {
  // Active + linked (카카오 연동) — 10명
  'user-frank-001':  { nickname: '프랭크',     linked_kakao: true,  status: 'active',    created_at: ts('2026-01-15'), updated_at: ts('2026-06-20') },
  'user-grace-001':  { nickname: '그레이스',   linked_kakao: true,  status: 'active',    created_at: ts('2026-02-20'), updated_at: ts('2026-06-18') },
  'user-henry-001':  { nickname: '헨리',       linked_kakao: true,  status: 'active',    created_at: ts('2026-03-05'), updated_at: ts('2026-06-15') },
  'user-iris-001':   { nickname: '아이리스',   linked_kakao: true,  status: 'active',    created_at: ts('2026-03-20'), updated_at: ts('2026-06-10') },
  'user-jake-001':   { nickname: '제이크',     linked_kakao: true,  status: 'active',    created_at: ts('2026-04-01'), updated_at: ts('2026-06-05') },
  'user-kate-001':   { nickname: '케이트',     linked_kakao: true,  status: 'active',    created_at: ts('2026-04-15'), updated_at: ts('2026-06-01') },
  'user-leo-001':    { nickname: '레오',       linked_kakao: true,  status: 'active',    created_at: ts('2026-05-01'), updated_at: ts('2026-06-22') },
  'user-mia-001':    { nickname: '미아',       linked_kakao: true,  status: 'active',    created_at: ts('2026-05-10'), updated_at: ts('2026-06-20') },
  'user-noah-001':   { nickname: '노아',       linked_kakao: true,  status: 'active',    created_at: ts('2026-06-01'), updated_at: ts('2026-06-21') },
  'user-olivia-001': { nickname: '올리비아',   linked_kakao: true,  status: 'active',    created_at: ts('2026-06-10'), updated_at: ts('2026-06-22') },
  // Active + guest (게스트) — 2명
  'user-peter-001':  { nickname: '피터(게스트)',  linked_kakao: false, status: 'active',  created_at: ts('2026-06-15'), updated_at: ts('2026-06-15') },
  'user-quinn-001':  { nickname: '퀸(게스트)',    linked_kakao: false, status: 'active',  created_at: ts('2026-06-20'), updated_at: ts('2026-06-20') },
  // Suspended — 2명
  'user-ryan-001':   { nickname: '라이언',     linked_kakao: true,  status: 'suspended', created_at: ts('2026-03-10'), updated_at: ts('2026-06-18') },
  'user-sara-001':   { nickname: '사라',       linked_kakao: true,  status: 'suspended', created_at: ts('2026-04-05'), updated_at: ts('2026-06-19') },
  // Withdrawn — 1명
  'user-tom-001':    { nickname: '탈퇴회원',    linked_kakao: true,  status: 'withdrawn', created_at: ts('2026-02-01'), updated_at: ts('2026-06-01') },
};

// ────────────────────────────────────────────
// POSTBACKS
// 필드: user_id, mall_name, mall_domain, purchase_amount, status, created_at, confirmed_at
// ────────────────────────────────────────────
const POSTBACKS = {
  // Frank: 150k×2 confirmed
  'pb-frank-001': { user_id:'user-frank-001', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:150000, status:'confirmed', created_at:ago(60), confirmed_at:ago(53) },
  'pb-frank-002': { user_id:'user-frank-001', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:150000, status:'confirmed', created_at:ago(30), confirmed_at:ago(23) },
  // Grace: 67k + 25k confirmed
  'pb-grace-001': { user_id:'user-grace-001', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:67000,  status:'confirmed', created_at:ago(45), confirmed_at:ago(38) },
  'pb-grace-002': { user_id:'user-grace-001', mall_name:'11번가', mall_domain:'11st.co.kr',  purchase_amount:25000,  status:'confirmed', created_at:ago(20), confirmed_at:ago(13) },
  // Henry: 67k confirmed
  'pb-henry-001': { user_id:'user-henry-001', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:67000,  status:'confirmed', created_at:ago(35), confirmed_at:ago(28) },
  // Iris: 100k confirmed
  'pb-iris-001':  { user_id:'user-iris-001',  mall_name:'G마켓', mall_domain:'gmarket.co.kr', purchase_amount:100000, status:'confirmed', created_at:ago(20), confirmed_at:ago(13) },
  // Jake: 67k PENDING (게스트는 D+30, 연동은 D+7이지만 데모용)
  'pb-jake-001':  { user_id:'user-jake-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:67000,  status:'pending',    created_at:ago(3),  confirmed_at:null },
  // Kate: 50k confirmed + 100k refunded
  'pb-kate-001':  { user_id:'user-kate-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:50000,  status:'confirmed',  created_at:ago(40), confirmed_at:ago(33) },
  'pb-kate-002':  { user_id:'user-kate-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:100000, status:'refunded',   created_at:ago(25), confirmed_at:ago(18) },
  // Leo: 200k + 100k confirmed
  'pb-leo-001':   { user_id:'user-leo-001',   mall_name:'11번가', mall_domain:'11st.co.kr',  purchase_amount:200000, status:'confirmed',  created_at:ago(50), confirmed_at:ago(43) },
  'pb-leo-002':   { user_id:'user-leo-001',   mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:100000, status:'confirmed',  created_at:ago(20), confirmed_at:ago(13) },
  // Mia: 50k (expired purchase, long ago) + 25k confirmed
  'pb-mia-001':   { user_id:'user-mia-001',   mall_name:'G마켓', mall_domain:'gmarket.co.kr', purchase_amount:50000,  status:'confirmed',  created_at:ago(370), confirmed_at:ago(363) },
  'pb-mia-002':   { user_id:'user-mia-001',   mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:25000,  status:'confirmed',  created_at:ago(15), confirmed_at:ago(8) },
  // Noah: 10k confirmed
  'pb-noah-001':  { user_id:'user-noah-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:10000,  status:'confirmed',  created_at:ago(10), confirmed_at:ago(3) },
  // Olivia: 200k×2 confirmed
  'pb-olivia-001':{ user_id:'user-olivia-001',mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:200000, status:'confirmed',  created_at:ago(40), confirmed_at:ago(33) },
  'pb-olivia-002':{ user_id:'user-olivia-001',mall_name:'11번가', mall_domain:'11st.co.kr',  purchase_amount:200000, status:'confirmed',  created_at:ago(15), confirmed_at:ago(8) },
  // Peter: 50k pending (게스트)
  'pb-peter-001': { user_id:'user-peter-001', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:50000,  status:'pending',    created_at:ago(5),  confirmed_at:null },
  // Ryan (suspended): 50k + 100k confirmed
  'pb-ryan-001':  { user_id:'user-ryan-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:50000,  status:'confirmed',  created_at:ago(55), confirmed_at:ago(48) },
  'pb-ryan-002':  { user_id:'user-ryan-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:100000, status:'confirmed',  created_at:ago(40), confirmed_at:ago(33) },
  // Sara (suspended): 25k confirmed
  'pb-sara-001':  { user_id:'user-sara-001',  mall_name:'11번가', mall_domain:'11st.co.kr',  purchase_amount:25000,  status:'confirmed',  created_at:ago(30), confirmed_at:ago(23) },
};

// ────────────────────────────────────────────
// CLICK LOGS (one per postback)
// ────────────────────────────────────────────
const CLICK_LOGS = {
  'cl-frank-001': { user_id:'user-frank-001', mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(60) },
  'cl-frank-002': { user_id:'user-frank-001', mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(30) },
  'cl-grace-001': { user_id:'user-grace-001', mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(45) },
  'cl-grace-002': { user_id:'user-grace-001', mall_name:'11번가', mall_domain:'11st.co.kr',  clicked_at:ago(20) },
  'cl-henry-001': { user_id:'user-henry-001', mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(35) },
  'cl-iris-001':  { user_id:'user-iris-001',  mall_name:'G마켓', mall_domain:'gmarket.co.kr', clicked_at:ago(20) },
  'cl-jake-001':  { user_id:'user-jake-001',  mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(3)  },
  'cl-kate-001':  { user_id:'user-kate-001',  mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(40) },
  'cl-kate-002':  { user_id:'user-kate-001',  mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(25) },
  'cl-leo-001':   { user_id:'user-leo-001',   mall_name:'11번가', mall_domain:'11st.co.kr',  clicked_at:ago(50) },
  'cl-leo-002':   { user_id:'user-leo-001',   mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(20) },
  'cl-mia-001':   { user_id:'user-mia-001',   mall_name:'G마켓', mall_domain:'gmarket.co.kr', clicked_at:ago(370) },
  'cl-mia-002':   { user_id:'user-mia-001',   mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(15) },
  'cl-noah-001':  { user_id:'user-noah-001',  mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(10) },
  'cl-olivia-001':{ user_id:'user-olivia-001',mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(40) },
  'cl-olivia-002':{ user_id:'user-olivia-001',mall_name:'11번가', mall_domain:'11st.co.kr',  clicked_at:ago(15) },
  'cl-peter-001': { user_id:'user-peter-001', mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(5)  },
  'cl-ryan-001':  { user_id:'user-ryan-001',  mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(55) },
  'cl-ryan-002':  { user_id:'user-ryan-001',  mall_name:'쿠팡', mall_domain:'coupang.com', clicked_at:ago(40) },
  'cl-sara-001':  { user_id:'user-sara-001',  mall_name:'11번가', mall_domain:'11st.co.kr',  clicked_at:ago(30) },
};

// ────────────────────────────────────────────
// CLICK POSTBACK MATCHES
// ────────────────────────────────────────────
const CPM = {
  'cpm-frank-001': { user_id:'user-frank-001', click_id:'cl-frank-001', postback_id:'pb-frank-001', created_at:ago(60) },
  'cpm-frank-002': { user_id:'user-frank-001', click_id:'cl-frank-002', postback_id:'pb-frank-002', created_at:ago(30) },
  'cpm-grace-001': { user_id:'user-grace-001', click_id:'cl-grace-001', postback_id:'pb-grace-001', created_at:ago(45) },
  'cpm-grace-002': { user_id:'user-grace-001', click_id:'cl-grace-002', postback_id:'pb-grace-002', created_at:ago(20) },
  'cpm-henry-001': { user_id:'user-henry-001', click_id:'cl-henry-001', postback_id:'pb-henry-001', created_at:ago(35) },
  'cpm-iris-001':  { user_id:'user-iris-001',  click_id:'cl-iris-001',  postback_id:'pb-iris-001',  created_at:ago(20) },
  'cpm-jake-001':  { user_id:'user-jake-001',  click_id:'cl-jake-001',  postback_id:'pb-jake-001',  created_at:ago(3)  },
  'cpm-kate-001':  { user_id:'user-kate-001',  click_id:'cl-kate-001',  postback_id:'pb-kate-001',  created_at:ago(40) },
  'cpm-kate-002':  { user_id:'user-kate-001',  click_id:'cl-kate-002',  postback_id:'pb-kate-002',  created_at:ago(25) },
  'cpm-leo-001':   { user_id:'user-leo-001',   click_id:'cl-leo-001',   postback_id:'pb-leo-001',   created_at:ago(50) },
  'cpm-leo-002':   { user_id:'user-leo-001',   click_id:'cl-leo-002',   postback_id:'pb-leo-002',   created_at:ago(20) },
  'cpm-mia-001':   { user_id:'user-mia-001',   click_id:'cl-mia-001',   postback_id:'pb-mia-001',   created_at:ago(370) },
  'cpm-mia-002':   { user_id:'user-mia-001',   click_id:'cl-mia-002',   postback_id:'pb-mia-002',   created_at:ago(15) },
  'cpm-noah-001':  { user_id:'user-noah-001',  click_id:'cl-noah-001',  postback_id:'pb-noah-001',  created_at:ago(10) },
  'cpm-olivia-001':{ user_id:'user-olivia-001',click_id:'cl-olivia-001',postback_id:'pb-olivia-001',created_at:ago(40) },
  'cpm-olivia-002':{ user_id:'user-olivia-001',click_id:'cl-olivia-002',postback_id:'pb-olivia-002',created_at:ago(15) },
  'cpm-peter-001': { user_id:'user-peter-001', click_id:'cl-peter-001', postback_id:'pb-peter-001', created_at:ago(5)  },
  'cpm-ryan-001':  { user_id:'user-ryan-001',  click_id:'cl-ryan-001',  postback_id:'pb-ryan-001',  created_at:ago(55) },
  'cpm-ryan-002':  { user_id:'user-ryan-001',  click_id:'cl-ryan-002',  postback_id:'pb-ryan-002',  created_at:ago(40) },
  'cpm-sara-001':  { user_id:'user-sara-001',  click_id:'cl-sara-001',  postback_id:'pb-sara-001',  created_at:ago(30) },
};

// ────────────────────────────────────────────
// USER TICKETS (individual docs, grade field)
// Greedy: 150k→gold1+silver1 / 67k→silver1+bronze4 / 25k→bronze5
//          100k→gold1 / 200k→gold2 / 50k→silver1 / 10k→bronze2
// ────────────────────────────────────────────
function tkt(id, uid, grade, status, postback_id, earned_at, confirmed_at, expires_at) {
  return [id, { user_id:uid, grade, status, postback_id, earned_at, confirmed_at, expires_at, created_at:earned_at }];
}

const TKT_RAW = [
  // Frank: 150k×2 → 2 gold + 2 silver (all active)
  tkt('tk-frank-01','user-frank-001','gold',  'active','pb-frank-001', ago(60), ago(53), future(305)),
  tkt('tk-frank-02','user-frank-001','silver','active','pb-frank-001', ago(60), ago(53), future(305)),
  tkt('tk-frank-03','user-frank-001','gold',  'active','pb-frank-002', ago(30), ago(23), future(335)),
  tkt('tk-frank-04','user-frank-001','silver','active','pb-frank-002', ago(30), ago(23), future(335)),

  // Grace: 67k→(silver1+bronze4) + 25k→bronze5 → 2 bronze used(exchange), rest active
  // 67k purchase: silver 1 + bronze 4
  tkt('tk-grace-01','user-grace-001','silver','active','pb-grace-001', ago(45), ago(38), future(320)),
  tkt('tk-grace-02','user-grace-001','bronze','active','pb-grace-001', ago(45), ago(38), future(320)),
  tkt('tk-grace-03','user-grace-001','bronze','active','pb-grace-001', ago(45), ago(38), future(320)),
  tkt('tk-grace-04','user-grace-001','bronze','used',  'pb-grace-001', ago(45), ago(38), future(320)), // 교환에 사용
  tkt('tk-grace-05','user-grace-001','bronze','used',  'pb-grace-001', ago(45), ago(38), future(320)), // 교환에 사용
  // 25k purchase: bronze 5 (모두 active)
  tkt('tk-grace-06','user-grace-001','bronze','active','pb-grace-002', ago(20), ago(13), future(350)),
  tkt('tk-grace-07','user-grace-001','bronze','active','pb-grace-002', ago(20), ago(13), future(350)),
  tkt('tk-grace-08','user-grace-001','bronze','active','pb-grace-002', ago(20), ago(13), future(350)),
  tkt('tk-grace-09','user-grace-001','bronze','active','pb-grace-002', ago(20), ago(13), future(350)),
  tkt('tk-grace-10','user-grace-001','bronze','active','pb-grace-002', ago(20), ago(13), future(350)),

  // Henry: 67k→silver1+bronze4, 2 bronze used(exchange), rest active
  tkt('tk-henry-01','user-henry-001','silver','active','pb-henry-001', ago(35), ago(28), future(330)),
  tkt('tk-henry-02','user-henry-001','bronze','active','pb-henry-001', ago(35), ago(28), future(330)),
  tkt('tk-henry-03','user-henry-001','bronze','active','pb-henry-001', ago(35), ago(28), future(330)),
  tkt('tk-henry-04','user-henry-001','bronze','used',  'pb-henry-001', ago(35), ago(28), future(330)), // 교환
  tkt('tk-henry-05','user-henry-001','bronze','used',  'pb-henry-001', ago(35), ago(28), future(330)), // 교환

  // Iris: 100k→gold1 (active)
  tkt('tk-iris-01','user-iris-001','gold','active','pb-iris-001', ago(20), ago(13), future(350)),

  // Jake: 67k PENDING (postback미확정)
  tkt('tk-jake-01','user-jake-001','silver','pending','pb-jake-001', ago(3), null, future(362)),
  tkt('tk-jake-02','user-jake-001','bronze','pending','pb-jake-001', ago(3), null, future(362)),
  tkt('tk-jake-03','user-jake-001','bronze','pending','pb-jake-001', ago(3), null, future(362)),
  tkt('tk-jake-04','user-jake-001','bronze','pending','pb-jake-001', ago(3), null, future(362)),
  tkt('tk-jake-05','user-jake-001','bronze','pending','pb-jake-001', ago(3), null, future(362)),

  // Kate: 50k→silver1 active / 100k→gold1 refunded→clawback(status:used)
  tkt('tk-kate-01','user-kate-001','silver','active','pb-kate-001', ago(40), ago(33), future(325)),
  tkt('tk-kate-02','user-kate-001','gold',  'used',  'pb-kate-002', ago(25), ago(18), future(340)), // clawback

  // Leo: 200k→gold2 / 100k→gold1 = 총 3 gold (all active)
  tkt('tk-leo-01','user-leo-001','gold','active','pb-leo-001', ago(50), ago(43), future(315)),
  tkt('tk-leo-02','user-leo-001','gold','active','pb-leo-001', ago(50), ago(43), future(315)),
  tkt('tk-leo-03','user-leo-001','gold','active','pb-leo-002', ago(20), ago(13), future(345)),

  // Mia: 50k(370일 전)→silver1 expired / 25k→bronze5 active
  tkt('tk-mia-01','user-mia-001','silver','expired','pb-mia-001', ago(370), ago(363), ago(5)),
  tkt('tk-mia-02','user-mia-001','bronze','active', 'pb-mia-002', ago(15),  ago(8),   future(350)),
  tkt('tk-mia-03','user-mia-001','bronze','active', 'pb-mia-002', ago(15),  ago(8),   future(350)),
  tkt('tk-mia-04','user-mia-001','bronze','active', 'pb-mia-002', ago(15),  ago(8),   future(350)),
  tkt('tk-mia-05','user-mia-001','bronze','active', 'pb-mia-002', ago(15),  ago(8),   future(350)),
  tkt('tk-mia-06','user-mia-001','bronze','active', 'pb-mia-002', ago(15),  ago(8),   future(350)),

  // Noah: 10k→bronze2 active
  tkt('tk-noah-01','user-noah-001','bronze','active','pb-noah-001', ago(10), ago(3), future(355)),
  tkt('tk-noah-02','user-noah-001','bronze','active','pb-noah-001', ago(10), ago(3), future(355)),

  // Olivia: 200k×2→gold4 active
  tkt('tk-olivia-01','user-olivia-001','gold','active','pb-olivia-001', ago(40), ago(33), future(325)),
  tkt('tk-olivia-02','user-olivia-001','gold','active','pb-olivia-001', ago(40), ago(33), future(325)),
  tkt('tk-olivia-03','user-olivia-001','gold','active','pb-olivia-002', ago(15), ago(8),  future(350)),
  tkt('tk-olivia-04','user-olivia-001','gold','active','pb-olivia-002', ago(15), ago(8),  future(350)),

  // Peter (게스트): 50k→silver1 pending
  tkt('tk-peter-01','user-peter-001','silver','pending','pb-peter-001', ago(5), null, future(360)),

  // Ryan (suspended): 50k→silver1 + 100k→gold1 (active, 정지여도 티켓은 유지)
  tkt('tk-ryan-01','user-ryan-001','silver','active','pb-ryan-001', ago(55), ago(48), future(310)),
  tkt('tk-ryan-02','user-ryan-001','gold',  'active','pb-ryan-002', ago(40), ago(33), future(325)),

  // Sara (suspended): 25k→bronze5 active
  tkt('tk-sara-01','user-sara-001','bronze','active','pb-sara-001', ago(30), ago(23), future(335)),
  tkt('tk-sara-02','user-sara-001','bronze','active','pb-sara-001', ago(30), ago(23), future(335)),
  tkt('tk-sara-03','user-sara-001','bronze','active','pb-sara-001', ago(30), ago(23), future(335)),
  tkt('tk-sara-04','user-sara-001','bronze','active','pb-sara-001', ago(30), ago(23), future(335)),
  tkt('tk-sara-05','user-sara-001','bronze','active','pb-sara-001', ago(30), ago(23), future(335)),
];
const USER_TICKETS = Object.fromEntries(TKT_RAW);

// ────────────────────────────────────────────
// TICKET TRANSACTIONS (immutable ledger)
// type: 'earn' | 'use' | 'expire' | 'clawback'
// ────────────────────────────────────────────
const TICKET_TX = {
  // Frank
  'ttx-frank-01': { user_id:'user-frank-001', ticket_grade:'gold',   type:'earn', postback_id:'pb-frank-001', created_at:ago(53) },
  'ttx-frank-02': { user_id:'user-frank-001', ticket_grade:'silver', type:'earn', postback_id:'pb-frank-001', created_at:ago(53) },
  'ttx-frank-03': { user_id:'user-frank-001', ticket_grade:'gold',   type:'earn', postback_id:'pb-frank-002', created_at:ago(23) },
  'ttx-frank-04': { user_id:'user-frank-001', ticket_grade:'silver', type:'earn', postback_id:'pb-frank-002', created_at:ago(23) },
  // Grace: 67k(silver+4bronze) + 25k(5bronze), 2 bronze used
  'ttx-grace-01': { user_id:'user-grace-001', ticket_grade:'silver', type:'earn', postback_id:'pb-grace-001', created_at:ago(38) },
  'ttx-grace-02': { user_id:'user-grace-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-grace-001', created_at:ago(38) },
  'ttx-grace-03': { user_id:'user-grace-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-grace-001', created_at:ago(38) },
  'ttx-grace-04': { user_id:'user-grace-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-grace-001', created_at:ago(38) },
  'ttx-grace-05': { user_id:'user-grace-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-grace-001', created_at:ago(38) },
  'ttx-grace-06': { user_id:'user-grace-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-grace-002', created_at:ago(13) },
  'ttx-grace-07': { user_id:'user-grace-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-grace-002', created_at:ago(13) },
  'ttx-grace-08': { user_id:'user-grace-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-grace-002', created_at:ago(13) },
  'ttx-grace-09': { user_id:'user-grace-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-grace-002', created_at:ago(13) },
  'ttx-grace-10': { user_id:'user-grace-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-grace-002', created_at:ago(13) },
  'ttx-grace-11': { user_id:'user-grace-001', ticket_grade:'bronze', type:'use',  gifticon_id:'gif-ediya-2000', created_at:ago(25) },
  'ttx-grace-12': { user_id:'user-grace-001', ticket_grade:'bronze', type:'use',  gifticon_id:'gif-ediya-2000', created_at:ago(25) },
  // Henry: 67k(silver+4bronze), 2 bronze used
  'ttx-henry-01': { user_id:'user-henry-001', ticket_grade:'silver', type:'earn', postback_id:'pb-henry-001', created_at:ago(28) },
  'ttx-henry-02': { user_id:'user-henry-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-henry-001', created_at:ago(28) },
  'ttx-henry-03': { user_id:'user-henry-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-henry-001', created_at:ago(28) },
  'ttx-henry-04': { user_id:'user-henry-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-henry-001', created_at:ago(28) },
  'ttx-henry-05': { user_id:'user-henry-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-henry-001', created_at:ago(28) },
  'ttx-henry-06': { user_id:'user-henry-001', ticket_grade:'bronze', type:'use',  gifticon_id:'gif-gs25-3000', created_at:ago(20) },
  'ttx-henry-07': { user_id:'user-henry-001', ticket_grade:'bronze', type:'use',  gifticon_id:'gif-gs25-3000', created_at:ago(20) },
  // Iris
  'ttx-iris-01':  { user_id:'user-iris-001',  ticket_grade:'gold',   type:'earn', postback_id:'pb-iris-001',  created_at:ago(13) },
  // Jake (pending — 티켓 미확정이지만 TX는 생성됨)
  'ttx-jake-01':  { user_id:'user-jake-001',  ticket_grade:'silver', type:'earn', postback_id:'pb-jake-001',  created_at:ago(3) },
  'ttx-jake-02':  { user_id:'user-jake-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-jake-001',  created_at:ago(3) },
  'ttx-jake-03':  { user_id:'user-jake-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-jake-001',  created_at:ago(3) },
  'ttx-jake-04':  { user_id:'user-jake-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-jake-001',  created_at:ago(3) },
  'ttx-jake-05':  { user_id:'user-jake-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-jake-001',  created_at:ago(3) },
  // Kate: 50k→silver(earn) + 100k→gold(earn, then clawback)
  'ttx-kate-01':  { user_id:'user-kate-001',  ticket_grade:'silver', type:'earn',     postback_id:'pb-kate-001', created_at:ago(33) },
  'ttx-kate-02':  { user_id:'user-kate-001',  ticket_grade:'gold',   type:'earn',     postback_id:'pb-kate-002', created_at:ago(18) },
  'ttx-kate-03':  { user_id:'user-kate-001',  ticket_grade:'gold',   type:'clawback', postback_id:'pb-kate-002', created_at:ago(10) },
  // Leo
  'ttx-leo-01':   { user_id:'user-leo-001',   ticket_grade:'gold',   type:'earn', postback_id:'pb-leo-001', created_at:ago(43) },
  'ttx-leo-02':   { user_id:'user-leo-001',   ticket_grade:'gold',   type:'earn', postback_id:'pb-leo-001', created_at:ago(43) },
  'ttx-leo-03':   { user_id:'user-leo-001',   ticket_grade:'gold',   type:'earn', postback_id:'pb-leo-002', created_at:ago(13) },
  // Mia: 50k silver expired + 25k bronze5 active
  'ttx-mia-01':   { user_id:'user-mia-001',   ticket_grade:'silver', type:'earn',   postback_id:'pb-mia-001', created_at:ago(363) },
  'ttx-mia-02':   { user_id:'user-mia-001',   ticket_grade:'silver', type:'expire', postback_id:'pb-mia-001', created_at:ago(5) },
  'ttx-mia-03':   { user_id:'user-mia-001',   ticket_grade:'bronze', type:'earn',   postback_id:'pb-mia-002', created_at:ago(8) },
  'ttx-mia-04':   { user_id:'user-mia-001',   ticket_grade:'bronze', type:'earn',   postback_id:'pb-mia-002', created_at:ago(8) },
  'ttx-mia-05':   { user_id:'user-mia-001',   ticket_grade:'bronze', type:'earn',   postback_id:'pb-mia-002', created_at:ago(8) },
  'ttx-mia-06':   { user_id:'user-mia-001',   ticket_grade:'bronze', type:'earn',   postback_id:'pb-mia-002', created_at:ago(8) },
  'ttx-mia-07':   { user_id:'user-mia-001',   ticket_grade:'bronze', type:'earn',   postback_id:'pb-mia-002', created_at:ago(8) },
  // Noah
  'ttx-noah-01':  { user_id:'user-noah-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-noah-001', created_at:ago(3) },
  'ttx-noah-02':  { user_id:'user-noah-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-noah-001', created_at:ago(3) },
  // Olivia
  'ttx-olivia-01':{ user_id:'user-olivia-001',ticket_grade:'gold',   type:'earn', postback_id:'pb-olivia-001', created_at:ago(33) },
  'ttx-olivia-02':{ user_id:'user-olivia-001',ticket_grade:'gold',   type:'earn', postback_id:'pb-olivia-001', created_at:ago(33) },
  'ttx-olivia-03':{ user_id:'user-olivia-001',ticket_grade:'gold',   type:'earn', postback_id:'pb-olivia-002', created_at:ago(8) },
  'ttx-olivia-04':{ user_id:'user-olivia-001',ticket_grade:'gold',   type:'earn', postback_id:'pb-olivia-002', created_at:ago(8) },
  // Peter (pending)
  'ttx-peter-01': { user_id:'user-peter-001', ticket_grade:'silver', type:'earn', postback_id:'pb-peter-001', created_at:ago(5) },
  // Ryan
  'ttx-ryan-01':  { user_id:'user-ryan-001',  ticket_grade:'silver', type:'earn', postback_id:'pb-ryan-001', created_at:ago(48) },
  'ttx-ryan-02':  { user_id:'user-ryan-001',  ticket_grade:'gold',   type:'earn', postback_id:'pb-ryan-002', created_at:ago(33) },
  // Sara
  'ttx-sara-01':  { user_id:'user-sara-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-sara-001', created_at:ago(23) },
  'ttx-sara-02':  { user_id:'user-sara-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-sara-001', created_at:ago(23) },
  'ttx-sara-03':  { user_id:'user-sara-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-sara-001', created_at:ago(23) },
  'ttx-sara-04':  { user_id:'user-sara-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-sara-001', created_at:ago(23) },
  'ttx-sara-05':  { user_id:'user-sara-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-sara-001', created_at:ago(23) },
};

// ────────────────────────────────────────────
// USER POINTS (balance = sum of point_transactions)
// ────────────────────────────────────────────
// frank: 300(referral) + 200(attendance) = 500
// grace: 200(attendance) = 200
// henry: 500(exchange_bonus) + 300(referral) + 200(attendance) = 1000
// iris: 300(referral) = 300
// jake: 50(attendance) = 50
// kate: 0
// leo: 200(attendance) + 200(daily_visit) = 400
// mia: 100(daily_visit) = 100
// noah: 50(attendance) = 50
// olivia: 500(referral) + 500(attendance) + 500(daily_visit) = 1500
// peter: 0 / quinn: 0 / ryan: 0 / sara: 0 / tom: 0
const USER_POINTS = {
  'user-frank-001':  { user_id:'user-frank-001',  balance:500,  updated_at:ago(1),  created_at:ts('2026-01-15') },
  'user-grace-001':  { user_id:'user-grace-001',  balance:200,  updated_at:ago(2),  created_at:ts('2026-02-20') },
  'user-henry-001':  { user_id:'user-henry-001',  balance:1000, updated_at:ago(5),  created_at:ts('2026-03-05') },
  'user-iris-001':   { user_id:'user-iris-001',   balance:300,  updated_at:ago(10), created_at:ts('2026-03-20') },
  'user-jake-001':   { user_id:'user-jake-001',   balance:50,   updated_at:ago(3),  created_at:ts('2026-04-01') },
  'user-kate-001':   { user_id:'user-kate-001',   balance:0,    updated_at:ago(20), created_at:ts('2026-04-15') },
  'user-leo-001':    { user_id:'user-leo-001',    balance:400,  updated_at:ago(1),  created_at:ts('2026-05-01') },
  'user-mia-001':    { user_id:'user-mia-001',    balance:100,  updated_at:ago(5),  created_at:ts('2026-05-10') },
  'user-noah-001':   { user_id:'user-noah-001',   balance:50,   updated_at:ago(5),  created_at:ts('2026-06-01') },
  'user-olivia-001': { user_id:'user-olivia-001', balance:1500, updated_at:ago(1),  created_at:ts('2026-06-10') },
  'user-peter-001':  { user_id:'user-peter-001',  balance:0,    updated_at:ago(5),  created_at:ts('2026-06-15') },
  'user-quinn-001':  { user_id:'user-quinn-001',  balance:0,    updated_at:ago(2),  created_at:ts('2026-06-20') },
  'user-ryan-001':   { user_id:'user-ryan-001',   balance:0,    updated_at:ago(20), created_at:ts('2026-03-10') },
  'user-sara-001':   { user_id:'user-sara-001',   balance:0,    updated_at:ago(15), created_at:ts('2026-04-05') },
  'user-tom-001':    { user_id:'user-tom-001',    balance:0,    updated_at:ago(20), created_at:ts('2026-02-01') },
};

// ────────────────────────────────────────────
// POINT TRANSACTIONS (immutable ledger)
// balance 정합성: sum of amount per user = balance above
// ────────────────────────────────────────────
const POINT_TX = {
  'ptx-frank-01':  { user_id:'user-frank-001',  amount:300,  type:'referral',    reason:'user-iris-001 초대 보상',     created_at:ago(55) },
  'ptx-frank-02':  { user_id:'user-frank-001',  amount:200,  type:'attendance',  reason:'출석 보상',                   created_at:ago(30) },
  'ptx-grace-01':  { user_id:'user-grace-001',  amount:200,  type:'attendance',  reason:'출석 보상',                   created_at:ago(40) },
  'ptx-henry-01':  { user_id:'user-henry-001',  amount:500,  type:'exchange',    reason:'기프티콘 교환 보너스',          created_at:ago(20) },
  'ptx-henry-02':  { user_id:'user-henry-001',  amount:300,  type:'referral',    reason:'user-frank-001 초대 보상',    created_at:ago(30) },
  'ptx-henry-03':  { user_id:'user-henry-001',  amount:200,  type:'attendance',  reason:'출석 보상',                   created_at:ago(25) },
  'ptx-iris-01':   { user_id:'user-iris-001',   amount:300,  type:'referral',    reason:'user-noah-001 초대 보상',     created_at:ago(15) },
  'ptx-jake-01':   { user_id:'user-jake-001',   amount:50,   type:'attendance',  reason:'첫 출석 보상',                 created_at:ago(3)  },
  'ptx-leo-01':    { user_id:'user-leo-001',    amount:200,  type:'attendance',  reason:'출석 보상',                   created_at:ago(40) },
  'ptx-leo-02':    { user_id:'user-leo-001',    amount:200,  type:'daily_visit', reason:'일일 방문 보상',               created_at:ago(2)  },
  'ptx-mia-01':    { user_id:'user-mia-001',    amount:100,  type:'daily_visit', reason:'일일 방문 보상',               created_at:ago(5)  },
  'ptx-noah-01':   { user_id:'user-noah-001',   amount:50,   type:'attendance',  reason:'첫 출석 보상',                 created_at:ago(5)  },
  'ptx-olivia-01': { user_id:'user-olivia-001', amount:500,  type:'referral',    reason:'user-quinn-001 초대 보상',    created_at:ago(10) },
  'ptx-olivia-02': { user_id:'user-olivia-001', amount:500,  type:'attendance',  reason:'출석 보상',                   created_at:ago(35) },
  'ptx-olivia-03': { user_id:'user-olivia-001', amount:500,  type:'daily_visit', reason:'일일 방문 보상',               created_at:ago(2)  },
};

// ────────────────────────────────────────────
// GIFTICON EXCHANGES
// grace → gif-ediya-2000 (bronze 2장)
// henry → gif-gs25-3000  (bronze 2장 — wait, gs25 needs 3장)
// Fix: henry exchanges 3 bronze (has 4 bronze earned, only 4 used 2... let me check)
// Actually henry: earned silver1+bronze4, used 2 bronze in tickets
// So henry uses 2 bronze for ediya-2000 (requires 2 bronze)
// and grace uses 2 bronze for ediya-2000
// Let me give henry gif-ediya-2000 (2 bronze) too, or use different gifticon
// Grace: 2 bronze for gif-ediya-2000
// Henry: 2 bronze for gif-ediya-2000 (different exchange)
// ────────────────────────────────────────────
const GIFTICON_EXCHANGES = {
  'ex-grace-001': {
    user_id: 'user-grace-001', gifticon_id: 'gif-ediya-2000',
    grade_used: 'bronze', count_used: 2,
    status: 'completed', exchanged_at: ago(25),
  },
  'ex-henry-001': {
    user_id: 'user-henry-001', gifticon_id: 'gif-ediya-2000',
    grade_used: 'bronze', count_used: 2,
    status: 'completed', exchanged_at: ago(20),
  },
};

// ────────────────────────────────────────────
// INQUIRIES
// ────────────────────────────────────────────
const INQUIRIES = {
  'inq-frank-001': {
    user_id: 'user-frank-001', category: 'postback',
    title: '포스트백 확인 요청', status: 'pending',
    content: '쿠팡에서 15만원짜리 구매했는데 티켓 적립이 안 됩니다.',
    answer: null, answered_at: null, created_at: ago(5),
  },
  'inq-grace-001': {
    user_id: 'user-grace-001', category: 'gifticon',
    title: '기프티콘 교환 후 쿠폰이 안 와요', status: 'answered',
    content: '이디야 아메리카노 교환했는데 쿠폰 코드가 문자로 오지 않았습니다.',
    answer: '기프티콘 코드는 교환 완료 화면에서 바로 확인하실 수 있습니다. 문자 발송은 서비스 미지원입니다.',
    answered_at: ago(22), created_at: ago(24),
  },
  'inq-leo-001': {
    user_id: 'user-leo-001', category: 'account',
    title: '탈퇴 방법 문의', status: 'pending',
    content: '앱을 탈퇴하고 싶은데 탈퇴 버튼을 찾을 수 없습니다.',
    answer: null, answered_at: null, created_at: ago(2),
  },
};

// ────────────────────────────────────────────
// INVITES
// iris → frank (완료)
// iris → noah (완료)
// olivia → quinn (완료)
// ────────────────────────────────────────────
const INVITES = {
  'inv-iris-frank': { inviter_id:'user-iris-001', invitee_id:'user-frank-001', status:'completed', created_at:ago(60) },
  'inv-iris-noah':  { inviter_id:'user-iris-001', invitee_id:'user-noah-001',  status:'completed', created_at:ago(15) },
  'inv-olivia-quinn':{ inviter_id:'user-olivia-001', invitee_id:'user-quinn-001', status:'completed', created_at:ago(10) },
};

// ────────────────────────────────────────────
// DAILY VISITS
// ────────────────────────────────────────────
const DAILY_VISITS = {
  'dv-frank-01':  { user_id:'user-frank-001',  visited_at:ago(2), points_earned:100 },
  'dv-frank-02':  { user_id:'user-frank-001',  visited_at:ago(1), points_earned:100 },
  'dv-leo-01':    { user_id:'user-leo-001',    visited_at:ago(3), points_earned:100 },
  'dv-leo-02':    { user_id:'user-leo-001',    visited_at:ago(2), points_earned:100 },
  'dv-olivia-01': { user_id:'user-olivia-001', visited_at:ago(3), points_earned:100 },
  'dv-olivia-02': { user_id:'user-olivia-001', visited_at:ago(2), points_earned:100 },
  'dv-olivia-03': { user_id:'user-olivia-001', visited_at:ago(1), points_earned:100 },
};

// ────────────────────────────────────────────
// NOTICES (앱 공지사항 + CMS 공지 관리 공용)
// ────────────────────────────────────────────
const NOTICES = {
  'notice-launch': {
    id: 'notice-launch',
    title: '프라이스픽 v1.0 정식 출시 안내',
    content: '안녕하세요, 프라이스픽 팀입니다.\n\n경유 쇼핑 리워드 앱 프라이스픽이 정식 출시되었습니다. 쿠팡·11번가·G마켓 등 주요 쇼핑몰에서 픽구매 링크를 통해 구매하시면 등급 티켓을 적립하실 수 있습니다.\n\n적립된 티켓으로 스타벅스, 배달의민족 등 인기 기프티콘을 교환해보세요!\n\n감사합니다.',
    is_pinned: true,
    published_at: ago(27), created_at: ago(27), updated_at: ago(27),
  },
  'notice-terms': {
    id: 'notice-terms',
    title: '서비스 이용약관 개정 안내',
    content: '2026년 6월 1일부터 개정된 이용약관이 적용됩니다. 주요 변경 사항은 개인정보처리방침 항목 보완 및 티켓 만료 정책 명시입니다.\n\n변경 내용에 동의하지 않으실 경우 서비스 이용을 중단하시거나 탈퇴하실 수 있습니다.',
    is_pinned: false,
    published_at: ago(40), created_at: ago(40), updated_at: ago(40),
  },
  'notice-ticket-policy': {
    id: 'notice-ticket-policy',
    title: '티켓 적립 정책 안내',
    content: '등급 티켓은 브론즈(5천원/장), 실버(5만원/장), 골드(10만원/장) 기준으로 적립됩니다.\n\n등급 티켓 유효기간은 등급 확정일로부터 1년이며, 만료 D-30·D-7에 알림을 발송합니다.',
    is_pinned: false,
    published_at: ago(54), created_at: ago(54), updated_at: ago(54),
  },
  'notice-event-coupang': {
    id: 'notice-event-coupang',
    title: '[이벤트] 쿠팡 픽구매 티켓 2배 적립',
    content: '이번 주 한정, 쿠팡 경유 픽구매 시 등급 티켓을 2배로 드립니다. 지금 픽하고 더 많은 티켓을 받아보세요!',
    is_pinned: false,
    published_at: ago(5), created_at: ago(5), updated_at: ago(5),
  },
};

// ────────────────────────────────────────────
// ADMIN LOGS (CMS 관리자 접근/행위 로그)
// ────────────────────────────────────────────
const ADMIN_LOGS = {
  'alog-001': { admin_username:'firstadmin', admin_name:'슈퍼어드민', action:'로그인', ip:'211.234.x.x', at: ago(0) },
  'alog-002': { admin_username:'firstadmin', admin_name:'슈퍼어드민', action:'1:1 문의 답변 (티켓이 확정되지 않아요)', ip:'211.234.x.x', at: ago(1) },
  'alog-003': { admin_username:'firstadmin', admin_name:'슈퍼어드민', action:'회원 정지 (라이언)', ip:'211.234.x.x', at: ago(1) },
  'alog-004': { admin_username:'admin-markkim', admin_name:'김반장', action:'기프티콘 상품 등록 (이디야 아메리카노)', ip:'121.5.x.x', at: ago(3) },
  'alog-005': { admin_username:'firstadmin', admin_name:'슈퍼어드민', action:'공지 발행 ([이벤트] 쿠팡 픽구매 티켓 2배)', ip:'211.234.x.x', at: ago(5) },
  'alog-006': { admin_username:'admin-markkim', admin_name:'김반장', action:'로그인', ip:'121.5.x.x', at: ago(6) },
};

// 관리자 계정 정규화 패치 (display_name/username/status 누락 보정)
const ADMIN_PATCH = {
  'admin-markkim': { username:'admin-markkim', display_name:'김반장', status:'active' },
};

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function main() {
  console.log('\n═══ PricePick Extended Seed ═══\n');

  // Patch existing gifticons with validity_days field
  console.log('Patching existing gifticons (validity_days)...');
  const pBatch = db.batch();
  for (const [id, data] of Object.entries(EXISTING_GIFTICON_PATCH)) {
    pBatch.update(db.collection('gifticons').doc(id), data);
  }
  await pBatch.commit();
  console.log('  [OK] 기존 기프티콘 3종 validity_days 패치');

  // New gifticons
  await batchWrite('gifticons', NEW_GIFTICONS);

  // Users
  await batchWrite('users', USERS);
  await batchWrite('user_points', USER_POINTS);

  // Attribution
  await batchWrite('postbacks', POSTBACKS);
  await batchWrite('click_logs', CLICK_LOGS);
  await batchWrite('click_postback_matches', CPM);

  // Tickets
  await batchWrite('user_tickets', USER_TICKETS);
  await batchWrite('ticket_transactions', TICKET_TX);

  // Points
  await batchWrite('point_transactions', POINT_TX);

  // Gifticon exchanges
  await batchWrite('gifticon_exchanges', GIFTICON_EXCHANGES);

  // Other
  await batchWrite('inquiries', INQUIRIES);
  await batchWrite('invites', INVITES);
  await batchWrite('daily_visits', DAILY_VISITS);

  // Notices (앱 공지 + CMS 공지)
  await batchWrite('notices', NOTICES);

  // Admin logs (CMS 접근/행위 로그)
  await batchWrite('admin_logs', ADMIN_LOGS);

  // 관리자 계정 정규화 패치
  console.log('Patching admin_accounts...');
  for (const [id, data] of Object.entries(ADMIN_PATCH)) {
    await db.collection('admin_accounts').doc(id).set(data, { merge: true });
  }
  console.log('  [OK] admin_accounts 정규화');

  // Summary
  console.log('\n─── 최종 검증 (Firestore 카운트) ───');
  const cols = [
    'users','user_points','postbacks','click_logs','click_postback_matches',
    'user_tickets','ticket_transactions','point_transactions',
    'gifticons','gifticon_exchanges','inquiries','invites','daily_visits',
  ];
  for (const c of cols) {
    const n = (await db.collection(c).get()).size;
    console.log(`  ${c}: ${n}건`);
  }

  // Distribution check
  console.log('\n─── 유저 분포 ───');
  const users = await db.collection('users').get();
  const dist = { active:0, suspended:0, withdrawn:0, linked:0, guest:0 };
  users.forEach(d => {
    const u = d.data();
    dist[u.status || 'active']++;
    if (u.linked_kakao) dist.linked++; else dist.guest++;
  });
  console.log(`  전체: ${users.size}명`);
  console.log(`  active: ${dist.active} / suspended: ${dist.suspended} / withdrawn: ${dist.withdrawn}`);
  console.log(`  카카오연동: ${dist.linked} / 게스트: ${dist.guest}`);

  // Active ticket distribution
  const activeTickets = await db.collection('user_tickets').where('status','==','active').get();
  const tkDist = { bronze:0, silver:0, gold:0 };
  activeTickets.forEach(d => { const t = d.data(); tkDist[t.grade] = (tkDist[t.grade]||0)+1; });
  console.log(`\n─── Active 티켓 분포 ───`);
  console.log(`  bronze: ${tkDist.bronze} / silver: ${tkDist.silver} / gold: ${tkDist.gold} (총 ${activeTickets.size}장)`);

  // Postback status
  const pbs = await db.collection('postbacks').get();
  const pbDist = { confirmed:0, pending:0, refunded:0 };
  pbs.forEach(d => { const s = d.data().status; pbDist[s] = (pbDist[s]||0)+1; });
  console.log(`\n─── 포스트백 분포 ───`);
  console.log(`  confirmed: ${pbDist.confirmed} / pending: ${pbDist.pending} / refunded: ${pbDist.refunded}`);

  // Point integrity check
  console.log('\n─── 포인트 원장 정합성 검증 ───');
  const ptxSnap = await db.collection('point_transactions').get();
  const ptxSum = {};
  ptxSnap.forEach(d => {
    const p = d.data();
    ptxSum[p.user_id] = (ptxSum[p.user_id] || 0) + (p.amount || 0);
  });
  const upSnap = await db.collection('user_points').get();
  // old seed uses qty field, new extended seed uses amount — check both
  const ptxQtySnap = await db.collection('point_transactions').get();
  const ptxSumQ = {};
  ptxQtySnap.forEach(d => {
    const p = d.data();
    ptxSumQ[p.user_id] = (ptxSumQ[p.user_id] || 0) + (p.amount || p.qty || 0);
  });
  let ptxOk = true;
  upSnap.forEach(d => {
    const p = d.data();
    const sum = ptxSumQ[p.user_id] || 0;
    if (p.balance !== sum) {
      console.log(`  ✗ ${d.id}: balance=${p.balance} ≠ tx합계=${sum}`);
      ptxOk = false;
    }
  });
  if (ptxOk) console.log('  ✓ 전 유저 잔액 = TX 합계');

  console.log('\n═══ 완료 ═══');
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
