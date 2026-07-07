/// 확정 대기 중인 가지급 티켓 묶음. 하나의 postback(구매 1건)에 묶인 pending 티켓들을 그룹핑한 뷰.
class PendingBundle {
  const PendingBundle({
    required this.postbackId,
    required this.mallName,
    required this.purchaseAmount,
    required this.pendingTicketCount,
  });

  final String postbackId;
  final String mallName;
  final int purchaseAmount;
  final int pendingTicketCount;
}
