import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const dbMocks = vi.hoisted(() => ({
  listUserStructureContextAlerts: vi.fn(),
  createUserStructureContextAlert: vi.fn(),
  cancelUserStructureContextAlert: vi.fn(),
}));

vi.mock("../db", () => dbMocks);

import { structureContextAlertsRouter } from "./structureContextAlerts";

const context: TrpcContext = {
  user: { id: 42, openId: "context-user", name: "Context user", email: "context@example.com", loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
};

describe("structureContextAlertsRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يعرض تنبيهات الحساب الحالي فقط", async () => {
    dbMocks.listUserStructureContextAlerts.mockResolvedValue([]);
    await expect(structureContextAlertsRouter.createCaller(context).list()).resolves.toEqual([]);
    expect(dbMocks.listUserStructureContextAlerts).toHaveBeenCalledWith(42);
  });

  it("يطبع مدخلات مستوى السياق قبل حفظها تحت الحساب الحالي", async () => {
    dbMocks.createUserStructureContextAlert.mockResolvedValue({ id: 11 });
    await structureContextAlertsRouter.createCaller(context).create({ symbol: "xauusd", exchange: "fx", interval: "1h", sourceKind: "support", sourceLabel: "دعم متجمع", referencePrice: "4000", invalidationPrice: "3988", eventType: "approach", proximityBps: 15 });
    expect(dbMocks.createUserStructureContextAlert).toHaveBeenCalledWith(42, expect.objectContaining({ symbol: "XAUUSD", exchange: "FX", sourceKind: "support" }));
  });

  it("يلغي التنبيه بملكيته مع معرف المستخدم الحالي", async () => {
    dbMocks.cancelUserStructureContextAlert.mockResolvedValue({ success: true });
    await structureContextAlertsRouter.createCaller(context).cancel({ id: 11 });
    expect(dbMocks.cancelUserStructureContextAlert).toHaveBeenCalledWith(42, 11);
  });
});
