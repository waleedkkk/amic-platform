import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { aiProviderDefinitions, aiProviderIds, type AiProviderId } from "@shared/aiProviders";
import { Activity, Check, CheckCircle2, ChevronDown, EyeOff, KeyRound, Loader2, RefreshCw, ShieldAlert, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";

type Provider = AiProviderId;

const providers = aiProviderIds.map(id => ({ id, ...aiProviderDefinitions[id] }));

type ProviderSetting = {
  provider: Provider;
  model: string;
  customBaseUrl: string | null;
  maxOutputTokens: number;
  configured: boolean;
  keyHint: string | null;
  enabled: boolean;
  isActive: boolean;
  updatedAt: Date | string | null;
};

type CatalogModel = { id: string; label: string; owner: string | null };

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
  const testConnection = trpc.auth.admin.ai.testConnection.useMutation({
    onSuccess: result => setStatus(result.message),
    onError: error => setStatus(error.message),
  });
  const listModels = trpc.auth.admin.ai.listModels.useMutation();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(setting.model || meta.defaultModel);
  const [customBaseUrl, setCustomBaseUrl] = useState(setting.customBaseUrl ?? "");
  const [catalogModels, setCatalogModels] = useState<CatalogModel[]>([]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [maxOutputTokens, setMaxOutputTokens] = useState(String(setting.maxOutputTokens || 900));
  const [enabled, setEnabled] = useState(setting.enabled);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setModel(setting.model || meta.defaultModel);
    setCustomBaseUrl(setting.customBaseUrl ?? "");
    setMaxOutputTokens(String(setting.maxOutputTokens || 900));
    setEnabled(setting.enabled);
  }, [meta.defaultModel, setting.customBaseUrl, setting.enabled, setting.maxOutputTokens, setting.model]);

  const loadCatalog = (announce: boolean) => {
    const key = apiKey.trim();
    if (!key && !setting.configured) {
      if (announce) setStatus("أدخل مفتاح API لجلب النماذج المتاحة قبل الحفظ.");
      return;
    }
    if (announce) setStatus(null);
    listModels.mutate(
      { provider: meta.id, apiKey: key || undefined, customBaseUrl: customBaseUrl.trim() },
      {
        onSuccess: result => {
          if (!result.success) {
            if (announce) setStatus(result.message);
            return;
          }
          setCatalogModels(result.models);
          if (announce) setStatus(`تم جلب ${result.models.length} نموذجًا من ${meta.name}.`);
        },
        onError: error => { if (announce) setStatus(error.message); },
      },
    );
  };

  useEffect(() => {
    if (setting.configured && !catalogModels.length && !listModels.isPending) loadCatalog(false);
  // يُعاد الجلب عند توفر مفتاح محفوظ أو تبديل المزود، وليس عند كل تغيير في حقل النموذج.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, setting.configured]);

  const saveProvider = (makeActive: boolean) => {
    setStatus(null);
    save.mutate({
      provider: meta.id,
      model: model.trim() || meta.defaultModel,
      maxOutputTokens: Math.min(8000, Math.max(128, Number(maxOutputTokens) || 900)),
      apiKey: apiKey.trim() || undefined,
      customBaseUrl: customBaseUrl.trim(),
      enabled,
      makeActive,
    });
  };

  const testProviderConnection = () => {
    const key = apiKey.trim();
    if (!key) {
      setStatus("أدخل مفتاح API جديدًا لاختباره؛ لا يمكن عرض المفتاح المحفوظ أو إرساله إلى المتصفح.");
      return;
    }
    setStatus(null);
    testConnection.mutate({ provider: meta.id, apiKey: key, model: model.trim() || meta.defaultModel, customBaseUrl: customBaseUrl.trim() });
  };

  const updatedAt = setting.updatedAt ? new Date(setting.updatedAt).toLocaleDateString("ar", { dateStyle: "medium" }) : null;
  const selectedCatalogModel = catalogModels.find(item => item.id === model);

  return (
    <Panel className={`relative overflow-hidden p-4 sm:p-5 ${setting.isActive ? "border-primary/45 bg-primary/[0.045]" : ""}`}>
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
          <p className="flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground"><EyeOff className="size-3.5" />لا يُعرض المفتاح ولا يمكن استعادته بعد الحفظ؛ يظهر التلميح المقنّع فقط. اختبار الاتصال لا يحفظ المفتاح.</p>
        </div>
        {meta.protocol === "openai" ? <div className="grid gap-2">
          <Label htmlFor={`${meta.id}-base-url`}>عنوان API الأساسي المخصص</Label>
          <Input
            id={`${meta.id}-base-url`}
            dir="ltr"
            type="url"
            autoComplete="url"
            value={customBaseUrl}
            onChange={event => setCustomBaseUrl(event.target.value)}
            placeholder={meta.baseUrl ?? "https://api.example.com/v1"}
            className="border-white/10 bg-black/15 font-mono text-sm"
          />
          <p className="text-[11px] leading-5 text-muted-foreground">اختياري للمزودات المتوافقة مع OpenAI. استخدم HTTPS فقط، مثل <span dir="ltr">https://gateway.example.com/v1</span>. لا تُقبل العناوين المحلية أو عناوين IP المباشرة.</p>
        </div> : null}
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2"><Label htmlFor={`${meta.id}-model`}>اسم النموذج الافتراضي</Label><span className="text-[11px] text-muted-foreground">اختياري يدويًا</span></div>
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={modelPickerOpen} disabled={!catalogModels.length} className="min-h-11 min-w-0 w-full justify-between border-white/10 bg-black/15 font-mono text-xs hover:bg-white/[0.06] min-[420px]:flex-1">
                  <span className="truncate" dir="ltr">{selectedCatalogModel?.label ?? (catalogModels.length ? "اختر نموذجًا من القائمة" : "اجلب النماذج لعرض القائمة")}</span><ChevronDown className="mr-2 size-4 shrink-0 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(28rem,calc(100vw-3rem))] p-0">
                <Command dir="ltr">
                  <CommandInput placeholder="ابحث عن نموذج…" />
                  <CommandList className="max-h-72">
                    <CommandEmpty>لا توجد نتيجة مطابقة.</CommandEmpty>
                    <CommandGroup heading="النماذج المتاحة">
                      {catalogModels.map(item => <CommandItem key={item.id} value={`${item.label} ${item.id} ${item.owner ?? ""}`} onSelect={() => { setModel(item.id); setModelPickerOpen(false); }}>
                        <Check className={`mr-2 size-4 ${item.id === model ? "opacity-100" : "opacity-0"}`} />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>{item.owner ? <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">{item.owner}</span> : null}
                      </CommandItem>)}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button type="button" size="sm" variant="outline" className="min-h-11 w-full border-white/10 min-[420px]:w-auto" onClick={() => loadCatalog(true)} disabled={listModels.isPending || save.isPending || removeKey.isPending}>
              {listModels.isPending ? <Loader2 className="ml-1.5 size-4 animate-spin" /> : <RefreshCw className="ml-1.5 size-4" />}<span className="min-[420px]:sr-only">جلب النماذج</span>
            </Button>
          </div>
          <Input id={`${meta.id}-model`} dir="ltr" value={model} onChange={event => setModel(event.target.value)} placeholder={meta.defaultModel} className="border-white/10 bg-black/15 font-mono text-sm" />
          <p className="text-[11px] text-muted-foreground">تُجلب القائمة من الخادم فقط؛ يمكنك اختيار نموذج أو كتابة معرّف نموذج يدويًا.</p>
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

      {status ? <p role="status" className={`mt-3 text-xs ${(status.startsWith("تم") || status.startsWith("نجح")) ? "text-emerald-300" : "text-destructive"}`}>{status}</p> : null}
      {updatedAt ? <p className="mt-3 text-[11px] text-muted-foreground">آخر تعديل: {updatedAt}</p> : null}

      <div className="mt-5 grid gap-2 min-[500px]:grid-cols-2">
        <Button size="sm" variant="outline" className="min-h-11 w-full border-sky-400/35 text-sky-200 hover:bg-sky-400/10" onClick={testProviderConnection} disabled={testConnection.isPending || listModels.isPending || save.isPending || removeKey.isPending}>
          {testConnection.isPending ? <Loader2 className="ml-1.5 size-4 animate-spin" /> : <Activity className="ml-1.5 size-4" />}اختبار الاتصال
        </Button>
        <Button size="sm" className="min-h-11 w-full" onClick={() => saveProvider(false)} disabled={save.isPending || listModels.isPending || testConnection.isPending || removeKey.isPending}>
          {save.isPending ? <Loader2 className="ml-1.5 size-4 animate-spin" /> : <KeyRound className="ml-1.5 size-4" />}حفظ الإعدادات
        </Button>
        <Button size="sm" variant="outline" className="min-h-11 w-full border-primary/35 text-primary hover:bg-primary/10" onClick={() => saveProvider(true)} disabled={!enabled || save.isPending || listModels.isPending || testConnection.isPending || removeKey.isPending}>
          <Zap className="ml-1.5 size-4" />تعيين كمزود نشط
        </Button>
        {setting.configured ? <Button size="sm" variant="ghost" className="min-h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (window.confirm(`حذف مفتاح ${meta.name} وتعطيله؟`)) removeKey.mutate({ provider: meta.id }); }} disabled={save.isPending || listModels.isPending || testConnection.isPending || removeKey.isPending}><Trash2 className="ml-1.5 size-4" />حذف المفتاح</Button> : null}
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
        {providers.map(meta => <ProviderCard key={meta.id} meta={meta} setting={settings.find(setting => setting.provider === meta.id) ?? { provider: meta.id, model: meta.defaultModel, customBaseUrl: null, maxOutputTokens: 900, configured: false, keyHint: null, enabled: false, isActive: false, updatedAt: null }} />)}
      </div>
    </section>
  );
}
