import { Button } from "@/components/ui/button";
import { Panel } from "@/components/market-ui";
import { useNearViewport } from "@/hooks/useNearViewport";
import React, { useState, type ReactNode } from "react";

type DeferredTechnicalPanelProps = {
  title: string;
  description: string;
  children: ReactNode;
};

/** يؤخر تركيب المكوّنات التحليلية الثانوية وما تطلقه من استعلامات حتى تظهر في مسار القراءة. */
export function DeferredTechnicalPanel({ title, description, children }: DeferredTechnicalPanelProps) {
  const { elementRef, nearViewport } = useNearViewport<HTMLDivElement>();
  const [loadRequested, setLoadRequested] = useState(false);
  const shouldLoad = nearViewport || loadRequested;

  return <div ref={elementRef} className="min-w-0 max-w-full">{shouldLoad ? children : <Panel className="mt-6 min-h-28 border-white/[0.08] bg-white/[0.02]"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div><Button type="button" variant="outline" size="sm" className="bg-white/[0.03]" onClick={() => setLoadRequested(true)}>تحميل الآن</Button></div></Panel>}</div>;
}
