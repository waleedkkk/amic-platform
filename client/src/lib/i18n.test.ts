import { describe, expect, it } from "vitest";
import { getStoredLanguage, translate } from "./i18n";

describe("أساس i18n", () => {
  it("يعيد العربية افتراضيًا ويقرأ الإنجليزية عند اختيارها", () => { expect(getStoredLanguage(null)).toBe("ar"); expect(getStoredLanguage("en")).toBe("en"); });
  it("يترجم عناصر التنقل المشتركة دون تغيير مفاتيح المسارات", () => { expect(translate("ar", "calendar")).toBe("التقويم الاقتصادي"); expect(translate("en", "calendar")).toBe("Economic Calendar"); });
});
