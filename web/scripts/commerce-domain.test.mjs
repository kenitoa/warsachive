import test from "node:test";
import assert from "node:assert/strict";
import { parseMoney, formatMoney, refundBalances } from "../lib/commerce-domain.ts";
test("currency-facing input converts KRW/USD exact minor units without rounding or exponent bypass", () => {
  assert.equal(parseMoney("1,200", "krw"), 1200); assert.equal(parseMoney("12.30", "usd"), 1230); assert.equal(parseMoney("0.01", "usd"), 1); assert.match(formatMoney(1230, "usd"), /12\.30/);
  for (const input of ["1e3", "-1", "0", "Infinity", "1,00", "0.001", "9007199254740992"]) assert.throws(() => parseMoney(input, "usd")); assert.throws(() => parseMoney("10.5", "krw"));
});
test("refund availability subtracts pending reservations and confirmed refunds independently", () => {
  assert.deepEqual(refundBalances({ amountMinor: 1000, refundedMinor: 200, refundRequests: [{ amountMinor: 300, status: "unknown" }, { amountMinor: 50, status: "requested" }, { amountMinor: 200, status: "refunded" }, { amountMinor: 200, status: "rejected" }] }), { paid: 1000, refunded: 200, reserved: 350, available: 450 });
});
