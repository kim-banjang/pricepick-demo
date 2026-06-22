/**
 * PricePick Demo — Firestore Seed Script
 * Based on v8.2 Data Model (31 entities, 7 groups A~G)
 *
 * Auth: uses firebase-tools OAuth2 refresh token (no service account key needed)
 * Run: node scripts/seed.js
 */

'use strict';

const { initializeApp, refreshToken } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ─────────────────────────────────────────────
// Auth via firebase-tools stored credentials
// ─────────────────────────────────────────────
const FIREBASE_TOOLS_CONFIG = path.join(
  os.homedir(),
  '.config/configstore/firebase-tools.json'
);
const FT_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FT_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const now = () => Timestamp.now();
const ts = (date) => Timestamp.fromDate(new Date(date));
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return Timestamp.fromDate(d);
};
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Timestamp.fromDate(d);
};

// Fixed IDs for deterministic demo data
const IDS = {
  // Users
  USER_LINKED_1: 'user-linked-alice',
  USER_LINKED_2: 'user-linked-bob',
  USER_LINKED_3: 'user-linked-carol',
  USER_GUEST_1:  'user-guest-dave',
  USER_GUEST_2:  'user-guest-eve',
  // Affiliate malls
  MALL_COUPANG: 'coupang',
  // Gifticons
  GIF_STARBUCKS: 'gif-starbucks-4500',
  GIF_CU: 'gif-cu-3000',
  GIF_BAEMIN: 'gif-baemin-10000',
  // Clicks
  CLICK_1: uuidv4(), CLICK_2: uuidv4(), CLICK_3: uuidv4(),
  // Postbacks
  PB_1: uuidv4(), PB_2: uuidv4(), PB_3: uuidv4(), PB_4: uuidv4(),
  // Matches
  MATCH_1: uuidv4(), MATCH_2: uuidv4(), MATCH_3: uuidv4(), MATCH_4: uuidv4(),
  // Tickets
  TKT_A1: uuidv4(), TKT_A2: uuidv4(), TKT_A3: uuidv4(),
  TKT_B1: uuidv4(), TKT_B2: uuidv4(),
  TKT_C1: uuidv4(), TKT_D1: uuidv4(), TKT_E1: uuidv4(),
  // Ticket transactions
  TTX_1: uuidv4(), TTX_2: uuidv4(), TTX_3: uuidv4(),
  TTX_4: uuidv4(), TTX_5: uuidv4(), TTX_6: uuidv4(), TTX_7: uuidv4(),
  // Point transactions
  PTX_1: uuidv4(), PTX_2: uuidv4(), PTX_3: uuidv4(),
  PTX_4: uuidv4(), PTX_5: uuidv4(),
};

// ─────────────────────────────────────────────
// Seed definitions
// ─────────────────────────────────────────────

