import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 출석체크. 오늘 출석 여부를 daily_visits에서 읽어 표시하고, 출석 액션만 기록한다.
/// 보상 포인트 계산·지급은 백엔드 몫 — 앱은 "방문했다"는 이벤트만 남긴다.
class CheckinScreen extends StatefulWidget {
  const CheckinScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<CheckinScreen> createState() => _CheckinScreenState();
}

class _CheckinScreenState extends State<CheckinScreen> {
  bool _loading = true;
  bool _submitting = false;
  bool _checkedInToday = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool _isToday(DateTime dt) {
    final now = DateTime.now();
    return dt.year == now.year && dt.month == now.month && dt.day == now.day;
  }

  Future<void> _load() async {
    final uid = widget.repository.activeUserId;
    if (uid == null) return;
    try {
      final latest = await widget.repository.fetchLatestCheckin(uid);
      setState(() {
        _checkedInToday = latest != null && _isToday(latest.toDate());
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _checkin() async {
    final uid = widget.repository.activeUserId;
    if (uid == null) return;
    setState(() => _submitting = true);
    try {
      await widget.repository.recordCheckin(uid);
      if (!mounted) return;
      setState(() => _checkedInToday = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('출석 완료! 보상 포인트는 서버 처리 후 반영됩니다.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('출석 처리 실패: $e')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('출석체크')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('불러오기 실패: $_error'))
              : Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            children: [
                              Icon(
                                _checkedInToday ? Icons.check_circle : Icons.calendar_today_outlined,
                                size: 48,
                                color: AppTheme.primary,
                              ),
                              const SizedBox(height: 16),
                              Text(
                                _checkedInToday ? '오늘 출석을 완료했어요' : '오늘 아직 출석하지 않았어요',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                '매일 출석하면 포인트를 받을 수 있어요',
                                style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                              ),
                              const SizedBox(height: 20),
                              ElevatedButton(
                                onPressed: (_checkedInToday || _submitting) ? null : _checkin,
                                child: _submitting
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : Text(_checkedInToday ? '출석 완료' : '출석하기'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
