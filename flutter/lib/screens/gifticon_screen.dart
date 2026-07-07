import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 기프티콘 교환. gifticons/gifticon_stock을 Firestore에서 읽어 목록 표시.
/// 교환은 포인트가 아니라 required_grade/required_count로 지정된 등급 티켓 수량을
/// 실제로 차감하는 트랜잭션(티켓 used 처리 + 재고 감소 + 교환 이력 기록)으로 처리한다.
class GifticonScreen extends StatefulWidget {
  const GifticonScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<GifticonScreen> createState() => _GifticonScreenState();
}

class _GifticonScreenState extends State<GifticonScreen> {
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _gifticons = [];
  Map<String, int> _remainingStock = {};
  bool _loading = true;
  String? _exchangingId;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final gifticons = await widget.repository.fetchGifticons();
      final stockEntries = await Future.wait(
        gifticons.map((g) => widget.repository.fetchGifticonStock(g.id)),
      );
      final stock = <String, int>{
        for (final s in stockEntries)
          s.id: (s.data()?['remaining'] as num?)?.toInt() ?? 0,
      };
      setState(() {
        _gifticons = gifticons;
        _remainingStock = stock;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _exchange(QueryDocumentSnapshot<Map<String, dynamic>> gifticon) async {
    final uid = widget.repository.uid;
    if (uid == null) return;
    if ((_remainingStock[gifticon.id] ?? 0) <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('재고가 소진되었습니다.')),
      );
      return;
    }
    final data = gifticon.data();
    final name = data['name'] as String? ?? gifticon.id;
    final requiredGrade = data['required_grade'] as String? ?? 'bronze';
    final requiredCount = (data['required_count'] as num?)?.toInt() ?? 0;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('기프티콘 교환'),
        content: Text('$name — $requiredGrade 티켓 $requiredCount장을 사용합니다. 교환할까요?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('교환하기'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _exchangingId = gifticon.id);
    try {
      await widget.repository.exchangeGifticon(
        uid: uid,
        gifticonId: gifticon.id,
        requiredGrade: requiredGrade,
        requiredCount: requiredCount,
      );
      if (!mounted) return;
      await showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('교환 완료'),
          content: Text('$name 교환이 완료됐습니다.'),
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
        SnackBar(content: Text('교환 실패: $e')),
      );
    } finally {
      if (mounted) setState(() => _exchangingId = null);
      await _load();
    }
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
                        final exchanging = _exchangingId == g.id;
                        final remaining = _remainingStock[g.id] ?? 0;
                        final soldOut = remaining <= 0;
                        return Card(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: (exchanging || soldOut) ? null : () => _exchange(g),
                            child: Opacity(
                              opacity: soldOut ? 0.45 : 1,
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
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            soldOut ? '품절' : '재고 $remaining개',
                                            style: TextStyle(
                                              color: soldOut ? Colors.redAccent : AppTheme.textSecondary,
                                              fontSize: 11,
                                              fontWeight: soldOut ? FontWeight.w700 : FontWeight.w400,
                                            ),
                                          ),
                                        ),
                                        if (exchanging)
                                          const SizedBox(
                                            width: 12,
                                            height: 12,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
