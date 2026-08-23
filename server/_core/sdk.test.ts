import { describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { createCronAuthDiagnostics, getTaskUidFromCronOpenId, SDKServer } from "./sdk";

describe("SDKServer cron identity lookup", () => {
  it("uses the verified session appId when resolving a cron identity", async () => {
    const post = vi.fn().mockResolvedValue({
      data: { openId: "cron_task", name: "Heartbeat", taskUid: "task-123" },
    });
    const sdk = new SDKServer({ post } as unknown as AxiosInstance);

    await sdk.getUserInfoWithJwt("signed-cron-cookie", "verified-project-app-id");

    expect(post).toHaveBeenCalledWith(
      "/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt",
      { jwtToken: "signed-cron-cookie", projectId: "verified-project-app-id" },
    );
  });
});

describe("getTaskUidFromCronOpenId", () => {
  it("يقبل فقط taskUid مضمّنًا في هوية cron بالشكل الموقّع المتوقع", () => {
    expect(getTaskUidFromCronOpenId("cron_j7SXze4Z2TzvdbAsqtFyjH")).toBe("j7SXze4Z2TzvdbAsqtFyjH");
    expect(getTaskUidFromCronOpenId("cron_short")).toBeNull();
    expect(getTaskUidFromCronOpenId("user_j7SXze4Z2TzvdbAsqtFyjH")).toBeNull();
  });
});

describe("createCronAuthDiagnostics", () => {
  it("لا يعيد المعرفات الخام أو الكوكي ضمن الدليل التشخيصي", () => {
    const diagnostics = createCronAuthDiagnostics({
      openId: "cron_j7SXze4Z2TzvdbAsqtFyjH",
      appId: "app-id",
      name: "Heartbeat",
    });

    expect(diagnostics).toEqual({
      stage: "identity_lookup",
      sessionAppIdMatchesEnvironment: false,
      taskUidEmbeddedInSignedIdentity: true,
      taskUidLength: 22,
    });
    expect(JSON.stringify(diagnostics)).not.toContain("j7SXze4Z2TzvdbAsqtFyjH");
  });
});
