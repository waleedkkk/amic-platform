import { useEffect, useMemo, useRef, useState } from "react";
import { BinanceOrderFlowEngine, type BinanceDepthPayload, type BinanceOrderFlowSnapshot, type BinanceTradePayload, normalizeBinanceOrderFlowSymbols } from "./binanceOrderFlowEngine";

type CombinedStreamMessage = { stream?: string; data?: Record<string, unknown> };

function parseStreamSymbol(stream: string | undefined) {
  return stream?.split("@")[0]?.toUpperCase() ?? null;
}

export function useBinanceOrderFlow(symbols: string[], reconnectKey = 0) {
  const normalizedSymbols = useMemo(() => normalizeBinanceOrderFlowSymbols(symbols), [symbols.join("|")]);
  const [snapshots, setSnapshots] = useState<BinanceOrderFlowSnapshot[]>([]);
  const engineRef = useRef<BinanceOrderFlowEngine | null>(null);
  const lastEmitRef = useRef(0);

  useEffect(() => {
    if (!normalizedSymbols.length) {
      setSnapshots([]);
      return;
    }
    const engine = new BinanceOrderFlowEngine(normalizedSymbols);
    engineRef.current = engine;
    setSnapshots(engine.snapshots());
    const streams = normalizedSymbols.flatMap(symbol => [`${symbol.toLowerCase()}@trade`, `${symbol.toLowerCase()}@depth20@100ms`]);
    const socket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams.join("/")}`);
    const emit = (force = false) => {
      const now = Date.now();
      if (!force && now - lastEmitRef.current < 250) return;
      lastEmitRef.current = now;
      setSnapshots(engine.snapshots());
    };

    socket.onopen = () => emit(true);
    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as CombinedStreamMessage;
        const symbol = parseStreamSymbol(message.stream);
        const payload = message.data;
        if (!symbol || !payload) return;
        if (payload.e === "trade") engine.applyTrade(symbol, payload as unknown as BinanceTradePayload);
        else if ("bids" in payload && "asks" in payload) engine.applyDepth(symbol, payload as unknown as BinanceDepthPayload, typeof payload.E === "number" ? payload.E : Date.now());
        emit();
      } catch {
        normalizedSymbols.forEach(symbol => engine.setStatus(symbol, "error", "invalid_message"));
        emit(true);
      }
    };
    socket.onerror = () => {
      normalizedSymbols.forEach(symbol => engine.setStatus(symbol, "error", "connection_error"));
      emit(true);
    };
    socket.onclose = () => {
      normalizedSymbols.forEach(symbol => engine.setStatus(symbol, "closed", "connection_closed"));
      emit(true);
    };
    return () => socket.close();
  }, [normalizedSymbols, reconnectKey]);

  return snapshots;
}
