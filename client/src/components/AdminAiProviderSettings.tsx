import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { Activity, CheckCircle2, EyeOff, KeyRound, Loader2, ShieldAlert, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";

type Provider = "openai" | "anthropic" | "google";

const providers: Array<{ id: Provider; name: string; subtitle: string; defaultModel: string; placeholder: string }> = [
  { id: "openai", name: "OpenAI", subtitle: "GPT-4o وGPT-5", defaultModel: "gpt-4o-mini", placeholder: "sk-..." },
  { id: "anthropic", name: "Anthropic", subtitle: "Claude", defaultModel: "claude-3-5-haiku-latest", placeholder: "sk-ant-..." },
  { id: "google", name: "Google Gemini", subtitle: "Gemini", defaultModel: "gemini-2.0-flash", placeholder: "AIza..." },
];

type ProviderSetting = {
  provider: Provider;
  model: string;
  maxOutputTokens: number;
  configured: boolean;
  keyHint: string | null;
  enabled: boolean;
  isActive: boolean;
  updatedAt: Date | string | null;
};

function ProviderCard({ setting, meta }: { setting: ProviderSetting; meta: (typeof providers)[number] }) {
  const utils = trpc.useUtils();
  const save = trpc.auth.admin.ai.save.useMutation({
    onSuccess: () => {
      setApiKey("");
      setStatus("تم حفظ الإعدادات بنجاح.");
      void utils.auth.admin.ai.list.invalidate();
    },
    onError: error => setStatus(error.message),
  });
  const removeKey = trpc.auth.admin.ai.removeKey.useMutation({
    onSuccess: () => {
      setApiKey("");
      setEnabled(false);
      setStatus("تم حذف المفتاح وتعطيل المزود.");
      void utils.auth.admin.ai.list.invalidate();
    },
    onError: error => setStatus(error.message),
  });
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(setting.model || meta.defaultModel);
  const [maxOutputTokens, setMaxOutputTokens] = useState(String(setting.maxOutputTokens || 900));
  const [enabled, setEnabled] = useState(setting.enabled);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setModel(setting.model || meta.defaultModel);
    setMaxOutputTokens(String(setting.maxOutputTokens || 900));
    setEnabled(setting.enabled);
  }, [meta.defaultModel, setting.enabled, setting.maxOutputTokens, setting.model]);

  const saveProvider = (makeActive: boolean) => {
    setStatus(null);
    save.mutate({
      provider: meta.id,
      model: model.trim() || meta.defaultModel,
      maxOutputTokens: Math.min(8000, Math.max(128, Number(maxOutputTokens) || 900)),
      apiKey: apiKey.trim() || undefined,
      enabled,
      makeActive,
    });
  };

  const updatedAt = setting.updatedAt ? new Date(setting.updatedAt).toLocaleDateString("ar", { dateStyle: "medium" }) : null;

  return (
    <Panel className={`relative overflow-hidden p-5 ${setting.isActive ? "border-primary/45 bg-primary/[0.045]" : ""}`}>
      {setting.isActive && <div className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{meta.name}</h3>
            {setting.isActive ? <Badge className="bg-primary text-primary-foreground">المزود النشط</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{meta.subtitle}</p>
        </div>
        {setting.configured ? (
          <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><CheckCircle2 className="ml-1 size-3.5" />مفتاح محفوظ {setting.keyHint}</Badge>
        ) : (
          <Badge variant="outline" className="border-amber-300/25 bg-amber-300/10 text-amber-200"><ShieldAlert className="ml-1 size-3.5" />غير مهيأ</Badge>
        )}
      </div>

      <div className="mt-5 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${meta.id}-key`}>مفتاح API</Label>
          <Input
            id={`${meta.id}-key`}
            dir="ltr"
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
            placeholder={setting.configured ? "اتركه فارغًا للإبقاء على المفتاح الحالي" : meta.placeholder}
            className="border-white/10 bg-black/15 font-mono text-sm"
          />
          <p className="flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground"><EyeOff className="size-3.5" />لا يُعرض المفتاح ولا يمكن استعادته بعد الحفظ؛ يظهر التلميح المقنّع فقط.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${meta.id}-model`}>اسم النموذج الافتراضي</Label>
          <Input id={`${meta.id}-model`} dir="ltr" value={model} onChange={event => setModel(event.target.value)} placeholder={meta.defaultModel} className="border-white/10 bg-black/15 font-mono text-sm" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${meta.id}-max-tokens`}>الحد الأقصى لطول الإجابة (Tokens)</Label>
          <Input id={`${meta.id}-max-tokens`} dir="ltr" inputMode="numeric" type="number" min={128} max={8000} value={maxOutputTokens} onChange={event => setMaxOutputTokens(event.target.value)} className="border-white/10 bg-black/15 font-mono text-sm" />
          <p className="text-[11px] text-muted-foreground">بين 128 و8,000؛ القيمة الأعلى تسمح بإجابات أطول وقد تستغرق وقتًا أكثر.</p>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-3">
          <div>
            <p className="text-sm font-medium">تفعيل المزود</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">لا يُستدعى أي مفتاح لمزود معطّل.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={`تفعيل مزود ${meta.name}`} />
        </div>
      </div>

      {status ? <p className={`mt-3 text-xs ${status.startsWith("تم") ? "text-emerald-300" : "text-destructive"}`}>{status}</p> : null}
      {updatedAt ? <p className="mt-3 text-[11px] text-muted-foreground">آخر تعديل: {updatedAt}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => saveProvider(false)} disabled={save.isPending || removeKey.isPending}>
          {save.isPending ? <Loader2 className="ml-1.5 size-4 animate-spin" /> : <KeyRound className="ml-1.5 size-4" />}حفظ الإعدادات
        </Button>
        <Button size="sm" variant="outline" className="border-primary/35 text-primary hover:bg-primary/10" onClick={() => saveProvider(true)} disabled={!enabled || save.isPending || removeKey.isPending}>
          <Zap className="ml-1.5 size-4" />تعيين كمزود نشط
        </Button>
        {setting.configured ? <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (window.confirm(`حذف مفتاح ${meta.name} وتعطيله؟`)) removeKey.mutate({ provider: meta.id }); }} disabled={save.isPending || removeKey.isPending}><Trash2 className="ml-1.5 size-4" />حذف المفتاح</Button> : null}
      </div>
    </Panel>
  );
}

