import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 가입 화면. 카카오 / 게스트 진입.
/// 카카오는 실제 Kakao SDK 연동 없이, CMS에 세팅된 카카오 연동 회원으로 바로 들어가는
/// 시뮬 로그인이다 (웹 데모 시연용 — 실 SDK/서명 빌드는 이 저장소 범위 밖).
class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  bool _loading = false;

  Future<void> _startWithKakaoSim() async {
    setState(() => _loading = true);
    List<QueryDocumentSnapshot<Map<String, dynamic>>> members = [];
    try {
      members = await widget.repository.fetchLinkedKakaoMembers();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('연동 회원 조회 실패: $e')),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
    if (!mounted) return;

    if (members.isEmpty) {
      await showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('연동 회원 없음'),
          content: const Text('CMS에 세팅된 카카오 연동 회원이 없습니다. 게스트로 시작해 주세요.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('확인'),
            ),
          ],
        ),
      );
      return;
    }

    final picked = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('카카오 연동 회원으로 시작'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: members.length,
            itemBuilder: (context, i) {
              final data = members[i].data();
              final nickname = data['nickname'] as String? ?? members[i].id;
              final kakaoNickname = data['kakao_nickname'] as String?;
              return ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFFEE500),
                  foregroundColor: Color(0xFF3C1E1E),
                  child: Icon(Icons.chat_bubble_rounded, size: 18),
                ),
                title: Text(nickname),
                subtitle: kakaoNickname != null ? Text('카카오: $kakaoNickname') : null,
                onTap: () => Navigator.of(dialogContext).pop(members[i].id),
              );
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('취소'),
          ),
        ],
      ),
    );
    if (picked == null) return;

    widget.repository.enterAsPersona(picked);
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed('/home');
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
                onPressed: _loading ? null : _startWithKakaoSim,
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
              const SizedBox(height: 12),
              const Text(
                '카카오 로그인은 실 SDK 연동 없이 CMS 연동 회원으로 바로 진입하는 시뮬입니다.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
