import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../services/ticket_policy.dart';
import '../theme/app_theme.dart';

/// 경유구매. 제휴몰 목록은 Firestore(affiliate_malls)에서 읽어온다.
/// 실제 제휴몰 API 없이 구매 금액을 입력받아 click_logs/postbacks/click_postback_matches를
/// 실제로 기록하고, 랜덤(가지급) 티켓 묶음을 pending으로 발급한다 (등급 확정은 티켓 화면에서).
class PurchaseScreen extends StatefulWidget {
  const PurchaseScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<PurchaseScreen> createState() => _PurchaseScreenState();
}

class _PurchaseScreenState extends State<PurchaseScreen> {
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _malls = [];
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final malls = await widget.repository.fetchActiveAffiliateMalls();
      setState(() {
        _malls = malls;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<int?> _promptAmount(String mallName) {
    final controller = TextEditingController();
    return showDialog<int>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) {
          final amount = int.tryParse(controller.text) ?? 0;
          final preview = amount >= 5000 ? greedyBreakdown(amount) : null;
          return AlertDialog(
            title: Text('$mallName 구매 시뮬레이션'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: controller,
                  keyboardType: TextInputType.number,
                  autofocus: true,
                  decoration: const InputDecoration(hintText: '구매 금액 (원)'),
                  onChanged: (_) => setDialogState(() {}),
                ),
                const SizedBox(height: 12),
                if (preview != null)
                  Text(
                    '적립 예정(가지급): 최대 ${preview.total}장 랜덤 묶음\n'
                    '(확정 시 실제 금액 기준 Greedy로 재계산)',
                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                  ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('취소'),
              ),
              TextButton(
                onPressed: amount >= 5000
                    ? () => Navigator.of(dialogContext).pop(amount)
                    : null,
                child: const Text('구매하기'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _simulatePurchase(
    QueryDocumentSnapshot<Map<String, dynamic>> mall,
  ) async {
    final data = mall.data();
    final mallName = (data['name'] as String?) ?? mall.id;
    final amount = await _promptAmount(mallName);
    if (amount == null) return;

    final uid = widget.repository.uid;
    if (uid == null) return;

    setState(() => _submitting = true);
    try {
      await widget.repository.simulatePurchase(
        uid: uid,
        mallCode: mall.id,
        mallName: mallName,
        mallDomain: (data['domain'] as String?) ?? '',
        amount: amount,
      );
      if (!mounted) return;
      await showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('구매 접수 완료'),
          content: Text(
            '$mallName ${amount.toString()}원 구매가 접수됐습니다.\n'
            '가지급 티켓이 발급됐어요 — 티켓 화면에서 등급을 확정해 주세요.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('확인'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('구매 처리 실패: $e')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('경유구매')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('불러오기 실패: $_error'))
              : _malls.isEmpty
                  ? const Center(child: Text('등록된 제휴몰이 없습니다.'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(20),
                      itemCount: _malls.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final mall = _malls[i];
                        final data = mall.data();
                        return Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            leading: const CircleAvatar(
                              backgroundColor: AppTheme.primarySoft,
                              foregroundColor: AppTheme.primary,
                              child: Icon(Icons.storefront_outlined),
                            ),
                            title: Text(
                              (data['name'] as String?) ?? mall.id,
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            subtitle: Text(mall.id, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                            trailing: ElevatedButton(
                              onPressed: _submitting ? null : () => _simulatePurchase(mall),
                              style: ElevatedButton.styleFrom(minimumSize: const Size(88, 40)),
                              child: const Text('구매 시뮬'),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
