import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 랜덤 가지급된 pending 티켓 묶음을 보여주고, 등급 확정 액션을 노출한다.
/// Greedy 등급 전환(골드 100,000원당·실버 50,000원당·브론즈 5,000원당 1장) 실제 연산은
/// 코어 로직 단계(다음 세션)에서 Cloud Function 또는 클라이언트 트랜잭션으로 연결한다.
class TicketScreen extends StatefulWidget {
  const TicketScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _pending = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = widget.repository.uid;
    if (uid == null) return;
    try {
      final pending = await widget.repository.fetchPendingTickets(uid);
      setState(() {
        _pending = pending;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _confirmGrade(QueryDocumentSnapshot<Map<String, dynamic>> ticket) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('등급 확정'),
        content: const Text(
          'Greedy 등급 전환 로직은 다음 단계(코어 로직)에서 연결됩니다.\n'
          '지금은 화면 흐름만 확인하는 단계입니다.',
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
      appBar: AppBar(title: const Text('티켓')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('불러오기 실패: $_error'))
              : _pending.isEmpty
                  ? const Center(child: Text('확정 대기 중인 티켓이 없습니다.'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(20),
                      itemCount: _pending.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final ticket = _pending[i];
                        final data = ticket.data();
                        return Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            leading: const CircleAvatar(
                              backgroundColor: AppTheme.primarySoft,
                              foregroundColor: AppTheme.primary,
                              child: Icon(Icons.confirmation_num_outlined),
                            ),
                            title: Text(
                              '가지급 티켓 · ${data['grade'] ?? '미확정'}',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            subtitle: Text('상태: ${data['status']}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                            trailing: ElevatedButton(
                              onPressed: () => _confirmGrade(ticket),
                              style: ElevatedButton.styleFrom(minimumSize: const Size(88, 40)),
                              child: const Text('확정'),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
