import { describe, expect, it } from "vitest";
import { getQueryViewState } from "./queryViewState";

describe("getQueryViewState", () => {
  it("يعرض التحميل قبل وصول أي بيانات", () => {
    expect(
      getQueryViewState({
        isLoading: true,
        isError: false,
        hasData: false,
        hasItems: false,
      })
    ).toBe("loading");
  });

  it("يفصل فشل الطلب عن القائمة الفارغة", () => {
    expect(
      getQueryViewState({
        isLoading: false,
        isError: true,
        hasData: false,
        hasItems: false,
      })
    ).toBe("error");
  });

  it("يحافظ على البيانات السابقة ويصنف فشل التحديث كبيانات قديمة", () => {
    expect(
      getQueryViewState({
        isLoading: false,
        isError: true,
        hasData: true,
        hasItems: true,
      })
    ).toBe("stale");
  });

  it("يعرض الفراغ فقط بعد نجاح الطلب بلا عناصر", () => {
    expect(
      getQueryViewState({
        isLoading: false,
        isError: false,
        hasData: true,
        hasItems: false,
      })
    ).toBe("empty");
  });

  it("يعرض البيانات عند نجاح الطلب ووجود عناصر", () => {
    expect(
      getQueryViewState({
        isLoading: false,
        isError: false,
        hasData: true,
        hasItems: true,
      })
    ).toBe("data");
  });
});
