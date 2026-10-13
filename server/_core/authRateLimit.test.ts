import express from "express";
import { EventEmitter } from "node:events";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "redis";
import {
  createAuthRateLimiters,
  createTrpcAuthRateLimitMiddleware,
} from "./authRateLimit";

vi.mock("redis", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const originalRedisUrl = process.env.REDIS_URL;
const originalRedisPassword = process.env.REDIS_PASSWORD;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = originalRedisUrl;
  if (originalRedisPassword === undefined) delete process.env.REDIS_PASSWORD;
  else process.env.REDIS_PASSWORD = originalRedisPassword;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  mockedCreateClient.mockReset();
});

async function startHttpServer(app: express.Express) {
  const server = await new Promise<Server>(resolve => {
    const listeningServer = app.listen(0, "127.0.0.1", () =>
      resolve(listeningServer)
    );
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected an ephemeral TCP port");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function closeHttpServer(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
}

function redisClientMock(
  sendCommand: (args: string[]) => Promise<unknown>,
  connect: () => Promise<void> = async () => {}
) {
  const client = Object.assign(new EventEmitter(), {
    isOpen: true,
    connect: vi.fn(connect),
    quit: vi.fn(async () => "OK"),
    sendCommand: vi.fn(sendCommand),
  });
  mockedCreateClient.mockReturnValue(
    client as unknown as ReturnType<typeof createClient>
  );
  return client;
}

describe("authentication rate limits", () => {
  it("refuses to use a process-local store in production", async () => {
    delete process.env.REDIS_URL;
    process.env.NODE_ENV = "production";
    await expect(createAuthRateLimiters()).rejects.toThrow(
      "REDIS_URL is required in production"
    );
  });

  it("fails startup when the initial Redis connection fails", async () => {
    process.env.NODE_ENV = "production";
    process.env.REDIS_URL = "redis://redis.test:6379";
    redisClientMock(
      vi.fn(async () => "OK"),
      async () => {
        throw new Error("ECONNREFUSED");
      }
    );

    await expect(createAuthRateLimiters()).rejects.toThrow("ECONNREFUSED");
  });

  it("rejects login requests while Redis is down and allows them after recovery", async () => {
    process.env.NODE_ENV = "production";
    process.env.REDIS_URL = "redis://redis.test:6379";
    let redisAvailable = true;
    const client = redisClientMock(async args => {
      if (args[0] === "SCRIPT" && args[1] === "LOAD") return "script-sha";
      if (!redisAvailable) throw new Error("ECONNRESET");
      return [1, 60_000];
    });

    const limiters = await createAuthRateLimiters();
    const app = express();
    app.use("/api/trpc", createTrpcAuthRateLimitMiddleware(limiters));
    app.use((_req, res) => res.sendStatus(204));
    const { server, baseUrl } = await startHttpServer(app);

    try {
      // Redis accepted connections during startup but drops the first counter command.
      redisAvailable = false;
      const failedResponse = await fetch(`${baseUrl}/api/trpc/auth.login`);
      expect(failedResponse.status).toBe(500);
      expect(client.sendCommand).toHaveBeenCalledWith(
        expect.arrayContaining(["EVALSHA"])
      );

      // Once the Redis connection is available again, the same route can be limited.
      redisAvailable = true;
      expect((await fetch(`${baseUrl}/api/trpc/auth.login`)).status).toBe(204);
    } finally {
      await closeHttpServer(server);
      await limiters.close();
    }
  });

  it("limits login and registration requests by client IP", async () => {
    delete process.env.REDIS_URL;
    process.env.NODE_ENV = "test";
    const limiters = await createAuthRateLimiters();
    const app = express();
    app.use("/api/trpc", createTrpcAuthRateLimitMiddleware(limiters));
    app.use((_req, res) => res.sendStatus(204));
    const { server, baseUrl } = await startHttpServer(app);

    try {
      for (let attempt = 0; attempt < 10; attempt++) {
        expect(
          (await fetch(`${baseUrl}/api/trpc/system.ping,auth.login`)).status
        ).toBe(204);
      }
      expect(
        (await fetch(`${baseUrl}/api/trpc/system.ping,auth.login`)).status
      ).toBe(429);

      for (let attempt = 0; attempt < 5; attempt++) {
        expect((await fetch(`${baseUrl}/api/trpc/auth.register`)).status).toBe(
          204
        );
      }
      expect((await fetch(`${baseUrl}/api/trpc/auth.register`)).status).toBe(
        429
      );
    } finally {
      await closeHttpServer(server);
      await limiters.close();
    }
  });
});
