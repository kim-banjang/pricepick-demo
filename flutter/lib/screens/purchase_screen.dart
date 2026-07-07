import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 경유구매. 제휴몰 목록은 Firestore(affiliate_malls)에서 읽어온다.
/// 실제 클릭로그/포스트백/Greedy 티켓전환 로직은 코어 로직 단계(다음 세션)에서 붙인다.
class PurchaseScreen extends StatefulWidget {
  const PurchaseScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<PurchaseScreen> createState() => _PurchaseScreenState();
}

class _PurchaseScreenState extends State<PurchaseScreen> {
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _malls = [];
  bool _loading = true;
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

  void _simulatePurchase(QueryDocumentSnapshot<Map<String, dynamic>> mall) {
    final name = mall.data()['name'] as String? ?? mall.id;
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('구매 시뮬레이션'),
        content: Text(
          '$name 경유 구매가 시뮬레이션되었습니다.\n'
          '실제 클릭로그·포스트백 매칭·티켓 전환(Greedy) 로직은 다음 단계에서 연결됩니다.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('확인'),
          ),
        ],
      ),
    );
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
                              onPressed: () => _simulatePurchase(mall),
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
