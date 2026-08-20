import { AIChatBox, Message } from "@/components/AIChatBox";
import { PageHeading, Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const explain = trpc.ai.explain.useMutation({ onSuccess: response => setMessages(current => [...current, { role: "assistant", content: response.content }]), onError: error => toast.error(error.message) });
  const send = (content: string) => { const next = [...messages, { role: "user" as const, content }]; setMessages(next); explain.mutate({ messages: next.map(({ role, content: item }) => ({ role: role === "assistant" ? "assistant" as const : "user" as const, content: item })) }); };
  return <><PageHeading eyebrow="AMIC EXPLAINER" title="مساعد التحليل" description="حوّل تساؤلاتك ومخرجاتك الفنية إلى شرح عربي منظم. لا يستخدم المساعد لإصدار توصيات شخصية أو وعود بالعوائد." /><div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]"><Panel className="h-fit"><Sparkles className="size-6 text-primary" /><h2 className="mt-5 text-xl font-semibold">كيف يجيب المساعد؟</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">يعتمد على السؤال والسياق الذي تزوّده به، ويشرح المؤشرات واحتمالاتها وتعارض الإشارات. عند الحاجة، انقل إليه القيم الفعلية من صفحة التحليل الفني.</p><div className="mt-6 flex gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4 text-sm leading-6 text-amber-100"><ShieldAlert className="mt-0.5 size-4 shrink-0" /><p>المحتوى تعليمي ومعلوماتي فقط، ولا يشكّل نصيحة استثمارية أو دعوة لفتح صفقة.</p></div></Panel><AIChatBox messages={messages} onSendMessage={send} isLoading={explain.isPending} height="600px" placeholder="اسأل عن RSI أو MACD أو توافق الاتجاه…" emptyStateMessage="ابدأ سؤالًا حول قراءة فنية أو سياق سوقي." suggestedPrompts={["كيف أقرأ تعارض RSI مع اتجاه السعر؟", "ما دلالة اتساع Bollinger Bands؟", "كيف أفسّر توافق 1h و4h و1D؟"]} className="border-white/[0.08] bg-card/90" /></div></>;
}
