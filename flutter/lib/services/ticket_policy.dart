/// 등급 티켓 Greedy 전환 정책.
/// 골드 100,000원당·실버 50,000원당·브론즈 5,000원당 1장, 큰 단위부터 채운다.
/// (수량이 아니라 금액 단가 기준 — pricepick-demo/app 웹 데모와 동일 공식)
class TicketBreakdown {
  const TicketBreakdown({required this.bronze, required this.silver, required this.gold});

  final int bronze;
  final int silver;
  final int gold;

  int get total => bronze + silver + gold;

  List<String> toFlatGradeList() => [
        ...List.filled(gold, 'gold'),
        ...List.filled(silver, 'silver'),
        ...List.filled(bronze, 'bronze'),
      ];
}

TicketBreakdown greedyBreakdown(int amountKrw) {
  final units = amountKrw ~/ 5000;
  final gold = units ~/ 20;
  final rem1 = units % 20;
  final silver = rem1 ~/ 10;
  final bronze = rem1 % 10;
  return TicketBreakdown(bronze: bronze, silver: silver, gold: gold);
}

const gradeTicketValidity = Duration(days: 365);
const eventTicketValidity = Duration(days: 100);
