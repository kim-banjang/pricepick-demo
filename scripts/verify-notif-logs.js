'use strict';
/**
 * 자동 발송 기록(notif_logs)이 배포본 CMS 에서 보이는지 브라우저 없이 확인한다 (2026-11-06)
 *
 *  1) 배포본: https://pricepick-demo.vercel.app/cms/index.html 을 받아 로컬 cms/index.html 과 같은지
 *  2) 데이터: CMS 와 같은 쿼리(orderBy sent_at desc, limit 500)로 몇 건이 오는지 · 샘플 몇 건인지 · sent_at 이 날짜 값인지
 *  3) 규칙: 배포된 Firestore 규칙에서 CMS 관리자(@pricepick-cms.internal)의 notif_logs 목록 읽기가 허용되는지
 *  4) 그리기: 배포본의 loadNotifLogs 와 그 도우미를 그대로 떼어 2) 의 실제 문서로 돌려 몇 줄·몇 쪽이 나오는지
 *
 * Run: node scripts/verify-notif-logs.js
 * 인증은 seed-notif-logs.js 와 같다(firebase-tools 로그인 · .adc.json).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const https = require('https');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { GoogleAuth } = require('google-auth-library');

const ROOT = path.join(__dirname, '..');
const FT = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
const adcPath = path.join(ROOT, '.adc.json');
fs.writeFileSync(adcPath, JSON.stringify({ type: 'authorized_user',
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token: FT.tokens.refresh_token }));
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
initializeApp({ credential: applicationDefault(), projectId: 'pricepick-demo' });
const fdb = getFirestore();

function fetchText(url) {
  return new Promise((res, rej) => https.get(url, (r) => { let b = ''; r.setEncoding('utf8'); r.on('data', (c) => b += c); r.on('end', () => res(b)); }).on('error', rej));
}
function findAcorn() {
  const tries = [path.join(ROOT, 'node_modules/acorn')].concat(
    fs.readdirSync(path.join(ROOT, '..')).map((d) => path.join(ROOT, '..', d, 'node_modules/acorn')));
  for (const t of tries) { try { return require(t); } catch (e) {} }
  return null;
}

(async () => {
  const out = {};
  // 1) 배포본
  const deployed = await fetchText('https://pricepick-demo.vercel.app/cms/index.html');
  const local = fs.readFileSync(path.join(ROOT, 'cms/index.html'), 'utf8');
  out['1_배포본이_로컬과_같음'] = deployed === local;
  out['1_배포본에_새_읽기코드'] = deployed.indexOf('NTLOG_SEQ') >= 0;

  // 2) 데이터
  const snap = await fdb.collection('notif_logs').orderBy('sent_at', 'desc').limit(500).get();
  out['2_쿼리_결과_건수'] = snap.size;
  out['2_샘플_건수'] = snap.docs.filter((d) => d.data().sample === true).length;
  out['2_sent_at_날짜값_아님'] = snap.docs.filter((d) => !(d.data().sent_at && d.data().sent_at.toDate)).length;

  // 3) 규칙
  const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const rel = await client.request({ url: 'https://firebaserules.googleapis.com/v1/projects/pricepick-demo/releases/cloud.firestore' });
  const rs = await client.request({ url: 'https://firebaserules.googleapis.com/v1/' + rel.data.rulesetName });
  const t = await client.request({ url: 'https://firebaserules.googleapis.com/v1/projects/pricepick-demo:test', method: 'POST', data: {
    source: rs.data.source,
    testSuite: { testCases: [{ expectation: 'ALLOW', request: { auth: { uid: 'cms-admin', token: { email: 'superadmin@pricepick-cms.internal' } },
      path: '/databases/(default)/documents/notif_logs/sample__001', method: 'list' }, resource: { data: { user_id: 'someone' } } }] } } });
  out['3_관리자_목록읽기_허용'] = t.data.testResults[0].state === 'SUCCESS';

  // 4) 그리기 — 배포본 코드 그대로
  const acorn = findAcorn();
  if (!acorn) { out['4_그리기'] = 'acorn 없음 — 건너뜀'; }
  else {
    const blocks = [...deployed.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const fns = new Set(['loadNotifLogs', 'notiResultBadge', 'ntplDef', 'ppPaged', 'ppPagedRender', 'ppStgPagerHtml', 'ppEmpty', 'ppDt', 'ppTm', 'ppEsc', 'ppN']);
    const vars = new Set(['NTLOG_SEQ', 'NOTI_RESULT', 'NTPL_DEF', 'PP_PAGED', 'PP_PAGE_SIZES']);
    let src = '';
    blocks.forEach((code) => {
      let ast; try { ast = acorn.parse(code, { ecmaVersion: 2022 }); } catch (e) { return; }
      (function walk(n) {
        if (!n || typeof n.type !== 'string') return;
        if (n.type === 'FunctionDeclaration' && fns.has(n.id.name)) { src += code.slice(n.start, n.end) + '\n'; fns.delete(n.id.name); return; }
        if (n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id && vars.has(d.id.name))) { src += code.slice(n.start, n.end) + '\n'; n.declarations.forEach((d) => vars.delete(d.id && d.id.name)); return; }
        for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
      })(ast);
    });
    const table = { nextElementSibling: null, parentNode: { insertBefore(h) { table.nextElementSibling = h; } } };
    const tbody = { innerHTML: '', closest() { return table; } };
    const ctx = { console, setTimeout, window: {},
      document: { getElementById: (id) => id === 'ntlog-tbody' ? tbody : null,
        createElement: () => ({ className: '', innerHTML: '', classList: { contains: (c) => c === 'pp-pager-host' } }) },
      db: { collection: () => ({ orderBy: () => ({ limit: () => ({ get: () => Promise.resolve(snap) }) }) }) } };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    vm.runInContext('loadNotifLogs()', ctx);
    await new Promise((r) => setTimeout(r, 200));
    out['4_첫쪽_줄수'] = (tbody.innerHTML.match(/<tr>/g) || []).length;
    const range = ((table.nextElementSibling || {}).innerHTML || '').match(/pp-pager-range">([^<]*)</);
    out['4_페이저'] = range ? range[1] : '없음';
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
