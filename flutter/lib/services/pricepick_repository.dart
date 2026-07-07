import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// pricepick-demo Firestore 스키마 접근 레이어.
/// 컬렉션 구조는 docs/schema-mapping.md (pricepick-demo repo) 기준.
class PricePickRepository {
  PricePickRepository({FirebaseAuth? auth, FirebaseFirestore? firestore})
      : _auth = auth ?? FirebaseAuth.instance,
        _db = firestore ?? FirebaseFirestore.instance;

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;

  Stream<User?> get authState => _auth.authStateChanges();

  String? get uid => _auth.currentUser?.uid;

  Future<User> signInAnonymously() async {
    final current = _auth.currentUser;
    if (current != null) return current;
    final cred = await _auth.signInAnonymously();
    return cred.user!;
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

  /// 등급 확정 대기 중인(pending) 티켓 묶음.
  Future<List<QueryDocumentSnapshot<Map<String, dynamic>>>>
      fetchPendingTickets(String uid) async {
    final snap = await _db
        .collection('user_tickets')
        .where('user_id', isEqualTo: uid)
        .where('status', isEqualTo: 'pending')
        .get();
    return snap.docs;
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
}
