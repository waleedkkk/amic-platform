import { describe, expect, it } from "vitest";
import { selectMostRecentOverlays } from "./chartOverlaySelection";

describe("اختيار طبقات الشارت", () => {
  it("يحافظ على أحدث الطبقات عند إضافة تاريخ أقدم أثناء السحب للخلف", () => {
    const current = [
      { id: "recent", createdAt: 300 },
      { id: "latest", createdAt: 400 },
    ];
    const afterLoadingOlder = [
      { id: "oldest", createdAt: 10 },
      { id: "older", createdAt: 50 },
      ...current,
    ];

    expect(selectMostRecentOverlays(current, 2).map(item => item.id)).toEqual(["latest", "recent"]);
    expect(selectMostRecentOverlays(afterLoadingOlder, 2).map(item => item.id)).toEqual(["latest", "recent"]);
  });
});
