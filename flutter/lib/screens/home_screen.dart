import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 홈. 티켓 현황 + 포인트 잔액을 pricepick-demo Firestore에서 직접 읽어 표시.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, int> _tickets = const {'bronze': 0, 'silver': 0, 'gold': 0};
  int _points = 0;
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
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final tickets = await widget.repository.fetchActiveTicketCounts(uid);
      final points = await widget.repository.fetchPointBalance(uid);
      setState(() {
        _tickets = tickets;
        _points = points;
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
    final total = _tickets.values.fold<int>(0, (a, b) => a + b);
    return Scaffold(
      appBar: AppBar(title: const Text('PricePick')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  'Firestore 읽기 실패: $_error',
                  style: const TextStyle(color: Colors.redAccent),
                ),
              ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                '보유 티켓',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                              Text(
                                '총 $total장',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: AppTheme.primary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              _GradeChip(label: '브론즈', value: _tickets['bronze'] ?? 0, color: AppTheme.bronze),
                              const SizedBox(width: 10),
                              _GradeChip(label: '실버', value: _tickets['silver'] ?? 0, color: AppTheme.silver),
                              const SizedBox(width: 10),
                              _GradeChip(label: '골드', value: _tickets['gold'] ?? 0, color: AppTheme.gold),
                            ],
                          ),
                          const Divider(height: 32),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('포인트 잔액', style: TextStyle(color: AppTheme.textSecondary)),
                              Text(
                                '${_points.toString()}P',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                              ),
                            ],
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 24),
            _HubTile(
              icon: Icons.storefront_outlined,
              title: '경유구매',
              subtitle: '제휴몰에서 구매하고 티켓 받기',
              onTap: () => Navigator.of(context).pushNamed('/purchase'),
            ),
            const SizedBox(height: 12),
            _HubTile(
              icon: Icons.confirmation_num_outlined,
              title: '티켓',
              subtitle: '가지급 티켓 확인 및 등급 확정',
              onTap: () => Navigator.of(context)
                  .pushNamed('/ticket')
                  .then((_) => _load()),
            ),
            const SizedBox(height: 12),
            _HubTile(
              icon: Icons.card_giftcard_outlined,
              title: '기프티콘 교환',
              subtitle: '보유 등급 티켓으로 기프티콘 교환하기',
              onTap: () => Navigator.of(context)
                  .pushNamed('/gifticon')
                  .then((_) => _load()),
            ),
            const SizedBox(height: 12),
            _HubTile(
              icon: Icons.person_outline,
              title: '마이',
              subtitle: '공지사항 · 문의 · 이벤트 · 응모',
              onTap: () => Navigator.of(context).pushNamed('/my'),
            ),
          ],
        ),
      ),
    );
  }
}

class _GradeChip extends StatelessWidget {
  const _GradeChip({required this.label, required this.value, required this.color});

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text('$value', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: color)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
          ],
        ),
      ),
    );
  }
}

class _HubTile extends StatelessWidget {
  const _HubTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: AppTheme.primarySoft,
          foregroundColor: AppTheme.primary,
          child: Icon(icon),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
        trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
      ),
    );
  }
}
