/**
 * seed-roulette.js — 룰렛 2종 확정 구성을 settings 문서에 기록
 *
 * 2026-07-31 이동영 부장 협의 확정 스펙 그대로 넣는다.
 *   settings/roulette          매일 행운 룰렛 (무료 · 출석 1일 1회)   1회 기대값 9.9원
 *   settings/jackpot_roulette  잭팟 룰렛 (유료 · 이벤트 티켓 1장=1회) 1회 기대값 40원
 *
 * CMS 화면에서 [기본값 복원] → [저장]을 누른 것과 같은 결과다.
 * 운영자가 잘못 저장한 값을 확정 스펙으로 되돌릴 때 쓴다.
 *   node scripts/seed-roulette.js
 */
const path = require('path');
const os   = require('os');
const fs   = require('fs');

// ── Auth (firebase-tools OAuth2) — seed-admin.js와 동일한 방식 ──
const cfgPath = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
const cfg     = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const tokens  = cfg.tokens;
const adc = {
  type:          'authorized_user',
  client_id:     '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  refresh_token: tokens.refresh_token,
};
const adcPath = path.join(__dirname, '..', '.adc.json');
fs.writeFileSync(adcPath, JSON.stringify(adc));
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;

const admin = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
const { getFirestore, FieldValue } = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin', 'lib', 'firestore', 'index.js'));

admin.initializeApp({ credential: admin.applicationDefault(), projectId: 'pricepick-demo' });
const db = getFirestore();

/* CMS(cms/index.html)의 RLT_REWARD_TYPES와 같은 환산표 — 기대값 검산용 */
const UNIT_VALUE = {
  miss: 0, point: 0.1, event_ticket: 40, bronze_ticket: 100, silver_ticket: 1000, gold_ticket: 2000,
};

const CONFIG = {
  roulette: {
    name: '매일 행운 룰렛',
    expect: 9.9,
    legacyWheel: true,   /* 데모 앱이 아직 wheel(type/value)을 읽는다 */
    slots: [
      { type: 'silver_ticket', qty: 1,   prob: 0.2  },
      { type: 'event_ticket',  qty: 1,   prob: 5    },
      { type: 'bronze_ticket', qty: 1,   prob: 2    },
      { type: 'point',         qty: 100, prob: 35   },
      { type: 'point',         qty: 10,  prob: 40   },
      { type: 'miss',          qty: 0,   prob: 17.8 },
    ],
  },
  jackpot_roulette: {
    name: '잭팟 룰렛',
    expect: 40,
    legacyWheel: false,
    /* 순서 = 앱 휠 칸 배치(12시부터 시계방향) · 20260731 시안 휠 그대로 */
    slots: [
      { type: 'gold_ticket',   qty: 1,    prob: 0.4  },
      { type: 'point',         qty: 1000, prob: 5    },
      { type: 'bronze_ticket', qty: 1,    prob: 12   },
      { type: 'miss',          qty: 0,    prob: 31.6 },
      { type: 'point',         qty: 100,  prob: 50   },
      { type: 'silver_ticket', qty: 1,    prob: 1    },
    ],
    /* 악용 방지 3종 */
    limits: { daily_spin_cap: 10, require_confirmed_purchase: true, event_ticket_monthly_cap: 30 },
  },
};

function slotValue(s) { return (UNIT_VALUE[s.type] || 0) * (s.type === 'miss' ? 0 : s.qty); }
function totalEv(slots) { return slots.reduce((a, s) => a + slotValue(s) * s.prob / 100, 0); }
function sumProb(slots) { return slots.reduce((a, s) => a + Math.round(s.prob * 10), 0) / 10; }

(async () => {
  for (const [docId, c] of Object.entries(CONFIG)) {
    const sum = sumProb(c.slots);
    const ev  = Math.round(totalEv(c.slots) * 100) / 100;
    /* 확정 스펙과 어긋나면 쓰지 않는다 — CMS 저장 검증과 같은 기준 */
    if (Math.abs(sum - 100) > 0.001) throw new Error(`${c.name}: 확률 합계 ${sum}% (100%가 아님)`);
    if (Math.abs(ev - c.expect) > 0.001) throw new Error(`${c.name}: 기대값 ${ev}원 (확정 ${c.expect}원과 다름)`);

    const payload = {
      slots: c.slots,
      slot_count: c.slots.length,
      expected_value: ev,
      updated_at: FieldValue.serverTimestamp(),
    };
    if (c.legacyWheel) payload.wheel = c.slots.map(s => ({ type: s.type, value: s.qty }));
    if (c.limits) payload.limits = c.limits;

    await db.collection('settings').doc(docId).set(payload, { merge: true });
    console.log(`settings/${docId} — ${c.name}: 슬롯 ${c.slots.length}개 · 합계 ${sum}% · 1회 기대값 ${ev}원`);
  }
  console.log('완료');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
