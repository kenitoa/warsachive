export function currencyDigits(currency: string): number { const digits = new Intl.NumberFormat("ko-KR", { style: "currency", currency }).resolvedOptions().maximumFractionDigits; if (digits === undefined || digits < 0 || digits > 4) throw new Error("통화의 금액 단위를 확인하세요."); return digits; }
export function formatMoney(amountMinor: number, currency: string): string { if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error("금액을 확인하세요."); return new Intl.NumberFormat("ko-KR", { style: "currency", currency }).format(amountMinor / 10 ** currencyDigits(currency)); }
/** Converts decimal text without floating point rounding or exponent notation. */
export function parseMoney(value: string, currency: string): number {
  const input = value.trim(); if (!/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]+)?$/.test(input)) throw new Error("환불 금액을 숫자로 입력하세요.");
  const [whole, fraction = ""] = input.replaceAll(",", "").split("."); const digits = currencyDigits(currency);
  if (fraction.length > digits) throw new Error(`이 통화는 소수 ${digits}자리까지 입력할 수 있습니다.`);
  const amount = BigInt(whole) * BigInt(10) ** BigInt(digits) + BigInt(fraction.padEnd(digits, "0") || "0");
  if (amount <= BigInt(0) || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("양의 금액과 허용 범위를 확인하세요.");
  return Number(amount);
}
export function refundBalances(order: { amountMinor: number; refundedMinor: number; refundRequests: { amountMinor: number; status: string }[] }): { paid: number; refunded: number; reserved: number; available: number } {
  const reserved = order.refundRequests.filter(request => ["requested", "pending", "unknown"].includes(request.status)).reduce((sum, request) => sum + request.amountMinor, 0);
  if (!Number.isSafeInteger(reserved) || reserved < 0) throw new Error("환불 접수 금액을 확인하세요.");
  return { paid: order.amountMinor, refunded: order.refundedMinor, reserved, available: Math.max(0, order.amountMinor - order.refundedMinor - reserved) };
}
