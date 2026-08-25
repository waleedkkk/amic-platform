import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import type { Request } from "express";
import { WebSocket, WebSocketServer } from "ws";
import { resolveSessionUser } from "./localAuth";
import { onPaperTradeEvent, type PaperTradeSocketEvent } from "./paperTradeEvents";

type UserSockets = Map<number, Set<WebSocket>>;

type ClientMessage = {
  type?: unknown;
};

const PATH = "/ws/paper-trading";
const MAX_PAYLOAD = 8 * 1024;
const HEARTBEAT_INTERVAL_MS = 30_000;

const socketsByUser: UserSockets = new Map();
const socketAlive = new WeakMap<WebSocket, boolean>();

function isAllowedOrigin(request: IncomingMessage) {
  const origin = request.headers.origin;
  if (!origin) return true;

  if (process.env.NODE_ENV === "development") return true;

  const configuredOrigins = [process.env.APP_ORIGIN, process.env.VITE_APP_ORIGIN]
    .filter((value): value is string => Boolean(value))
    .map(value => value.replace(/\/$/, ""));
  const forwardedProto = String(request.headers["x-forwarded-proto"] ?? "https").split(",")[0].trim();
  const requestHost = request.headers.host;
  const sameOrigin = requestHost ? `${forwardedProto}://${requestHost}` : null;
  const allowedOrigins = sameOrigin ? [...configuredOrigins, sameOrigin] : configuredOrigins;

  return allowedOrigins.includes(origin.replace(/\/$/, ""));
}

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(payload));
  return true;
}

function removeSocket(userId: number, socket: WebSocket) {
  const userSockets = socketsByUser.get(userId);
  if (!userSockets) return;
  userSockets.delete(socket);
  if (!userSockets.size) socketsByUser.delete(userId);
}

function registerSocket(userId: number, socket: WebSocket) {
  const userSockets = socketsByUser.get(userId) ?? new Set<WebSocket>();
  userSockets.add(socket);
  socketsByUser.set(userId, userSockets);
  socketAlive.set(socket, true);

  socket.once("close", () => removeSocket(userId, socket));
  socket.once("error", () => removeSocket(userId, socket));
}

function authenticateRequest(request: IncomingMessage) {
  return resolveSessionUser({ headers: request.headers } as Request);
}

function rejectUpgrade(socket: Duplex, status: 401 | 403) {
  socket.write(`HTTP/1.1 ${status} ${status === 401 ? "Unauthorized" : "Forbidden"}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function sendPaperTradeEventToUser(userId: number, event: PaperTradeSocketEvent) {
  const userSockets = socketsByUser.get(userId);
  if (!userSockets) return;

  userSockets.forEach(socket => {
    if (!sendJson(socket, event)) {
      socket.terminate();
      userSockets.delete(socket);
    }
  });
  if (!userSockets.size) socketsByUser.delete(userId);
}

export function attachPaperTradeWebSocket(server: HttpServer) {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  const unsubscribe = onPaperTradeEvent((userId, event) => sendPaperTradeEventToUser(userId, event));

  const heartbeat = setInterval(() => {
    socketsByUser.forEach(userSockets => {
      userSockets.forEach(socket => {
        if (socketAlive.get(socket) === false) {
          socket.terminate();
          return;
        }
        socketAlive.set(socket, false);
        socket.ping();
      });
    });
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  const handleUpgrade = async (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== PATH) return;

    if (!isAllowedOrigin(request)) {
      rejectUpgrade(socket, 403);
      return;
    }

    try {
      const user = await authenticateRequest(request);
      if (!user) {
        rejectUpgrade(socket, 401);
        return;
      }

      webSocketServer.handleUpgrade(request, socket, head, client => {
        registerSocket(user.id, client);
        sendJson(client, {
          type: "paper_trade.socket_ready",
          eventId: randomUUID(),
          observedAt: new Date().toISOString(),
        });

        client.on("pong", () => socketAlive.set(client, true));
        client.on("message", raw => {
          let message: ClientMessage;
          try {
            message = JSON.parse(raw.toString()) as ClientMessage;
          } catch {
            client.close(1003, "Invalid JSON");
            return;
          }

          // هذه القناة push-only في المرحلة الأولى. الإغلاق يمر دائمًا عبر tRPC.
          if (message.type !== "paper_trade.ping") {
            sendJson(client, {
              type: "paper_trade.message_rejected",
              eventId: randomUUID(),
              reason: "قناة التنبيهات لا تنفذ عمليات تداول؛ استخدم مسار API.",
            });
          }
        });
      });
    } catch (error) {
      console.warn("[PaperTradeSocket] Authentication failed", {
        reason: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      });
      rejectUpgrade(socket, 401);
    }
  };

  server.on("upgrade", handleUpgrade);

  return {
    close() {
      clearInterval(heartbeat);
      unsubscribe();
      server.off("upgrade", handleUpgrade);
      webSocketServer.close();
      socketsByUser.forEach(userSockets => {
        userSockets.forEach(socket => socket.close(1001, "Server shutdown"));
      });
      socketsByUser.clear();
    },
  };
}
