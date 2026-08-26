import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AuthScreen } from "./AuthScreen";
import { BellRing, Bot, CalendarDays, CandlestickChart, ChartNoAxesCombined, FlaskConical, History, LayoutDashboard, LogOut, PanelLeft, ScanSearch, ShieldCheck, Sparkles, Trophy, WalletCards } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { getSidebarResizeWidth, getSidebarSideForLanguage } from "@/lib/sidebarDirection";
import { navigateFromSidebar } from "@/lib/sidebarMobileNavigation";
import { preloadRoute } from "@/lib/routePreload";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type MenuItem = { icon: typeof LayoutDashboard; labelKey: TranslationKey; path: string };
type MenuSection = { labelKey: TranslationKey; items: MenuItem[] };
const menuSections: MenuSection[] = [
  {
    labelKey: "marketWorkspace",
    items: [
      { icon: LayoutDashboard, labelKey: "marketPulse", path: "/" },
      { icon: CandlestickChart, labelKey: "technicalAnalysis", path: "/analysis" },
      { icon: ChartNoAxesCombined, labelKey: "confluence", path: "/confluence" },
      { icon: ScanSearch, labelKey: "scanner", path: "/screener" },
      { icon: CalendarDays, labelKey: "calendar", path: "/calendar" },
      { icon: Bot, labelKey: "assistant", path: "/assistant" },
    ],
  },
  {
    labelKey: "practiceWorkspace",
    items: [
      { icon: WalletCards, labelKey: "paperTrading", path: "/paper-trading" },
      { icon: Sparkles, labelKey: "signals", path: "/signals" },
      { icon: BellRing, labelKey: "alertCenter", path: "/alerts" },
      { icon: Sparkles, labelKey: "tradeReview", path: "/trade-review" },
    ],
  },
  {
    labelKey: "toolsWorkspace",
    items: [
      { icon: FlaskConical, labelKey: "backtest", path: "/backtest" },
      { icon: History, labelKey: "replay", path: "/replay" },
      { icon: Trophy, labelKey: "leaderboard", path: "/leaderboard" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "amic-sidebar-width";
const DEFAULT_WIDTH = 272;
const MIN_WIDTH = 220;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user } = useAuth();
  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)), [sidebarWidth]);
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return <AuthScreen />;
  }
  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><LayoutContent setSidebarWidth={setSidebarWidth}>{children}</LayoutContent></SidebarProvider>;
}

function LayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, setOpenMobile, isMobile } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const collapsed = state === "collapsed";
  const sidebarSide = getSidebarSideForLanguage(language);
  const visibleSections = user?.role === "admin"
    ? [...menuSections, { labelKey: "controlWorkspace" as TranslationKey, items: [{ icon: ShieldCheck, labelKey: "admin" as TranslationKey, path: "/admin" }] }]
    : menuSections;
  const visibleMenuItems = visibleSections.flatMap(section => section.items);
  const active = visibleMenuItems.find(item => item.path === location);
  useEffect(() => {
    const move = (event: MouseEvent) => { if (!isResizing || !sidebarRef.current) return; const width = getSidebarResizeWidth(sidebarSide, sidebarRef.current.getBoundingClientRect(), event.clientX); if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width); };
    const end = () => setIsResizing(false);
    if (isResizing) { document.addEventListener("mousemove", move); document.addEventListener("mouseup", end); document.body.style.cursor = "col-resize"; }
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", end); document.body.style.cursor = ""; };
  }, [isResizing, setSidebarWidth, sidebarSide]);
  return <>
    <div className="relative" ref={sidebarRef}>
      <Sidebar side={sidebarSide} collapsible="icon" className={`${sidebarSide === "right" ? "border-l" : "border-r"} border-white/[0.07] bg-[#0c141e]`} disableTransition={isResizing}>
        <SidebarHeader className="h-[76px] justify-center px-3"><div className="flex w-full items-center gap-3"><button onClick={toggleSidebar} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-muted-foreground transition-colors hover:bg-white/[0.07]" aria-label={t("toggleNavigation")}><PanelLeft className="size-4" /></button>{!collapsed && <div className="min-w-0"><p className="text-base font-semibold tracking-tight">AMIC</p><p className="text-[10px] tracking-[0.15em] text-primary">MARKET INTELLIGENCE</p></div>}</div></SidebarHeader>
        <SidebarContent className="px-2 pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleSections.map((section, sectionIndex) => <section key={section.labelKey} className={sectionIndex ? "mt-4 border-t border-white/[0.06] pt-3" : ""} aria-label={t(section.labelKey)}>
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground group-data-[collapsible=icon]:hidden">{t(section.labelKey)}</p>
            <SidebarMenu>{section.items.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} onClick={() => navigateFromSidebar({ isMobile, setOpenMobile, setLocation, path: item.path })} onPointerEnter={() => preloadRoute(item.path)} onFocus={() => preloadRoute(item.path)} tooltip={{ children: t(item.labelKey), side: sidebarSide === "right" ? "left" : "right" }} aria-current={location === item.path ? "page" : undefined} className="h-11 rounded-xl text-[13px] font-medium data-[active=true]:bg-primary/12 data-[active=true]:text-primary"><item.icon className="size-[18px]" /><span>{t(item.labelKey)}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>
          </section>)}
        </SidebarContent>
        <SidebarFooter className="p-3"><div className="mb-3 rounded-xl border border-primary/15 bg-primary/[0.045] p-3 group-data-[collapsible=icon]:hidden"><p className="text-xs font-medium text-primary">{t("responsibleReading")}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{t("disclaimer")}</p></div><Button variant="outline" size="sm" className="mb-3 w-full group-data-[collapsible=icon]:hidden" onClick={() => setLanguage(language === "ar" ? "en" : "ar")}>{t("language")}</Button><DropdownMenu><DropdownMenuTrigger asChild><button className="flex min-h-11 w-full items-center gap-3 rounded-xl p-2 text-start transition-colors hover:bg-white/[0.05] group-data-[collapsible=icon]:justify-center"><Avatar className="size-8 border border-white/10"><AvatarFallback className="bg-secondary text-xs">{user?.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-medium">{user?.name || t("user")}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground" dir="ltr">{user?.email ?? ""}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-48"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="ms-2 size-4" />{t("logout")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter>
      </Sidebar>
      <div onMouseDown={() => !collapsed && setIsResizing(true)} className={cnResize(collapsed, sidebarSide)} />
    </div>
    <SidebarInset className="surface-grid min-w-0 overflow-x-hidden bg-background"><div className="min-h-screen min-w-0 bg-[radial-gradient(circle_at_70%_0%,rgba(48,121,145,0.12),transparent_32%)]">{isMobile && <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/[0.07] bg-background/90 px-3 backdrop-blur"><SidebarTrigger className="size-11 rounded-lg bg-white/[0.05]" aria-label={t("openNavigation")} /><span className="truncate text-sm font-medium">{active ? t(active.labelKey) : "AMIC"}</span></div>}<main className="mx-auto w-full min-w-0 max-w-[1600px] overflow-x-hidden p-3 sm:p-6 lg:p-8">{children}</main></div></SidebarInset>
  </>;
}

function cnResize(collapsed: boolean, side: "left" | "right") { return `absolute ${side === "right" ? "left-0" : "right-0"} top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/30 ${collapsed ? "hidden" : ""}`; }
