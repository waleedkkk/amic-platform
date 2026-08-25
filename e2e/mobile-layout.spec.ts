import { test, expect } from "@playwright/test";

test.describe("استجابة AMIC على الهاتف", () => {
  test("لا تنشئ الواجهة تمريرًا أفقيًا", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("body")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));

    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);
  });

  test("بطاقة ملخص الأدلة تتكيف عند توفر جلسة اختبار مصادق عليها", async ({ page }) => {
    await page.goto("/analysis", { waitUntil: "domcontentloaded" });
    const summaryCard = page.getByRole("region", { name: "ملخص الأدلة" });

    // صفحة التحليل محمية؛ يظل الاختبار الأساسي أعلاه فعالًا دون أسرار.
    // عند تزويد CI بـ storageState مصادق عليه، نتحقق من البطاقة نفسها.
    if (await summaryCard.count() === 0) {
      test.skip(true, "يتطلب اختبار بطاقة التحليل storageState مصادقًا عليه.");
      return;
    }

    await expect(summaryCard).toBeVisible();
    const cardWidth = await summaryCard.evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(cardWidth.scrollWidth).toBeLessThanOrEqual(cardWidth.clientWidth);

    await page.getByRole("button", { name: "عرض أسباب التقييم" }).click();
    await expect(page.getByText("Confluence ICT")).toBeVisible();
  });
});
