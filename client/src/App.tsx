import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AiAssistant from "./pages/AiAssistant";
import Confluence from "./pages/Confluence";
import Home from "./pages/Home";
import MarketScanner from "./pages/MarketScanner";
import NotFound from "./pages/NotFound";
import PaperTrading from "./pages/PaperTrading";
import Signals from "./pages/Signals";
import TechnicalAnalysis from "./pages/TechnicalAnalysis";
import { Route, Switch } from "wouter";

function AppRoutes() {
  return <DashboardLayout><Switch><Route path="/" component={Home} /><Route path="/analysis" component={TechnicalAnalysis} /><Route path="/confluence" component={Confluence} /><Route path="/screener" component={MarketScanner} /><Route path="/paper-trading" component={PaperTrading} /><Route path="/signals" component={Signals} /><Route path="/assistant" component={AiAssistant} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></DashboardLayout>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors position="top-center" /><AppRoutes /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
