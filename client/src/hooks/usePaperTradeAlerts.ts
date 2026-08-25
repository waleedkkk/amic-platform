import { useEffect, useRef, useState } from "react";

export type PaperTradeAlert = {
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

export type PaperTradeSocketStatus = "connecting" | "connected" | "reconnecting" | "offline";

const MAX_ALERTS = 30;
const EVENT_TTL_MS = 10 * 60_000;

function isPaperTradeAlert(value: unknown): value is PaperTradeAlert {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<PaperTradeAlert>;
  return (
    (message.type === "paper_trade.close_deviation_detected" || message.type === "paper_trade.closed") &&
    typeof message.eventId === "string" &&
    Number.isSafeInteger(message.tradeId) &&
    typeof message.symbol === "string" &&
    typeof message.exchange === "string" &&
    typeof message.observedAt === "string"
  );
}

function getSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws/paper-trading`;
}

export function usePaperTradeAlerts() {
  const [alerts, setAlerts] = useState<PaperTradeAlert[]>([]);
  const [status, setStatus] = useState<PaperTradeSocketStatus>("connecting");
  const seenEvents = useRef(new Map<string, number>());

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;
    let stopped = false;

    const cleanSeenEvents = (now: number) => {
      seenEvents.current.forEach((timestamp, eventId) => {
        if (now - timestamp > EVENT_TTL_MS) seenEvents.current.delete(eventId);
      });
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      setStatus("reconnecting");
      const delay = Math.min(1_000 * 2 ** retryAttempt, 30_000);
      retryAttempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (stopped) return;
      setStatus(retryAttempt ? "reconnecting" : "connecting");
      socket = new WebSocket(getSocketUrl());

      socket.onopen = () => {
        retryAttempt = 0;
        setStatus("connected");
      };

      socket.onmessage = event => {
        let message: unknown;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!isPaperTradeAlert(message)) return;

        const now = Date.now();
        cleanSeenEvents(now);
        if (seenEvents.current.has(message.eventId)) return;
        seenEvents.current.set(message.eventId, now);
        setAlerts(current => [message, ...current].slice(0, MAX_ALERTS));
      };

      socket.onerror = () => socket?.close();
      socket.onclose = () => scheduleReconnect();
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close(1000, "Component unmounted");
    };
  }, []);

  const dismissAlert = (eventId: string) => {
    setAlerts(current => current.filter(alert => alert.eventId !== eventId));
  };

  const clearAlerts = () => setAlerts([]);

  return { alerts, status, dismissAlert, clearAlerts };
}
