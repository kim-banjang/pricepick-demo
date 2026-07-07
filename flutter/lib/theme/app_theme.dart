import 'package:flutter/material.dart';

/// PricePick 데모 앱 테마. 화이트 + 소프트블루/파스텔 톤 고정.
/// 다크테마는 지원하지 않는다 (라이트 고정).
class AppTheme {
  AppTheme._();

  static const Color primary = Color(0xFF5B8DEF);
  static const Color primarySoft = Color(0xFFEAF1FF);
  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFF7F9FC);
  static const Color textPrimary = Color(0xFF1F2430);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color border = Color(0xFFE5E9F0);
  static const Color gold = Color(0xFFE0B15C);
  static const Color silver = Color(0xFFA0A7B4);
  static const Color bronze = Color(0xFFC08B5C);

  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: background,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        brightness: Brightness.light,
        surface: background,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: background,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: true,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: border),
        ),
      ),
    );
  }
}
