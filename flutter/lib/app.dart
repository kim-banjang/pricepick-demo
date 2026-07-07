import 'package:flutter/material.dart';

import 'screens/gifticon_screen.dart';
import 'screens/home_screen.dart';
import 'screens/purchase_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/ticket_screen.dart';
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
      },
    );
  }
}
