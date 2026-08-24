export type CorrelationAssetClass = "metal" | "forex" | "crypto" | "stock";
export type CorrelationRelationship = "same" | "inverse" | "context_only";
export type CorrelationDirection = "up" | "down" | "flat" | "unavailable";
export type CorrelationItemStatus = "aligned" | "divergent" | "context_only" | "unavailable";
export type CorrelationAssessment = "strong" | "moderate" | "weak" | "conflicted" | "insufficient";

export type CorrelationAssetDefinition = {
  id: string;
  symbol: string;
  exchange: string;
  label: string;
  rationale: string;
  expectedRelationship: CorrelationRelationship;
};

export type CorrelationObservedAsset = CorrelationAssetDefinition & {
  price: number | null;
  changePercent: number | null;
  fetchedAt: string;
  sourceTimestamp: string | null;
  provider: "tradingview-mcp";
};

export type CorrelationContextItem = CorrelationObservedAsset & {
  direction: CorrelationDirection;
  status: CorrelationItemStatus;
};

export type CorrelationContext = {
  assetClass: CorrelationAssetClass;
  primaryChangePercent: number | null;
  items: CorrelationContextItem[];
  assessment: CorrelationAssessment;
  summary: string;
  fetchedAt: string;
  provider: "tradingview-mcp";
};

type Instrument = { symbol: string; exchange: string };

function normalized(value: string) {
  return value.trim().toUpperCase();
}

function isForexPair(symbol: string) {
  return /^[A-Z]{6}$/.test(normalized(symbol));
}

function asset(id: string, symbol: string, exchange: string, label: string, rationale: string, expectedRelationship: CorrelationRelationship): CorrelationAssetDefinition {
  return { id, symbol, exchange, label, rationale, expectedRelationship };
}

/** يصنف الأصل من خصائص السوق والرمز، وليس بقائمة حالة خاصة لكل رمز فردي. */
export function inferCorrelationAssetClass({ symbol, exchange }: Instrument): CorrelationAssetClass {
  const normalizedSymbol = normalized(symbol);
  const normalizedExchange = normalized(exchange);
  if (/^XA[UG]/.test(normalizedSymbol) || ["OZ", "COMEX", "NYMEX"].includes(normalizedExchange)) return "metal";
  if (normalizedExchange === "BINANCE" || normalizedSymbol.endsWith("USDT") || normalizedSymbol.endsWith("USDC")) return "crypto";
  if (["FX", "FOREX", "OANDA", "IDEALPRO"].includes(normalizedExchange) || isForexPair(normalizedSymbol)) return "forex";
  return "stock";
}

function fxRelationshipForUsdPair(symbol: string): CorrelationRelationship {
  const normalizedSymbol = normalized(symbol);
  if (!isForexPair(normalizedSymbol)) return "context_only";
  if (normalizedSymbol.startsWith("USD")) return "same";
  if (normalizedSymbol.endsWith("USD")) return "inverse";
  return "context_only";
}

function commodityFxRelationship(symbol: string, currency: "AUD" | "CAD"): CorrelationRelationship | null {
  const normalizedSymbol = normalized(symbol);
  if (!isForexPair(normalizedSymbol) || !normalizedSymbol.includes(currency)) return null;
  return normalizedSymbol.startsWith(currency) ? "same" : "inverse";
}

/**
 * يعيد أصولًا ذات علاقة اقتصادية أو هيكلية قابلة للتفسير فقط. الرمز الجديد يستفيد
 * من التصنيف العام للفئة، فلا يتطلب إضافة شرط منفصل لكل أصل.
 */
export function selectCorrelationAssets(instrument: Instrument): { assetClass: CorrelationAssetClass; assets: CorrelationAssetDefinition[] } {
  const assetClass = inferCorrelationAssetClass(instrument);
  const symbol = normalized(instrument.symbol);
  const exchange = normalized(instrument.exchange);

  if (assetClass === "metal") {
    const counterpart = symbol.startsWith("XAU")
      ? asset("silver", "XAGUSD", "FX", "الفضة", "المعدن النفيس المقابل لقياس اتساق حركة المجمع.", "same")
      : asset("gold", "XAUUSD", "FX", "الذهب", "المعدن النفيس المقابل لقياس اتساق حركة المجمع.", "same");
    return {
      assetClass,
      assets: [
        asset("dxy", "DXY", "TVC", "مؤشر الدولار", "الدولار غالبًا عامل تسعير معاكس للمعادن المسعّرة بالدولار.", "inverse"),
        asset("us10y", "US10Y", "TVC", "عائد سندات الخزانة 10 سنوات", "العائد الحقيقي والاسمي عنصر سياقي مهم للمعادن النفيسة.", "inverse"),
        counterpart,
        asset("gdx", "GDX", "NYSE", "ETF شركات تعدين الذهب", "أسهم التعدين تمثل استجابة سوق الأسهم لقوة أو ضعف قطاع المعادن.", "same"),
      ],
    };
  }

  if (assetClass === "forex") {
    const assets = [
      asset("dxy", "DXY", "TVC", "مؤشر الدولار", "يقيس سياق قوة الدولار مقابل سلة عملات رئيسية.", fxRelationshipForUsdPair(symbol)),
      asset("us10y", "US10Y", "TVC", "عائد سندات الخزانة 10 سنوات", "فروق العوائد مؤثر سياقي على الأزواج التي تتضمن الدولار.", fxRelationshipForUsdPair(symbol)),
    ];
    const audRelationship = commodityFxRelationship(symbol, "AUD");
    if (audRelationship) assets.push(asset("gold", "XAUUSD", "FX", "الذهب", "الذهب سلعة ذات صلة هيكلية بالدولار الأسترالي.", audRelationship));
    const cadRelationship = commodityFxRelationship(symbol, "CAD");
    if (cadRelationship) assets.push(asset("oil", "USOIL", "TVC", "النفط", "النفط سلعة ذات صلة هيكلية بالدولار الكندي.", cadRelationship));
    return { assetClass, assets };
  }

  if (assetClass === "crypto") {
    return {
      assetClass,
      assets: [
        asset("btc", "BTCUSDT", "BINANCE", "بيتكوين", "الأصل المرجعي لسيولة سوق الكربتو.", symbol === "BTCUSDT" ? "context_only" : "same"),
        asset("eth", "ETHUSDT", "BINANCE", "إيثيريوم", "عملة كبرى لقياس اتساق السيولة داخل قطاع الكربتو.", symbol === "ETHUSDT" ? "context_only" : "same"),
        asset("btc-dominance", "BTC.D", "CRYPTOCAP", "هيمنة بيتكوين", "مقياس تركّز السيولة داخل سوق الكربتو، ويُعرض كسياق لا كاتجاه مكافئ.", "context_only"),
        asset("qqq", "QQQ", "NASDAQ", "Nasdaq 100", "مؤشر أسهم تقني يقدّم سياقًا عامًا لشهية المخاطرة.", "same"),
      ],
    };
  }

  return {
    assetClass,
    assets: [
      exchange === "NASDAQ"
        ? asset("qqq", "QQQ", "NASDAQ", "Nasdaq 100", "مؤشر السوق التقني المرجعي للسهم المتداول في ناسداك.", "same")
        : asset("spy", "SPY", "NYSE", "S&P 500", "مؤشر السوق العام المرجعي للسهم المتداول في السوق الأمريكية.", "same"),
      asset("spy", "SPY", "NYSE", "S&P 500", "سياق السوق الأمريكي العام للسهم محل التحليل.", "same"),
    ].filter((candidate, index, all) => all.findIndex(item => item.id === candidate.id) === index),
  };
}

