import type { OrderFlowPreferences } from "../../../shared/orderFlowPreferences";

export const BINANCE_ORDER_FLOW_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "DOTUSDT",
  "LINKUSDT",
] as const;

export const MAX_LOCAL_ORDER_FLOW_SYMBOLS = 5;
export const MAX_CVD_DISPLAY_POINTS = 180;
const CVD_WINDOW_MS = 5 * 60 * 1_000;
const CVD_BUCKET_MS = 1_000;
const LARGE_TRADE_SAMPLE = 20;
const LARGE_TRADE_MULTIPLIER = 4;

export type BinanceOrderFlowStatus = "connecting" | "live" | "closed" | "error" | "unsupported";
export type BinanceOrderFlowEvent = {
  id: string;
  kind: "large_trade";
  side: "aggressive_buy" | "aggressive_sell";
  price: number;
  notional: number;
  observedAt: number;
};

export type BinanceCvdPoint = {
  time: number;
  delta: number;
  cvd: number;
  buyVolume: number;
  sellVolume: number;
  largeTradeCount: number;
  depthImbalance: number | null;
};

export type BinanceOrderFlowSnapshot = {
  symbol: string;
  status: BinanceOrderFlowStatus;
  updatedAt: number | null;
  tradeUpdatedAt: number | null;
  depthUpdatedAt: number | null;
  bidLiquidity: number | null;
  askLiquidity: number | null;
  depthImbalance: number | null;
  cvdApprox: number;
  cvdSeries: BinanceCvdPoint[];
  events: BinanceOrderFlowEvent[];
  depthLevels: number;
  error: string | null;
};

export type BinanceTradePayload = { p: string; q: string; m: boolean; t: number; T: number };
export type BinanceDepthPayload = { bids: Array<[string, string]>; asks: Array<[string, string]>; E?: number };

type MutableCvdBucket = Omit<BinanceCvdPoint, "time" | "cvd">;
type MutableState = BinanceOrderFlowSnapshot & {
  cvdBuckets: Map<number, MutableCvdBucket>;
  recentNotionals: number[];
};

function finite(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function isSupportedBinanceOrderFlowSymbol(symbol: string, exchange: string) {
  return exchange.trim().toUpperCase() === "BINANCE" && BINANCE_ORDER_FLOW_SYMBOLS.includes(symbol.trim().toUpperCase() as (typeof BINANCE_ORDER_FLOW_SYMBOLS)[number]);
}

export function normalizeBinanceOrderFlowSymbols(symbols: string[]) {
  return Array.from(new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(symbol => BINANCE_ORDER_FLOW_SYMBOLS.includes(symbol as (typeof BINANCE_ORDER_FLOW_SYMBOLS)[number]))))
    .slice(0, MAX_LOCAL_ORDER_FLOW_SYMBOLS);
}

function initialState(symbol: string): MutableState {
  return {
    symbol,
    status: "connecting",
    updatedAt: null,
    tradeUpdatedAt: null,
    depthUpdatedAt: null,
    bidLiquidity: null,
    askLiquidity: null,
    depthImbalance: null,
    cvdApprox: 0,
    cvdSeries: [],
    events: [],
    depthLevels: 0,
    error: null,
    cvdBuckets: new Map(),
    recentNotionals: [],
  };
}

function publicSnapshot(state: MutableState): BinanceOrderFlowSnapshot {
  const { cvdBuckets: _cvdBuckets, recentNotionals: _recentNotionals, ...snapshot } = state;
  return { ...snapshot, events: snapshot.events.map(event => ({ ...event })), cvdSeries: snapshot.cvdSeries.map(point => ({ ...point })) };
}

function downsample(points: BinanceCvdPoint[]) {
  if (points.length <= MAX_CVD_DISPLAY_POINTS) return points;
  const sampled: BinanceCvdPoint[] = [];
  const stride = (points.length - 1) / (MAX_CVD_DISPLAY_POINTS - 1);
  for (let index = 0; index < MAX_CVD_DISPLAY_POINTS; index += 1) sampled.push(points[Math.round(index * stride)]);
  return sampled;
}

