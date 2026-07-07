import 'package:flutter/material.dart';

import '../services/pricepick_repository.dart';
import '../theme/app_theme.dart';

/// 앱 진입점. 익명 인증 후 users/{uid} 존재 여부로 가입/홈 분기.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.repository});

  final PricePickRepository repository;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  String? _error;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final user = await widget.repository.signInAnonymously();
      final doc = await widget.repository.fetchUser(user.uid);
      if (!mounted) return;
      if (doc.exists) {
        Navigator.of(context).pushReplacementNamed('/home');
      } else {
        Navigator.of(context).pushReplacementNamed('/signup');
      }
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: _error != null
            ? Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Firebase 연결 실패',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.local_offer_outlined,
                    size: 56,
                    color: AppTheme.primary,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'PricePick',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const CircularProgressIndicator(color: AppTheme.primary),
                ],
              ),
      ),
    );
  }
}
