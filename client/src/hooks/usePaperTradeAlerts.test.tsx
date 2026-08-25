import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePaperTradeAlerts, type PaperTradeAlert } from "@/hooks/usePaperTradeAlerts";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  readonly close = vi.fn((code?: number) => {
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
  });
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: PaperTradeAlert) {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }
}

function Probe() {
  const { alerts, status } = usePaperTradeAlerts();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="count">{alerts.length}</span>
      <span data-testid="latest">{alerts[0]?.eventId ?? "none"}</span>
    </div>
  );
}

describe("usePaperTradeAlerts", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    cleanup();
    globalThis.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it("deduplicates events by eventId", () => {
    render(<Probe />);
    const socket = FakeWebSocket.instances[0];
    expect(socket).toBeDefined();
    expect(screen.getByTestId("status").textContent).toBe("connecting");

    act(() => socket.open());
    expect(screen.getByTestId("status").textContent).toBe("connected");

    const alert: PaperTradeAlert = {
      type: "paper_trade.close_deviation_detected",
      eventId: "event-1",
      tradeId: 8,
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      requestedClosePrice: "110",
      referencePrice: "100",
      deviationPercent: 10,
      thresholdPercent: 5,
      observedAt: new Date().toISOString(),
    };

    act(() => {
      socket.receive(alert);
      socket.receive(alert);
    });

    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("latest").textContent).toBe("event-1");
  });
});
