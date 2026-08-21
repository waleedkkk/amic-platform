import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AuthScreen } from "./AuthScreen";
import { useIsMobile } from "@/hooks/useMobile";
import { Bot, CandlestickChart, ChartNoAxesCombined, LayoutDashboard, LogOut, PanelLeft, ScanSearch, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { ARABIC_SIDEBAR_SIDE, getSidebarResizeWidth } from "@/lib/sidebarDirection";

const menuItems = [
  { icon: LayoutDashboard, label: "نبضة السوق", path: "/" },
  { icon: CandlestickChart, label: "تحليل فني", path: "/analysis" },
  { icon: ChartNoAxesCombined, label: "توافق الأطر", path: "/confluence" },
  { icon: ScanSearch, label: "ماسح السوق", path: "/screener" },
  { icon: WalletCards, label: "التداول الورقي", path: "/paper-trading" },
  { icon: Sparkles, label: "الإشارات المحفوظة", path: "/signals" },
  { icon: Bot, label: "مساعد AMIC", path: "/assistant" },
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
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const collapsed = state === "collapsed";
  const visibleMenuItems = user?.role === "admin" ? [...menuItems, { icon: ShieldCheck, label: "مركز الإدارة", path: "/admin" }] : menuItems;
  const active = visibleMenuItems.find(item => item.path === location);
  useEffect(() => {
    const move = (event: MouseEvent) => { if (!isResizing || !sidebarRef.current) return; const width = getSidebarResizeWidth(ARABIC_SIDEBAR_SIDE, sidebarRef.current.getBoundingClientRect(), event.clientX); if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width); };
    const end = () => setIsResizing(false);
    if (isResizing) { document.addEventListener("mousemove", move); document.addEventListener("mouseup", end); document.body.style.cursor = "col-resize"; }
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", end); document.body.style.cursor = ""; };
  }, [isResizing, setSidebarWidth]);
  return <>
    <div className="relative" ref={sidebarRef}>
      <Sidebar side={ARABIC_SIDEBAR_SIDE} collapsible="icon" className="border-l border-white/[0.07] bg-[#0c141e]" disableTransition={isResizing}>
        <SidebarHeader className="h-[76px] justify-center px-3"><div className="flex w-full items-center gap-3"><button onClick={toggleSidebar} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-muted-foreground transition-colors hover:bg-white/[0.07]" aria-label="طي القائمة"><PanelLeft className="size-4" /></button>{!collapsed && <div className="min-w-0"><p className="text-base font-semibold tracking-tight">AMIC</p><p className="text-[10px] tracking-[0.15em] text-primary">MARKET INTELLIGENCE</p></div>}</div></SidebarHeader>
        <SidebarContent className="px-2 pb-4 pt-2"><p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground group-data-[collapsible=icon]:hidden">مساحة العمل</p><SidebarMenu>{visibleMenuItems.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={{ children: item.label, side: "left" }} aria-current={location === item.path ? "page" : undefined} className="h-12 rounded-xl text-[13px] font-medium data-[active=true]:bg-primary/12 data-[active=true]:text-primary"><item.icon className="size-[18px]" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent>
        <SidebarFooter className="p-3"><div className="mb-3 rounded-xl border border-primary/15 bg-primary/[0.045] p-3 group-data-[collapsible=icon]:hidden"><p className="text-xs font-medium text-primary">قراءة مسؤولة</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">المعلومات تحليلية وتعليمية، وليست توصية استثمارية.</p></div><DropdownMenu><DropdownMenuTrigger asChild><button className="flex min-h-11 w-full items-center gap-3 rounded-xl p-2 text-start transition-colors hover:bg-white/[0.05] group-data-[collapsible=icon]:justify-center"><Avatar className="size-8 border border-white/10"><AvatarFallback className="bg-secondary text-xs">{user?.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-medium">{user?.name || "مستخدم AMIC"}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground" dir="ltr">{user?.email ?? ""}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-48"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="ms-2 size-4" />تسجيل الخروج</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter>
      </Sidebar>
      <div onMouseDown={() => !collapsed && setIsResizing(true)} className={cnResize(collapsed)} />
    </div>
    <SidebarInset className="surface-grid min-w-0 overflow-x-hidden bg-background"><div className="min-h-screen min-w-0 bg-[radial-gradient(circle_at_70%_0%,rgba(48,121,145,0.12),transparent_32%)]">{isMobile && <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/[0.07] bg-background/90 px-3 backdrop-blur"><SidebarTrigger className="size-11 rounded-lg bg-white/[0.05]" aria-label="فتح التنقل" /><span className="truncate text-sm font-medium">{active?.label ?? "AMIC"}</span></div>}<main className="mx-auto w-full min-w-0 max-w-[1600px] overflow-x-hidden p-3 sm:p-6 lg:p-8">{children}</main></div></SidebarInset>
  </>;
}

function cnResize(collapsed: boolean) { return `absolute left-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/30 ${collapsed ? "hidden" : ""}`; }
