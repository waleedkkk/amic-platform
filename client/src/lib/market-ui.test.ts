import { describe, expect, it } from "vitest";
import { BOLLINGER_VALUE_CANDIDATES, findValue } from "../components/market-ui";

describe("استخراج مؤشرات واجهة السوق", () => {
  it("يستخرج خط Bollinger الأوسط عند إعادة المزود للحقل bollinger_bands", () => {
    const response = {
      key_indicators: {
        bollinger_bands: {
          upper: 78_672.3262,
          middle: 77_581.2615,
          lower: 76_490.1968,
          width: 0.0281,
        },
      },
    };

    expect(findValue(response, BOLLINGER_VALUE_CANDIDATES)).toBe(77_581.2615);
  });
});
