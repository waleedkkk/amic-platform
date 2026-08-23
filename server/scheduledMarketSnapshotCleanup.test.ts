import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  cleanupExpiredMarketSnapshots: vi.fn(),
  getMarketSnapshotCleanupMonitorTaskUid: vi.fn(),
}));

vi.mock("./db", () => ({
  cleanupExpiredMarketSnapshots: mocks.cleanupExpiredMarketSnapshots,
  getMarketSnapshotCleanupMonitorTaskUid: mocks.getMarketSnapshotCleanupMonitorTaskUid,
}));

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: mocks.authenticateRequest },
  CronAuthenticationError: class CronAuthenticationError extends Error {},
}));

import { handleMarketSnapshotCleanupSchedule } from "./scheduledMarketSnapshotCleanup";

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe("معالج Heartbeat لتنظيف لقطات السوق", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMarketSnapshotCleanupMonitorTaskUid.mockResolvedValue("registered-cleanup-task");
  });

  it("يعيد orphan ولا ينفذ الحذف عندما لا يطابق taskUid المهمة المسجلة", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "unregistered-cleanup-task" });
    const res = createResponse();

    await handleMarketSnapshotCleanupSchedule({ path: "/api/scheduled/market-snapshot-cleanup" } as never, res as never);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, skipped: "orphan" });
    expect(mocks.cleanupExpiredMarketSnapshots).not.toHaveBeenCalled();
  });

  it("ينفذ الحذف فقط للمهمة المسجلة", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "registered-cleanup-task" });
    mocks.cleanupExpiredMarketSnapshots.mockResolvedValue(3);
    const res = createResponse();

    await handleMarketSnapshotCleanupSchedule({ path: "/api/scheduled/market-snapshot-cleanup" } as never, res as never);

    expect(mocks.cleanupExpiredMarketSnapshots).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ ok: true, taskUid: "registered-cleanup-task", deleted: 3 });
  });
});
