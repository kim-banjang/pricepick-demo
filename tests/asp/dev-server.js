'use strict';
/* 로컬 시험 서버 — Firebase·Vercel 없이 쇼핑 적립 데모 전체를 돌린다.
   node tests/asp/dev-server.js [포트]  →  http://localhost:4600/asp-sim/
   저장소는 메모리(가짜 Firestore), CMS 관리자 확인은 건너뛴다. 서버를 끄면 데이터가 사라진다. */
process.env.ASP_TEST_SECRET = process.env.ASP_TEST_SECRET || 'local-dev-secret';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { FakeStore } = require('./fake-store');

global.__ASP_TEST_STORE__ = new FakeStore();
global.__ASP_TEST_ADMIN__ = { uid: 'local', user: 'local-admin' };
const ROOT = path.resolve(__dirname, '../..');
const HANDLERS = {
  asp: require('../../api/asp/[op].js'),
  'asp-admin': require('../../api/asp-admin/[op].js'),
  'asp-mock': require('../../api/asp-mock/[op].js'),
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const REWRITE = { '/asp': '/asp/index.html', '/asp/': '/asp/index.html', '/asp-sim': '/asp-sim/index.html', '/asp-sim/': '/asp-sim/index.html',
  '/asp-cms': '/asp-cms/index.html', '/asp-cms/': '/asp-cms/index.html', '/cms': '/cms/index.html', '/cms/': '/cms/index.html' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const m = /^\/api\/(asp|asp-admin|asp-mock)\/([^/]+)$/.exec(u.pathname);
  if (m) {
    req.query = Object.assign(Object.fromEntries(u.searchParams), { op: m[2] });
    return HANDLERS[m[1]](req, res);
  }
  let file = path.join(ROOT, REWRITE[u.pathname] || u.pathname);
  if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.argv[2]) || 4600, () => console.log('ASP dev server http://localhost:' + (Number(process.argv[2]) || 4600) + '/asp-sim/'));
