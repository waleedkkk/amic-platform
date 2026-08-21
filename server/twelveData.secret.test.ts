import { describe, expect, it } from "vitest";
import { fetchTwelveDataCandleHistory } from "./candles";

describe("Twelve Data credential", () => {
  it("يصل إلى نقطة سلاسل زمنية خفيفة باستخدام المفتاح الخادمي", async () => {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    expect(apiKey, "TWELVE_DATA_API_KEY يجب أن يكون مضبوطًا").toBeTruthy();

    const history = await fetchTwelveDataCandleHistory("AAPL", "NASDAQ", "1d", "5d", apiKey);
    expect(history.provider).toBe("twelve-data");
    expect(history.candles.length).toBeGreaterThan(0);
    expect(history.candles.at(-1)?.close).toBeGreaterThan(0);
  }, 15_000);
});
