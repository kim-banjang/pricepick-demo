import 'package:flutter/material.dart';

import '../models/pending_bundle.dart';
import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 티켓. postback(구매 1건)별 확정 대기(pending) 묶음을 그대로 보여준다.
/// 등급 확정(Greedy 전환)은 백엔드가 처리할 영역이라 이 화면은 순수 노출만 한다 — 액션 버튼 없음.
class TicketScreen extends StatefulWidget {
  const TicketScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  List<PendingBundle> _bundles = [];
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
      final bundles = await widget.repository.fetchPendingBundles(uid);
      setState(() {
        _bundles = bundles;
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
    return Scaffold(
      appBar: AppBar(title: const Text('티켓')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('불러오기 실패: $_error'))
              : _bundles.isEmpty
                  ? const Center(child: Text('확정 대기 중인 티켓이 없습니다.'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(20),
                      itemCount: _bundles.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final bundle = _bundles[i];
                        return Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            leading: const CircleAvatar(
                              backgroundColor: AppTheme.primarySoft,
                              foregroundColor: AppTheme.primary,
                              child: Icon(Icons.confirmation_num_outlined),
                            ),
                            title: Text(
                              '${bundle.mallName} 구매 · ${bundle.purchaseAmount}원',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            subtitle: Text(
                              '가지급 티켓 ${bundle.pendingTicketCount}장 · 등급 확정은 서버 처리 대기 중',
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
