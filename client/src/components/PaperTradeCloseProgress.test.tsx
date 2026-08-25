import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PaperTradeCloseProgress } from "./PaperTradeCloseProgress";

afterEach(() => cleanup());

describe("PaperTradeCloseProgress", () => {
  it("يعرض مرحلة التحقق المرجعي ويحدد التقدم الأولي", () => {
    render(<PaperTradeCloseProgress stage="checking" />);

    expect(screen.getByLabelText("تقدم إغلاق الصفقة الورقية")).toBeTruthy();
    expect(screen.getAllByText("فحص السعر المرجعي").length).toBeGreaterThan(0);
    expect(screen.getByText("34%")).toBeTruthy();
  });

  it("يعرض مرحلة التأكيد ثم مرحلة تسجيل الإغلاق", () => {
    const { rerender } = render(<PaperTradeCloseProgress stage="awaiting_confirmation" />);

    expect(screen.getAllByText("مراجعة التأكيد").length).toBeGreaterThan(0);
    expect(screen.getByText("67%")).toBeTruthy();

    rerender(<PaperTradeCloseProgress stage="closing" />);
    expect(screen.getAllByText("تسجيل الإغلاق").length).toBeGreaterThan(0);
    expect(screen.getByText("92%")).toBeTruthy();
  });
});
