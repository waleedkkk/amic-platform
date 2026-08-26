const routeLoaders = {
  "/": () => import("../pages/Home"),
  "/alerts": () => import("../pages/AlertCenter"),
  "/analysis": () => import("../pages/TechnicalAnalysis"),
  "/confluence": () => import("../pages/Confluence"),
  "/calendar": () => import("../pages/EconomicCalendar"),
  "/backtest": () => import("../pages/Backtest"),
  "/replay": () => import("../pages/Replay"),
  "/screener": () => import("../pages/MarketScanner"),
  "/paper-trading": () => import("../pages/PaperTrading"),
  "/trade-review": () => import("../pages/TradeReview"),
  "/leaderboard": () => import("../pages/Leaderboard"),
  "/signals": () => import("../pages/Signals"),
  "/assistant": () => import("../pages/AiAssistant"),
  "/admin": () => import("../pages/AdminUsers"),
} as const;

/** يبدأ تحميل صفحة محتملة عند تمرير المستخدم أو تركيزه على رابط التنقل. */
export function preloadRoute(path: string) {
  const loader = routeLoaders[path as keyof typeof routeLoaders];
  if (loader) void loader();
}
