import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// 행운룰렛. 룰렛 결과는 랜덤 보상 생성이라 전형적인 "계산 로직"이다 —
/// 클라이언트가 결과를 만들면 조작 가능하므로 이 화면은 UI만 갖추고 실제 추첨은 하지 않는다.
/// TODO(백엔드): 스핀 요청을 받아 실제 보상(티켓)을 추첨·지급하는 로직이 필요하다.
class RouletteScreen extends StatelessWidget {
  const RouletteScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('행운룰렛')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    const Text(
                      '매일 한 번, 행운룰렛',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '버튼을 눌러 룰렛을 돌리고 티켓을 받아보세요',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      width: 180,
                      height: 180,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.primarySoft,
                        border: Border.all(color: AppTheme.primary, width: 3),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(Icons.emoji_events_outlined, size: 56, color: AppTheme.primary),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('룰렛 추첨은 서버에서 처리됩니다 (이 데모에는 아직 연결되어 있지 않아요).')),
                      ),
                      child: const Text('룰렛 돌리기'),
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
