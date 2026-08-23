import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { Bot, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Critique = { planAdherence: string[]; timing: string[]; didWell: string[]; improve: string[]; nextSteps: string[]; disclaimer: string };
const sections: Array<[keyof Omit<Critique, "disclaimer">, string]> = [["planAdherence", "الالتزام بالخطة"], ["timing", "توقيت الدخول والخروج"], ["didWell", "ما تم بصورة جيدة"], ["improve", "ما يمكن تحسينه"], ["nextSteps", "خطوات عملية تالية"]];

export default function TradeReview() {
  const trades = trpc.paperTrading.list.useQuery();
  const [tradeId, setTradeId] = useState<number | null>(null);
  const [critique, setCritique] = useState<Critique | null>(null);
  const closed = trades.data?.filter(trade => trade.status === "closed") ?? [];
  useEffect(() => { if (closed.length && !tradeId) setTradeId(closed[0].id); }, [closed, tradeId]);
  const generate = trpc.paperTrading.critique.generate.useMutation({ onSuccess: result => { setCritique(result.content as Critique); toast.success("أُعد النقد التعليمي الخاص بالصفقة."); }, onError: error => toast.error(error.message) });
  return <><PageHeading eyebrow="PRIVATE TRADE REVIEW" title="نقد الصفقات الورقية" description="مراجعة اختيارية للالتزام بالخطة والتوقيت ونتيجة الصفقة. لا تشارك أي معلومات خارج حسابك، ولا تتضمن حكمًا على شخصك أو مشاعرك." />
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]"><Panel><Bot className="size-5 text-primary" /><h2 className="mt-3 text-lg font-semibold">اختر صفقة مغلقة</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">يُرسل إلى النموذج فقط سجل الصفقة، والإشارة الأصلية المطابقة إن وجدت، وليس أي معلومات شخصية أو سجل محادثة.</p>{closed.length ? <><select className="mt-5 h-10 w-full rounded-md border border-input bg-white/[0.025] px-3 text-sm" value={tradeId ?? ""} onChange={event => { setTradeId(Number(event.target.value)); setCritique(null); }}>{closed.map(trade => <option className="bg-background" key={trade.id} value={trade.id}>{trade.symbol} · {trade.exchange} · #{trade.id}</option>)}</select><Button className="mt-3 w-full" disabled={!tradeId || generate.isPending} onClick={() => tradeId && generate.mutate({ tradeId })}><Sparkles className="ml-2 size-4" />{generate.isPending ? "جارٍ إعداد المراجعة…" : "إنشاء نقد تعليمي"}</Button></> : <p className="mt-5 text-sm text-muted-foreground">أغلق صفقة ورقية أولًا لتتوفر مراجعة اختيارية.</p>}</Panel><div className="space-y-4">{critique ? <><div className="grid gap-3 md:grid-cols-2">{sections.map(([key, title]) => <Panel key={key}><h3 className="text-sm font-semibold">{title}</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">{critique[key].map((item, index) => <li key={index} className="border-r border-primary/40 pr-3">{item}</li>)}</ul></Panel>)}</div><Panel><p className="text-xs text-muted-foreground">{critique.disclaimer}</p></Panel></> : <Panel><p className="text-sm text-muted-foreground">اختر صفقة مغلقة ثم اطلب النقد. ستظهر الملاحظات العملية هنا، وتبقى خاصة بحسابك.</p></Panel>}</div></div></>;
}
