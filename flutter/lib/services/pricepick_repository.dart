import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/pending_bundle.dart';

/// pricepick-demo Firestore 스키마 접근 레이어.
/// 컬렉션 구조는 docs/schema-mapping.md (pricepick-demo repo) 기준.
///
/// 이 앱은 노출(표시) 중심이다: Firestore에서 CMS/백엔드가 만들어 둔 결과값을 읽어 보여주고,
/// 구매·교환 같은 사용자 액션은 "일어났다"는 이벤트만 최소한으로 기록한다.
/// 등급 티켓 Greedy 전환, 재고·티켓 차감 같은 비즈니스 계산은 이 앱이 하지 않는다 —
/// 원래 백엔드(Cloud Functions 등)가 처리해야 할 영역이며, 이 데모 프로젝트엔 아직 그 백엔드가
/// 없어 CMS 쪽에서 임시로 계산 중이다. 클라이언트가 계산을 떠맡으면 조작·정합성 문제가 생기므로
/// 여기서는 절대 흉내내지 않는다.
class PricePickRepository {
  PricePickRepository({FirebaseAuth? auth, FirebaseFirestore? firestore})
      : _auth = auth ?? FirebaseAuth.instance,
        _db = firestore ?? FirebaseFirestore.instance;

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;

  String? _personaUserId;

  Stream<User?> get authState => _auth.authStateChanges();

  String? get uid => _auth.currentUser?.uid;

  /// 실제로 화면이 데이터를 읽고 써야 할 대상 유저 ID.
  /// 시뮬 로그인(카카오 연동 회원 체험) 중이면 그 회원의 ID, 아니면 본인 Firebase Auth uid.
  String? get activeUserId => _personaUserId ?? uid;

  bool get isPersonaMode => _personaUserId != null;

  /// CMS에 세팅된 카카오 연동 회원으로 시뮬 로그인한다 (실제 Kakao SDK 인증 없음, 데모 전용).
  void enterAsPersona(String userId) {
    _personaUserId = userId;
  }

  void exitPersona() {
    _personaUserId = null;
  }

  Future<User> signInAnonymously() async {
    final current = _auth.currentUser;
    if (current != null) return current;
    final cred = await _auth.signInAnonymously();
    return cred.user!;
  }

  /// 카카오 연동 회원 시뮬 로그인 후보 목록.
  Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>>
      fetchLinkedKakaoMembers() async {
    final snap = await _db
        .collection('users')
        .where('linked_kakao', isEqualTo: true)
        .limit(8)
        .get();
    return snap.docs;
  }

  Future<DocumentSnapshot<Map<String, dynamic>>> fetchUser(String uid) {
    return _db.collection('users').doc(uid).get();
  }

  Future<void> createGuestUser({
    required String uid,
    required String nickname,
  }) async {
    final now = FieldValue.serverTimestamp();
    await _db.collection('users').doc(uid).set({
      'uid': uid,
      'nickname': nickname,
      'linked_kakao': false,
      'status': 'active',
      'created_at': now,
    }, SetOptions(merge: true));
    await _db.collection('user_points').doc(uid).set({
      'user_id': uid,
      'balance': 0,
      'updated_at': now,
    }, SetOptions(merge: true));
  }

  Future<int> fetchPointBalance(String uid) async {
    final doc = await _db.collection('user_points').doc(uid).get();
    if (!doc.exists) return 0;
    return (doc.data()?['balance'] as num?)?.toInt() ?? 0;
  }

  /// grade별 active 티켓 개수. { bronze, silver, gold }
  Future<Map<String, int>> fetchActiveTicketCounts(String uid) async {
    final snap = await _db
        .collection('user_tickets')
        .where('user_id', isEqualTo: uid)
        .where('status', isEqualTo: 'active')
        .get();
    final counts = {'bronze': 0, 'silver': 0, 'gold': 0};
    for (final d in snap.docs) {
      final grade = (d.data()['grade'] as String? ?? 'bronze').toLowerCase();
      if (counts.containsKey(grade)) counts[grade] = counts[grade]! + 1;
    }
    return counts;
  }

  Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>>
      fetchActiveAffiliateMalls() async {
    final snap = await _db
        .collection('affiliate_malls')
        .where('active', isEqualTo: true)
        .get();
    return snap.docs;
  }

  Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>>
      fetchGifticons() async {
    final snap = await _db.collection('gifticons').get();
    return snap.docs;
  }

  Future<DocumentSnapshot<Map<String, dynamic>>> fetchGifticonStock(
    String gifticonId,
  ) {
    return _db.collection('gifticon_stock').doc(gifticonId).get();
  }