export function AdminAiProviderSettings() {
  const { data, isLoading, error } = trpc.auth.admin.ai.list.useQuery();
  const { data: marketStatus, isFetching: isCheckingMarket } = trpc.auth.admin.ai.marketProviderStatus.useQuery(undefined, { refetchInterval: 60_000 });
  if (isLoading) return <Panel className="flex min-h-40 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></Panel>;
  if (error) return <Panel><p className="text-sm text-destructive">{error.message}</p></Panel>;
  const settings = (data ?? []) as ProviderSetting[];
  const marketLastChecked = marketStatus?.checkedAt
    ? new Date(marketStatus.checkedAt).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /><h2 className="text-lg font-semibold">ربط نماذج الذكاء الاصطناعي</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">اربط مزودًا واحدًا أو أكثر، واختر المزود النشط الذي يستخدمه مساعد AMIC.</p>
        </div>
        <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary"><ShieldAlert className="ml-1 size-3.5" />تشفير على الخادم</Badge>
      </div>
      <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm"><Activity className="size-4 text-primary" /><span className="font-medium">حالة مزود السوق TradingView-MCP</span></div>
          {marketLastChecked ? <p className="mt-1 text-[11px] text-muted-foreground">آخر فحص: {marketLastChecked}</p> : null}
        </div>
        {isCheckingMarket ? <Badge variant="outline"><Loader2 className="ml-1 size-3.5 animate-spin" />جارٍ الفحص</Badge> : marketStatus?.status === "healthy" ? <Badge className="bg-emerald-500/15 text-emerald-300"><CheckCircle2 className="ml-1 size-3.5" />متصل · {marketStatus.toolCount} أداة</Badge> : <Badge variant="outline" className="border-amber-300/30 bg-amber-300/10 text-amber-200"><ShieldAlert className="ml-1 size-3.5" />يتعذر التحقق الآن</Badge>}
      </Panel>
      <div className="grid gap-4 xl:grid-cols-3">
        {providers.map(meta => <ProviderCard key={meta.id} meta={meta} setting={settings.find(setting => setting.provider === meta.id) ?? { provider: meta.id, model: meta.defaultModel, maxOutputTokens: 900, configured: false, keyHint: null, enabled: false, isActive: false, updatedAt: null }} />)}
      </div>
    </section>
  );
}