function buildSeedData() {
  return {

    // ── B. Master Data ──────────────────────────
    affiliate_malls: {
      [IDS.MALL_COUPANG]: {
        id: IDS.MALL_COUPANG,
        mall_code: 'coupang',
        name: '쿠팡',
        commission_rate: 0.0200,
        deeplink_template: 'https://link.coupang.com/re/DEMO?click_id={click_id}',
        active: true,
        created_at: ts('2026-01-01'),
      },
    },

    ticket_grades: {
      bronze: {
        grade_code: 'bronze',
        accrual_unit_krw: 5000,
        reward_value_krw: 100,
        reward_rate: 0.02,
        sort_order: 1,
      },
      silver: {
        grade_code: 'silver',
        accrual_unit_krw: 50000,
        reward_value_krw: 1000,
        reward_rate: 0.02,
        sort_order: 2,
      },
      gold: {
        grade_code: 'gold',
        accrual_unit_krw: 100000,
        reward_value_krw: 2000,
        reward_rate: 0.02,
        sort_order: 3,
      },
    },

    grade_exchange_rules: {
      'rule-bronze-to-silver': {
        id: 'rule-bronze-to-silver',
        from_grade: 'bronze', to_grade: 'silver',
        from_qty: 10, to_qty: 1,
        created_at: ts('2026-01-01'),
      },
      'rule-silver-to-bronze': {
        id: 'rule-silver-to-bronze',
        from_grade: 'silver', to_grade: 'bronze',
        from_qty: 1, to_qty: 10,
        created_at: ts('2026-01-01'),
      },
      'rule-silver-to-gold': {
        id: 'rule-silver-to-gold',
        from_grade: 'silver', to_grade: 'gold',
        from_qty: 2, to_qty: 1,
        created_at: ts('2026-01-01'),
      },
      'rule-gold-to-silver': {
        id: 'rule-gold-to-silver',
        from_grade: 'gold', to_grade: 'silver',
        from_qty: 1, to_qty: 2,
        created_at: ts('2026-01-01'),
      },
    },

    // ── E. Gifticons ────────────────────────────
    gifticons: {
      [IDS.GIF_STARBUCKS]: {
        id: IDS.GIF_STARBUCKS,
        category: '카페',
        brand: '스타벅스',
        name: '아메리카노 Tall (4,500원)',
        emoji: '☕',
        product_code: 'SBX-TALL-001',
        price: 4500,
        required_grade: 'bronze',
        required_count: 50,
        valid_days: 30,
        status: 'active',
        sale_end_at: null,
        created_at: ts('2026-01-01'),
      },
      [IDS.GIF_CU]: {
        id: IDS.GIF_CU,
        category: '편의점',
        brand: 'CU',
        name: 'CU 3,000원 금액권',
        emoji: '🏪',
        product_code: 'CU-3000-001',
        price: 3000,
        required_grade: 'bronze',
        required_count: 33,
        valid_days: 30,
        status: 'active',
        sale_end_at: null,
        created_at: ts('2026-01-01'),
      },
      [IDS.GIF_BAEMIN]: {
        id: IDS.GIF_BAEMIN,
        category: '배달',
        brand: '배달의민족',
        name: '배민 10,000원 상품권',
        emoji: '🍔',
        product_code: 'BAEMIN-10000-001',
        price: 10000,
        required_grade: 'silver',
        required_count: 11,
        valid_days: 30,
        status: 'active',
        sale_end_at: null,
        created_at: ts('2026-01-01'),
      },
    },

    gifticon_stock: {
      [IDS.GIF_STARBUCKS]: {
        id: IDS.GIF_STARBUCKS,
        gifticon_id: IDS.GIF_STARBUCKS,
        total_issued: 500,
        remaining: 487,
        updated_at: now(),
      },
      [IDS.GIF_CU]: {
        id: IDS.GIF_CU,
        gifticon_id: IDS.GIF_CU,
        total_issued: 300,
        remaining: 294,
        updated_at: now(),
      },
      [IDS.GIF_BAEMIN]: {
        id: IDS.GIF_BAEMIN,
        gifticon_id: IDS.GIF_BAEMIN,
        total_issued: 200,
        remaining: 198,
        updated_at: now(),
      },
    },

    // ── A. Users ────────────────────────────────
    users: {
      [IDS.USER_LINKED_1]: {
        user_id: IDS.USER_LINKED_1,
        nickname: '앨리스',
        link_status: 'linked',
        status: 'active',
        joined_at: ts('2026-03-01'),
        withdrawn_at: null,
        created_at: ts('2026-03-01'),
        updated_at: ts('2026-06-01'),
      },
      [IDS.USER_LINKED_2]: {
        user_id: IDS.USER_LINKED_2,
        nickname: '밥',
        link_status: 'linked',
        status: 'active',
        joined_at: ts('2026-04-10'),
        withdrawn_at: null,
        created_at: ts('2026-04-10'),
        updated_at: ts('2026-06-10'),
      },
      [IDS.USER_LINKED_3]: {
        user_id: IDS.USER_LINKED_3,
        nickname: '캐롤',
        link_status: 'linked',
        status: 'suspended',
        joined_at: ts('2026-02-15'),
        withdrawn_at: null,
        created_at: ts('2026-02-15'),
        updated_at: ts('2026-06-20'),
      },
      [IDS.USER_GUEST_1]: {
        user_id: IDS.USER_GUEST_1,
        nickname: '데이브(게스트)',
        link_status: 'guest',
        status: 'active',
        joined_at: ts('2026-06-01'),
        withdrawn_at: null,
        created_at: ts('2026-06-01'),
        updated_at: ts('2026-06-01'),
      },
      [IDS.USER_GUEST_2]: {
        user_id: IDS.USER_GUEST_2,
        nickname: '이브(게스트)',
        link_status: 'guest',
        status: 'active',
        joined_at: ts('2026-06-10'),
        withdrawn_at: null,
        created_at: ts('2026-06-10'),
        updated_at: ts('2026-06-10'),
      },
    },

    // ── User subcollections (auth_providers, devices) ──
    // Stored as arrays here; seed script handles subcollections separately
    _user_auth_providers: [
      {
        _parent: IDS.USER_LINKED_1,
        id: uuidv4(),
        user_id: IDS.USER_LINKED_1,
        provider: 'kakao',
        provider_user_id: 'kakao_uid_alice_001',
        account_type: null,
        linked_at: ts('2026-03-01'),
        created_at: ts('2026-03-01'),
      },
      {
        _parent: IDS.USER_LINKED_2,
        id: uuidv4(),
        user_id: IDS.USER_LINKED_2,
        provider: 'kakao',
        provider_user_id: 'kakao_uid_bob_002',
        account_type: null,
        linked_at: ts('2026-04-10'),
        created_at: ts('2026-04-10'),
      },
      {
        _parent: IDS.USER_LINKED_3,
        id: uuidv4(),
        user_id: IDS.USER_LINKED_3,
        provider: 'kakao',
        provider_user_id: 'kakao_uid_carol_003',
        account_type: null,
        linked_at: ts('2026-02-15'),
        created_at: ts('2026-02-15'),
      },
    ],

    _user_devices: [
      {
        _parent: IDS.USER_LINKED_1,
        id: uuidv4(),
        user_id: IDS.USER_LINKED_1,
        device_uuid: 'device-uuid-alice-iphone',
        os: 'ios',
        push_token: 'fcm-token-alice-001',
        att_granted: true,
        last_seen_at: daysAgo(1),
        created_at: ts('2026-03-01'),
      },
      {
        _parent: IDS.USER_LINKED_2,
        id: uuidv4(),
        user_id: IDS.USER_LINKED_2,
        device_uuid: 'device-uuid-bob-android',
        os: 'android',
        push_token: 'fcm-token-bob-002',
        att_granted: false,
        last_seen_at: daysAgo(3),
        created_at: ts('2026-04-10'),
      },
      {
        _parent: IDS.USER_GUEST_1,
        id: uuidv4(),
        user_id: IDS.USER_GUEST_1,
        device_uuid: 'device-uuid-dave-android',
        os: 'android',
        push_token: null,
        att_granted: false,
        last_seen_at: daysAgo(2),
        created_at: ts('2026-06-01'),
      },
    ],

    // ── C. Click logs ───────────────────────────
    click_logs: {
      [IDS.CLICK_1]: {
        click_id: IDS.CLICK_1,
        user_id: IDS.USER_LINKED_1,
        mall_code: 'coupang',
        clicked_at: daysAgo(10),
        valid_until: daysAgo(9),  // expired (10d ago + 24h)
        created_at: daysAgo(10),
      },
      [IDS.CLICK_2]: {
        click_id: IDS.CLICK_2,
        user_id: IDS.USER_LINKED_2,
        mall_code: 'coupang',
        clicked_at: daysAgo(5),
        valid_until: daysAgo(4),  // expired
        created_at: daysAgo(5),
      },
      [IDS.CLICK_3]: {
        click_id: IDS.CLICK_3,
        user_id: IDS.USER_GUEST_1,
        mall_code: 'coupang',
        clicked_at: daysAgo(2),
        valid_until: daysAgo(1),  // expired
        created_at: daysAgo(2),
      },
    },

    // ── C. Postbacks ─────────────────────────────
    postbacks: {
      [IDS.PB_1]: {
        postback_id: IDS.PB_1,
        user_id: IDS.USER_LINKED_1,
        mall_code: 'coupang',
        order_id: 'CPN-ORDER-20260612-001',
        raw_payload: { event: 'purchase', amount: 67000, commission: 1340 },
        purchase_amount: 67000,
        commission_amount: 1340,
        status: 'confirmed',
        purchased_at: daysAgo(10),
        confirmed_at: daysAgo(3),   // D+7 for linked user
        received_at: daysAgo(10),
        processed_at: daysAgo(3),
        created_at: daysAgo(10),
      },
      [IDS.PB_2]: {
        postback_id: IDS.PB_2,
        user_id: IDS.USER_LINKED_2,
        mall_code: 'coupang',
        order_id: 'CPN-ORDER-20260617-002',
        raw_payload: { event: 'purchase', amount: 120000, commission: 2400 },
        purchase_amount: 120000,
        commission_amount: 2400,
        status: 'confirmed',
        purchased_at: daysAgo(5),
        confirmed_at: daysAgo(0),   // just confirmed today (D+5 early)
        received_at: daysAgo(5),
        processed_at: now(),
        created_at: daysAgo(5),
      },
      [IDS.PB_3]: {
        postback_id: IDS.PB_3,
        user_id: IDS.USER_GUEST_1,
        mall_code: 'coupang',
        order_id: 'CPN-ORDER-20260620-003',
        raw_payload: { event: 'purchase', amount: 15000, commission: 300 },
        purchase_amount: 15000,
        commission_amount: 300,
        status: 'pending',          // guest: D+30 pending
        purchased_at: daysAgo(2),
        confirmed_at: null,
        received_at: daysAgo(2),
        processed_at: null,
        created_at: daysAgo(2),
      },
      [IDS.PB_4]: {
        postback_id: IDS.PB_4,
        user_id: null,              // unmatched postback (no user)
        mall_code: 'coupang',
        order_id: 'CPN-ORDER-20260621-004',
        raw_payload: { event: 'purchase', amount: 34000, commission: 680 },
        purchase_amount: 34000,
        commission_amount: 680,
        status: 'pending',
        purchased_at: daysAgo(1),
        confirmed_at: null,
        received_at: daysAgo(1),
        processed_at: null,
        created_at: daysAgo(1),
      },
    },

    // ── C. Matches ───────────────────────────────
    click_postback_matches: {
      [IDS.MATCH_1]: {
        match_id: IDS.MATCH_1,
        click_id: IDS.CLICK_1,
        postback_id: IDS.PB_1,
        user_id: IDS.USER_LINKED_1,
        match_status: 'matched',
        matched_at: daysAgo(10),
        created_at: daysAgo(10),
      },
      [IDS.MATCH_2]: {
        match_id: IDS.MATCH_2,
        click_id: IDS.CLICK_2,
        postback_id: IDS.PB_2,
        user_id: IDS.USER_LINKED_2,
        match_status: 'matched',
        matched_at: daysAgo(5),
        created_at: daysAgo(5),
      },
      [IDS.MATCH_3]: {
        match_id: IDS.MATCH_3,
        click_id: IDS.CLICK_3,
        postback_id: IDS.PB_3,
        user_id: IDS.USER_GUEST_1,
        match_status: 'matched',
        matched_at: daysAgo(2),
        created_at: daysAgo(2),
      },
      [IDS.MATCH_4]: {
        match_id: IDS.MATCH_4,
        click_id: null,
        postback_id: IDS.PB_4,
        user_id: null,
        match_status: 'unmatched',
        matched_at: null,
        created_at: daysAgo(1),
      },
    },

    // ── D. User Tickets ──────────────────────────
    // Alice: 67000원 구매 → gold(0) + silver(1) + bronze(4) = Greedy
    // Bob: 120000원 구매 → gold(1) + silver(0) + bronze(4) = Greedy
    // Dave(guest): 15000원 구매 → bronze(3) pending
    user_tickets: {
      [IDS.TKT_A1]: {
        id: IDS.TKT_A1,
        user_id: IDS.USER_LINKED_1,
        ticket_type: 'grade',
        grade_code: 'silver',
        qty: 1,
        status: 'active',
        source: 'purchase',
        acquired_at: daysAgo(10),
        confirmed_at: daysAgo(3),
        expires_at: daysFromNow(355),
        created_at: daysAgo(10),
        updated_at: daysAgo(3),
      },
      [IDS.TKT_A2]: {
        id: IDS.TKT_A2,
        user_id: IDS.USER_LINKED_1,
        ticket_type: 'grade',
        grade_code: 'bronze',
        qty: 4,
        status: 'active',
        source: 'purchase',
        acquired_at: daysAgo(10),
        confirmed_at: daysAgo(3),
        expires_at: daysFromNow(355),
        created_at: daysAgo(10),
        updated_at: daysAgo(3),
      },
      [IDS.TKT_A3]: {
        id: IDS.TKT_A3,
        user_id: IDS.USER_LINKED_1,
        ticket_type: 'event',
        grade_code: null,
        qty: 2,
        status: 'active',
        source: 'attendance',
        acquired_at: daysAgo(2),
        confirmed_at: daysAgo(2),
        expires_at: daysFromNow(363),
        created_at: daysAgo(2),
        updated_at: daysAgo(2),
      },
      [IDS.TKT_B1]: {
        id: IDS.TKT_B1,
        user_id: IDS.USER_LINKED_2,
        ticket_type: 'grade',
        grade_code: 'gold',
        qty: 1,
        status: 'active',
        source: 'purchase',
        acquired_at: daysAgo(5),
        confirmed_at: now(),
        expires_at: daysFromNow(360),
        created_at: daysAgo(5),
        updated_at: now(),
      },
      [IDS.TKT_B2]: {
        id: IDS.TKT_B2,
        user_id: IDS.USER_LINKED_2,
        ticket_type: 'grade',
        grade_code: 'bronze',
        qty: 4,
        status: 'active',
        source: 'purchase',
        acquired_at: daysAgo(5),
        confirmed_at: now(),
        expires_at: daysFromNow(360),
        created_at: daysAgo(5),
        updated_at: now(),
      },
      [IDS.TKT_C1]: {
        id: IDS.TKT_C1,
        user_id: IDS.USER_GUEST_1,
        ticket_type: 'grade',
        grade_code: 'bronze',
        qty: 3,
        status: 'pending',          // guest: D+30 미확정
        source: 'purchase',
        acquired_at: daysAgo(2),
        confirmed_at: null,
        expires_at: daysFromNow(363),
        created_at: daysAgo(2),
        updated_at: daysAgo(2),
      },
      [IDS.TKT_D1]: {
        id: IDS.TKT_D1,
        user_id: IDS.USER_LINKED_3,
        ticket_type: 'grade',
        grade_code: 'bronze',
        qty: 0,
        status: 'expired',
        source: 'purchase',
        acquired_at: daysAgo(370),
        confirmed_at: daysAgo(363),
        expires_at: daysAgo(5),
        created_at: daysAgo(370),
        updated_at: daysAgo(5),
      },
      [IDS.TKT_E1]: {
        id: IDS.TKT_E1,
        user_id: IDS.USER_GUEST_2,
        ticket_type: 'grade',
        grade_code: 'bronze',
        qty: 1,
        status: 'pending',
        source: 'purchase',
        acquired_at: daysAgo(1),
        confirmed_at: null,
        expires_at: daysFromNow(364),
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
      },
    },

    // ── D. User Points ───────────────────────────
    user_points: {
      [IDS.USER_LINKED_1]: {
        user_id: IDS.USER_LINKED_1,
        balance: 3500,    // 100P referral + 2900P events
        updated_at: daysAgo(1),
        created_at: ts('2026-03-01'),
      },
      [IDS.USER_LINKED_2]: {
        user_id: IDS.USER_LINKED_2,
        balance: 1200,
        updated_at: daysAgo(3),
        created_at: ts('2026-04-10'),
      },
      [IDS.USER_LINKED_3]: {
        user_id: IDS.USER_LINKED_3,
        balance: 0,
        updated_at: daysAgo(5),
        created_at: ts('2026-02-15'),
      },
      [IDS.USER_GUEST_1]: {
        user_id: IDS.USER_GUEST_1,
        balance: 100,
        updated_at: daysAgo(1),
        created_at: ts('2026-06-01'),
      },
      [IDS.USER_GUEST_2]: {
        user_id: IDS.USER_GUEST_2,
        balance: 0,
        updated_at: ts('2026-06-10'),
        created_at: ts('2026-06-10'),
      },
    },

    // ── C. Ticket Transactions (immutable ledger) ─
    ticket_transactions: {
      [IDS.TTX_1]: {
        id: IDS.TTX_1,
        user_id: IDS.USER_LINKED_1,
        ticket_type: 'grade',
        grade_code: 'bronze',
        type: 'EARN',
        qty: 13,             // 67000 / 5000 = 13.4 → 13개 bronze pending
        source: 'purchase',
        ref_type: 'postbacks',
        ref_id: IDS.PB_1,
        expires_at: daysFromNow(355),
        created_at: daysAgo(10),
      },
      [IDS.TTX_2]: {
        id: IDS.TTX_2,
        user_id: IDS.USER_LINKED_1,
        ticket_type: 'grade',
        grade_code: 'bronze',
        type: 'CONVERT',     // bronze 13 → silver 1 + bronze 4 (greedy: 10bronze=1silver, 3bronze remain + 1extra from 50000)
        qty: -10,            // consumed
        source: 'purchase',
        ref_type: 'postbacks',
        ref_id: IDS.PB_1,
        expires_at: null,
        created_at: daysAgo(3),
      },
      [IDS.TTX_3]: {
        id: IDS.TTX_3,
        user_id: IDS.USER_LINKED_1,
        ticket_type: 'grade',
        grade_code: 'silver',
        type: 'EARN',
        qty: 1,
        source: 'purchase',
        ref_type: 'postbacks',
        ref_id: IDS.PB_1,
        expires_at: daysFromNow(355),
        created_at: daysAgo(3),
      },
      [IDS.TTX_4]: {
        id: IDS.TTX_4,
        user_id: IDS.USER_LINKED_2,
        ticket_type: 'grade',
        grade_code: 'bronze',
        type: 'EARN',
        qty: 24,             // 120000 / 5000 = 24
        source: 'purchase',
        ref_type: 'postbacks',
        ref_id: IDS.PB_2,
        expires_at: daysFromNow(360),
        created_at: daysAgo(5),
      },
      [IDS.TTX_5]: {
        id: IDS.TTX_5,
        user_id: IDS.USER_LINKED_2,
        ticket_type: 'grade',
        grade_code: 'bronze',
        type: 'CONVERT',
        qty: -20,            // 20 bronze consumed to convert
        source: 'purchase',
        ref_type: 'postbacks',
        ref_id: IDS.PB_2,
        expires_at: null,
        created_at: now(),
      },
      [IDS.TTX_6]: {
        id: IDS.TTX_6,
        user_id: IDS.USER_LINKED_2,
        ticket_type: 'grade',
        grade_code: 'gold',
        type: 'EARN',
        qty: 1,              // 10 silver → 1 gold (greedy: 120000 → gold + 4 bronze remain)
        source: 'purchase',
        ref_type: 'postbacks',
        ref_id: IDS.PB_2,
        expires_at: daysFromNow(360),
        created_at: now(),
      },
      [IDS.TTX_7]: {
        id: IDS.TTX_7,
        user_id: IDS.USER_GUEST_1,
        ticket_type: 'grade',
        grade_code: 'bronze',
        type: 'EARN',
        qty: 3,              // 15000 / 5000 = 3 pending
        source: 'purchase',
        ref_type: 'postbacks',
        ref_id: IDS.PB_3,
        expires_at: daysFromNow(363),
        created_at: daysAgo(2),
      },
    },

    // ── D. Point Transactions (immutable ledger) ──
    point_transactions: {
      [IDS.PTX_1]: {
        id: IDS.PTX_1,
        user_id: IDS.USER_LINKED_1,
        type: 'EARN',
        qty: 500,
        source: 'referral',
        ref_type: null,
        ref_id: null,
        expires_at: daysFromNow(355),
        created_at: daysAgo(10),
      },
      [IDS.PTX_2]: {
        id: IDS.PTX_2,
        user_id: IDS.USER_LINKED_1,
        type: 'EARN',
        qty: 3000,
        source: 'daily_visit',
        ref_type: null,
        ref_id: null,
        expires_at: daysFromNow(350),
        created_at: daysAgo(15),
      },
      [IDS.PTX_3]: {
        id: IDS.PTX_3,
        user_id: IDS.USER_LINKED_2,
        type: 'EARN',
        qty: 500,
        source: 'onboarding',
        ref_type: null,
        ref_id: null,
        expires_at: daysFromNow(350),
        created_at: daysAgo(5),
      },
      [IDS.PTX_4]: {
        id: IDS.PTX_4,
        user_id: IDS.USER_LINKED_2,
        type: 'EARN',
        qty: 700,
        source: 'daily_visit',
        ref_type: null,
        ref_id: null,
        expires_at: daysFromNow(348),
        created_at: daysAgo(3),
      },
      [IDS.PTX_5]: {
        id: IDS.PTX_5,
        user_id: IDS.USER_GUEST_1,
        type: 'EARN',
        qty: 100,
        source: 'daily_visit',
        ref_type: null,
        ref_id: null,
        expires_at: daysFromNow(363),
        created_at: daysAgo(2),
      },
    },

    // ── G. Admin Account ─────────────────────────
    admin_accounts: {
      'admin-markkim': {
        id: 'admin-markkim',
        email: 'sgkim.mixit@gmail.com',
        name: '김반장',
        role: 'superadmin',
        last_login_at: now(),
        active: true,
        created_at: ts('2026-01-01'),
      },
    },

    // ── G. Notice ────────────────────────────────
    notices: {
      'notice-001': {
        id: 'notice-001',
        title: '[공지] 프라이스픽 데모 서비스 오픈 안내',
        content: '프라이스픽 CMS 데모가 오픈되었습니다. 본 데모 데이터는 실제 데이터와 무관합니다.',
        is_pinned: true,
        published_at: now(),
        created_at: now(),
        updated_at: now(),
      },
    },

    // ── F. Banner ────────────────────────────────
    banners: {
      'banner-001': {
        id: 'banner-001',
        type: 'home_top',
        image_url: 'https://placehold.co/800x300/3B82F6/white?text=쿠팡+구매하고+티켓+받자',
        link_url: null,
        sort_order: 1,
        active: true,
        starts_at: ts('2026-06-01'),
        ends_at: ts('2026-12-31'),
        created_at: ts('2026-06-01'),
      },
      'banner-002': {
        id: 'banner-002',
        type: 'home_mid',
        image_url: 'https://placehold.co/800x200/10B981/white?text=스타벅스+기프티콘+교환',
        link_url: null,
        sort_order: 1,
        active: true,
        starts_at: ts('2026-06-01'),
        ends_at: ts('2026-12-31'),
        created_at: ts('2026-06-01'),
      },
    },

    // ── F. Inquiry ───────────────────────────────
    inquiries: {
      'inq-001': {
        id: 'inq-001',
        user_id: IDS.USER_LINKED_1,
        category: 'ticket',
        title: '티켓이 확정되지 않아요',
        content: '쿠팡에서 구매했는데 7일이 지났는데도 티켓이 active가 안 됩니다.',
        status: 'answered',
        answer: '해당 건은 쿠팡 측 커미션 승인 지연으로 인한 사항입니다. 48시간 내 처리 예정입니다.',
        answered_at: daysAgo(1),
        created_at: daysAgo(3),
      },
      'inq-002': {
        id: 'inq-002',
        user_id: IDS.USER_LINKED_2,
        category: 'gifticon',
        title: '기프티콘 교환이 안 됩니다',
        content: '골드 티켓이 있는데 배민 상품권 교환 버튼이 눌리지 않습니다.',
        status: 'pending',
        answer: null,
        answered_at: null,
        created_at: daysAgo(1),
      },
    },
  };
}

