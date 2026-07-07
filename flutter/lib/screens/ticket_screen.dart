import 'package:flutter/material.dart';

import '../models/pending_bundle.dart';
import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 랜덤 가지급된 pending 티켓 묶음(postback 단위)을 보여주고,
/// 확정 시 실제 구매 금액 기준 Greedy로 재계산해 active 티켓으로 전환한다.
class TicketScreen extends StatefulWidget {
  const TicketScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  List<PendingBundle> _bundles = [];
  bool _loading = true;
  String? _confirmingPostbackId;
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

  Future<void> _confirm(PendingBundle bundle) async {
    final uid = widget.repository.activeUserId;
    if (uid == null) return;
    setState(() => _confirmingPostbackId = bundle.postbackId);
    try {
      final result = await widget.repository.confirmBundle(
        uid: uid,
        postbackId: bundle.postbackId,
      );
      if (!mounted) return;
      await showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('등급 확정 완료'),
          content: Text(
            '${bundle.mallName} ${bundle.purchaseAmount}원 구매 확정\n'
            '골드 ${result.gold}장 · 실버 ${result.silver}장 · 브론즈 ${result.bronze}장',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('확인'),
            ),
          ],
        ),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('확정 실패: $e')),
      );
    } finally {
      if (mounted) setState(() => _confirmingPostbackId = null);
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
                        final confirming = _confirmingPostbackId == bundle.postbackId;
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
                              '가지급 티켓 ${bundle.pendingTicketCount}장 (확정 대기)',
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                            ),
                            trailing: ElevatedButton(
                              onPressed: confirming ? null : () => _confirm(bundle),
                              style: ElevatedButton.styleFrom(minimumSize: const Size(88, 40)),
                              child: confirming
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                    )
                                  : const Text('확정'),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
