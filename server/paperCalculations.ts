import Decimal from "decimal.js";

type TradePlanInput = {
  side: "long" | "short";
  entryPrice: string;
  stopLoss?: string;
  takeProfit?: string;
};

function parseOptionalPositivePrice(value: string | undefined, label: string) {
  if (value === undefined || value.trim() === "") return null;
  let price: Decimal;
  try {
    price = new Decimal(value);
  } catch {
    throw new Error(`${label} يجب أن يكون رقمًا موجبًا.`);
  }
  if (!price.isFinite() || price.lte(0)) throw new Error(`${label} يجب أن يكون رقمًا موجبًا.`);
  return price;
}

/** يتحقق خادميًا من منطق الوقف والهدف حتى لا يمكن تجاوز تحذيرات الواجهة بطلب مباشر. */
export function validatePaperTradePlan(input: TradePlanInput) {
  const entryPrice = parseOptionalPositivePrice(input.entryPrice, "سعر الدخول");
  if (!entryPrice) throw new Error("سعر الدخول يجب أن يكون رقمًا موجبًا.");
  const stopLoss = parseOptionalPositivePrice(input.stopLoss, "وقف الخسارة");
  const takeProfit = parseOptionalPositivePrice(input.takeProfit, "جني الربح");

  if (input.side === "long") {
    if (stopLoss?.gte(entryPrice)) throw new Error("للشراء، يجب أن يكون وقف الخسارة أقل من سعر الدخول.");
    if (takeProfit?.lte(entryPrice)) throw new Error("للشراء، يجب أن يكون جني الربح أعلى من سعر الدخول.");
  } else {
    if (stopLoss?.lte(entryPrice)) throw new Error("للبيع، يجب أن يكون وقف الخسارة أعلى من سعر الدخول.");
    if (takeProfit?.gte(entryPrice)) throw new Error("للبيع، يجب أن يكون جني الربح أقل من سعر الدخول.");
  }
}

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
