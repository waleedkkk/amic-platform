import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./lib/i18n";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";

const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AlertCenter = lazy(() => import("./pages/AlertCenter"));
const LocalAlertCenterDemo = lazy(() => import("./pages/LocalAlertCenterDemo"));
const AiAssistant = lazy(() => import("./pages/AiAssistant"));
const Confluence = lazy(() => import("./pages/Confluence"));
const EconomicCalendar = lazy(() => import("./pages/EconomicCalendar"));
const Backtest = lazy(() => import("./pages/Backtest"));
const Replay = lazy(() => import("./pages/Replay"));
const Home = lazy(() => import("./pages/Home"));
const MarketScanner = lazy(() => import("./pages/MarketScanner"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PaperTrading = lazy(() => import("./pages/PaperTrading"));
const TradeReview = lazy(() => import("./pages/TradeReview"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const PublicSignal = lazy(() => import("./pages/PublicSignal"));
const Signals = lazy(() => import("./pages/Signals"));
const TechnicalAnalysis = lazy(() => import("./pages/TechnicalAnalysis"));

function RouteLoading() {
  return <div className="flex min-h-[38vh] items-center justify-center" role="status" aria-live="polite"><div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-card/70 px-4 py-3 text-sm text-muted-foreground"><span className="size-2 animate-pulse rounded-full bg-primary" />جارٍ فتح الصفحة…</div></div>;
}

function LocalAlertCenterDemoRoute() { return <Suspense fallback={<RouteLoading />}>{import.meta.env.DEV ? <LocalAlertCenterDemo /> : <NotFound />}</Suspense>; }
function PublicSignalRoute() { return <Suspense fallback={<RouteLoading />}><PublicSignal /></Suspense>; }
function AppRoutes() {
  return <Switch><Route path="/demo/alerts" component={LocalAlertCenterDemoRoute} /><Route path="/signal/:shareId" component={PublicSignalRoute} /><Route><DashboardLayout><Suspense fallback={<RouteLoading />}><Switch><Route path="/" component={Home} /><Route path="/alerts" component={AlertCenter} /><Route path="/analysis" component={TechnicalAnalysis} /><Route path="/confluence" component={Confluence} /><Route path="/calendar" component={EconomicCalendar} /><Route path="/backtest" component={Backtest} /><Route path="/replay" component={Replay} /><Route path="/screener" component={MarketScanner} /><Route path="/paper-trading" component={PaperTrading} /><Route path="/trade-review" component={TradeReview} /><Route path="/leaderboard" component={Leaderboard} /><Route path="/signals" component={Signals} /><Route path="/assistant" component={AiAssistant} /><Route path="/admin" component={AdminUsers} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></Suspense></DashboardLayout></Route></Switch>;
}

export default function App() { return <ErrorBoundary><LanguageProvider><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors position="top-center" /><AppRoutes /></TooltipProvider></ThemeProvider></LanguageProvider></ErrorBoundary>; }
