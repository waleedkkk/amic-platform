import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const databaseMocks = vi.hoisted(() => ({
  createUserSignal: vi.fn(),
  deleteUserSignal: vi.fn(),
  enablePublicSignalShare: vi.fn(),
  getPublicSignal: vi.fn(),
  listUserSignals: vi.fn(),
}));

vi.mock("../db", () => databaseMocks);

import { signalsRouter } from "./signals";

function createAuthenticatedContext(userId = 91): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: "اختبار AMIC",
      email: null,
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("signalsRouter", () => {
  it("يقبل ويحفظ غلاف عقد التحليل المعياري مع المستخدم الموثق", async () => {
    databaseMocks.createUserSignal.mockResolvedValue({ id: 12, publicShareId: null });
    const analysisPayload = {
      contractVersion: 1,
      technicalAnalysis: { schemaVersion: 1, symbol: "BTCUSDT", indicators: { bollinger: { middle: 77_000 } } },
      chartContext: { movingAverageCrossover: { kind: "golden" } },
    };
    const caller = signalsRouter.createCaller(createAuthenticatedContext(91));

    await caller.save({
      symbol: "btcusdt",
      exchange: "binance",
      timeframe: "1h",
      recommendation: "buy",
      confidence: 72,
      summary: "قراءة معيارية",
      analysisPayload,
    });

    expect(databaseMocks.createUserSignal).toHaveBeenCalledWith(91, expect.objectContaining({
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      analysisPayload,
    }), false);
  });

  it("ينشئ رابط المشاركة فقط بطلب صريح من مالك الإشارة", async () => {
    databaseMocks.enablePublicSignalShare.mockResolvedValue({ publicShareId: "91b57ed5-685b-4d02-8b8a-4a13de9ea649" });
    const caller = signalsRouter.createCaller(createAuthenticatedContext(91));
    await expect(caller.share({ id: 12 })).resolves.toEqual({ publicShareId: "91b57ed5-685b-4d02-8b8a-4a13de9ea649" });
    expect(databaseMocks.enablePublicSignalShare).toHaveBeenCalledWith(91, 12);
  });

  it("يعيد الرابط العام إسقاطًا آمنًا من دون userId أو بريد أو payload خاص", async () => {
    databaseMocks.getPublicSignal.mockResolvedValue({ symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h", recommendation: "buy", confidence: 72, summary: "قراءة عامة", createdAt: new Date("2026-08-23T00:00:00.000Z") });
    const caller = signalsRouter.createCaller({ ...createAuthenticatedContext(), user: null });
    const result = await caller.getPublicSignal({ shareId: "91b57ed5-685b-4d02-8b8a-4a13de9ea649" });
    expect(result).toMatchObject({ symbol: "BTCUSDT", recommendation: "buy" });
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("analysisPayload");
  });
});
