import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

const _kInquiryCategories = ['postback', 'ticket', 'gifticon', 'account'];

/// 문의. 본인 문의 내역을 읽고, 새 문의는 inquiries에 실제로 기록한다.
class InquiryScreen extends StatefulWidget {
  const InquiryScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<InquiryScreen> createState() => _InquiryScreenState();
}

class _InquiryScreenState extends State<InquiryScreen> {
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _inquiries = [];
  bool _loading = true;
  bool _submitting = false;
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
      final inquiries = await widget.repository.fetchInquiries(uid);
      setState(() {
        _inquiries = inquiries;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _openNewInquiry() async {
    final uid = widget.repository.activeUserId;
    if (uid == null) return;
    final titleController = TextEditingController();
    final contentController = TextEditingController();
    var category = _kInquiryCategories.first;

    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('문의하기'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DropdownButton<String>(
                value: category,
                isExpanded: true,
                items: _kInquiryCategories
                    .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                    .toList(),
                onChanged: (v) => setDialogState(() => category = v ?? category),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: titleController,
                decoration: const InputDecoration(hintText: '제목'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: contentController,
                maxLines: 3,
                decoration: const InputDecoration(hintText: '문의 내용'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('취소'),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('등록'),
            ),
          ],
        ),
      ),
    );

    if (result != true) return;
    if (titleController.text.trim().isEmpty || contentController.text.trim().isEmpty) return;

    setState(() => _submitting = true);
    try {
      await widget.repository.createInquiry(
        uid: uid,
        category: category,
        title: titleController.text.trim(),
        content: contentController.text.trim(),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('등록 실패: $e')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('문의')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _submitting ? null : _openNewInquiry,
        icon: const Icon(Icons.add),
        label: const Text('문의하기'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('불러오기 실패: $_error'))
              : _inquiries.isEmpty
                  ? const Center(child: Text('등록된 문의가 없습니다.'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(20),
                      itemCount: _inquiries.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final data = _inquiries[i].data();
                        final answered = data['status'] == 'answered';
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        data['title'] as String? ?? '',
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: answered ? AppTheme.primarySoft : AppTheme.surface,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        answered ? '답변완료' : '접수중',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: answered ? AppTheme.primary : AppTheme.textSecondary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  data['content'] as String? ?? '',
                                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                                ),
                                if (answered) ...[
                                  const Divider(height: 20),
                                  Text(
                                    data['answer'] as String? ?? '',
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
