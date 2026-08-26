import { AIChatBox, Message } from "@/components/AIChatBox";
import { consumeMarketAssistantContext, MarketAssistantContext } from "@/lib/marketAssistantContext";
import { ContextHelp } from "@/components/ContextHelp";
import { PageHeading, Panel } from "@/components/market-ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Gem, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MARKET_SUMMARY_PROMPT = "لخّص لي نبضة السوق وفق الأسواق واتجاهات الرابحين/الخاسرين والرموز التي خصصتها في البيانات المرفقة، واذكر مصدر البيانات ووقت جلبها إن توفرا.";

export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const marketContextRef = useRef<MarketAssistantContext | undefined>(undefined);
  const memory = trpc.ai.memory.get.useQuery();
  const utils = trpc.useUtils();
  const setMemoryEnabled = trpc.ai.memory.setEnabled.useMutation({
    onSuccess: async ({ enabled }) => {
      await utils.ai.memory.get.invalidate();
      toast.success(enabled ? "تم تفعيل ذاكرة المساعد لهذه الحساب." : "تم إيقاف ذاكرة المساعد. بقي السجل محفوظًا حتى تمسحه.");
    },
    onError: error => toast.error(error.message),
  });
  const clearMemory = trpc.ai.memory.clear.useMutation({
    onSuccess: () => toast.success("تم مسح ذاكرة محادثاتك المحفوظة."),
    onError: error => toast.error(error.message),
  });
  const explain = trpc.ai.explain.useMutation({ onSuccess: response => setMessages(current => {
    const next = [...current, { role: "assistant" as const, content: response.content, toolActivity: response.toolActivity }];
    messagesRef.current = next;
    return next;
  }), onError: error => toast.error(error.message) });
  const requestExplanation = (next: Message[], marketContext = marketContextRef.current) => {
    explain.mutate({
      messages: next.map(({ role, content: item }) => ({ role: role === "assistant" ? "assistant" as const : "user" as const, content: item })),
      ...(marketContext ? { marketContext } : {}),
    });
  };
  const send = (content: string) => {
    const next = [...messagesRef.current, { role: "user" as const, content }];
    messagesRef.current = next;
    setMessages(next);
    requestExplanation(next);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    let marketContext: MarketAssistantContext | undefined;
    try {
      marketContext = consumeMarketAssistantContext(window.sessionStorage);
    } catch {
      return;
    }
    if (!marketContext) return;

    marketContextRef.current = marketContext;
    const next = [{ role: "user" as const, content: MARKET_SUMMARY_PROMPT }];
    messagesRef.current = next;
    setMessages(next);
    requestExplanation(next, marketContext);
  }, []);

  return <><PageHeading eyebrow="AMIC EXPLAINER" title="مساعد التحليل" description="اسأل عن أصل أو مفهوم، أو افتح المساعد من نبضة السوق لإرسال السياق الظاهر تلقائيًا. الإجابات تعليمية وليست توصيات شخصية." /><div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]"><Panel className="h-fit"><Sparkles className="size-6 text-primary" /><div className="mt-5 flex items-center gap-1"><h2 className="text-xl font-semibold">ابدأ بسؤال واضح</h2><ContextHelp term="مصدر البيانات ووقته"><p>عند استخدام بيانات حديثة، يعرض المساعد أسفل الإجابة اسم الأداة والمصدر ووقت الجلب المتاحين، حتى تميّز الشرح عن البيانات الفعلية.</p></ContextHelp></div><p className="mt-3 text-sm leading-7 text-muted-foreground">يمكنك السؤال عن مؤشر أو قراءة فنية أو تعارض إشارات. لا تحتاج إلى نسخ الأرقام من نبضة السوق؛ افتح المساعد منها لإرسال ما خصصته مرة واحدة.</p><div className="mt-6 rounded-xl border border-border bg-background/35 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-start gap-1"><div><h3 className="text-sm font-semibold">ذاكرة المحادثة</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">اختيارية ومعزولة لحسابك، ويمكنك مسحها في أي وقت.</p></div><ContextHelp term="ذاكرة المحادثة"><p>عند التفعيل، تحفظ آخر المحادثات داخل حسابك لمساعدة المساعد على متابعة السياق. إيقافها لا يمسح السجل تلقائيًا؛ استخدم زر المسح عند الحاجة.</p></ContextHelp></div><Switch checked={memory.data?.enabled ?? false} onCheckedChange={enabled => setMemoryEnabled.mutate({ enabled })} disabled={memory.isLoading || setMemoryEnabled.isPending} aria-label="تفعيل ذاكرة المحادثة" /></div><Button variant="outline" size="sm" className="mt-3 w-full justify-start text-muted-foreground" onClick={() => clearMemory.mutate()} disabled={!memory.data?.enabled || clearMemory.isPending}><Trash2 className="ml-2 size-4" />مسح الذاكرة المحفوظة</Button></div><div className="mt-4 rounded-xl border border-border bg-background/35 p-4"><h3 className="text-sm font-semibold">تحليل سريع للمعادن</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">اطلب قراءة حديثة بنقرة واحدة، ثم راجع مصدر البيانات ووقت الجلب في النتيجة.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1"><Button variant="outline" className="justify-start" onClick={() => send("حلّل الذهب XAUUSD فنيًا على إطار 1h باستخدام بيانات حديثة من FX.")} disabled={explain.isPending}><Gem className="ml-2 size-4 text-amber-400" />تحليل الذهب</Button><Button variant="outline" className="justify-start" onClick={() => send("حلّل الفضة XAGUSD فنيًا على إطار 1h باستخدام بيانات حديثة من FX.")} disabled={explain.isPending}><Gem className="ml-2 size-4 text-slate-300" />تحليل الفضة</Button></div></div><div className="mt-6 flex gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4 text-sm leading-6 text-amber-100"><ShieldAlert className="mt-0.5 size-4 shrink-0" /><p>المحتوى تعليمي ومعلوماتي فقط، ولا يشكّل نصيحة استثمارية أو دعوة لفتح صفقة.</p></div></Panel><AIChatBox messages={messages} onSendMessage={send} isLoading={explain.isPending} height="600px" placeholder="اسأل عن RSI أو MACD أو توافق الاتجاه…" emptyStateMessage="ابدأ سؤالًا حول قراءة فنية أو سياق سوقي." suggestedPrompts={["كيف أقرأ تعارض RSI مع اتجاه السعر؟", "ما دلالة اتساع Bollinger Bands؟", "كيف أفسّر توافق 1h و4h و1D؟"]} className="border-white/[0.08] bg-card/90" /></div></>;
}
