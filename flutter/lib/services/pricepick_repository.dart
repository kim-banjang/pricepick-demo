import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/pending_bundle.dart';
import 'ticket_policy.dart';

/// pricepick-demo Firestore 스키마 접근 레이어.
/// 컬렉션 구조는 docs/schema-mapping.md (pricepick-demo repo) 기준.
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

  /// 경유구매 시뮬레이션. click_logs → postbacks(pending) → click_postback_matches를 실제로 기록하고,
  /// 랜덤(가지급) 티켓 1묶음을 pending 상태로 발급한다. 최종 등급은 [confirmBundle]에서 Greedy로 확정된다.
  Future<void> simulatePurchase({
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

    final rand = Random();
    const pendingGradePool = ['bronze', 'bronze', 'bronze', 'silver', 'gold'];
    final pendingCount = 1 + rand.nextInt(3);
    for (var i = 0; i < pendingCount; i++) {
      batch.set(_db.collection('user_tickets').doc(), {
        'user_id': uid,
        'grade': pendingGradePool[rand.nextInt(pendingGradePool.length)],
        'status': 'pending',
        'postback_id': postbackRef.id,
        'earned_at': now,
        'confirmed_at': null,
        'expires_at': null,
      });
    }

    await batch.commit();
  }

  /// postback(구매 1건) 단위로 그룹핑한 확정 대기 묶음 목록.
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

  /// pending 묶음을 실제 구매 금액 기준 Greedy로 재계산해 active 티켓으로 확정한다.
  /// 기존 pending 문서를 재사용(부족하면 신규 생성, 남으면 expired 처리)하고
  /// 확정된 티켓마다 ticket_transactions(earn) 원장을 남긴다.
  Future<TicketBreakdown> confirmBundle({
    required String uid,
    required String postbackId,
  }) async {
    final pendingSnap = await _db
        .collection('user_tickets')
        .where('user_id', isEqualTo: uid)
        .where('postback_id', isEqualTo: postbackId)
        .where('status', isEqualTo: 'pending')
        .get();
    final pendingRefs = pendingSnap.docs.map((d) => d.reference).toList();
    final postbackRef = _db.collection('postbacks').doc(postbackId);

    return _db.runTransaction<TicketBreakdown>((tx) async {
      final postbackSnap = await tx.get(postbackRef);
      final amount = (postbackSnap.data()?['purchase_amount'] as num?)?.toInt() ?? 0;
      final target = greedyBreakdown(amount);
      final flatGrades = target.toFlatGradeList();

      final pendingSnaps = <DocumentSnapshot<Map<String, dynamic>>>[];
      for (final ref in pendingRefs) {
        pendingSnaps.add(await tx.get(ref));
      }

      final expiresAt = Timestamp.fromDate(DateTime.now().add(gradeTicketValidity));
      var i = 0;
      for (final snap in pendingSnaps) {
        if (i < flatGrades.length) {
          tx.update(snap.reference, {
            'grade': flatGrades[i],
            'status': 'active',
            'confirmed_at': FieldValue.serverTimestamp(),
            'expires_at': expiresAt,
          });
          tx.set(_db.collection('ticket_transactions').doc(), {
            'user_id': uid,
            'ticket_grade': flatGrades[i],
            'type': 'earn',
            'postback_id': postbackId,
            'created_at': FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(snap.reference, {'status': 'expired'});
        }
        i++;
      }
      while (i < flatGrades.length) {
        tx.set(_db.collection('user_tickets').doc(), {
          'user_id': uid,
          'grade': flatGrades[i],
          'status': 'active',
          'postback_id': postbackId,
          'earned_at': FieldValue.serverTimestamp(),
          'confirmed_at': FieldValue.serverTimestamp(),
          'expires_at': expiresAt,
        });
        tx.set(_db.collection('ticket_transactions').doc(), {
          'user_id': uid,
          'ticket_grade': flatGrades[i],
          'type': 'earn',
          'postback_id': postbackId,
          'created_at': FieldValue.serverTimestamp(),
        });
        i++;
      }

      tx.update(postbackRef, {
        'status': 'confirmed',
        'confirmed_at': FieldValue.serverTimestamp(),
      });

      return target;
    });
  }

  /// 보유 등급 티켓 수량으로 기프티콘을 교환한다 (포인트 아님).
  /// active 티켓 [requiredCount]장을 used 처리하고 재고를 1 감소시키는 것을 하나의 트랜잭션으로 묶는다.
  Future<void> exchangeGifticon({
    required String uid,
    required String gifticonId,
    required String requiredGrade,
    required int requiredCount,
  }) async {
    final activeSnap = await _db
        .collection('user_tickets')
        .where('user_id', isEqualTo: uid)
        .where('status', isEqualTo: 'active')
        .where('grade', isEqualTo: requiredGrade)
        .get();
    if (activeSnap.docs.length < requiredCount) {
      throw StateError(
        '보유한 $requiredGrade 티켓이 부족합니다 (${activeSnap.docs.length}/$requiredCount장)',
      );
    }
    final ticketRefs =
        activeSnap.docs.take(requiredCount).map((d) => d.reference).toList();
    final stockRef = _db.collection('gifticon_stock').doc(gifticonId);

    await _db.runTransaction((tx) async {
      final stockSnap = await tx.get(stockRef);
      final remaining = (stockSnap.data()?['remaining'] as num?)?.toInt() ?? 0;
      if (remaining <= 0) {
        throw StateError('재고가 소진되었습니다.');
      }
      for (final ref in ticketRefs) {
        tx.update(ref, {'status': 'used'});
        tx.set(_db.collection('ticket_transactions').doc(), {
          'user_id': uid,
          'ticket_grade': requiredGrade,
          'type': 'use',
          'gifticon_id': gifticonId,
          'created_at': FieldValue.serverTimestamp(),
        });
      }
      tx.update(stockRef, {
        'remaining': remaining - 1,
        'updated_at': FieldValue.serverTimestamp(),
      });
      tx.set(_db.collection('gifticon_exchanges').doc(), {
        'user_id': uid,
        'gifticon_id': gifticonId,
        'grade_used': requiredGrade,
        'count_used': requiredCount,
        'status': 'completed',
        'exchanged_at': FieldValue.serverTimestamp(),
      });
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
