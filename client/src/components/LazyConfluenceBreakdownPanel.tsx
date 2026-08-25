import { useState } from "react";
import { ConfluenceBreakdownPanel } from "@/components/ConfluenceBreakdownPanel";
import { Panel } from "@/components/market-ui";
import { useNearViewport } from "@/hooks/useNearViewport";

type BreakdownInterval = "15m" | "60m" | "4h" | "1d" | "1wk";

type LazyConfluenceBreakdownPanelProps = {
  symbol: string;
  exchange: string;
  interval?: BreakdownInterval;
};

export function LazyConfluenceBreakdownPanel({ symbol, exchange, interval = "60m" }: LazyConfluenceBreakdownPanelProps) {
  const { elementRef, nearViewport } = useNearViewport<HTMLDivElement>();
  const [loadRequested, setLoadRequested] = useState(false);
  const shouldLoad = nearViewport || loadRequested;

  return (
    <div ref={elementRef} className="min-w-0 max-w-full">
      {shouldLoad ? (
        <ConfluenceBreakdownPanel symbol={symbol} exchange={exchange} interval={interval} enabled />
      ) : (
        <Panel className="mt-6 min-h-32 border-white/[0.08] bg-white/[0.02]" aria-label="تفكيك درجة التلاقي مؤجل التحميل">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.13em] text-primary">WHY THIS SIGNAL?</p>
              <h2 className="mt-2 text-lg font-semibold">تفكيك درجة التلاقي</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">سيُحمّل التفصيل عند الاقتراب من هذه المنطقة.</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-xs text-foreground transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setLoadRequested(true)}
            >
              تحميل الآن
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
