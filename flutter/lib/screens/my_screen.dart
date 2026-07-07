import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 마이. 프로필 요약 + 공지/문의/이벤트/응모 진입 메뉴.
class MyScreen extends StatefulWidget {
  const MyScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<MyScreen> createState() => _MyScreenState();
}

class _MyScreenState extends State<MyScreen> {
  String? _nickname;
  bool _linkedKakao = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = widget.repository.activeUserId;
    if (uid == null) return;
    final doc = await widget.repository.fetchUserDoc(uid);
    final data = doc.data();
    setState(() {
      _nickname = data?['nickname'] as String? ?? '게스트';
      _linkedKakao = data?['linked_kakao'] as bool? ?? false;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('마이')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Row(
                      children: [
                        const CircleAvatar(
                          radius: 24,
                          backgroundColor: AppTheme.primarySoft,
                          foregroundColor: AppTheme.primary,
                          child: Icon(Icons.person_outline),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _nickname ?? '게스트',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                widget.repository.isPersonaMode
                                    ? '카카오 연동 회원 시뮬 로그인 중'
                                    : (_linkedKakao ? '카카오 연동됨' : '게스트 계정'),
                                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (widget.repository.isPersonaMode) ...[
                  const SizedBox(height: 12),
                  _MenuTile(
                    icon: Icons.logout,
                    title: '시뮬 로그인 종료 (다시 시작하기로)',
                    onTap: () {
                      widget.repository.exitPersona();
                      Navigator.of(context).pushNamedAndRemoveUntil('/signup', (route) => false);
                    },
                  ),
                ],
                const SizedBox(height: 24),
                _MenuTile(
                  icon: Icons.campaign_outlined,
                  title: '공지사항',
                  onTap: () => Navigator.of(context).pushNamed('/notice'),
                ),
                _MenuTile(
                  icon: Icons.headset_mic_outlined,
                  title: '문의하기',
                  onTap: () => Navigator.of(context).pushNamed('/inquiry'),
                ),
                _MenuTile(
                  icon: Icons.celebration_outlined,
                  title: '이벤트',
                  onTap: () => Navigator.of(context).pushNamed('/event'),
                ),
                _MenuTile(
                  icon: Icons.card_giftcard,
                  title: '응모',
                  onTap: () => Navigator.of(context).pushNamed('/raffle'),
                ),
                _MenuTile(
                  icon: Icons.settings_outlined,
                  title: '설정',
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('설정 화면은 다음 단계에서 이어집니다.')),
                  ),
                ),
              ],
            ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({required this.icon, required this.title, required this.onTap});

  final IconData icon;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: CircleAvatar(
          backgroundColor: AppTheme.primarySoft,
          foregroundColor: AppTheme.primary,
          child: Icon(icon),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
      ),
    );
  }
}
