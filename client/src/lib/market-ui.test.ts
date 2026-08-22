import { describe, expect, it } from "vitest";
import { formatValue, signalLabel } from "../components/market-ui";

describe("عرض مؤشرات واجهة السوق المعيارية", () => {
  it("يعرض القيم القياسية وحالة الإشارة دون معرفة أسماء المزود الخام", () => {
    expect(formatValue(77_581.2615, 2)).toBe("77,581.26");
    expect(signalLabel("neutral").label).toBe("محايد");
  });
});
