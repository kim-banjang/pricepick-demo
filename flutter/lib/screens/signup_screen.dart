import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 가입 화면. 카카오 / 게스트 진입.
/// 카카오 로그인은 실제 Kakao SDK 앱 키·SHA-1 등록이 필요해 이번 단계에서는 스텁으로만 표시한다.
class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  bool _loading = false;

  void _showKakaoStubNotice() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('카카오 로그인 연동 준비 중'),
        content: const Text(
          '실제 카카오 로그인은 카카오 개발자 앱 키 발급과 SHA-1 등록이 필요합니다.\n'
          '이번 단계는 코어 스파인 골격이라 게스트 진입으로 먼저 진행해 주세요.',
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

  Future<void> _startAsGuest() async {
    final nickname = await _promptNickname();
    if (nickname == null || nickname.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      final uid = widget.repository.uid;
      if (uid == null) throw StateError('인증되지 않은 상태입니다.');
      await widget.repository.createGuestUser(uid: uid, nickname: nickname.trim());
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/home');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('가입 실패: $e')),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<String?> _promptNickname() {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('닉네임 입력'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: '사용할 닉네임'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(controller.text),
            child: const Text('시작하기'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.local_offer_outlined, size: 48, color: AppTheme.primary),
              const SizedBox(height: 12),
              const Text(
                'PricePick 시작하기',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              const Text(
                '경유구매로 쌓이는 티켓과 포인트',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 40),
              ElevatedButton.icon(
                onPressed: _loading ? null : _showKakaoStubNotice,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFEE500),
                  foregroundColor: const Color(0xFF3C1E1E),
                ),
                icon: const Icon(Icons.chat_bubble_rounded, size: 18),
                label: const Text('카카오로 시작하기'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: _loading ? null : _startAsGuest,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: _loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('게스트로 시작하기'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
