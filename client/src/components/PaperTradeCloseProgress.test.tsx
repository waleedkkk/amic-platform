import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaperTradeCloseProgress } from "./PaperTradeCloseProgress";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

beforeEach(() => {
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

  it("يعرض نجاح الإغلاق عند الوصول إلى 100% ويجعل كل المراحل مكتملة", () => {
    render(<PaperTradeCloseProgress stage="completed" completionMessage="أُغلقت BTCUSDT بنجاح." onCompletionDismiss={() => undefined} />);

    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("نجاح: أُغلقت الصفقة الورقية")).toBeTruthy();
    expect(screen.getByText("أُغلقت BTCUSDT بنجاح.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "إخفاء رسالة نجاح الإغلاق" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /شرح مرحلة/ })).toHaveLength(3);
  });

  it("يفتح مشاركة النظام للنتيجة عندما تدعمها بيئة المستخدم", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    render(<PaperTradeCloseProgress stage="completed" completionMessage="أُغلقت BTCUSDT بنجاح. الربح/الخسارة المحققة: 12.5." />);

    fireEvent.click(screen.getByRole("button", { name: "مشاركة النتيجة" }));

    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: "نتيجة تداول ورقي من AMIC",
      text: expect.stringContaining("BTCUSDT"),
    })));
    expect(screen.getByText("فُتحت خيارات المشاركة.")).toBeTruthy();
  });

  it("ينسخ النتيجة للحافظة عندما لا تتوفر مشاركة النظام", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<PaperTradeCloseProgress stage="completed" completionMessage="أُغلقت ETHUSDT بنجاح. الربح/الخسارة المحققة: 4." />);

    fireEvent.click(screen.getByRole("button", { name: "مشاركة النتيجة" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("ETHUSDT")));
    expect(screen.getByText("نُسخت النتيجة للحافظة.")).toBeTruthy();
  });
});
