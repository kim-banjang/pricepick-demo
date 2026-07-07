import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';
import '../widgets/empty_state.dart';

/// 활동내역. ticket_transactions + point_transactions 원장을 합쳐서 최신순으로 노출한다.
/// 순수 읽기 화면 — 원장은 백엔드만 기록한다.
class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  List<Map<String, dynamic>> _entries = [];
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
      final entries = await widget.repository.fetchActivity(uid);
      setState(() {
        _entries = entries;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  String _describe(Map<String, dynamic> entry) {
    if (entry['kind'] == 'ticket') {
      final grade = entry['ticket_grade'] as String? ?? '';
      final type = entry['type'] as String? ?? '';
      return switch (type) {
        'earn' => '$grade 티켓 적립',
        'use' => '$grade 티켓 사용',
        _ => '$grade 티켓 $type',
      };
    }
    final amount = (entry['amount'] as num?)?.toInt();
    final type = entry['type'] as String? ?? '';
    return '포인트 $type${amount != null ? ' ($amount P)' : ''}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('활동내역')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('불러오기 실패: $_error'))
              : _entries.isEmpty
                  ? const EmptyState(
                      icon: Icons.history,
                      message: '활동내역이 없습니다.\n픽구매·교환이 발생하면 여기에 표시돼요.',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(20),
                      itemCount: _entries.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final entry = _entries[i];
                        final isTicket = entry['kind'] == 'ticket';
                        return Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            leading: CircleAvatar(
                              backgroundColor: AppTheme.primarySoft,
                              foregroundColor: AppTheme.primary,
                              child: Icon(isTicket ? Icons.confirmation_num_outlined : Icons.paid_outlined),
                            ),
                            title: Text(
                              _describe(entry),
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
