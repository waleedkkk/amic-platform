import { evaluateCorrelationContext, selectCorrelationAssets, type CorrelationContext, type CorrelationObservedAsset } from "../shared/correlationContext";
import { callTradingViewTool } from "./mcpClient";
import { normalizeTechnicalAnalysis } from "./technicalAnalysis";

type CorrelationRequest = { symbol: string; exchange: string };

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 240) : "سبب غير متاح";
}

async function loadObservedAsset(asset: ReturnType<typeof selectCorrelationAssets>["assets"][number]): Promise<CorrelationObservedAsset> {
  const fetchedAt = new Date().toISOString();
  const raw = await callTradingViewTool("coin_analysis", { symbol: asset.symbol, exchange: asset.exchange, timeframe: "1D" });
  const analysis = normalizeTechnicalAnalysis(raw, { symbol: asset.symbol, exchange: asset.exchange, timeframe: "1D" }, fetchedAt);
  const price = analysis.price.current ?? analysis.price.close;
  if (price === null || analysis.price.changePercent === null) throw new Error("لم يُرجع المزود قيمة وسعر تغير صالحين للأصل المرتبط.");
  return {
    ...asset,
    price,
    changePercent: analysis.price.changePercent,
    fetchedAt: analysis.fetchedAt,
    sourceTimestamp: analysis.sourceTimestamp,
    provider: "tradingview-mcp",
  };
}

/**
 * يفشل كل أصل مرتبط بصورة مستقلة: يسجل السبب تشخيصيًا ويُستبعد من السياق،
 * ولا يسمح لتعذر السياق بإيقاف نتيجة التحليل الأساسي.
 */
export async function fetchCorrelationContext(input: CorrelationRequest, primaryChangePercent: number | null): Promise<CorrelationContext> {
  const selection = selectCorrelationAssets(input);
  const settled = await Promise.allSettled(selection.assets.map(asset => loadObservedAsset(asset)));
  const observedAssets = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    const asset = selection.assets[index];
    console.warn("[CorrelationContext] Skipped related asset", { id: asset?.id, symbol: asset?.symbol, reason: safeErrorMessage(result.reason) });
    return [];
  });
  return evaluateCorrelationContext({ instrument: input, primaryChangePercent, observedAssets });
}