export function correlationDirection(changePercent: number | null): CorrelationDirection {
  if (changePercent === null || !Number.isFinite(changePercent)) return "unavailable";
  if (changePercent > 0) return "up";
  if (changePercent < 0) return "down";
  return "flat";
}

function classifyItem(primaryChangePercent: number | null, item: CorrelationObservedAsset): CorrelationItemStatus {
  if (item.expectedRelationship === "context_only") return "context_only";
  const primaryDirection = correlationDirection(primaryChangePercent);
  const relatedDirection = correlationDirection(item.changePercent);
  if ([primaryDirection, relatedDirection].includes("unavailable") || [primaryDirection, relatedDirection].includes("flat")) return "unavailable";
  const movesTogether = primaryDirection === relatedDirection;
  const aligned = item.expectedRelationship === "same" ? movesTogether : !movesTogether;
  return aligned ? "aligned" : "divergent";
}

function contextSummary(assessment: CorrelationAssessment, aligned: number, divergent: number, usable: number) {
  if (assessment === "strong") return `توافق قوي: ${aligned} من الأصول ذات العلاقة الاتجاهية تؤيد الحركة المتوقعة ولا تظهر أصول متعارضة في البيانات المتاحة.`;
  if (assessment === "moderate") return `توافق متوسط: تميل الأصول المرتبطة إلى العلاقة المتوقعة (${aligned} متوافق مقابل ${divergent} متعارض)، مع بقاء عوامل سوقية غير محسومة.`;
  if (assessment === "weak") return `توافق ضعيف: الأدلة السياقية محدودة أو مختلطة (${aligned} متوافق مقابل ${divergent} متعارض)، لذلك لا ينبغي التعامل معها كتأكيد مستقل.`;
  if (assessment === "conflicted") return `تعارض سياقي: تظهر أصول مرتبطة تتحرك بعكس العلاقة المتوقعة (${divergent} متعارض مقابل ${aligned} متوافق)، ما يستدعي الحذر التفسيري.`;
  return usable === 0
    ? "لم تتوفر بيانات آنية كافية للأصول المرتبطة، بينما يبقى التحليل الأساسي للرمز مستقلاً ومتواصلاً."
    : "السياق المتاح غير كافٍ لإسناد توافق أو تعارض ذي معنى.";
}

/** ينتج وصفًا نسبيًا من عدد العلاقات الاتجاهية المتوافقة والمتعارضة، لا درجة رقمية موهومة. */
export function evaluateCorrelationContext(input: {
  instrument: Instrument;
  primaryChangePercent: number | null;
  observedAssets: CorrelationObservedAsset[];
  fetchedAt?: string;
}): CorrelationContext {
  const assetClass = inferCorrelationAssetClass(input.instrument);
  const items = input.observedAssets.map(item => ({ ...item, direction: correlationDirection(item.changePercent), status: classifyItem(input.primaryChangePercent, item) }));
  const aligned = items.filter(item => item.status === "aligned").length;
  const divergent = items.filter(item => item.status === "divergent").length;
  const usable = aligned + divergent;
  const assessment: CorrelationAssessment = usable === 0
    ? "insufficient"
    : divergent > aligned
      ? "conflicted"
      : aligned >= 3 && divergent === 0
        ? "strong"
        : aligned > divergent
          ? "moderate"
          : "weak";

  return {
    assetClass,
    primaryChangePercent: Number.isFinite(input.primaryChangePercent) ? input.primaryChangePercent : null,
    items,
    assessment,
    summary: contextSummary(assessment, aligned, divergent, usable),
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    provider: "tradingview-mcp",
  };
}
