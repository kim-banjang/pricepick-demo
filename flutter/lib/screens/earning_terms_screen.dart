import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// 적립 조건 안내. 정책 설명은 고정 텍스트(정적 콘텐츠)이며 Firestore를 읽지 않는다.
class EarningTermsScreen extends StatelessWidget {
  const EarningTermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('적립 조건 안내')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          _TermSection(
            title: '티켓 적립 기준',
            body: '경유구매 1건당 랜덤(가지급) 티켓 1묶음이 먼저 지급되고, 구매가 확정되면 실제 결제 금액을 '
                '기준으로 등급 티켓이 확정돼요.\n\n골드 100,000원당·실버 50,000원당·브론즈 5,000원당 1장씩, '
                '큰 단위(골드)부터 채우고 남는 금액을 순서대로 배분합니다.',
          ),
          _TermSection(
            title: '확정 대기 기간',
            body: '제휴몰의 주문 확정(구매확정/반품기간 경과) 이후 등급 티켓이 확정돼요. 보통 D+7 전후로 반영됩니다.',
          ),
          _TermSection(
            title: '적립 제외',
            body: '상품권·기프티콘·상품권류 재판매 상품, 환불·취소된 주문은 적립에서 제외돼요.',
          ),
          _TermSection(
            title: '유효기간',
            body: '등급 티켓(브론즈/실버/골드)은 확정일로부터 1년, 이벤트 티켓은 발급일로부터 100일간 유효합니다.',
          ),
        ],
      ),
    );
  }
}

class _TermSection extends StatelessWidget {
  const _TermSection({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            const SizedBox(height: 8),
            Text(body, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.5)),
          ],
        ),
      ),
    );
  }
}