// ─────────────────────────────────────────────
// Write helpers
// ─────────────────────────────────────────────
async function batchWrite(db, collectionName, docsMap) {
  const entries = Object.entries(docsMap);
  let batchCount = 0;

  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + 400);
    for (const [docId, data] of chunk) {
      const ref = db.collection(collectionName).doc(docId);
      batch.set(ref, data);
    }
    await batch.commit();
    batchCount++;
  }
  console.log(`  [OK] ${collectionName} — ${entries.length} docs (${batchCount} batch(es))`);
}

async function writeSubcollection(db, parentCollection, items, subCollection) {
  const batch = db.batch();
  for (const item of items) {
    const { _parent, id, ...data } = item;
    const ref = db.collection(parentCollection).doc(_parent).collection(subCollection).doc(id);
    batch.set(ref, data);
  }
  await batch.commit();
  console.log(`  [OK] ${parentCollection}/*/auth_providers or devices — ${items.length} docs`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log('\n== PricePick Demo Seed ==');
  console.log('Project: pricepick-demo\n');

  // Init Admin SDK with firebase-tools OAuth2 refresh token
  let ftConfig;
  try {
    ftConfig = JSON.parse(fs.readFileSync(FIREBASE_TOOLS_CONFIG, 'utf8'));
    console.log('[auth] Using firebase-tools OAuth2 refresh token for:', ftConfig.user.email);
  } catch (e) {
    console.error('[auth] Failed to load firebase-tools credentials:', e.message);
    process.exit(1);
  }

  // Write ADC file and use applicationDefault() — Firestore requires cert or ADC
  const adcPath = path.join(__dirname, '..', '.adc.json');
  fs.writeFileSync(adcPath, JSON.stringify({
    type: 'authorized_user',
    client_id: FT_CLIENT_ID,
    client_secret: FT_CLIENT_SECRET,
    refresh_token: ftConfig.tokens.refresh_token,
  }));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;

  const { applicationDefault } = require('firebase-admin/app');
  initializeApp({
    credential: applicationDefault(),
    projectId: 'pricepick-demo',
  });

  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  const seed = buildSeedData();

  console.log('Writing collections...\n');

  // B. Master
  await batchWrite(db, 'affiliate_malls', seed.affiliate_malls);
  await batchWrite(db, 'ticket_grades', seed.ticket_grades);
  await batchWrite(db, 'grade_exchange_rules', seed.grade_exchange_rules);

  // E. Gifticons
  await batchWrite(db, 'gifticons', seed.gifticons);
  await batchWrite(db, 'gifticon_stock', seed.gifticon_stock);

  // A. Users
  await batchWrite(db, 'users', seed.users);
  await writeSubcollection(db, 'users', seed._user_auth_providers, 'auth_providers');
  await writeSubcollection(db, 'users', seed._user_devices, 'devices');

  // C. Attribution
  await batchWrite(db, 'click_logs', seed.click_logs);
  await batchWrite(db, 'postbacks', seed.postbacks);
  await batchWrite(db, 'click_postback_matches', seed.click_postback_matches);
  await batchWrite(db, 'ticket_transactions', seed.ticket_transactions);

  // D. Assets
  await batchWrite(db, 'user_tickets', seed.user_tickets);
  await batchWrite(db, 'user_points', seed.user_points);
  await batchWrite(db, 'point_transactions', seed.point_transactions);

  // G. Ops
  await batchWrite(db, 'admin_accounts', seed.admin_accounts);
  await batchWrite(db, 'notices', seed.notices);
  await batchWrite(db, 'banners', seed.banners);
  await batchWrite(db, 'inquiries', seed.inquiries);

  console.log('\n== Seed complete ==');

  // Verify: dump collection list
  console.log('\nVerifying — listing collections...');
  const collections = await db.listCollections();
  console.log('Collections in Firestore:');
  for (const col of collections) {
    const snap = await col.limit(1).get();
    console.log(`  ${col.id} (${snap.size > 0 ? 'has docs' : 'empty'})`);
  }
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
