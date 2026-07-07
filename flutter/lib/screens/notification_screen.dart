import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';
import '../widgets/empty_state.dart';

/// 알림. notifications 컬렉션을 그대로 읽어 목록으로 보여준다 (순수 노출).
class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _notifications = [];
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
      final notifications = await widget.repository.fetchNotifications(uid);
      setState(() {
        _notifications = notifications;
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
      appBar: AppBar(title: const Text('알림')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('불러오기 실패: $_error'))
              : _notifications.isEmpty
                  ? const EmptyState(
                      icon: Icons.notifications_none,
                      message: '알림이 없습니다.\n새 소식이 있으면 여기에 표시돼요.',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(20),
                      itemCount: _notifications.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final data = _notifications[i].data();
                        final isRead = data['read'] as bool? ?? false;
                        return Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            leading: Icon(
                              isRead ? Icons.notifications_none : Icons.notifications_active,
                              color: isRead ? AppTheme.textSecondary : AppTheme.primary,
                            ),
                            title: Text(
                              data['title'] as String? ?? '',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            subtitle: Text(
                              data['body'] as String? ?? data['content'] as String? ?? '',
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
