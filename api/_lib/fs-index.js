'use strict';
/* Firestore 복합 색인 — 데모 앱이 읽는 양을 줄이는 질의 두 개에 필요한 색인을 확인하고 없으면 만든다 (2026-10-16).
 *   ① 기프티콘 구매(티켓 차감): user_tickets  user_id ↑ · status ↑ · earned_at ↑   — 쓸 장수만큼만 오래된 순으로 읽기
 *   ② 활동 내역 나눠 읽기:     ticket_transactions  user_id ↑ · created_at ↓        — 최근 100건씩 읽기
 * firestore.indexes.json 에 같은 내용이 적혀 있다. Firebase CLI 로그인이 없는 환경이라 서버 자격증명(서비스 계정)으로
 * Firestore Admin API 를 직접 부른다. 색인 만들기는 데이터를 바꾸지 않는다. */
const H = require('./http');

const WANT = [
  { col: 'user_tickets', fields: [['user_id', 'ASCENDING'], ['status', 'ASCENDING'], ['earned_at', 'ASCENDING']] },
  { col: 'ticket_transactions', fields: [['user_id', 'ASCENDING'], ['created_at', 'DESCENDING']] },
];

async function call(method, path, body) {
  const token = await H.adminAccessToken();
  const url = 'https://firestore.googleapis.com/v1/projects/' + H.projectId() + '/databases/(default)/' + path;
  const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (_) { /* 그대로 */ }
  return { status: r.status, json, text: text.slice(0, 400) };
}
const sig = fields => fields.filter(f => f.fieldPath !== '__name__').map(f => f.fieldPath + ':' + (f.order || f.arrayConfig)).join(',');

async function ensure(apply) {
  const out = [];
  for (const w of WANT) {
    const want = sig(w.fields.map(([fieldPath, order]) => ({ fieldPath, order })));
    const list = await call('GET', 'collectionGroups/' + w.col + '/indexes');
    if (list.status !== 200) { out.push({ col: w.col, want, error: 'list ' + list.status + ' ' + list.text }); continue; }
    const found = ((list.json && list.json.indexes) || []).find(ix => ix.queryScope === 'COLLECTION' && sig(ix.fields || []) === want);
    if (found) { out.push({ col: w.col, want, state: found.state }); continue; }
    if (!apply) { out.push({ col: w.col, want, state: 'MISSING' }); continue; }
    const made = await call('POST', 'collectionGroups/' + w.col + '/indexes',
      { queryScope: 'COLLECTION', fields: w.fields.map(([fieldPath, order]) => ({ fieldPath, order })) });
    out.push({ col: w.col, want, state: made.status === 200 ? 'CREATING' : 'error', detail: made.status === 200 ? undefined : made.status + ' ' + made.text });
  }
  return out;
}

module.exports = { ensure, WANT };
