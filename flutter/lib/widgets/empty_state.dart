import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// 목록이 비었을 때 공통으로 쓰는 안내 위젯. 아이콘 + 한 줄 설명으로 "정상적으로 비어있음"을 보여준다.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40, color: AppTheme.textSecondary),
          const SizedBox(height: 12),
          Text(message, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
        ],
      ),
    );
  }
}
