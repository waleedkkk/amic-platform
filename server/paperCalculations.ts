import Decimal from "decimal.js";

export function calculateRealizedPnl(input: {
  side: "long" | "short";
  entryPrice: string;
  exitPrice: string;
  quantity: string;
}) {
  const entryPrice = new Decimal(input.entryPrice);
  const exitPrice = new Decimal(input.exitPrice);
  const quantity = new Decimal(input.quantity);
  if (![entryPrice, exitPrice, quantity].every(value => value.isFinite() && value.gt(0))) {
    throw new Error("أسعار وكمية الصفقة يجب أن تكون أرقامًا موجبة.");
  }
  const movement = input.side === "long" ? exitPrice.minus(entryPrice) : entryPrice.minus(exitPrice);
  return movement.mul(quantity).toFixed(8);
}
