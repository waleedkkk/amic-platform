import { EventEmitter } from "node:events";

export type PaperTradeSocketEvent = {
  type:
    | "paper_trade.close_deviation_detected"
    | "paper_trade.closed";
  eventId: string;
  tradeId: number;
  symbol: string;
  exchange: string;
  requestedClosePrice?: string;
  referencePrice?: string | null;
  referenceFetchedAt?: string | null;
  deviationPercent?: number | null;
  thresholdPercent?: number;
  provider?: "twelve-data" | "yahoo" | "unknown" | null;
  observedAt: string;
};

const eventBus = new EventEmitter();
eventBus.setMaxListeners(0);

export function publishPaperTradeEvent(userId: number, event: PaperTradeSocketEvent) {
  eventBus.emit("paper-trade", userId, event);
}

export function onPaperTradeEvent(
  listener: (userId: number, event: PaperTradeSocketEvent) => void,
) {
  eventBus.on("paper-trade", listener);
  return () => eventBus.off("paper-trade", listener);
}
