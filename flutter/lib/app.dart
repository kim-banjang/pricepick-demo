import 'package:flutter/material.dart';

import 'screens/activity_screen.dart';
import 'screens/checkin_screen.dart';
import 'screens/earning_terms_screen.dart';
import 'screens/event_screen.dart';
import 'screens/gifticon_screen.dart';
import 'screens/home_screen.dart';
import 'screens/inquiry_screen.dart';
import 'screens/invite_screen.dart';
import 'screens/my_screen.dart';
import 'screens/notice_screen.dart';
import 'screens/notification_screen.dart';
import 'screens/purchase_screen.dart';
import 'screens/raffle_screen.dart';
import 'screens/roulette_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/ticket_screen.dart';
import 'screens/withdraw_screen.dart';
import 'services/pricepick_repository.dart';
import 'theme/app_theme.dart';

class PricePickApp extends StatelessWidget {
  const PricePickApp({super.key});

  @override
  Widget build(BuildContext context) {
    final repository = PricePickRepository();
    return MaterialApp(
      title: 'PricePick',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.light,
      theme: AppTheme.light,
      darkTheme: AppTheme.light,
      initialRoute: '/',
      routes: {
        '/': (_) => SplashScreen(repository: repository),
        '/signup': (_) => SignupScreen(repository: repository),
        '/home': (_) => HomeScreen(repository: repository),
        '/purchase': (_) => PurchaseScreen(repository: repository),
        '/ticket': (_) => TicketScreen(repository: repository),
        '/gifticon': (_) => GifticonScreen(repository: repository),
        '/my': (_) => MyScreen(repository: repository),
        '/notice': (_) => NoticeScreen(repository: repository),
        '/inquiry': (_) => InquiryScreen(repository: repository),
        '/event': (_) => EventScreen(repository: repository),
        '/raffle': (_) => RaffleScreen(repository: repository),
        '/notification': (_) => NotificationScreen(repository: repository),
        '/activity': (_) => ActivityScreen(repository: repository),
        '/invite': (_) => InviteScreen(repository: repository),
        '/checkin': (_) => CheckinScreen(repository: repository),
        '/roulette': (_) => const RouletteScreen(),
        '/terms': (_) => const EarningTermsScreen(),
        '/settings': (_) => SettingsScreen(repository: repository),
        '/withdraw': (_) => WithdrawScreen(repository: repository),
      },
    );
  }
}
