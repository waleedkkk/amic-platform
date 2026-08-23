import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./lib/i18n";
import AdminUsers from "./pages/AdminUsers";
import AlertCenter from "./pages/AlertCenter";
import LocalAlertCenterDemo from "./pages/LocalAlertCenterDemo";
import AiAssistant from "./pages/AiAssistant";
import Confluence from "./pages/Confluence";
import EconomicCalendar from "./pages/EconomicCalendar";
import Backtest from "./pages/Backtest";
import Replay from "./pages/Replay";
import Home from "./pages/Home";
import MarketScanner from "./pages/MarketScanner";
import NotFound from "./pages/NotFound";
import PaperTrading from "./pages/PaperTrading";
import TradeReview from "./pages/TradeReview";
import Leaderboard from "./pages/Leaderboard";
import PublicSignal from "./pages/PublicSignal";
import Signals from "./pages/Signals";
import TechnicalAnalysis from "./pages/TechnicalAnalysis";
import { Route, Switch } from "wouter";

function LocalAlertCenterDemoRoute() { return import.meta.env.DEV ? <LocalAlertCenterDemo /> : <NotFound />; }
function AppRoutes() {
  return <Switch><Route path="/demo/alerts" component={LocalAlertCenterDemoRoute} /><Route path="/signal/:shareId" component={PublicSignal} /><Route><DashboardLayout><Switch><Route path="/" component={Home} /><Route path="/alerts" component={AlertCenter} /><Route path="/analysis" component={TechnicalAnalysis} /><Route path="/confluence" component={Confluence} /><Route path="/calendar" component={EconomicCalendar} /><Route path="/backtest" component={Backtest} /><Route path="/replay" component={Replay} /><Route path="/screener" component={MarketScanner} /><Route path="/paper-trading" component={PaperTrading} /><Route path="/trade-review" component={TradeReview} /><Route path="/leaderboard" component={Leaderboard} /><Route path="/signals" component={Signals} /><Route path="/assistant" component={AiAssistant} /><Route path="/admin" component={AdminUsers} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></DashboardLayout></Route></Switch>;
}

export default function App() { return <ErrorBoundary><LanguageProvider><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors position="top-center" /><AppRoutes /></TooltipProvider></ThemeProvider></LanguageProvider></ErrorBoundary>; }
