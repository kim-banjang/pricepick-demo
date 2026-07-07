import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 계정 탈퇴. 실제 계정·데이터 삭제는 이 데모에서 하지 않는다 — 되돌릴 수 없는 파괴적 동작이라
/// (특히 시뮬 로그인 중이면 CMS가 세팅한 실제 회원 데이터를 지우게 될 위험이 있음) 안내·동의 UI만
/// 완성하고, 실제 삭제는 백엔드가 처리해야 할 몫으로 남겨둔다.
class WithdrawScreen extends StatefulWidget {
  const WithdrawScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<WithdrawScreen> createState() => _WithdrawScreenState();
}

class _WithdrawScreenState extends State<WithdrawScreen> {
  bool _agreed = false;

  Future<void> _withdraw() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('탈퇴하시겠어요?'),
        content: const Text('보유 티켓·포인트·활동내역이 모두 삭제되며 되돌릴 수 없어요.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('탈퇴하기'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!mounted) return;

    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('탈퇴 요청 접수'),
        content: const Text(
          '탈퇴 요청이 접수되었습니다.\n'
          '실제 계정·데이터 삭제는 서버에서 처리됩니다 (이 데모에는 아직 연결되어 있지 않아요).',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('확인'),
          ),
        ],
      ),
    );
    if (!mounted) return;

    widget.repository.exitPersona();
    Navigator.of(context).pushNamedAndRemoveUntil('/signup', (route) => false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('계정 탈퇴')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '탈퇴하면 아래 정보가 모두 삭제돼요',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
            ),
            const SizedBox(height: 16),
            const _WithdrawItem(text: '보유 등급 티켓 전체'),
            const _WithdrawItem(text: '포인트 잔액'),
            const _WithdrawItem(text: '구매·교환 활동내역'),
            const _WithdrawItem(text: '닉네임 및 프로필 정보'),
            const SizedBox(height: 20),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _agreed,
              onChanged: (v) => setState(() => _agreed = v ?? false),
              title: const Text('안내 사항을 확인했으며 탈퇴에 동의합니다', style: TextStyle(fontSize: 13)),
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: _agreed ? _withdraw : null,
              style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
              child: const Text('탈퇴하기'),
            ),
          ],
        ),
      ),
    );
  }
}

class _WithdrawItem extends StatelessWidget {
  const _WithdrawItem({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          const Icon(Icons.remove_circle_outline, size: 16, color: AppTheme.textSecondary),
          const SizedBox(width: 8),
          Text(text, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
        ],
      ),
    );
  }
}
