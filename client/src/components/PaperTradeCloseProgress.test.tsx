import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PaperTradeCloseProgress } from "./PaperTradeCloseProgress";

afterEach(() => cleanup());

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

describe("PaperTradeCloseProgress", () => {
  it("يعرض مرحلة التحقق المرجعي ويحدد التقدم الأولي", () => {
    render(<PaperTradeCloseProgress stage="checking" />);

    expect(screen.getByLabelText("تقدم إغلاق الصفقة الورقية")).toBeTruthy();
    expect(screen.getAllByText("فحص السعر المرجعي").length).toBeGreaterThan(0);
    expect(screen.getByText("34%")).toBeTruthy();
    expect(screen.getByRole("button", { name: "شرح مرحلة فحص السعر المرجعي" }).getAttribute("aria-current")).toBe("step");
    expect(screen.getAllByRole("button", { name: /شرح مرحلة/ })).toHaveLength(3);
  });

  it("يعرض مرحلة التأكيد ثم مرحلة تسجيل الإغلاق", () => {
    const { rerender } = render(<PaperTradeCloseProgress stage="awaiting_confirmation" />);

    expect(screen.getAllByText("مراجعة التأكيد").length).toBeGreaterThan(0);
    expect(screen.getByText("67%")).toBeTruthy();

    rerender(<PaperTradeCloseProgress stage="closing" />);
    expect(screen.getAllByText("تسجيل الإغلاق").length).toBeGreaterThan(0);
    expect(screen.getByText("92%")).toBeTruthy();
  });

  it("يفتح تلميحًا يشرح المرحلة الحالية عند التركيز على زرها", () => {
    render(<PaperTradeCloseProgress stage="awaiting_confirmation" />);

    const trigger = screen.getByRole("button", { name: "شرح مرحلة مراجعة التأكيد" });
    fireEvent.focus(trigger);

    expect(trigger.getAttribute("data-state")).toContain("open");
    expect(trigger.getAttribute("aria-describedby")).toBeTruthy();
  });
});
