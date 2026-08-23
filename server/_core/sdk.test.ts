import { describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { SDKServer } from "./sdk";

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
