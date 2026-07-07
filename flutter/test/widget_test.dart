import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:pricepick_flutter/theme/app_theme.dart';

void main() {
  testWidgets('AppTheme.light builds without error', (WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(theme: AppTheme.light, home: const SizedBox()));
    expect(find.byType(SizedBox), findsOneWidget);
  });
}
