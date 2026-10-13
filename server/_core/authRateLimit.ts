import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { createClient } from "redis";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 10;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_LIMIT = 5;

export async function createAuthRateLimiters() {
  const redisUrl = process.env.REDIS_URL?.trim();
  const production = process.env.NODE_ENV === "production";

  if (production && !redisUrl) {
    throw new Error(
      "REDIS_URL is required in production for shared authentication rate limiting."
    );
  }

  let redisClient: ReturnType<typeof createClient> | undefined;
  let loginStore: RedisStore | undefined;
  let registerStore: RedisStore | undefined;

  if (redisUrl) {
    redisClient = createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        reconnectStrategy: retries => Math.min(retries * 100, 3_000),
      },
    });
    redisClient.on("error", error => {
      console.error("[RateLimit Redis] connection error:", error.message);
    });
    await redisClient.connect();

    const sendCommand = async (...args: string[]): Promise<RedisReply> =>
      (await redisClient!.sendCommand(args)) as unknown as RedisReply;
    loginStore = new RedisStore({
      prefix: "amic:rate-limit:login:",
      sendCommand,
    });
    registerStore = new RedisStore({
      prefix: "amic:rate-limit:register:",
      sendCommand,
    });
  }

  const loginLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_LIMIT,
    ...(loginStore ? { store: loginStore } : {}),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: false,
    message: { error: "محاولات تسجيل دخول كثيرة. حاول مجددًا بعد قليل." },
    // Keep the default IPv6-aware IP key generator from express-rate-limit.
    // Store failures are fail-closed by default; do not allow unmetered login.
  });

  const registerLimiter = rateLimit({
    windowMs: REGISTER_WINDOW_MS,
    limit: REGISTER_LIMIT,
    ...(registerStore ? { store: registerStore } : {}),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: false,
    message: { error: "تم تجاوز حد إنشاء الحسابات لهذا الاتصال. حاول لاحقًا." },
  });

  return {
    loginLimiter,
    registerLimiter,
    async close() {
      if (redisClient?.isOpen) await redisClient.quit();
    },
  };
}

type AuthRateLimiters = Awaited<ReturnType<typeof createAuthRateLimiters>>;

/** Apply the matching limiter(s) even when tRPC combines procedures into one HTTP request. */
export function createTrpcAuthRateLimitMiddleware(
  limiters: Pick<AuthRateLimiters, "loginLimiter" | "registerLimiter">
): RequestHandler {
  return (req, res, next) => {
    const pathname = req.originalUrl.split("?", 1)[0] ?? "";
    const procedurePaths = pathname.replace(/^\/api\/trpc\//, "").split(",");
    const selected: RequestHandler[] = [];

    if (procedurePaths.includes("auth.login"))
      selected.push(limiters.loginLimiter);
    if (procedurePaths.includes("auth.register"))
      selected.push(limiters.registerLimiter);

    const runNext = (index: number) => {
      const limiter = selected[index];
      if (!limiter) return next();
      limiter(req, res, error => (error ? next(error) : runNext(index + 1)));
    };

    runNext(0);
  };
}
