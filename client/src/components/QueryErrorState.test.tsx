import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryErrorState } from "@/components/market-ui";

describe("QueryErrorState", () => {
  it("يعرض الخطأ ويستدعي إعادة المحاولة عند النقر", () => {
    const onRetry = vi.fn();
    render(
      <QueryErrorState
        message="تعذر تحميل الصفقات."
        onRetry={onRetry}
        isRetrying={false}
      />
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "تعذر تحميل الصفقات."
    );
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("يعطل زر المحاولة أثناء إعادة الجلب", () => {
    render(
      <QueryErrorState
        message="تعذر تحديث الصفقات."
        onRetry={() => undefined}
        isRetrying
      />
    );

    expect(
      screen
        .getByRole("button", { name: "جارٍ إعادة المحاولة…" })
        .hasAttribute("disabled")
    ).toBe(true);
  });
});
