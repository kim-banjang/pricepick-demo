import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 기프티콘 교환. gifticons/gifticon_stock을 Firestore에서 읽어 목록 표시.
/// 교환은 포인트가 아니라 required_grade/required_count로 지정된 등급 티켓 수량 차감 방식.
/// 실제 티켓 차감·재고 감소 트랜잭션은 코어 로직 단계(다음 세션)에서 연결한다.
class GifticonScreen extends StatefulWidget {
  const GifticonScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<GifticonScreen> createState() => _GifticonScreenState();
}

class _GifticonScreenState extends State<GifticonScreen> {
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _gifticons = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final gifticons = await widget.repository.fetchGifticons();
      setState(() {
        _gifticons = gifticons;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _exchange(QueryDocumentSnapshot<Map<String, dynamic>> gifticon) {
    final name = gifticon.data()['name'] as String? ?? gifticon.id;
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('기프티콘 교환'),
        content: Text(
          '$name 교환 요청이 접수되었습니다.\n'
          '실제 등급 티켓 차감·재고 처리는 다음 단계(코어 로직)에서 연결됩니다.',
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
      appBar: AppBar(title: const Text('기프티콘 교환')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('불러오기 실패: $_error'))
              : _gifticons.isEmpty
                  ? const Center(child: Text('등록된 기프티콘이 없습니다.'))
                  : GridView.builder(
                      padding: const EdgeInsets.all(20),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 14,
                        crossAxisSpacing: 14,
                        childAspectRatio: 0.82,
                      ),
                      itemCount: _gifticons.length,
                      itemBuilder: (context, i) {
                        final g = _gifticons[i];
                        final data = g.data();
                        return Card(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () => _exchange(g),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    (data['emoji'] as String?) ?? '🎁',
                                    style: const TextStyle(fontSize: 26),
                                  ),
                                  Text(
                                    (data['name'] as String?) ?? g.id,
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                    maxLines: 2,
                                  ),
                                  Text(
                                    '${(data['price'] as num?)?.toInt() ?? '-'}원',
                                    style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w800),
                                  ),
                                  Text(
                                    '${data['required_grade'] ?? '-'} ${(data['required_count'] as num?)?.toInt() ?? '-'}장',
                                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
