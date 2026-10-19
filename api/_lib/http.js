'use strict';
/* 서버 함수 공통 — Firestore 접속, 요청 본문, 응답, 쿠키, 관리자 확인 */

const CRED_VARS = ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_KEY', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS_JSON'];
const BSLASH_N = String.fromCharCode(92) + 'n';

function credJson() {
  for (const k of CRED_VARS) {
    const v = process.env[k];
    if (!v || !String(v).trim()) continue;
    const raw = String(v).trim();
    const j = JSON.parse(raw.charAt(0) === '{' ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    if (typeof j.private_key === 'string' && j.private_key.indexOf(BSLASH_N) >= 0) j.private_key = j.private_key.split(BSLASH_N).join('\n');
    return j;
  }
  return null;
}

let APP = null;
function app() {
  if (APP) return APP;
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  if (getApps().length) { APP = getApps()[0]; return APP; }
  const j = credJson();
  if (!j) { const e = new Error('서버 자격증명이 없습니다'); e.code = 'no_credentials'; e.status = 500; throw e; }
  APP = initializeApp({ credential: cert(j) });
  return APP;
}
function store() {
  if (global.__ASP_TEST_STORE__) return global.__ASP_TEST_STORE__;     // 로컬 시험 서버(tests/asp/dev-server.js) 전용
  return require('firebase-admin/firestore').getFirestore(app());
}

async function rawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  try {
    const chunks = [];
    for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    if (chunks.length) return Buffer.concat(chunks).toString('utf8');
  } catch (_) { /* 이미 읽힌 스트림 */ }
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}
async function jsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const t = await rawBody(req);
  if (!t) return {};
  try { return JSON.parse(t); } catch (_) { return {}; }
}

function send(res, status, obj, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (headers) for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(obj));
}
/* Firestore 하루 한도 초과(gRPC 8 RESOURCE_EXHAUSTED) — 데모 Firebase 는 무료 요금제라 하루 읽기 5만 건에서 막힌다.
   한도는 태평양 시각 자정(한국 16:00 · 서머타임 끝나면 17:00)에 풀린다. */
function quotaError(e) {
  const m = String((e && (e.message || e.details)) || '');
  return (e && (e.code === 8 || e.code === 'resource-exhausted')) || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(m);
}
function sendError(res, e) {
  if (quotaError(e)) {
    console.error('[asp] quota', e && e.message);
    return send(res, 503, { ok: false, error: 'quota', message: '데모 데이터베이스의 하루 사용 한도를 넘었습니다. 한국 시각 오후 4시(서머타임 끝나면 5시)에 다시 열립니다' });
  }
  const status = (e && e.status) || 500;
  if (status >= 500) console.error('[asp]', e);
  send(res, status, { ok: false, error: (e && e.code) || 'server_error', message: (e && e.code && e.message) || '잠시 후 다시 시도해 주세요', detail: (e && e.detail) || undefined });
}

function cookies(req) {
  const out = {};
  String((req.headers && req.headers.cookie) || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i < 0) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function origin(req) {
  const h = req.headers || {};
  const host = h['x-forwarded-host'] || h.host || 'localhost';
  const proto = h['x-forwarded-proto'] || (/^localhost|^127\./.test(host) ? 'http' : 'https');
  return proto + '://' + host;
}
function opOf(req) {
  const q = req.query || {};
  if (q.op) return String(q.op);
  const m = /\/([^/?]+)(?:\?|$)/.exec(req.url || '');
  return m ? m[1] : '';
}

/* CMS DEMO 관리자 — Firebase 로그인 토큰을 확인하고 이메일 도메인을 본다 (firestore.rules isAdmin 과 같은 기준) */
async function requireAdmin(req) {
  if (global.__ASP_TEST_ADMIN__) return global.__ASP_TEST_ADMIN__;     // 로컬 시험 서버 전용
  const h = String((req.headers && req.headers.authorization) || '');
  const m = /^Bearer\s+(.+)$/.exec(h);
  const err = (code, msg, status) => { const e = new Error(msg); e.code = code; e.status = status; return e; };
  if (!m) throw err('no_token', 'CMS DEMO 에 로그인해 주세요', 401);
  let d;
  try { d = await require('firebase-admin/auth').getAuth(app()).verifyIdToken(m[1]); }
  catch (e) {
    /* 원인을 남긴다(2026-10-19) — 유효한 관리자 토큰도 여기서 막혀 원인을 봐야 했다. Firebase 오류 코드·문구만 싣는다. */
    console.error('[asp-admin] verifyIdToken', e && e.code, e && e.message);
    const x = err('bad_token', '로그인이 만료됐습니다. CMS DEMO 에서 다시 로그인해 주세요', 401);
    x.detail = String((e && (e.code || '')) + ' ' + ((e && e.message) || '')).slice(0, 200);
    throw x;
  }
  if (!d.email || !/@pricepick-cms\.internal$/.test(d.email)) throw err('not_admin', '관리자 계정이 아닙니다', 403);
  return { uid: d.uid, user: d.email.replace('@pricepick-cms.internal', '') };
}

/* 서비스 계정 접근 토큰(cloud-platform 범위) — Firestore Admin API(색인 관리)를 부를 때만 쓴다 */
async function adminAccessToken() {
  const t = await app().options.credential.getAccessToken();
  return t.access_token;
}
function projectId() { const j = credJson(); return (j && j.project_id) || 'pricepick-demo'; }

module.exports = { store, rawBody, jsonBody, send, sendError, cookies, origin, opOf, requireAdmin, adminAccessToken, projectId };
