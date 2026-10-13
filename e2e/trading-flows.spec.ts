import { expect, test, type Page } from "@playwright/test";
import superjson from "superjson";

type Trade = {
  id: number;
  userId: number;
  signalId: number | null;
  symbol: string;
  exchange: string;
  assetClass: "crypto" | "stock" | "forex" | "futures";
  side: "long" | "short";
  quantity: string;
  entryPrice: string;
  stopLoss: string | null;
  takeProfit: string | null;
  status: "open" | "closed";
  closePrice: string | null;
  realizedPnl: string | null;
  note: string | null;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
};

const openTrade: Trade = {
  id: 41,
  userId: 7,
  signalId: null,
  symbol: "BTCUSDT",
  exchange: "BINANCE",
  assetClass: "crypto",
  side: "long",
  quantity: "0.1",
  entryPrice: "60000",
  stopLoss: "58000",
  takeProfit: "65000",
  status: "open",
  closePrice: null,
  realizedPnl: null,
  note: "اختبار E2E",
  openedAt: new Date("2026-10-01T10:00:00.000Z"),
  closedAt: null,
  createdAt: new Date("2026-10-01T10:00:00.000Z"),
};

const closedTrade: Trade = {
  ...openTrade,
  id: 42,
  symbol: "ETHUSDT",
  status: "closed",
  closePrice: "3200",
  realizedPnl: "25.00000000",
  closedAt: new Date("2026-10-02T10:00:00.000Z"),
};

const critique = {
  planAdherence: ["التزم بالخطة المحددة."],
  timing: ["راجع توقيت الدخول والخروج."],
  didWell: ["وثّقت الصفقة."],
  improve: ["سجّل سبب القرار."],
  nextSteps: ["راجع النتائج بعد عينة أكبر."],
  disclaimer: "مراجعة تعليمية وليست نصيحة استثمارية.",
};

function success(data: unknown) {
  return { result: { data: superjson.serialize(data) } };
}

function failure(path: string) {
  return {
    error: {
      json: {
        message: "فشل اختباري متعمد في واجهة API.",
        code: -32603,
        data: {
          code: "INTERNAL_SERVER_ERROR",
          httpStatus: 500,
          path,
        },
      },
    },
  };
}

async function mockTradingApi(
  page: Page,
  options: {
    trades?: Trade[];
    failListAttempts?: number;
    delayListMs?: number;
  } = {}
) {
  const trades = options.trades ?? [openTrade, closedTrade];
  const failListAttempts = options.failListAttempts ?? 0;
  let listAttempts = 0;

  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/trpc/")) {
      await route.continue();
      return;
    }
    const requestPath = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const procedures = requestPath.split(",");
    const hasTradeList = procedures.includes("paperTrading.list");

    if (hasTradeList) {
      listAttempts += 1;
      if (options.delayListMs) {
        await new Promise(resolve => setTimeout(resolve, options.delayListMs));
      }
    }

    const response = procedures.map(procedure => {
      if (procedure === "auth.me") {
        return success({
          id: 7,
          name: "اختبار AMIC",
          email: "e2e@example.test",
          role: "user",
        });
      }
      if (procedure === "paperTrading.list") {
        return listAttempts <= failListAttempts
          ? failure(procedure)
          : success(trades);
      }
      if (procedure === "paperTrading.summary") {
        return success({
          totalTrades: trades.length,
          openTrades: trades.filter(trade => trade.status === "open").length,
          closedTrades: trades.filter(trade => trade.status === "closed")
            .length,
          wins: 1,
          losses: 0,
          winRate: 100,
          realizedPnl: "25.00000000",
        });
      }
      if (procedure === "paperTrading.referencePrices") return success([]);
      if (procedure === "paperTrading.signalPerformance") {
        return success({
          measuredSignals: 0,
          trackedSignals: 0,
          winRate: null,
          successfulSignals: 0,
          unfavorableSignals: 0,
          pendingSignals: 0,
        });
      }
      if (procedure === "paperTrading.critique.generate") {
        return success({ id: 42, content: critique });
      }
      return success(null);
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

test.describe("التداول الورقي ومراجعة الصفقات", () => {
  test("يعرض التحميل ثم بيانات المراكز والسجل بعد اكتمال الجلب", async ({
    page,
  }) => {
    await mockTradingApi(page, { delayListMs: 400 });
    await page.goto("/paper-trading", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "التداول الورقي" })
    ).toBeVisible();
    await expect(page.getByText("جارٍ تحميل المراكز…")).toBeVisible();
    await expect(
      page.getByText("BTCUSDT · BINANCE", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("ETHUSDT", { exact: true }).last()
    ).toBeVisible();
    await expect(page.getByText("جارٍ تحميل سجل الصفقات…")).toHaveCount(0);
  });

  test("لا يعرض القوائم الفارغة عند الفشل، ويستعيدها بعد إعادة المحاولة", async ({
    page,
  }) => {
    // التطبيق يعيد الاستعلام تلقائيًا مرة واحدة؛ نفشل المحاولتين كي نختبر زر المستخدم.
    await mockTradingApi(page, { failListAttempts: 2 });
    await page.goto("/paper-trading", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("تعذر تحميل بيانات الصفقات.")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText("لا توجد مراكز مفتوحة", { exact: false })
    ).toHaveCount(0);
    await expect(page.getByText("لا توجد صفقات مغلقة بعد.")).toHaveCount(0);

    await page.getByRole("button", { name: "إعادة المحاولة" }).click();
    await expect(
      page.getByText("BTCUSDT · BINANCE", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("ETHUSDT", { exact: true }).last()
    ).toBeVisible();
  });

  test("يعرض حالة الفراغ فقط بعد نجاح الاستعلام بلا صفقات", async ({
    page,
  }) => {
    await mockTradingApi(page, { trades: [] });
    await page.goto("/paper-trading", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByText("لا توجد مراكز مفتوحة", { exact: false })
    ).toBeVisible();
    await expect(page.getByText("لا توجد صفقات مغلقة بعد.")).toBeVisible();
    await expect(page.getByText("تعذر تحميل بيانات الصفقات.")).toHaveCount(0);
  });

  test("يعيد تحميل الصفقات المغلقة ثم ينشئ مراجعة تعليمية", async ({
    page,
  }) => {
    await mockTradingApi(page, { failListAttempts: 2, trades: [closedTrade] });
    await page.goto("/trade-review", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByText("تعذر تحميل قائمة الصفقات المغلقة.")
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("أغلق صفقة ورقية أولًا لتتوفر مراجعة اختيارية.")
    ).toHaveCount(0);

    await page.getByRole("button", { name: "إعادة المحاولة" }).click();
    await expect(page.getByRole("combobox")).toHaveValue("42");
    await page.getByRole("button", { name: "إنشاء نقد تعليمي" }).click();

    await expect(
      page.getByRole("heading", { name: "الالتزام بالخطة" })
    ).toBeVisible();
    await expect(page.getByText("التزم بالخطة المحددة.")).toBeVisible();
    await expect(
      page.getByText("مراجعة تعليمية وليست نصيحة استثمارية.")
    ).toBeVisible();
  });

  test("يعرض رسالة عدم وجود صفقة مغلقة بعد نجاح جلب قائمة فارغة", async ({
    page,
  }) => {
    await mockTradingApi(page, { trades: [] });
    await page.goto("/trade-review", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByText("أغلق صفقة ورقية أولًا لتتوفر مراجعة اختيارية.")
    ).toBeVisible();
    await expect(
      page.getByText("تعذر تحميل قائمة الصفقات المغلقة.")
    ).toHaveCount(0);
  });
});
