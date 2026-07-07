import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';
import '../widgets/empty_state.dart';

/// 응모. raffles 컬렉션을 그대로 읽어 목록으로 보여준다.
/// 응모 참여(raffle_entries 기록) 실쓰기는 다음 단계에서 채운다.
class RaffleScreen extends StatefulWidget {
  const RaffleScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<RaffleScreen> createState() => _RaffleScreenState();
}

class _RaffleScreenState extends State<RaffleScreen> {
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _raffles = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raffles = await widget.repository.fetchRaffles();
      setState(() {
        _raffles = raffles;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _enter(QueryDocumentSnapshot<Map<String, dynamic>> raffle) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('응모 참여 로직은 다음 단계에서 연결됩니다.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('응모')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('불러오기 실패: $_error'))
              : _raffles.isEmpty
                  ? const EmptyState(
                      icon: Icons.card_giftcard,
                      message: '진행 중인 응모가 없습니다.\nCMS에서 응모 이벤트를 등록하면 여기에 표시돼요.',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(20),
                      itemCount: _raffles.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final raffle = _raffles[i];
                        final data = raffle.data();
                        return Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            leading: const CircleAvatar(
                              backgroundColor: AppTheme.primarySoft,
                              foregroundColor: AppTheme.primary,
                              child: Icon(Icons.card_giftcard),
                            ),
                            title: Text(
                              data['title'] as String? ?? '응모 이벤트',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            trailing: ElevatedButton(
                              onPressed: () => _enter(raffle),
                              style: ElevatedButton.styleFrom(minimumSize: const Size(88, 40)),
                              child: const Text('응모하기'),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
