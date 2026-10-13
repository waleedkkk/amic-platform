import { expect, test, type Page } from "@playwright/test";
import superjson from "superjson";

function success(data: unknown) {
  return { result: { data: superjson.serialize(data) } };
}

async function mockTrpc(
  page: Page,
  resolve: (procedure: string) => unknown,
  requests: string[]
) {
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/trpc/")) {
      await route.continue();
      return;
    }

    const path = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const procedures = path.split(",");
    requests.push(...procedures);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        procedures.map(procedure => success(resolve(procedure)))
      ),
    });
  });
}

test.describe("التحميل المؤجل لوحدات المسارات", () => {
  test("لا يحمّل Markdown للمساعد قبل وصول أول رد", async ({ page }) => {
    const procedures: string[] = [];
    const markdownRequests: string[] = [];
    page.on("request", request => {
      if (request.url().includes("AssistantMarkdown"))
        markdownRequests.push(request.url());
    });

    await mockTrpc(
      page,
      procedure => {
        if (procedure === "auth.me") {
          return {
            id: 7,
            name: "اختبار AMIC",
            email: "e2e@example.test",
            role: "user",
          };
        }
        if (procedure === "ai.memory.get") return { enabled: false };
        if (procedure === "ai.explain") {
          return { content: "**رد تجريبي**", toolActivity: [] };
        }
        return null;
      },
      procedures
    );

    await page.goto("/assistant", { waitUntil: "domcontentloaded" });
    const prompt = page.getByPlaceholder(
      "اسأل عن RSI أو MACD أو توافق الاتجاه…"
    );
    await expect(prompt).toBeVisible();
    expect(markdownRequests).toHaveLength(0);

    const markdownRequest = page.waitForRequest(request =>
      request.url().includes("AssistantMarkdown")
    );
    await prompt.fill("اشرح مؤشر RSI");
    await prompt.press("Enter");
    await markdownRequest;
    await expect(page.getByText("رد تجريبي")).toBeVisible();
    expect(procedures).toContain("ai.explain");
  });

  test("يؤجل قائمة المستخدمين وإعدادات AI حتى فتح تبويبيهما", async ({
    page,
  }) => {
    const procedures: string[] = [];
    const providerModuleRequests: string[] = [];
    const chartRequests: string[] = [];
    page.on("request", request => {
      if (request.url().includes("AdminAiProviderSettings")) {
        providerModuleRequests.push(request.url());
      }
      if (
        request.url().includes("AdminCacheDistributionChart") ||
        request.url().toLowerCase().includes("recharts")
      ) {
        chartRequests.push(request.url());
      }
    });

    await mockTrpc(
      page,
      procedure => {
        if (procedure === "auth.me") {
          return {
            id: 1,
            name: "مسؤول الاختبار",
            email: "admin@example.test",
            role: "admin",
          };
        }
        if (procedure === "auth.admin.dashboard.overview") {
          return {
            users: { total: 12, activeLast7Days: 4, admins: 2 },
            paperTrading: { openTrades: 3 },
            marketCache: {
              cachedSnapshots: 8,
              freshSnapshots: 5,
              retainedSnapshots: 2,
              cleanupEligibleSnapshots: 1,
            },
            ai: { activeProvider: null, configuredProviders: 0 },
            cleanup: { registered: false },
            checkedAt: "2026-10-13T12:00:00.000Z",
          };
        }
        if (procedure === "auth.admin.listUsers") return [];
        return null;
      },
      procedures
    );

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "مركز الإدارة" })
    ).toBeVisible();
    await expect
      .poll(() => procedures.includes("auth.admin.dashboard.overview"))
      .toBe(true);
    await expect(
      page.getByRole("meter", { name: "المساعد الذكي" })
    ).toBeVisible();
    expect(procedures).not.toContain("auth.admin.listUsers");
    expect(providerModuleRequests).toHaveLength(0);
    expect(chartRequests).toHaveLength(0);

    await page.getByRole("tab", { name: "المستخدمون" }).click();
    await expect
      .poll(() => procedures.includes("auth.admin.listUsers"))
      .toBe(true);
    await expect(page.getByText("المستخدمون المسجّلون (0)")).toBeVisible();

    const providerModuleRequest = page.waitForRequest(request =>
      request.url().includes("AdminAiProviderSettings")
    );
    await page.getByRole("tab", { name: "الذكاء الاصطناعي" }).click();
    await providerModuleRequest;

    const cacheChartModuleRequest = page.waitForRequest(request =>
      request.url().includes("AdminCacheDistributionChart")
    );
    await page.getByRole("tab", { name: "صيانة السوق" }).click();
    await cacheChartModuleRequest;
  });
});
