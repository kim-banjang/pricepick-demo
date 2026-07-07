import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 마이. 프로필 요약 + 나머지 기능(혜택/내 정보/안내/설정) 진입 메뉴 허브.
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
                const _SectionLabel('혜택'),
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
                  icon: Icons.group_add_outlined,
                  title: '친구초대',
                  onTap: () => Navigator.of(context).pushNamed('/invite'),
                ),
                _MenuTile(
                  icon: Icons.event_available_outlined,
                  title: '출석체크',
                  onTap: () => Navigator.of(context).pushNamed('/checkin'),
                ),
                _MenuTile(
                  icon: Icons.casino_outlined,
                  title: '행운룰렛',
                  onTap: () => Navigator.of(context).pushNamed('/roulette'),
                ),
                const _SectionLabel('내 정보'),
                _MenuTile(
                  icon: Icons.notifications_none,
                  title: '알림',
                  onTap: () => Navigator.of(context).pushNamed('/notification'),
                ),
                _MenuTile(
                  icon: Icons.history,
                  title: '활동내역',
                  onTap: () => Navigator.of(context).pushNamed('/activity'),
                ),
                const _SectionLabel('안내'),
                _MenuTile(
                  icon: Icons.campaign_outlined,
                  title: '공지사항',
                  onTap: () => Navigator.of(context).pushNamed('/notice'),
                ),
                _MenuTile(
                  icon: Icons.info_outline,
                  title: '적립 조건 안내',
                  onTap: () => Navigator.of(context).pushNamed('/terms'),
                ),
                _MenuTile(
                  icon: Icons.headset_mic_outlined,
                  title: '문의하기',
                  onTap: () => Navigator.of(context).pushNamed('/inquiry'),
                ),
                const _SectionLabel('설정'),
                _MenuTile(
                  icon: Icons.settings_outlined,
                  title: '설정',
                  onTap: () => Navigator.of(context).pushNamed('/settings'),
                ),
              ],
            ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 8, left: 4),
      child: Text(
        text,
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.textSecondary),
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
      margin: const EdgeInsets.only(bottom: 10),
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
