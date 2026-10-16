'use strict';
/* 시험용 Firestore 흉내 — api/_lib/asp*.js 가 쓰는 만큼만.
   트랜잭션은 쓰기를 모았다가 끝에 한 번에 반영하고, 쓰기 뒤 읽기는 오류로 막는다(Firestore 와 같은 제약). */
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
let AUTO = 0;

class Snap {
  constructor(ref, data) { this.ref = ref; this.id = ref.id; this._d = data; this.exists = data !== undefined; }
  data() { return clone(this._d); }
}
class QSnap {
  constructor(docs) { this.docs = docs; this.size = docs.length; this.empty = !docs.length; }
  forEach(fn) { this.docs.forEach(fn); }
}
class DocRef {
  constructor(db, col, id) { this.db = db; this.col = col; this.id = id; this.path = col + '/' + id; }
  get ref() { return this; }
  _m() { return this.db._col(this.col); }
  async get() { return new Snap(this, clone(this._m().get(this.id))); }
  async set(data, opt) { this._m().set(this.id, opt && opt.merge ? Object.assign({}, this._m().get(this.id) || {}, clone(data)) : clone(data)); }
  async update(data) {
    if (!data || !Object.keys(data).length) throw new Error('update: at least one field');
    const cur = this._m().get(this.id);
    if (!cur) throw new Error('update: no document ' + this.path);
    this._m().set(this.id, Object.assign({}, cur, clone(data)));
  }
  async delete() { this._m().delete(this.id); }
}
class Query {
  constructor(db, col, filters, order, lim) { this.db = db; this.col = col; this.f = filters || []; this.o = order || null; this.l = lim || 0; }
  where(field, op, v) { return new Query(this.db, this.col, this.f.concat([[field, op, v]]), this.o, this.l); }
  orderBy(field, dir) { return new Query(this.db, this.col, this.f, [field, dir || 'asc'], this.l); }
  limit(n) { return new Query(this.db, this.col, this.f, this.o, n); }
  doc(id) { return new DocRef(this.db, this.col, id || ('auto' + (++AUTO))); }
  async get() {
    let rows = [...this.db._col(this.col).entries()].map(([id, d]) => [id, d]);
    for (const [field, op, v] of this.f) {
      rows = rows.filter(([, d]) => {
        const x = d[field];
        if (op === '==') return x === v;
        if (op === 'in') return v.indexOf(x) >= 0;
        if (op === '<=') return x <= v;
        if (op === '>=') return x >= v;
        throw new Error('op ' + op);
      });
    }
    if (this.o) {
      const [field, dir] = this.o;
      rows = rows.filter(([, d]) => d[field] !== undefined).sort((a, b) => (a[1][field] < b[1][field] ? -1 : a[1][field] > b[1][field] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
    }
    if (this.l) rows = rows.slice(0, this.l);
    return new QSnap(rows.map(([id, d]) => new Snap(new DocRef(this.db, this.col, id), clone(d))));
  }
}
class FakeStore {
  constructor() { this.cols = new Map(); }
  _col(name) { if (!this.cols.has(name)) this.cols.set(name, new Map()); return this.cols.get(name); }
  collection(name) { return new Query(this, name); }
  dump(name) { return [...this._col(name).values()].map(clone); }
  async runTransaction(fn) {
    const writes = [];
    let wrote = false;
    const t = {
      get: async ref => { if (wrote) throw new Error('transaction: read after write'); return ref.get(); },
      set: (ref, d, o) => { wrote = true; writes.push(() => ref.set(d, o)); return t; },
      update: (ref, d) => { wrote = true; if (!d || !Object.keys(d).length) throw new Error('update: at least one field'); writes.push(() => ref.update(d)); return t; },
      delete: ref => { wrote = true; writes.push(() => ref.delete()); return t; },
    };
    const out = await fn(t);
    for (const w of writes) await w();
    return out;
  }
  batch() {
    const ops = [];
    return { delete: r => ops.push(() => r.delete()), set: (r, d, o) => ops.push(() => r.set(d, o)), update: (r, d) => ops.push(() => r.update(d)),
      commit: async () => { for (const o of ops) await o(); } };
  }
}
module.exports = { FakeStore };
