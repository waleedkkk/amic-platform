import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { publishPaperTradeEvent } from "./paperTradeEvents";
import { attachPaperTradeWebSocket } from "./paperTradeSocket";

vi.mock("./localAuth", () => ({
  resolveSessionUser: vi.fn(async () => ({ id: 42 })),
}));

type ReceivedMessage = Record<string, unknown>;

let server: Server | null = null;
let socketController: ReturnType<typeof attachPaperTradeWebSocket> | null = null;

function waitForMessage(socket: WebSocket, predicate: (message: ReceivedMessage) => boolean) {
  return new Promise<ReceivedMessage>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for WebSocket message"));
    }, 2_000);

    const onMessage = (raw: WebSocket.RawData) => {
      let message: ReceivedMessage;
      try {
        message = JSON.parse(raw.toString()) as ReceivedMessage;
      } catch {
        return;
      }
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(message);
    };

    socket.on("message", onMessage);
  });
}

async function closeServer() {
  socketController?.close();
  socketController = null;
  if (!server) return;
  const current = server;
  server = null;
  await new Promise<void>(resolve => current.close(() => resolve()));
}

describe("paper trade WebSocket", () => {
  afterEach(async () => {
    await closeServer();
  });

  it("authenticates the session and sends events only to the matching user", async () => {
    server = createServer();
    socketController = attachPaperTradeWebSocket(server);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/paper-trading`, {
      headers: { Origin: "http://localhost" },
    });
    const readyPromise = waitForMessage(socket, message => message.type === "paper_trade.socket_ready");
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    await readyPromise;

    const eventPromise = waitForMessage(socket, message => message.type === "paper_trade.close_deviation_detected");
    publishPaperTradeEvent(42, {
      type: "paper_trade.close_deviation_detected",
      eventId: "deviation-1",
      tradeId: 9,
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      requestedClosePrice: "110",
      referencePrice: "100",
      referenceFetchedAt: new Date().toISOString(),
      deviationPercent: 10,
      thresholdPercent: 5,
      provider: "twelve-data",
      observedAt: new Date().toISOString(),
    });

    await expect(eventPromise).resolves.toMatchObject({ tradeId: 9, symbol: "BTCUSDT", deviationPercent: 10 });
    socket.close();
  });

  it("does not expose a trading command through the push-only channel", async () => {
    server = createServer();
    socketController = attachPaperTradeWebSocket(server);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/paper-trading`);
    const readyPromise = waitForMessage(socket, message => message.type === "paper_trade.socket_ready");

    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    await readyPromise;

    const rejection = waitForMessage(socket, message => message.type === "paper_trade.message_rejected");
    socket.send(JSON.stringify({ type: "paper_trade.close" }));
    await expect(rejection).resolves.toMatchObject({
      reason: "قناة التنبيهات لا تنفذ عمليات تداول؛ استخدم مسار API.",
    });
    socket.close();
  });
});
