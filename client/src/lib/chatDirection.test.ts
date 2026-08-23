import { describe, expect, it } from "vitest";
import { getAssistantBubbleAlignment, getChatDirection, getChatTextAlignment } from "./chatDirection";

describe("اتجاه واجهة المحادثة", () => {
  it("يستخدم RTL ومحاذاة اليمين للغة العربية", () => {
    expect(getChatDirection("ar")).toBe("rtl");
    expect(getChatTextAlignment("ar")).toBe("text-right");
    expect(getAssistantBubbleAlignment("ar")).toBe("justify-end");
  });

  it("يستخدم LTR ومحاذاة اليسار للغة الإنجليزية", () => {
    expect(getChatDirection("en")).toBe("ltr");
    expect(getChatTextAlignment("en")).toBe("text-left");
    expect(getAssistantBubbleAlignment("en")).toBe("justify-start");
  });
});
