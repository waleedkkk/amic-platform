import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getPaperTradingLeaderboardProfile: vi.fn(), listPaperTradingLeaderboard: vi.fn(), savePaperTradingLeaderboardProfile: vi.fn() }));
vi.mock("../db", () => dbMocks);
import { leaderboardRouter } from "./leaderboard";

const context = { user: { id: 17, role: "user" } } as never;

describe("leaderboardRouter", () => {
  beforeEach(() => vi.clearAllMocks());
  it("يرفض اسم عرض يشبه البريد قبل حفظ ملف المشاركة", async () => {
    await expect(leaderboardRouter.createCaller(context).profile.save({ enabled: true, displayName: "name@example.com", anonymized: false })).rejects.toThrow();
    expect(dbMocks.savePaperTradingLeaderboardProfile).not.toHaveBeenCalled();
  });
  it("يعيد صفوف الصدارة المجمعة فقط بلا معرّف مستخدم", async () => {
    dbMocks.listPaperTradingLeaderboard.mockResolvedValue([{ displayName: "متداول مجهول", totalTrades: 2, winRate: 50, totalReturnPercent: 1.2, realizedPnl: "5.0" }]);
    await expect(leaderboardRouter.createCaller(context).list()).resolves.toEqual([{ displayName: "متداول مجهول", totalTrades: 2, winRate: 50, totalReturnPercent: 1.2, realizedPnl: "5.0" }]);
  });
});
