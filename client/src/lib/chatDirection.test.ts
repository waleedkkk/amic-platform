import { describe, expect, it } from "vitest";
import { getAssistantBubbleAlignment, getChatDirection, getChatMarkdownDirection, getChatTextAlignment } from "./chatDirection";

describe("اتجاه واجهة المحادثة", () => {
  it("يستخدم RTL ومحاذاة اليمين للغة العربية", () => {
    expect(getChatDirection("ar")).toBe("rtl");
    expect(getChatTextAlignment("ar")).toBe("text-right");
    expect(getAssistantBubbleAlignment("ar")).toBe("justify-end");
    expect(getChatMarkdownDirection("ar")).toEqual({ direction: "rtl", alignment: "text-right", className: "assistant-markdown-rtl" });
  });

  it("يستخدم LTR ومحاذاة اليسار للغة الإنجليزية", () => {
    expect(getChatDirection("en")).toBe("ltr");
    expect(getChatTextAlignment("en")).toBe("text-left");
    expect(getAssistantBubbleAlignment("en")).toBe("justify-start");
    expect(getChatMarkdownDirection("en")).toEqual({ direction: "ltr", alignment: "text-left", className: "assistant-markdown-ltr" });
  });
});
