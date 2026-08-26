import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextHelp } from "@/components/ContextHelp";

describe("ContextHelp", () => {
  it("يكشف شرح المفهوم وإرشاد الإجراء عند النقر", () => {
    render(
      <ContextHelp term="الإطار الزمني" actionHint="ابدأ بإطار واحد ثم قارن النتائج عند الحاجة.">
        الفترة التي تُجمع فيها حركة السعر داخل كل شمعة.
      </ContextHelp>,
    );

    fireEvent.click(screen.getByRole("button", { name: "شرح الإطار الزمني" }));

    expect(screen.getByRole("dialog", { name: "شرح الإطار الزمني" })).toBeTruthy();
    expect(screen.getByText("الفترة التي تُجمع فيها حركة السعر داخل كل شمعة.")).toBeTruthy();
    expect(screen.getByText("ما الذي أفعله؟", { exact: false })).toBeTruthy();
  });
});
