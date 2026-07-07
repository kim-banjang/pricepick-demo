import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 공지사항. notices 컬렉션을 그대로 읽어 목록 + 상세를 보여준다.
class NoticeScreen extends StatefulWidget {
  const NoticeScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<NoticeScreen> createState() => _NoticeScreenState();
}

class _NoticeScreenState extends State<NoticeScreen> {
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _notices = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final notices = await widget.repository.fetchNotices();
      setState(() {
        _notices = notices;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _openDetail(QueryDocumentSnapshot<Map<String, dynamic>> notice) {
    final data = notice.data();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(data['title'] as String? ?? ''),
        content: SingleChildScrollView(
          child: Text(data['content'] as String? ?? ''),
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
      appBar: AppBar(title: const Text('공지사항')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('불러오기 실패: $_error'))
              : _notices.isEmpty
                  ? const Center(child: Text('등록된 공지사항이 없습니다.'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(20),
                      itemCount: _notices.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final notice = _notices[i];
                        final data = notice.data();
                        final pinned = data['is_pinned'] as bool? ?? false;
                        return Card(
                          child: ListTile(
                            onTap: () => _openDetail(notice),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            leading: Icon(
                              pinned ? Icons.push_pin : Icons.campaign_outlined,
                              color: pinned ? AppTheme.primary : AppTheme.textSecondary,
                            ),
                            title: Text(
                              data['title'] as String? ?? '',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(
                              data['content'] as String? ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                            ),
                            trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
                          ),
                        );
                      },
                    ),
    );
  }
}
