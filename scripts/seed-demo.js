'use strict';
/**
 * PricePick Demo — UNIFIED Seed (v8.2 single schema)
 *
 * 단일 신 스키마로 전 유저(20명)를 재작성한 데모 시드. 구 seed.js(5명)/seed-extended.js(15명)
 * 혼재를 제거하고 하나로 통합. 실행 시 시드가 소유한 컬렉션을 전부 비우고(WIPE) 재주입한다.
 *
 * Run: node scripts/seed-demo.js
 *
 * 정본 스키마 = 라이브 앱(app/index.html)의 쓰기 경로(processPurchase 등)와 동일:
 *   users               → nickname, linked_kakao(bool), status, created_at, updated_at
 *   user_points         → user_id, balance, updated_at, created_at   (docId = user_id)
 *   user_tickets        → user_id, grade('bronze'|'silver'|'gold'|'event'), status, postback_id, earned_at, confirmed_at, expires_at
 *   ticket_transactions → user_id, ticket_grade, type('earn'|'use'|'expire'|'clawback'), postback_id|gifticon_id, created_at
 *   point_transactions  → user_id, amount, type, reason, created_at
 *   postbacks           → user_id, mall_name, mall_domain, purchase_amount, order_id, status, created_at, confirmed_at
 *   gifticons           → category, brand, name, emoji, product_code, price, required_grade, required_count, validity_days, status, created_at
 *   gifticon_exchanges  → user_id, gifticon_id, grade_used, count_used, status, exchanged_at
 *
 * 보존(WIPE 제외): admin_accounts(로그인 계정), withdrawals/draws/events(빈 상태 유지)
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Auth (firebase-tools OAuth2) ──
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
db.settings({ ignoreUndefinedProperties: true });

// ── Helpers ──
const ts = (d) => Timestamp.fromDate(new Date(d));
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return Timestamp.fromDate(d); };
const future = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return Timestamp.fromDate(d); };

function tkt(id, uid, grade, status, postback_id, earned_at, confirmed_at, expires_at) {
  return [id, { user_id: uid, grade, status, postback_id, earned_at, confirmed_at, expires_at, created_at: earned_at }];
}

// ═══════════════════════════════════════════════════════
// MASTER DATA (v8.2 — 데이터 모델 완전성용; 화면 직접 참조 없음)
// ═══════════════════════════════════════════════════════
const AFFILIATE_MALLS = {
  'coupang':   { mall_code:'coupang',   name:'쿠팡',         commission_rate:0.030, domain:'coupang.com',  active:true, created_at:ts('2026-01-01') },
  '11st':      { mall_code:'11st',      name:'11번가',       commission_rate:0.035, domain:'11st.co.kr',   active:true, created_at:ts('2026-01-01') },
  'gmarket':   { mall_code:'gmarket',   name:'G마켓',        commission_rate:0.030, domain:'gmarket.co.kr',active:true, created_at:ts('2026-01-01') },
  'aliexpress':{ mall_code:'aliexpress',name:'알리익스프레스', commission_rate:0.050, domain:'aliexpress.com',active:true, created_at:ts('2026-01-01') },
  'iherb':     { mall_code:'iherb',     name:'아이허브',     commission_rate:0.050, domain:'iherb.com',    active:true, created_at:ts('2026-01-01') },
};
const TICKET_GRADES = {
  bronze: { grade_code:'bronze', accrual_unit_krw:5000,   reward_value_krw:100,  sort_order:1 },
  silver: { grade_code:'silver', accrual_unit_krw:50000,  reward_value_krw:1000, sort_order:2 },
  gold:   { grade_code:'gold',   accrual_unit_krw:100000, reward_value_krw:2000, sort_order:3 },
};
const GRADE_EXCHANGE_RULES = {
  'rule-bronze-to-silver': { from_grade:'bronze', to_grade:'silver', from_qty:10, to_qty:1, created_at:ts('2026-01-01') },
  'rule-silver-to-bronze': { from_grade:'silver', to_grade:'bronze', from_qty:1, to_qty:10, created_at:ts('2026-01-01') },
  'rule-silver-to-gold':   { from_grade:'silver', to_grade:'gold',   from_qty:2, to_qty:1, created_at:ts('2026-01-01') },
  'rule-gold-to-silver':   { from_grade:'gold',   to_grade:'silver', from_qty:1, to_qty:2, created_at:ts('2026-01-01') },
};

// ═══════════════════════════════════════════════════════
// GIFTICONS (5종 — 단일 스키마: required_grade/required_count/validity_days)
// ═══════════════════════════════════════════════════════
const GIFTICONS = {
  'gif-starbucks-4500': { category:'카페', brand:'스타벅스', name:'아메리카노 Tall (4,500원)', emoji:'☕', product_code:'SBX-TALL-001', price:4500, required_grade:'bronze', required_count:50, validity_days:30, status:'active', sale_end_at:null, created_at:ts('2026-01-01') },
  'gif-cu-3000':        { category:'편의점', brand:'CU', name:'CU 3,000원 금액권', emoji:'🏪', product_code:'CU-3000-001', price:3000, required_grade:'bronze', required_count:33, validity_days:30, status:'active', sale_end_at:null, created_at:ts('2026-01-01') },
  'gif-baemin-10000':   { category:'배달', brand:'배달의민족', name:'배민 10,000원 상품권', emoji:'🍔', product_code:'BAEMIN-10000-001', price:10000, required_grade:'silver', required_count:11, validity_days:30, status:'active', sale_end_at:null, created_at:ts('2026-01-01') },
  'gif-ediya-2000':     { category:'카페', brand:'이디야커피', name:'이디야 아메리카노', emoji:'☕', product_code:'EDIYA-AMR-001', price:2000, required_grade:'bronze', required_count:2, validity_days:30, status:'active', sale_end_at:null, created_at:ts('2026-03-01') },
  'gif-gs25-3000':      { category:'편의점', brand:'GS25', name:'GS25 3,000원 금액권', emoji:'🏬', product_code:'GS25-3000-001', price:3000, required_grade:'bronze', required_count:3, validity_days:30, status:'active', sale_end_at:null, created_at:ts('2026-03-01') },
};
const GIFTICON_STOCK = {
  'gif-starbucks-4500': { gifticon_id:'gif-starbucks-4500', total_issued:500, remaining:487, updated_at:ago(0) },
  'gif-cu-3000':        { gifticon_id:'gif-cu-3000', total_issued:300, remaining:294, updated_at:ago(0) },
  'gif-baemin-10000':   { gifticon_id:'gif-baemin-10000', total_issued:200, remaining:198, updated_at:ago(0) },
  'gif-ediya-2000':     { gifticon_id:'gif-ediya-2000', total_issued:1000, remaining:995, updated_at:ago(0) },
  'gif-gs25-3000':      { gifticon_id:'gif-gs25-3000', total_issued:1000, remaining:997, updated_at:ago(0) },
};

// ═══════════════════════════════════════════════════════
// USERS (20명 — 단일 신 스키마)
//   01~15: 확장 시드 인물(프랭크~탈퇴회원)  /  16~20: 앨리스·밥·캐롤·데이브·이브
// ═══════════════════════════════════════════════════════
const USERS = {
  // ── 연동·정상 (헤비/일반) ──
  'user-frank-001':  { nickname:'프랭크',     linked_kakao:true,  status:'active',    created_at:ts('2026-01-15'), updated_at:ago(5)  },
  'user-grace-001':  { nickname:'그레이스',   linked_kakao:true,  status:'active',    created_at:ts('2026-02-20'), updated_at:ago(7)  },
  'user-henry-001':  { nickname:'헨리',       linked_kakao:true,  status:'active',    created_at:ts('2026-03-05'), updated_at:ago(10) },
  'user-iris-001':   { nickname:'아이리스',   linked_kakao:true,  status:'active',    created_at:ts('2026-03-20'), updated_at:ago(15) },
  'user-jake-001':   { nickname:'제이크',     linked_kakao:true,  status:'active',    created_at:ts('2026-04-01'), updated_at:ago(3)  },
  'user-kate-001':   { nickname:'케이트',     linked_kakao:true,  status:'active',    created_at:ts('2026-04-15'), updated_at:ago(20) },
  'user-leo-001':    { nickname:'레오',       linked_kakao:true,  status:'active',    created_at:ts('2026-05-01'), updated_at:ago(2)  },
  'user-mia-001':    { nickname:'미아',       linked_kakao:true,  status:'active',    created_at:ts('2026-05-10'), updated_at:ago(5)  },
  'user-noah-001':   { nickname:'노아',       linked_kakao:true,  status:'active',    created_at:ts('2026-06-01'), updated_at:ago(4)  },
  'user-olivia-001': { nickname:'올리비아',   linked_kakao:true,  status:'active',    created_at:ts('2026-06-10'), updated_at:ago(1)  },
  // ── 게스트(미연동)·정상 ──
  'user-peter-001':  { nickname:'피터(게스트)', linked_kakao:false, status:'active',   created_at:ts('2026-06-15'), updated_at:ago(5)  },
  'user-quinn-001':  { nickname:'퀸(게스트)',   linked_kakao:false, status:'active',   created_at:ts('2026-06-20'), updated_at:ago(2)  },
  // ── 정지 ──
  'user-ryan-001':   { nickname:'라이언',     linked_kakao:true,  status:'suspended', created_at:ts('2026-03-10'), updated_at:ago(7)  },
  'user-sara-001':   { nickname:'사라',       linked_kakao:true,  status:'suspended', created_at:ts('2026-04-05'), updated_at:ago(6)  },
  // ── 탈퇴 ──
  'user-tom-001':    { nickname:'탈퇴회원',    linked_kakao:true,  status:'withdrawn', created_at:ts('2026-02-01'), updated_at:ago(24) },
  // ── 16~20: 기존 기본 시드 5명(신 스키마로 통일) ──
  'user-linked-alice': { nickname:'앨리스', linked_kakao:true,  status:'active',    created_at:ts('2026-03-01'), updated_at:ago(1)  },
  'user-linked-bob':   { nickname:'밥',     linked_kakao:true,  status:'active',    created_at:ts('2026-04-10'), updated_at:ago(3)  },
  'user-linked-carol': { nickname:'캐롤',   linked_kakao:true,  status:'suspended', created_at:ts('2026-02-15'), updated_at:ago(5)  },
  'user-guest-dave':   { nickname:'데이브(게스트)', linked_kakao:false, status:'active', created_at:ts('2026-06-01'), updated_at:ago(2) },
  'user-guest-eve':    { nickname:'이브(게스트)',   linked_kakao:false, status:'active', created_at:ts('2026-06-10'), updated_at:ago(1) },
};

// ═══════════════════════════════════════════════════════
// POSTBACKS (order_id는 아래에서 자동 부여)
// ═══════════════════════════════════════════════════════
const POSTBACKS = {
  'pb-frank-001': { user_id:'user-frank-001', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:150000, status:'confirmed', created_at:ago(60), confirmed_at:ago(53) },
  'pb-frank-002': { user_id:'user-frank-001', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:150000, status:'confirmed', created_at:ago(30), confirmed_at:ago(23) },
  'pb-grace-001': { user_id:'user-grace-001', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:67000,  status:'confirmed', created_at:ago(45), confirmed_at:ago(38) },
  'pb-grace-002': { user_id:'user-grace-001', mall_name:'11번가', mall_domain:'11st.co.kr',  purchase_amount:25000,  status:'confirmed', created_at:ago(20), confirmed_at:ago(13) },
  'pb-henry-001': { user_id:'user-henry-001', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:67000,  status:'confirmed', created_at:ago(35), confirmed_at:ago(28) },
  'pb-iris-001':  { user_id:'user-iris-001',  mall_name:'G마켓', mall_domain:'gmarket.co.kr', purchase_amount:100000, status:'confirmed', created_at:ago(20), confirmed_at:ago(13) },
  'pb-jake-001':  { user_id:'user-jake-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:67000,  status:'pending',    created_at:ago(3),  confirmed_at:null },
  'pb-kate-001':  { user_id:'user-kate-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:50000,  status:'confirmed',  created_at:ago(40), confirmed_at:ago(33) },
  'pb-kate-002':  { user_id:'user-kate-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:100000, status:'refunded',   created_at:ago(25), confirmed_at:ago(18) },
  'pb-leo-001':   { user_id:'user-leo-001',   mall_name:'11번가', mall_domain:'11st.co.kr',  purchase_amount:200000, status:'confirmed',  created_at:ago(50), confirmed_at:ago(43) },
  'pb-leo-002':   { user_id:'user-leo-001',   mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:100000, status:'confirmed',  created_at:ago(20), confirmed_at:ago(13) },
  'pb-mia-001':   { user_id:'user-mia-001',   mall_name:'G마켓', mall_domain:'gmarket.co.kr', purchase_amount:50000,  status:'confirmed',  created_at:ago(370), confirmed_at:ago(363) },
  'pb-mia-002':   { user_id:'user-mia-001',   mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:25000,  status:'confirmed',  created_at:ago(15), confirmed_at:ago(8) },
  'pb-noah-001':  { user_id:'user-noah-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:10000,  status:'confirmed',  created_at:ago(10), confirmed_at:ago(3) },
  'pb-olivia-001':{ user_id:'user-olivia-001',mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:200000, status:'confirmed',  created_at:ago(40), confirmed_at:ago(33) },
  'pb-olivia-002':{ user_id:'user-olivia-001',mall_name:'11번가', mall_domain:'11st.co.kr',  purchase_amount:200000, status:'confirmed',  created_at:ago(15), confirmed_at:ago(8) },
  'pb-peter-001': { user_id:'user-peter-001', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:50000,  status:'pending',    created_at:ago(5),  confirmed_at:null },
  'pb-ryan-001':  { user_id:'user-ryan-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:50000,  status:'confirmed',  created_at:ago(55), confirmed_at:ago(48) },
  'pb-ryan-002':  { user_id:'user-ryan-001',  mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:100000, status:'confirmed',  created_at:ago(40), confirmed_at:ago(33) },
  'pb-sara-001':  { user_id:'user-sara-001',  mall_name:'11번가', mall_domain:'11st.co.kr',  purchase_amount:25000,  status:'confirmed',  created_at:ago(30), confirmed_at:ago(23) },
  // ── 16~20 ──
  'pb-alice-001': { user_id:'user-linked-alice', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:67000,  status:'confirmed', created_at:ago(13), confirmed_at:ago(6) },
  'pb-bob-001':   { user_id:'user-linked-bob',   mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:120000, status:'confirmed', created_at:ago(8),  confirmed_at:ago(1) },
  'pb-carol-001': { user_id:'user-linked-carol', mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:5000,   status:'confirmed', created_at:ago(370),confirmed_at:ago(363) },
  'pb-dave-001':  { user_id:'user-guest-dave',   mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:15000,  status:'pending',   created_at:ago(5),  confirmed_at:null },
  'pb-eve-001':   { user_id:'user-guest-eve',    mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:5000,   status:'pending',   created_at:ago(1),  confirmed_at:null },
  // ── 미매칭 포스트백(유저 없음) — 포스트백 로그 데모용 ──
  'pb-unmatched-001': { user_id:null, mall_name:'쿠팡', mall_domain:'coupang.com', purchase_amount:34000, status:'pending', created_at:ago(4), confirmed_at:null },
};
// order_id 자동 부여 (PREFIX-ORDER-YYYYMMDD-NNN) — 시드↔화면 일치 기준
const MALL_PREFIX = { '쿠팡':'CPN', '11번가':'11ST', 'G마켓':'GM', '알리익스프레스':'ALI', '아이허브':'IHB' };
(function assignOrderIds() {
  let seq = 0;
  for (const [, pb] of Object.entries(POSTBACKS)) {
    seq++;
    const d = pb.created_at.toDate();
    const ymd = '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    pb.order_id = (MALL_PREFIX[pb.mall_name] || 'ORD') + '-ORDER-' + ymd + '-' + String(seq).padStart(3, '0');
  }
})();

// ═══════════════════════════════════════════════════════
// CLICK LOGS + CLICK-POSTBACK MATCHES (1:1 per matched postback)
// ═══════════════════════════════════════════════════════
const CLICK_LOGS = {}, CPM = {};
for (const [pbId, pb] of Object.entries(POSTBACKS)) {
  if (!pb.user_id) continue; // 미매칭은 click/match 없음
  const key = pbId.replace('pb-', '');
  const clId = 'cl-' + key, cpmId = 'cpm-' + key;
  CLICK_LOGS[clId] = { user_id: pb.user_id, mall_name: pb.mall_name, mall_domain: pb.mall_domain, clicked_at: pb.created_at };
  CPM[cpmId] = { user_id: pb.user_id, click_id: clId, postback_id: pbId, created_at: pb.created_at };
}

// ═══════════════════════════════════════════════════════
// USER TICKETS (개별 문서, grade 필드)
// Greedy: 150k→gold1+silver1 / 120k→gold1+bronze4 / 100k→gold1 / 67k→silver1+bronze4
//         50k→silver1 / 25k→bronze5 / 15k→bronze3 / 10k→bronze2 / 5k→bronze1 / 200k→gold2
// ═══════════════════════════════════════════════════════
const TKT_RAW = [
  // Frank: 150k×2 → gold2 + silver2 (active)
  tkt('tk-frank-01','user-frank-001','gold',  'active','pb-frank-001', ago(60), ago(53), future(305)),
  tkt('tk-frank-02','user-frank-001','silver','active','pb-frank-001', ago(60), ago(53), future(305)),
  tkt('tk-frank-03','user-frank-001','gold',  'active','pb-frank-002', ago(30), ago(23), future(335)),
  tkt('tk-frank-04','user-frank-001','silver','active','pb-frank-002', ago(30), ago(23), future(335)),
  // Grace: 67k(silver1+bronze4) + 25k(bronze5), bronze2 used(교환)
  tkt('tk-grace-01','user-grace-001','silver','active','pb-grace-001', ago(45), ago(38), future(320)),
  tkt('tk-grace-02','user-grace-001','bronze','active','pb-grace-001', ago(45), ago(38), future(320)),
  tkt('tk-grace-03','user-grace-001','bronze','active','pb-grace-001', ago(45), ago(38), future(320)),
  tkt('tk-grace-04','user-grace-001','bronze','used',  'pb-grace-001', ago(45), ago(38), future(320)),
  tkt('tk-grace-05','user-grace-001','bronze','used',  'pb-grace-001', ago(45), ago(38), future(320)),
  tkt('tk-grace-06','user-grace-001','bronze','active','pb-grace-002', ago(20), ago(13), future(350)),
  tkt('tk-grace-07','user-grace-001','bronze','active','pb-grace-002', ago(20), ago(13), future(350)),
  tkt('tk-grace-08','user-grace-001','bronze','active','pb-grace-002', ago(20), ago(13), future(350)),
  tkt('tk-grace-09','user-grace-001','bronze','active','pb-grace-002', ago(20), ago(13), future(350)),
  tkt('tk-grace-10','user-grace-001','bronze','active','pb-grace-002', ago(20), ago(13), future(350)),
  // Henry: 67k(silver1+bronze4), bronze2 used(교환)
  tkt('tk-henry-01','user-henry-001','silver','active','pb-henry-001', ago(35), ago(28), future(330)),
  tkt('tk-henry-02','user-henry-001','bronze','active','pb-henry-001', ago(35), ago(28), future(330)),
  tkt('tk-henry-03','user-henry-001','bronze','active','pb-henry-001', ago(35), ago(28), future(330)),
  tkt('tk-henry-04','user-henry-001','bronze','used',  'pb-henry-001', ago(35), ago(28), future(330)),
  tkt('tk-henry-05','user-henry-001','bronze','used',  'pb-henry-001', ago(35), ago(28), future(330)),
  // Iris: 100k→gold1
  tkt('tk-iris-01','user-iris-001','gold','active','pb-iris-001', ago(20), ago(13), future(350)),
  // Jake: 67k PENDING(가지급)
  tkt('tk-jake-01','user-jake-001','silver','pending','pb-jake-001', ago(3), null, future(362)),
  tkt('tk-jake-02','user-jake-001','bronze','pending','pb-jake-001', ago(3), null, future(362)),
  tkt('tk-jake-03','user-jake-001','bronze','pending','pb-jake-001', ago(3), null, future(362)),
  tkt('tk-jake-04','user-jake-001','bronze','pending','pb-jake-001', ago(3), null, future(362)),
  tkt('tk-jake-05','user-jake-001','bronze','pending','pb-jake-001', ago(3), null, future(362)),
  // Kate: 50k→silver1 active / 100k→gold1 clawback(used)
  tkt('tk-kate-01','user-kate-001','silver','active','pb-kate-001', ago(40), ago(33), future(325)),
  tkt('tk-kate-02','user-kate-001','gold',  'used',  'pb-kate-002', ago(25), ago(18), future(340)),
  // Leo: 200k→gold2 / 100k→gold1
  tkt('tk-leo-01','user-leo-001','gold','active','pb-leo-001', ago(50), ago(43), future(315)),
  tkt('tk-leo-02','user-leo-001','gold','active','pb-leo-001', ago(50), ago(43), future(315)),
  tkt('tk-leo-03','user-leo-001','gold','active','pb-leo-002', ago(20), ago(13), future(345)),
  // Mia: 50k(370일전)→silver1 expired / 25k→bronze5 active
  tkt('tk-mia-01','user-mia-001','silver','expired','pb-mia-001', ago(370), ago(363), ago(5)),
  tkt('tk-mia-02','user-mia-001','bronze','active', 'pb-mia-002', ago(15), ago(8), future(350)),
  tkt('tk-mia-03','user-mia-001','bronze','active', 'pb-mia-002', ago(15), ago(8), future(350)),
  tkt('tk-mia-04','user-mia-001','bronze','active', 'pb-mia-002', ago(15), ago(8), future(350)),
  tkt('tk-mia-05','user-mia-001','bronze','active', 'pb-mia-002', ago(15), ago(8), future(350)),
  tkt('tk-mia-06','user-mia-001','bronze','active', 'pb-mia-002', ago(15), ago(8), future(350)),
  // Noah: 10k→bronze2
  tkt('tk-noah-01','user-noah-001','bronze','active','pb-noah-001', ago(10), ago(3), future(355)),
  tkt('tk-noah-02','user-noah-001','bronze','active','pb-noah-001', ago(10), ago(3), future(355)),
  // Olivia: 200k×2→gold4
  tkt('tk-olivia-01','user-olivia-001','gold','active','pb-olivia-001', ago(40), ago(33), future(325)),
  tkt('tk-olivia-02','user-olivia-001','gold','active','pb-olivia-001', ago(40), ago(33), future(325)),
  tkt('tk-olivia-03','user-olivia-001','gold','active','pb-olivia-002', ago(15), ago(8), future(350)),
  tkt('tk-olivia-04','user-olivia-001','gold','active','pb-olivia-002', ago(15), ago(8), future(350)),
  // Peter(게스트): 50k→silver1 pending
  tkt('tk-peter-01','user-peter-001','silver','pending','pb-peter-001', ago(5), null, future(360)),
  // Ryan(정지): 50k→silver1 + 100k→gold1 (정지여도 티켓 유지)
  tkt('tk-ryan-01','user-ryan-001','silver','active','pb-ryan-001', ago(55), ago(48), future(310)),
  tkt('tk-ryan-02','user-ryan-001','gold',  'active','pb-ryan-002', ago(40), ago(33), future(325)),
  // Sara(정지): 25k→bronze5
  tkt('tk-sara-01','user-sara-001','bronze','active','pb-sara-001', ago(30), ago(23), future(335)),
  tkt('tk-sara-02','user-sara-001','bronze','active','pb-sara-001', ago(30), ago(23), future(335)),
  tkt('tk-sara-03','user-sara-001','bronze','active','pb-sara-001', ago(30), ago(23), future(335)),
  tkt('tk-sara-04','user-sara-001','bronze','active','pb-sara-001', ago(30), ago(23), future(335)),
  tkt('tk-sara-05','user-sara-001','bronze','active','pb-sara-001', ago(30), ago(23), future(335)),
  // ── 16~20 ──
  // Alice: 67k→silver1+bronze4 active + 이벤트티켓2(출석)
  tkt('tk-alice-01','user-linked-alice','silver','active','pb-alice-001', ago(13), ago(6), future(352)),
  tkt('tk-alice-02','user-linked-alice','bronze','active','pb-alice-001', ago(13), ago(6), future(352)),
  tkt('tk-alice-03','user-linked-alice','bronze','active','pb-alice-001', ago(13), ago(6), future(352)),
  tkt('tk-alice-04','user-linked-alice','bronze','active','pb-alice-001', ago(13), ago(6), future(352)),
  tkt('tk-alice-05','user-linked-alice','bronze','active','pb-alice-001', ago(13), ago(6), future(352)),
  tkt('tk-alice-ev1','user-linked-alice','event','active', null, ago(2), ago(2), future(28)),
  tkt('tk-alice-ev2','user-linked-alice','event','active', null, ago(2), ago(2), future(28)),
  // Bob: 120k→gold1+bronze4 active
  tkt('tk-bob-01','user-linked-bob','gold',  'active','pb-bob-001', ago(8), ago(1), future(357)),
  tkt('tk-bob-02','user-linked-bob','bronze','active','pb-bob-001', ago(8), ago(1), future(357)),
  tkt('tk-bob-03','user-linked-bob','bronze','active','pb-bob-001', ago(8), ago(1), future(357)),
  tkt('tk-bob-04','user-linked-bob','bronze','active','pb-bob-001', ago(8), ago(1), future(357)),
  tkt('tk-bob-05','user-linked-bob','bronze','active','pb-bob-001', ago(8), ago(1), future(357)),
  // Carol(정지): 5k(370일전)→bronze1 expired
  tkt('tk-carol-01','user-linked-carol','bronze','expired','pb-carol-001', ago(370), ago(363), ago(5)),
  // Dave(게스트): 15k→bronze3 pending
  tkt('tk-dave-01','user-guest-dave','bronze','pending','pb-dave-001', ago(5), null, future(360)),
  tkt('tk-dave-02','user-guest-dave','bronze','pending','pb-dave-001', ago(5), null, future(360)),
  tkt('tk-dave-03','user-guest-dave','bronze','pending','pb-dave-001', ago(5), null, future(360)),
  // Eve(게스트): 5k→bronze1 pending
  tkt('tk-eve-01','user-guest-eve','bronze','pending','pb-eve-001', ago(1), null, future(364)),
];
const USER_TICKETS = Object.fromEntries(TKT_RAW);

// ═══════════════════════════════════════════════════════
// TICKET TRANSACTIONS (불변 원장) — earn/use/expire/clawback
// ═══════════════════════════════════════════════════════
const TICKET_TX = {
  // Frank
  'ttx-frank-01': { user_id:'user-frank-001', ticket_grade:'gold',   type:'earn', postback_id:'pb-frank-001', created_at:ago(53) },
  'ttx-frank-02': { user_id:'user-frank-001', ticket_grade:'silver', type:'earn', postback_id:'pb-frank-001', created_at:ago(53) },
  'ttx-frank-03': { user_id:'user-frank-001', ticket_grade:'gold',   type:'earn', postback_id:'pb-frank-002', created_at:ago(23) },
  'ttx-frank-04': { user_id:'user-frank-001', ticket_grade:'silver', type:'earn', postback_id:'pb-frank-002', created_at:ago(23) },
  // Grace
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
  // Henry
  'ttx-henry-01': { user_id:'user-henry-001', ticket_grade:'silver', type:'earn', postback_id:'pb-henry-001', created_at:ago(28) },
  'ttx-henry-02': { user_id:'user-henry-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-henry-001', created_at:ago(28) },
  'ttx-henry-03': { user_id:'user-henry-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-henry-001', created_at:ago(28) },
  'ttx-henry-04': { user_id:'user-henry-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-henry-001', created_at:ago(28) },
  'ttx-henry-05': { user_id:'user-henry-001', ticket_grade:'bronze', type:'earn', postback_id:'pb-henry-001', created_at:ago(28) },
  'ttx-henry-06': { user_id:'user-henry-001', ticket_grade:'bronze', type:'use',  gifticon_id:'gif-ediya-2000', created_at:ago(20) },
  'ttx-henry-07': { user_id:'user-henry-001', ticket_grade:'bronze', type:'use',  gifticon_id:'gif-ediya-2000', created_at:ago(20) },
  // Iris
  'ttx-iris-01':  { user_id:'user-iris-001',  ticket_grade:'gold',   type:'earn', postback_id:'pb-iris-001',  created_at:ago(13) },
  // Jake (pending)
  'ttx-jake-01':  { user_id:'user-jake-001',  ticket_grade:'silver', type:'earn', postback_id:'pb-jake-001',  created_at:ago(3) },
  'ttx-jake-02':  { user_id:'user-jake-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-jake-001',  created_at:ago(3) },
  'ttx-jake-03':  { user_id:'user-jake-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-jake-001',  created_at:ago(3) },
  'ttx-jake-04':  { user_id:'user-jake-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-jake-001',  created_at:ago(3) },
  'ttx-jake-05':  { user_id:'user-jake-001',  ticket_grade:'bronze', type:'earn', postback_id:'pb-jake-001',  created_at:ago(3) },
  // Kate (earn silver, earn gold → clawback gold)
  'ttx-kate-01':  { user_id:'user-kate-001',  ticket_grade:'silver', type:'earn',     postback_id:'pb-kate-001', created_at:ago(33) },
  'ttx-kate-02':  { user_id:'user-kate-001',  ticket_grade:'gold',   type:'earn',     postback_id:'pb-kate-002', created_at:ago(18) },
  'ttx-kate-03':  { user_id:'user-kate-001',  ticket_grade:'gold',   type:'clawback', postback_id:'pb-kate-002', created_at:ago(10) },
  // Leo
  'ttx-leo-01':   { user_id:'user-leo-001',   ticket_grade:'gold',   type:'earn', postback_id:'pb-leo-001', created_at:ago(43) },
  'ttx-leo-02':   { user_id:'user-leo-001',   ticket_grade:'gold',   type:'earn', postback_id:'pb-leo-001', created_at:ago(43) },
  'ttx-leo-03':   { user_id:'user-leo-001',   ticket_grade:'gold',   type:'earn', postback_id:'pb-leo-002', created_at:ago(13) },
  // Mia (earn silver → expire / earn bronze5)
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
  // ── 16~20 ──
  // Alice (67k earn silver1+bronze4) + 이벤트티켓2 earn
  'ttx-alice-01': { user_id:'user-linked-alice', ticket_grade:'silver', type:'earn', postback_id:'pb-alice-001', created_at:ago(6) },
  'ttx-alice-02': { user_id:'user-linked-alice', ticket_grade:'bronze', type:'earn', postback_id:'pb-alice-001', created_at:ago(6) },
  'ttx-alice-03': { user_id:'user-linked-alice', ticket_grade:'bronze', type:'earn', postback_id:'pb-alice-001', created_at:ago(6) },
  'ttx-alice-04': { user_id:'user-linked-alice', ticket_grade:'bronze', type:'earn', postback_id:'pb-alice-001', created_at:ago(6) },
  'ttx-alice-05': { user_id:'user-linked-alice', ticket_grade:'bronze', type:'earn', postback_id:'pb-alice-001', created_at:ago(6) },
  'ttx-alice-ev1':{ user_id:'user-linked-alice', ticket_grade:'event',  type:'earn', created_at:ago(2) },
  'ttx-alice-ev2':{ user_id:'user-linked-alice', ticket_grade:'event',  type:'earn', created_at:ago(2) },
  // Bob (120k earn gold1+bronze4)
  'ttx-bob-01':   { user_id:'user-linked-bob', ticket_grade:'gold',   type:'earn', postback_id:'pb-bob-001', created_at:ago(1) },
  'ttx-bob-02':   { user_id:'user-linked-bob', ticket_grade:'bronze', type:'earn', postback_id:'pb-bob-001', created_at:ago(1) },
  'ttx-bob-03':   { user_id:'user-linked-bob', ticket_grade:'bronze', type:'earn', postback_id:'pb-bob-001', created_at:ago(1) },
  'ttx-bob-04':   { user_id:'user-linked-bob', ticket_grade:'bronze', type:'earn', postback_id:'pb-bob-001', created_at:ago(1) },
  'ttx-bob-05':   { user_id:'user-linked-bob', ticket_grade:'bronze', type:'earn', postback_id:'pb-bob-001', created_at:ago(1) },
  // Carol (earn bronze → expire)
  'ttx-carol-01': { user_id:'user-linked-carol', ticket_grade:'bronze', type:'earn',   postback_id:'pb-carol-001', created_at:ago(363) },
  'ttx-carol-02': { user_id:'user-linked-carol', ticket_grade:'bronze', type:'expire', postback_id:'pb-carol-001', created_at:ago(5) },
  // Dave (pending earn bronze3)
  'ttx-dave-01':  { user_id:'user-guest-dave', ticket_grade:'bronze', type:'earn', postback_id:'pb-dave-001', created_at:ago(5) },
  'ttx-dave-02':  { user_id:'user-guest-dave', ticket_grade:'bronze', type:'earn', postback_id:'pb-dave-001', created_at:ago(5) },
  'ttx-dave-03':  { user_id:'user-guest-dave', ticket_grade:'bronze', type:'earn', postback_id:'pb-dave-001', created_at:ago(5) },
  // Eve (pending earn bronze1)
  'ttx-eve-01':   { user_id:'user-guest-eve', ticket_grade:'bronze', type:'earn', postback_id:'pb-eve-001', created_at:ago(1) },
};

// ═══════════════════════════════════════════════════════
// USER POINTS (docId = user_id, balance = Σ point_transactions)
// ═══════════════════════════════════════════════════════
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
  'user-tom-001':    { user_id:'user-tom-001',    balance:0,    updated_at:ago(24), created_at:ts('2026-02-01') },
  // ── 16~20 ──
  'user-linked-alice': { user_id:'user-linked-alice', balance:3500, updated_at:ago(1), created_at:ts('2026-03-01') },
  'user-linked-bob':   { user_id:'user-linked-bob',   balance:1200, updated_at:ago(3), created_at:ts('2026-04-10') },
  'user-linked-carol': { user_id:'user-linked-carol', balance:0,    updated_at:ago(5), created_at:ts('2026-02-15') },
  'user-guest-dave':   { user_id:'user-guest-dave',   balance:100,  updated_at:ago(2), created_at:ts('2026-06-01') },
  'user-guest-eve':    { user_id:'user-guest-eve',    balance:0,    updated_at:ago(1), created_at:ts('2026-06-10') },
};

// ═══════════════════════════════════════════════════════
// POINT TRANSACTIONS (불변 원장; Σamount = balance)
// ═══════════════════════════════════════════════════════
const POINT_TX = {
  'ptx-frank-01':  { user_id:'user-frank-001',  amount:300,  type:'referral',    reason:'user-iris-001 초대 보상',  created_at:ago(55) },
  'ptx-frank-02':  { user_id:'user-frank-001',  amount:200,  type:'attendance',  reason:'출석 보상',                created_at:ago(30) },
  'ptx-grace-01':  { user_id:'user-grace-001',  amount:200,  type:'attendance',  reason:'출석 보상',                created_at:ago(40) },
  'ptx-henry-01':  { user_id:'user-henry-001',  amount:500,  type:'attendance',  reason:'출석·이벤트 누적 보상',      created_at:ago(20) },
  'ptx-henry-02':  { user_id:'user-henry-001',  amount:300,  type:'referral',    reason:'user-frank-001 초대 보상', created_at:ago(30) },
  'ptx-henry-03':  { user_id:'user-henry-001',  amount:200,  type:'attendance',  reason:'출석 보상',                created_at:ago(25) },
  'ptx-iris-01':   { user_id:'user-iris-001',   amount:300,  type:'referral',    reason:'user-noah-001 초대 보상',  created_at:ago(15) },
  'ptx-jake-01':   { user_id:'user-jake-001',   amount:50,   type:'attendance',  reason:'첫 출석 보상',              created_at:ago(3)  },
  'ptx-leo-01':    { user_id:'user-leo-001',    amount:200,  type:'attendance',  reason:'출석 보상',                created_at:ago(40) },
  'ptx-leo-02':    { user_id:'user-leo-001',    amount:200,  type:'attendance',  reason:'출석 보상',                created_at:ago(2)  },
  'ptx-mia-01':    { user_id:'user-mia-001',    amount:100,  type:'attendance',  reason:'출석 보상',                created_at:ago(5)  },
  'ptx-noah-01':   { user_id:'user-noah-001',   amount:50,   type:'attendance',  reason:'첫 출석 보상',              created_at:ago(5)  },
  'ptx-olivia-01': { user_id:'user-olivia-001', amount:500,  type:'referral',    reason:'user-quinn-001 초대 보상', created_at:ago(10) },
  'ptx-olivia-02': { user_id:'user-olivia-001', amount:500,  type:'attendance',  reason:'출석 보상',                created_at:ago(35) },
  'ptx-olivia-03': { user_id:'user-olivia-001', amount:500,  type:'attendance',  reason:'출석 보상',                created_at:ago(2)  },
  // ── 16~20 ──
  'ptx-alice-01':  { user_id:'user-linked-alice', amount:500,  type:'referral',   reason:'친구 초대 보상',          created_at:ago(20) },
  'ptx-alice-02':  { user_id:'user-linked-alice', amount:3000, type:'attendance', reason:'출석·이벤트 누적 보상',     created_at:ago(10) },
  'ptx-bob-01':    { user_id:'user-linked-bob',   amount:500,  type:'onboarding', reason:'가입 축하 보상',           created_at:ago(70) },
  'ptx-bob-02':    { user_id:'user-linked-bob',   amount:700,  type:'attendance', reason:'출석 누적 보상',           created_at:ago(3)  },
  'ptx-dave-01':   { user_id:'user-guest-dave',   amount:100,  type:'attendance', reason:'출석 보상',                created_at:ago(2)  },
};

// ═══════════════════════════════════════════════════════
// GIFTICON EXCHANGES (grace·henry — 이디야 2장)
// ═══════════════════════════════════════════════════════
const GIFTICON_EXCHANGES = {
  'ex-grace-001': { user_id:'user-grace-001', gifticon_id:'gif-ediya-2000', grade_used:'bronze', count_used:2, status:'completed', exchanged_at:ago(25) },
  'ex-henry-001': { user_id:'user-henry-001', gifticon_id:'gif-ediya-2000', grade_used:'bronze', count_used:2, status:'completed', exchanged_at:ago(20) },
};

// ═══════════════════════════════════════════════════════
// INQUIRIES (frank·grace·leo + alice·bob)
// ═══════════════════════════════════════════════════════
const INQUIRIES = {
  'inq-frank-001': { user_id:'user-frank-001', category:'postback', title:'포스트백 확인 요청', status:'pending', content:'쿠팡에서 15만원짜리 구매했는데 티켓 적립이 안 됩니다.', answer:null, answered_at:null, created_at:ago(5) },
  'inq-grace-001': { user_id:'user-grace-001', category:'gifticon', title:'기프티콘 교환 후 쿠폰이 안 와요', status:'answered', content:'이디야 아메리카노 교환했는데 쿠폰 코드가 문자로 오지 않았습니다.', answer:'기프티콘 코드는 교환 완료 화면에서 바로 확인하실 수 있습니다. 문자 발송은 서비스 미지원입니다.', answered_at:ago(22), created_at:ago(24) },
  'inq-leo-001':   { user_id:'user-leo-001', category:'account', title:'탈퇴 방법 문의', status:'pending', content:'앱을 탈퇴하고 싶은데 탈퇴 버튼을 찾을 수 없습니다.', answer:null, answered_at:null, created_at:ago(2) },
  'inq-alice-001': { user_id:'user-linked-alice', category:'ticket', title:'티켓이 확정되지 않아요', status:'answered', content:'쿠팡에서 구매했는데 7일이 지났는데도 티켓이 active가 안 됩니다.', answer:'해당 건은 쿠팡 측 커미션 승인 지연으로 인한 사항입니다. 48시간 내 처리 예정입니다.', answered_at:ago(5), created_at:ago(7) },
  'inq-bob-001':   { user_id:'user-linked-bob', category:'gifticon', title:'기프티콘 교환이 안 됩니다', status:'pending', content:'골드 티켓이 있는데 배민 상품권 교환 버튼이 눌리지 않습니다.', answer:null, answered_at:null, created_at:ago(1) },
};

// ═══════════════════════════════════════════════════════
// INVITES (iris→frank, iris→noah, olivia→quinn)
// ═══════════════════════════════════════════════════════
const INVITES = {
  'inv-iris-frank':   { inviter_id:'user-iris-001',   invitee_id:'user-frank-001', status:'completed', created_at:ago(60) },
  'inv-iris-noah':    { inviter_id:'user-iris-001',   invitee_id:'user-noah-001',  status:'completed', created_at:ago(15) },
  'inv-olivia-quinn': { inviter_id:'user-olivia-001', invitee_id:'user-quinn-001', status:'completed', created_at:ago(10) },
};

// ═══════════════════════════════════════════════════════
// DAILY VISITS
// ═══════════════════════════════════════════════════════
const DAILY_VISITS = {
  'dv-frank-01':  { user_id:'user-frank-001',  visited_at:ago(2), points_earned:100 },
  'dv-frank-02':  { user_id:'user-frank-001',  visited_at:ago(1), points_earned:100 },
  'dv-leo-01':    { user_id:'user-leo-001',    visited_at:ago(3), points_earned:100 },
  'dv-leo-02':    { user_id:'user-leo-001',    visited_at:ago(2), points_earned:100 },
  'dv-olivia-01': { user_id:'user-olivia-001', visited_at:ago(3), points_earned:100 },
  'dv-olivia-02': { user_id:'user-olivia-001', visited_at:ago(2), points_earned:100 },
  'dv-olivia-03': { user_id:'user-olivia-001', visited_at:ago(1), points_earned:100 },
  'dv-dave-01':   { user_id:'user-guest-dave', visited_at:ago(2), points_earned:100 },
};

// ═══════════════════════════════════════════════════════
// NOTICES (앱 공지 + CMS 공지 공용)
// ═══════════════════════════════════════════════════════
const NOTICES = {
  'notice-launch': { id:'notice-launch', title:'프라이스픽 v1.0 정식 출시 안내', content:'안녕하세요, 프라이스픽 팀입니다.\n\n경유 쇼핑 리워드 앱 프라이스픽이 정식 출시되었습니다. 쿠팡·11번가·G마켓 등 주요 쇼핑몰에서 픽구매 링크를 통해 구매하시면 등급 티켓을 적립하실 수 있습니다.\n\n적립된 티켓으로 스타벅스, 배달의민족 등 인기 기프티콘을 교환해보세요!\n\n감사합니다.', is_pinned:true, published_at:ago(27), created_at:ago(27), updated_at:ago(27) },
  'notice-terms': { id:'notice-terms', title:'서비스 이용약관 개정 안내', content:'2026년 6월 1일부터 개정된 이용약관이 적용됩니다. 주요 변경 사항은 개인정보처리방침 항목 보완 및 티켓 만료 정책 명시입니다.\n\n변경 내용에 동의하지 않으실 경우 서비스 이용을 중단하시거나 탈퇴하실 수 있습니다.', is_pinned:false, published_at:ago(40), created_at:ago(40), updated_at:ago(40) },
  'notice-ticket-policy': { id:'notice-ticket-policy', title:'티켓 적립 정책 안내', content:'등급 티켓은 브론즈(5천원/장), 실버(5만원/장), 골드(10만원/장) 기준으로 적립됩니다.\n\n등급 티켓 유효기간은 등급 확정일로부터 1년이며, 만료 D-30·D-7에 알림을 발송합니다.', is_pinned:false, published_at:ago(54), created_at:ago(54), updated_at:ago(54) },
  'notice-event-coupang': { id:'notice-event-coupang', title:'[이벤트] 쿠팡 픽구매 티켓 2배 적립', content:'이번 주 한정, 쿠팡 경유 픽구매 시 등급 티켓을 2배로 드립니다. 지금 픽하고 더 많은 티켓을 받아보세요!', is_pinned:false, published_at:ago(5), created_at:ago(5), updated_at:ago(5) },
};

// ═══════════════════════════════════════════════════════
// BANNERS
// ═══════════════════════════════════════════════════════
const BANNERS = {
  'banner-001': { id:'banner-001', type:'home_top', image_url:'https://placehold.co/800x300/3B82F6/white?text=쿠팡+구매하고+티켓+받자', link_url:null, sort_order:1, active:true, starts_at:ts('2026-06-01'), ends_at:ts('2026-12-31'), created_at:ts('2026-06-01') },
  'banner-002': { id:'banner-002', type:'home_mid', image_url:'https://placehold.co/800x200/10B981/white?text=스타벅스+기프티콘+교환', link_url:null, sort_order:1, active:true, starts_at:ts('2026-06-01'), ends_at:ts('2026-12-31'), created_at:ts('2026-06-01') },
};

// ═══════════════════════════════════════════════════════
// ADMIN LOGS (CMS 접근/행위 로그)
// ═══════════════════════════════════════════════════════
const ADMIN_LOGS = {
  'alog-001': { admin_username:'firstadmin', admin_name:'슈퍼어드민', action:'로그인', ip:'211.234.x.x', at:ago(0) },
  'alog-002': { admin_username:'firstadmin', admin_name:'슈퍼어드민', action:'1:1 문의 답변 (티켓이 확정되지 않아요)', ip:'211.234.x.x', at:ago(1) },
  'alog-003': { admin_username:'firstadmin', admin_name:'슈퍼어드민', action:'회원 정지 (라이언)', ip:'211.234.x.x', at:ago(1) },
  'alog-004': { admin_username:'admin-markkim', admin_name:'김반장', action:'기프티콘 상품 등록 (이디야 아메리카노)', ip:'121.5.x.x', at:ago(3) },
  'alog-005': { admin_username:'firstadmin', admin_name:'슈퍼어드민', action:'공지 발행 ([이벤트] 쿠팡 픽구매 티켓 2배)', ip:'211.234.x.x', at:ago(5) },
  'alog-006': { admin_username:'admin-markkim', admin_name:'김반장', action:'로그인', ip:'121.5.x.x', at:ago(6) },
};

// admin_accounts는 로그인 계정이므로 WIPE하지 않고 admin-markkim만 정규화 patch
const ADMIN_PATCH = { 'admin-markkim': { username:'admin-markkim', display_name:'김반장', status:'active' } };

// ═══════════════════════════════════════════════════════
// WIPE + WRITE
// ═══════════════════════════════════════════════════════
// 시드가 소유하는 컬렉션(전부 비우고 재주입). admin_accounts/withdrawals/draws/events는 제외(보존).
const OWNED_COLLECTIONS = [
  'users','user_points','user_tickets','ticket_transactions','point_transactions',
  'postbacks','click_logs','click_postback_matches',
  'gifticons','gifticon_stock','gifticon_exchanges',
  'inquiries','invites','daily_visits','notices','banners',
  'affiliate_malls','ticket_grades','grade_exchange_rules','admin_logs',
];

async function wipeCollection(name) {
  const snap = await db.collection(name).get();
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach((d) => { batch.delete(d.ref); n++; });
    await batch.commit();
  }
  console.log(`  [WIPE] ${name}: ${n}건 삭제`);
}

async function batchWrite(name, docsMap) {
  const entries = Object.entries(docsMap);
  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch();
    entries.slice(i, i + 400).forEach(([id, data]) => batch.set(db.collection(name).doc(id), data));
    await batch.commit();
  }
  console.log(`  [WRITE] ${name}: ${entries.length}건`);
}

async function main() {
  console.log('\n═══ PricePick UNIFIED Demo Seed (v8.2) ═══\n');

  console.log('1) WIPE (admin_accounts 등 보존 컬렉션 제외)');
  for (const c of OWNED_COLLECTIONS) await wipeCollection(c);

  console.log('\n2) WRITE');
  await batchWrite('affiliate_malls', AFFILIATE_MALLS);
  await batchWrite('ticket_grades', TICKET_GRADES);
  await batchWrite('grade_exchange_rules', GRADE_EXCHANGE_RULES);
  await batchWrite('gifticons', GIFTICONS);
  await batchWrite('gifticon_stock', GIFTICON_STOCK);
  await batchWrite('users', USERS);
  await batchWrite('user_points', USER_POINTS);
  await batchWrite('postbacks', POSTBACKS);
  await batchWrite('click_logs', CLICK_LOGS);
  await batchWrite('click_postback_matches', CPM);
  await batchWrite('user_tickets', USER_TICKETS);
  await batchWrite('ticket_transactions', TICKET_TX);
  await batchWrite('point_transactions', POINT_TX);
  await batchWrite('gifticon_exchanges', GIFTICON_EXCHANGES);
  await batchWrite('inquiries', INQUIRIES);
  await batchWrite('invites', INVITES);
  await batchWrite('daily_visits', DAILY_VISITS);
  await batchWrite('notices', NOTICES);
  await batchWrite('banners', BANNERS);
  await batchWrite('admin_logs', ADMIN_LOGS);

  console.log('\n3) admin_accounts 정규화 patch (WIPE 안 함 — 로그인 보존)');
  for (const [id, data] of Object.entries(ADMIN_PATCH)) {
    await db.collection('admin_accounts').doc(id).set(data, { merge: true });
  }
  console.log('  [OK] admin-markkim patch');

  // ── 검증 ──
  console.log('\n─── 검증 ───');
  const users = await db.collection('users').get();
  const dist = { active:0, suspended:0, withdrawn:0, linked:0, guest:0 };
  users.forEach((d) => { const u = d.data(); dist[u.status || 'active']++; if (u.linked_kakao) dist.linked++; else dist.guest++; });
  console.log(`  users: ${users.size}명 (active ${dist.active}/suspended ${dist.suspended}/withdrawn ${dist.withdrawn}, 연동 ${dist.linked}/게스트 ${dist.guest})`);

  // 포인트 정합성
  const ptx = await db.collection('point_transactions').get();
  const sum = {};
  ptx.forEach((d) => { const p = d.data(); sum[p.user_id] = (sum[p.user_id] || 0) + (p.amount || 0); });
  const up = await db.collection('user_points').get();
  let pOk = true;
  up.forEach((d) => { const p = d.data(); const s = sum[d.id] || 0; if ((p.balance || 0) !== s) { console.log(`  ✗ 포인트 불일치 ${d.id}: balance=${p.balance} ≠ Σtx=${s}`); pOk = false; } });
  console.log(pOk ? '  ✓ 포인트 잔액 = Σtx (전 유저)' : '  ✗ 포인트 정합성 실패');

  // 적립금액 커버리지: confirmed 포스트백(최근 top10, 매칭) 전원 earn 보유?
  const earn = await db.collection('ticket_transactions').where('type', '==', 'earn').get();
  const earnByPb = {};
  earn.forEach((d) => { const x = d.data(); if (!x.postback_id) return; const g = x.ticket_grade; if (!['bronze','silver','gold'].includes(g)) return; earnByPb[x.postback_id] = (earnByPb[x.postback_id] || 0) + 1; });
  const pb = await db.collection('postbacks').get();
  const confirmed = pb.docs.filter((d) => d.data().status === 'confirmed').sort((a, b) => b.data().created_at.toMillis() - a.data().created_at.toMillis());
  const top10 = confirmed.slice(0, 10);
  const noEarn = top10.filter((d) => !earnByPb[d.id]);
  console.log(`  confirmed 포스트백: ${confirmed.length}건 / 최근10건 중 적립 없는 행: ${noEarn.length}건` + (noEarn.length ? ' → ' + noEarn.map((d) => d.id).join(',') : ' ✓'));

  console.log('\n═══ 완료 ═══');
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
