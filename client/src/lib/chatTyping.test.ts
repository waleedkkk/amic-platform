import { describe, expect, it } from "vitest";
import { getTypingInterval, getTypingPreview, getTypingUnits } from "@/lib/chatTyping";

describe("تأثير الكتابة التدريجية", () => {
  it("يحافظ على الرمز التعبيري عند تقسيم النص إلى وحدات", () => {
    const units = getTypingUnits("📈 راجع الرابط");

    expect(units[0]).toBe("📈");
    expect(getTypingPreview("📈 راجع الرابط", 2)).toBe("📈 ");
  });

  it("يعرض معاينة جزئية ولا يغير النص الأصلي", () => {
    const content = "تحليل السوق الحالي";

    expect(getTypingPreview(content, 4)).toBe("تحلي");
    expect(getTypingPreview(content, 999)).toBe(content);
  });

  it("يستخدم سرعة أبطأ للنصوص القصيرة وأسرع للنصوص الطويلة", () => {
    expect(getTypingInterval("قصير")).toBeGreaterThan(getTypingInterval("x".repeat(801)));
  });
});
