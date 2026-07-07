import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 경유구매. 제휴몰 목록은 Firestore(affiliate_malls)에서 읽어온다.
/// 구매 금액을 입력받아 "구매가 일어났다"는 이벤트(click_logs/postbacks/click_postback_matches)만
/// 기록한다. 등급 티켓 계산·발급은 백엔드 몫이라 이 앱에서는 하지 않는다.
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
                const Text(
                  '등급 티켓 적립은 서버에서 처리됩니다 (이 데모에는 아직 연결되어 있지 않아요).',
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
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

  Future<void> _recordPurchase(
    QueryDocumentSnapshot<Map<String, dynamic>> mall,
  ) async {
    final data = mall.data();
    final mallName = (data['name'] as String?) ?? mall.id;
    final amount = await _promptAmount(mallName);
    if (amount == null) return;

    final uid = widget.repository.activeUserId;
    if (uid == null) return;

    setState(() => _submitting = true);
    try {
      await widget.repository.recordPurchase(
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
            '등급 티켓 적립은 서버 처리 결과가 반영되면 티켓 화면에서 보여요.',
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
                              onPressed: _submitting ? null : () => _recordPurchase(mall),
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
