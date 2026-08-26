import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIChatBox } from "@/components/AIChatBox";

const i18nState = vi.hoisted(() => ({ language: "ar" as "ar" | "en" }));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ language: i18nState.language }),
}));

vi.mock("streamdown", async () => {
  const ReactModule = await import("react");
  return {
    Streamdown: ({ children }: { children: string }) => {
      const content = String(children);
      const match = content.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      if (!match || match.index === undefined) return ReactModule.createElement("p", null, content);
      const [token, label, href] = match;
      return ReactModule.createElement("p", null,
        content.slice(0, match.index),
        ReactModule.createElement("a", { href }, label),
        content.slice(match.index + token.length),
      );
    },
  };
});

function renderChat(language: "ar" | "en", content: string) {
  i18nState.language = language;
  render(<AIChatBox messages={[{ role: "assistant", content }]} onSendMessage={() => undefined} />);
}

describe("اتجاه محتوى مساعد AMIC المختلط", () => {
  beforeEach(() => { i18nState.language = "ar"; });

  it("يبقي الرمز التعبيري والرابط داخل رد عربي بمحاذاة RTL", () => {
    renderChat("ar", "📈 راجع [مصدر الذهب](https://example.com/gold) قبل متابعة القراءة. السعر 4,625.292.");

    fireEvent.click(screen.getByRole("button", { name: "عرض الرد كاملًا" }));
    const link = screen.getByRole("link", { name: "مصدر الذهب" });
    const markdown = link.closest(".assistant-markdown");

    expect(markdown?.getAttribute("dir")).toBe("rtl");
    expect(markdown?.className).toContain("assistant-markdown-rtl");
    expect(markdown?.textContent).toContain("📈");
    expect(link.getAttribute("href")).toBe("https://example.com/gold");
  });

  it("يبقي الرابط داخل رد إنجليزي بمحاذاة LTR", () => {
    renderChat("en", "📈 Review the [gold source](https://example.com/gold) before continuing.");

    fireEvent.click(screen.getByRole("button", { name: "Show full reply" }));
    const link = screen.getByRole("link", { name: "gold source" });
    const markdown = link.closest(".assistant-markdown");

    expect(markdown?.getAttribute("dir")).toBe("ltr");
    expect(markdown?.className).toContain("assistant-markdown-ltr");
    expect(markdown?.textContent).toContain("📈");
    expect(link.getAttribute("href")).toBe("https://example.com/gold");
  });
});
