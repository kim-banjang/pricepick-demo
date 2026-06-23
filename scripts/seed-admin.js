/**
 * seed-admin.js — CMS admin_accounts 초기 시드 + Firebase Auth 계정 생성
 * - firstadmin / 1111 → 슈퍼어드민
 */
const path  = require('path');
const os    = require('os');
const fs    = require('fs');
const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ── Auth (firebase-tools OAuth2) ──────────────────────────
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
const { getFirestore } = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin', 'lib', 'firestore', 'index.js'));
const { getAuth }      = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin', 'lib', 'auth', 'index.js'));

admin.initializeApp({ credential: admin.applicationDefault(), projectId: 'pricepick-demo' });
const db   = getFirestore();
const auth = getAuth();

// ── Config ────────────────────────────────────────────────
const ADMINS = [
  {
    username:     'firstadmin',
    password:     '1111',
    role:         'superadmin',
    display_name: '슈퍼어드민',
    status:       'active',
  },
];

async function main() {
  console.log('\n[auth]', cfg.user ? cfg.user.email : 'firebase-tools');
  console.log('\n═══ CMS Admin Accounts Seed ═══\n');

  for (const a of ADMINS) {
    const hash  = sha256(a.password);
    const email = `${a.username}@pricepick-cms.internal`;

    // 1. Firebase Auth 유저 생성/업데이트
    try {
      await auth.createUser({
        email,
        password:      hash,
        displayName:   a.display_name,
        emailVerified: true,
      });
      console.log(`  [Auth] 생성: ${email}`);
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        const existing = await auth.getUserByEmail(email);
        await auth.updateUser(existing.uid, { password: hash, emailVerified: true });
        console.log(`  [Auth] 업데이트: ${email}`);
      } else {
        throw err;
      }
    }

    // 2. Firestore admin_accounts 문서 upsert
    await db.collection('admin_accounts').doc(a.username).set({
      username:      a.username,
      role:          a.role,
      password_hash: hash,
      email,
      display_name:  a.display_name,
      status:        a.status,
      created_at:    new Date(),
    }, { merge: true });
    console.log(`  [Firestore] admin_accounts/${a.username} (${a.role}) 저장`);
    console.log(`  SHA-256("${a.password}"): ${hash}`);
  }

  // 3. 결과 확인
  const snap = await db.collection('admin_accounts').get();
  console.log(`\n  admin_accounts 총 ${snap.size}건:`);
  snap.forEach(d => {
    const dat = d.data();
    console.log(`    ${d.id} — role:${dat.role} status:${dat.status}`);
  });

  console.log('\n═══ 완료 ═══\n');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
