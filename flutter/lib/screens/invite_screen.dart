import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 친구초대. 초대 코드는 본인 uid 앞 8자리를 그대로 보여주는 표시용 값이며,
/// invites 컬렉션에서 본인이 초대한 친구 목록을 읽어 노출한다.
/// 실제 초대 성사(친구 가입 완료) 판정과 보상 지급은 백엔드 몫 — 앱은 목록만 보여준다.
class InviteScreen extends StatefulWidget {
  const InviteScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends State<InviteScreen> {
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _invites = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = widget.repository.activeUserId;
    if (uid == null) return;
    try {
      final invites = await widget.repository.fetchInvites(uid);
      setState(() {
        _invites = invites;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = widget.repository.activeUserId ?? '';
    final code = uid.length >= 8 ? uid.substring(0, 8).toUpperCase() : uid.toUpperCase();

    return Scaffold(
      appBar: AppBar(title: const Text('친구초대')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '친구 초대하고 포인트 받기',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '초대한 친구가 첫 픽구매를 완료하면 두 사람 모두 포인트를 받아요.',
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: AppTheme.primarySoft,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          code,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            letterSpacing: 2,
                            color: AppTheme.primary,
                          ),
                        ),
                        const Icon(Icons.copy_outlined, size: 18, color: AppTheme.primary),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text('초대한 친구', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 12),
          if (_loading)
            const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
          else if (_error != null)
            Text('불러오기 실패: $_error')
          else if (_invites.isEmpty)
            const Text('아직 초대한 친구가 없습니다.', style: TextStyle(color: AppTheme.textSecondary))
          else
            ..._invites.map((doc) {
              final data = doc.data();
              final status = data['status'] as String? ?? 'pending';
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: const Icon(Icons.person_outline, color: AppTheme.primary),
                  title: Text(data['invitee_id'] as String? ?? doc.id),
                  trailing: Text(
                    status == 'completed' ? '완료' : '대기중',
                    style: TextStyle(
                      color: status == 'completed' ? AppTheme.primary : AppTheme.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