function rebuildCvdSeries(state: MutableState, observedAt: number) {
  const oldestAllowed = observedAt - CVD_WINDOW_MS;
  Array.from(state.cvdBuckets.keys()).forEach(timestamp => {
    if (timestamp < oldestAllowed) state.cvdBuckets.delete(timestamp);
  });
  let cumulative = 0;
  const points = Array.from(state.cvdBuckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([timestamp, bucket]) => {
      cumulative += bucket.delta;
      return {
        time: Math.floor(timestamp / 1_000),
        delta: bucket.delta,
        cvd: cumulative,
        buyVolume: bucket.buyVolume,
        sellVolume: bucket.sellVolume,
        largeTradeCount: bucket.largeTradeCount,
        depthImbalance: bucket.depthImbalance,
      };
    });
  state.cvdSeries = downsample(points);
  state.cvdApprox = cumulative;
}

export class BinanceOrderFlowEngine {
  private states = new Map<string, MutableState>();
  private preferences: OrderFlowPreferences;

  constructor(symbols: string[], preferences: OrderFlowPreferences) {
    this.preferences = preferences;
    normalizeBinanceOrderFlowSymbols(symbols).forEach(symbol => this.states.set(symbol, initialState(symbol)));
  }

  setStatus(symbol: string, status: BinanceOrderFlowStatus, error: string | null = null) {
    const state = this.states.get(symbol);
    if (!state) return;
    state.status = status;
    state.error = error;
  }

  applyDepth(symbol: string, payload: BinanceDepthPayload, observedAt = Date.now()) {
    const state = this.states.get(symbol);
    if (!state) return;
    const bidLiquidity = payload.bids.slice(0, this.preferences.depthLevels).reduce((total, [, quantity]) => total + finite(quantity), 0);
    const askLiquidity = payload.asks.slice(0, this.preferences.depthLevels).reduce((total, [, quantity]) => total + finite(quantity), 0);
    const total = bidLiquidity + askLiquidity;
    state.bidLiquidity = bidLiquidity;
    state.askLiquidity = askLiquidity;
    state.depthImbalance = total > 0 ? (bidLiquidity - askLiquidity) / total : null;
    state.depthLevels = Math.min(payload.bids.length, this.preferences.depthLevels) + Math.min(payload.asks.length, this.preferences.depthLevels);
    state.depthUpdatedAt = observedAt;
    state.updatedAt = observedAt;
    state.status = "live";
    state.error = null;
  }

  applyTrade(symbol: string, payload: BinanceTradePayload) {
    const state = this.states.get(symbol);
    if (!state) return;
    const observedAt = Number.isFinite(payload.T) ? payload.T : Date.now();
    const price = finite(payload.p);
    const quantity = finite(payload.q);
    const notional = price * quantity;
    const signedVolume = payload.m ? -quantity : quantity;
    const sample = state.recentNotionals.slice(-LARGE_TRADE_SAMPLE);
    const baseline = sample.length ? sample.reduce((total, value) => total + value, 0) / sample.length : null;
    const isLarge = baseline !== null && notional >= this.preferences.largeTradeMinNotional && notional >= baseline * LARGE_TRADE_MULTIPLIER;
    if (isLarge) {
      const event: BinanceOrderFlowEvent = {
        id: `${payload.t}-${observedAt}`,
        kind: "large_trade",
        side: payload.m ? "aggressive_sell" : "aggressive_buy",
        price,
        notional,
        observedAt,
      };
      state.events = [event, ...state.events].slice(0, 3);
    }
    const bucketTime = Math.floor(observedAt / CVD_BUCKET_MS) * CVD_BUCKET_MS;
    const bucket = state.cvdBuckets.get(bucketTime) ?? {
      delta: 0,
      buyVolume: 0,
      sellVolume: 0,
      largeTradeCount: 0,
      depthImbalance: state.depthImbalance,
    };
    bucket.delta += signedVolume;
    if (signedVolume > 0) bucket.buyVolume += quantity;
    else bucket.sellVolume += quantity;
    if (isLarge) bucket.largeTradeCount += 1;
    bucket.depthImbalance = state.depthImbalance;
    state.cvdBuckets.set(bucketTime, bucket);
    rebuildCvdSeries(state, observedAt);
    state.recentNotionals = [...sample, notional].slice(-LARGE_TRADE_SAMPLE);
    state.tradeUpdatedAt = observedAt;
    state.updatedAt = observedAt;
    state.status = "live";
    state.error = null;
  }

  snapshots() {
    return Array.from(this.states.values()).map(publicSnapshot);
  }
}

export function orderFlowPercent(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

export function orderFlowStatusLabel(status: BinanceOrderFlowStatus) {
  if (status === "live") return "متصل";
  if (status === "connecting") return "جارٍ الاتصال";
  if (status === "closed") return "مغلق";
  if (status === "error") return "تعذر الاتصال";
  return "غير مدعوم";
}
