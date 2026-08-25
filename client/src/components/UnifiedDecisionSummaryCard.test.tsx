import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnifiedDecisionSummaryCard } from "@/components/UnifiedDecisionSummaryCard";
import type { UnifiedDecisionSummary } from "@shared/unifiedDecision";

const summary: UnifiedDecisionSummary = {
  version: "v1",
  state: "conflicted",
  direction: "neutral",
  evidenceScore: 42,
  coveragePercent: 70,
  blockedBy: ["core_ict_conflict"],
  pillars: [
    { id: "core", available: true, direction: "bullish", contribution: 20, weight: 35, freshness: "fresh", summary: "القراءة الأساسية صاعدة.", reasons: ["الإشارة الأساسية: buy."] },
    { id: "ict", available: true, direction: "bearish", contribution: -18, weight: 35, freshness: "fresh", summary: "Confluence ICT هابط.", reasons: ["إشارة ICT: SELL."] },
    { id: "timeframes", available: false, direction: "neutral", contribution: 0, weight: 20, freshness: "unknown", summary: "توافق الأطر غير محمل.", reasons: [] },
    { id: "correlation", available: false, direction: "neutral", contribution: 0, weight: 10, freshness: "unknown", summary: "السياق المترابط غير متاح.", reasons: [] },
  ],
  summary: "توجد عوامل متعارضة.",
  educationalDisclaimer: "هذا ملخص تعليمي.",
  computedAt: Date.parse("2026-08-25T12:00:00.000Z"),
};

describe("UnifiedDecisionSummaryCard", () => {
  it("يعرض الحالة ودرجتي الاتفاق والتغطية ويكشف سبب التعارض", () => {
    render(<UnifiedDecisionSummaryCard summary={summary} />);

    expect(screen.getByRole("region", { name: "ملخص الأدلة" })).toBeTruthy();
    expect(screen.getByText("عوامل متعارضة")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "جودة اتفاق الأدلة" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "درجة تغطية الأدلة" })).toBeTruthy();
    expect(screen.getByText("التوصية الأساسية وICT متعارضان.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "عرض أسباب التقييم" }));

    expect(screen.getByText("Confluence ICT")).toBeTruthy();
    expect(screen.getByRole("button", { name: "إخفاء أسباب التقييم" })).toBeTruthy();
  });

  it("يعرض حالة الخطأ بدل بطاقة فارغة عند فشل الملخص", () => {
    render(<UnifiedDecisionSummaryCard error="تعذر تحميل المصدر" />);

    expect(screen.getByRole("status", { name: "ملخص الأدلة" })).toBeTruthy();
    expect(screen.getByText("تعذر تحميل المصدر")).toBeTruthy();
  });
});