  /// 경유구매 액션 기록. click_logs → postbacks(status: pending) → click_postback_matches를
  /// "구매가 발생했다"는 이벤트로만 남긴다.
  ///
  /// TODO(백엔드): 이 postback을 트리거로 실제 등급 티켓을 Greedy 규칙(골드 100,000원당·
  /// 실버 50,000원당·브론즈 5,000원당 1장, 큰 단위부터 배분)으로 계산해 user_tickets를
  /// 생성하는 건 서버(Cloud Functions 등)의 몫이다. 이 데모 프로젝트엔 아직 그 백엔드가
  /// 연결돼 있지 않아, 여기서는 postback만 남기고 티켓 생성/계산은 하지 않는다.
  Future<void> recordPurchase({
    required String uid,
    required String mallCode,
    required String mallName,
    required String mallDomain,
    required int amount,
  }) async {
    final now = FieldValue.serverTimestamp();
    final batch = _db.batch();

    final clickRef = _db.collection('click_logs').doc();
    batch.set(clickRef, {
      'user_id': uid,
      'mall_code': mallCode,
      'mall_name': mallName,
      'clicked_at': now,
    });

    final postbackRef = _db.collection('postbacks').doc();
    batch.set(postbackRef, {
      'user_id': uid,
      'mall_name': mallName,
      'mall_domain': mallDomain,
      'purchase_amount': amount,
      'status': 'pending',
      'created_at': now,
    });

    final matchRef = _db.collection('click_postback_matches').doc();
    batch.set(matchRef, {
      'click_id': clickRef.id,
      'postback_id': postbackRef.id,
      'user_id': uid,
      'matched_at': now,
    });

    await batch.commit();
  }

  /// postback(구매 1건) 단위로 그룹핑한, 등급 확정을 기다리는 pending 티켓 노출용 목록.
  /// 순수 읽기 전용 — 티켓 생성/등급 계산은 백엔드가 처리한 결과를 그대로 보여줄 뿐이다.
  Future<List<PendingBundle>> fetchPendingBundles(String uid) async {
    final pendingSnap = await _db
        .collection('user_tickets')
        .where('user_id', isEqualTo: uid)
        .where('status', isEqualTo: 'pending')
        .get();

    final countByPostback = <String, int>{};
    for (final doc in pendingSnap.docs) {
      final postbackId = doc.data()['postback_id'] as String?;
      if (postbackId == null) continue;
      countByPostback[postbackId] = (countByPostback[postbackId] ?? 0) + 1;
    }

    final bundles = <PendingBundle>[];
    for (final entry in countByPostback.entries) {
      final postbackDoc = await _db.collection('postbacks').doc(entry.key).get();
      final data = postbackDoc.data();
      if (data == null) continue;
      bundles.add(PendingBundle(
        postbackId: entry.key,
        mallName: data['mall_name'] as String? ?? '알 수 없음',
        purchaseAmount: (data['purchase_amount'] as num?)?.toInt() ?? 0,
        pendingTicketCount: entry.value,
      ));
    }
    return bundles;
  }

  /// 기프티콘 교환 "요청" 기록. 실제로 보유 중인지는 화면에서 읽은 값으로만 안내하고,
  /// 여기서는 어떤 등급/수량을 요청했는지 이벤트로만 남긴다 (status: requested).
  ///
  /// TODO(백엔드): 티켓을 실제로 소진 처리(user_tickets status → used)하고
  /// gifticon_stock.remaining을 차감하는 건 서버가 이 요청을 트리거로 처리해야 한다.
  /// 클라이언트가 재고·보유수량을 직접 차감하면 조작·동시성 문제가 생기므로 여기서 하지 않는다.
  Future<void> requestGifticonExchange({
    required String uid,
    required String gifticonId,
    required String requiredGrade,
    required int requiredCount,
  }) {
    return _db.collection('gifticon_exchanges').add({
      'user_id': uid,
      'gifticon_id': gifticonId,
      'grade_used': requiredGrade,
      'count_used': requiredCount,
      'status': 'requested',
      'exchanged_at': FieldValue.serverTimestamp(),
    });
  }

  Future<DocumentSnapshot<Map<String, dynamic>>> fetchUserDoc(String uid) {
    return _db.collection('users').doc(uid).get();
  }

  /// 고정 공지 우선, 그다음 최신순. 복합 인덱스가 필요 없도록 정렬은 클라이언트에서 처리한다.
  Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> fetchNotices() async {
    final snap = await _db.collection('notices').get();
    final docs = snap.docs.toList();
    docs.sort((a, b) {
      final pinnedA = a.data()['is_pinned'] as bool? ?? false;
      final pinnedB = b.data()['is_pinned'] as bool? ?? false;
      if (pinnedA != pinnedB) return pinnedA ? -1 : 1;
      final atA = a.data()['published_at'] as Timestamp?;
      final atB = b.data()['published_at'] as Timestamp?;
      if (atA == null || atB == null) return 0;
      return atB.compareTo(atA);
    });
    return docs;
  }

  Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> fetchInquiries(
    String uid,
  ) async {
    final snap = await _db
        .collection('inquiries')
        .where('user_id', isEqualTo: uid)
        .get();
    final docs = snap.docs.toList();
    docs.sort((a, b) {
      final atA = a.data()['created_at'] as Timestamp?;
      final atB = b.data()['created_at'] as Timestamp?;
      if (atA == null || atB == null) return 0;
      return atB.compareTo(atA);
    });
    return docs;
  }

  Future<void> createInquiry({
    required String uid,
    required String category,
    required String title,
    required String content,
  }) {
    return _db.collection('inquiries').add({
      'user_id': uid,
      'category': category,
      'title': title,
      'content': content,
      'status': 'pending',
      'answer': null,
      'answered_at': null,
      'created_at': FieldValue.serverTimestamp(),
    });
  }

  Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> fetchEvents() async {
    final snap = await _db.collection('events').get();
    return snap.docs;
  }

  Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>> fetchRaffles() async {
    final snap = await _db.collection('raffles').get();
    return snap.docs;
  }
}
