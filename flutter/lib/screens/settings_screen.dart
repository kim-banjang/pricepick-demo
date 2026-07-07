import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 설정. 알림 토글은 이 데모에서 화면 상태로만 유지한다(Firestore에 저장하지 않음) —
/// 실제 알림 설정 저장/발송 여부 판단은 백엔드 몫이라 여기서는 UI만 보여준다.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _purchaseAlerts = true;
  bool _eventAlerts = true;
  bool _marketingAlerts = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('설정')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('알림 설정', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  title: const Text('픽구매 알림'),
                  value: _purchaseAlerts,
                  onChanged: (v) => setState(() => _purchaseAlerts = v),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: const Text('이벤트 알림'),
                  value: _eventAlerts,
                  onChanged: (v) => setState(() => _eventAlerts = v),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: const Text('마케팅 알림'),
                  value: _marketingAlerts,
                  onChanged: (v) => setState(() => _marketingAlerts = v),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text('계정', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              title: const Text('계정 탈퇴'),
              trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
              onTap: () => Navigator.of(context).pushNamed('/withdraw'),
            ),
          ),
        ],
      ),
    );
  }
}
