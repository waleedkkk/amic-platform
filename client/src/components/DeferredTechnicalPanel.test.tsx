import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DeferredTechnicalPanel } from "@/components/DeferredTechnicalPanel";

const originalIntersectionObserver = window.IntersectionObserver;

afterEach(() => {
  Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: originalIntersectionObserver });
});

describe("DeferredTechnicalPanel", () => {
  it("يؤجل تركيب المحتوى حتى يطلب المستخدم تحميله", () => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });

    render(<DeferredTechnicalPanel title="سياق ثانوي" description="سيُحمّل لاحقًا."><p>محتوى استعلام ثقيل</p></DeferredTechnicalPanel>);

    expect(screen.getByText("سياق ثانوي")).toBeTruthy();
    expect(screen.queryByText("محتوى استعلام ثقيل")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "تحميل الآن" }));

    expect(screen.getByText("محتوى استعلام ثقيل")).toBeTruthy();
  });
});
