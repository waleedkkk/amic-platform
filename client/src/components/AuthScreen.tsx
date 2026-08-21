import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ChartNoAxesCombined, Loader2, Lock, Mail, UserPlus, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Mode = "login" | "register";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async data => {
      toast.success(`أهلًا بك${data.name ? `، ${data.name}` : ""}!`);
      await utils.auth.me.invalidate();
    },
    onError: error => {
      toast.error(error.message || "فشل تسجيل الدخول");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async data => {
      toast.success(`تم إنشاء الحساب${data.name ? ` ${data.name}` : ""}، أهلاً بك!`);
      await utils.auth.me.invalidate();
    },
    onError: error => {
      toast.error(error.message || "تعذّر إنشاء الحساب");
    },
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;
    if (!email.trim() || password.length < 8) {
      toast.error("أدخل بريدًا إلكترونيًا وكلمة مرور من 8 أحرف على الأقل");
      return;
    }
    if (mode === "login") {
      loginMutation.mutate({ email: email.trim(), password });
    } else {
      registerMutation.mutate({ email: email.trim(), password, name: name.trim() || undefined });
    }
  }

  return (
    <div className="surface-grid flex min-h-[100dvh] items-center justify-center overflow-x-hidden p-4 sm:p-6">
      <Card className="w-full max-w-md border-white/10 bg-card/90 p-5 text-center panel-glow sm:p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary sm:size-14">
          <ChartNoAxesCombined className="size-6 sm:size-7" />
        </div>
        <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-primary sm:mt-6 sm:text-xs sm:tracking-[0.18em]">AMIC MARKET INTELLIGENCE</p>
        <h1 className="mt-3 text-xl font-semibold sm:text-2xl">
          {mode === "login" ? "تسجيل الدخول إلى مساحة التحليل" : "إنشاء حساب جديد"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          تُحفظ محفظتك الورقية وإشاراتك داخل حسابك فقط، لتبقى قراءة السوق منظمة ومستقلة.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4 text-right sm:mt-7">
          {mode === "register" && (
            <div className="space-y-1.5 text-right">
              <Label htmlFor="amic-name" className="text-xs">الاسم (اختياري)</Label>
              <div className="relative">
                <UserPlus className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="amic-name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="اسمك"
                  className="pr-9"
                  maxLength={120}
                  disabled={isPending}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5 text-right">
            <Label htmlFor="amic-email" className="text-xs">البريد الإلكتروني</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="amic-email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                className="pr-9"
                disabled={isPending}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5 text-right">
            <Label htmlFor="amic-password" className="text-xs">كلمة المرور</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="amic-password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="8 أحرف على الأقل"
                dir="ltr"
                className="pr-9"
                disabled={isPending}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </div>
          </div>

          <Button type="submit" className="min-h-11 w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="ml-2 size-4 animate-spin" />
                {mode === "login" ? "جارٍ الدخول..." : "جارٍ إنشاء الحساب..."}
              </>
            ) : mode === "login" ? (
              "تسجيل الدخول"
            ) : (
              "إنشاء الحساب"
            )}
          </Button>
        </form>

        <p className="mt-5 text-sm text-muted-foreground">
          {mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {mode === "login" ? "أنشئ حسابًا جديدًا" : "سجّل الدخول"}
          </button>
        </p>
      </Card>
    </div>
  );
}
