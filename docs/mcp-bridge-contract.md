# عقد جسر TradingView MCP الداخلي

> **الغرض:** يمرر خادم AMIC طلبات السوق إلى خدمة `tradingview-mcp` الموجودة على الشبكة الداخلية فقط. لا يُنشر منفذ MCP إلى الإنترنت.

## النقل والعنوان

| البند | القيمة |
|---|---|
| مزود الأدوات | المصدر المضمّن من [`atilaahmettaner/tradingview-mcp`](https://github.com/atilaahmettaner/tradingview-mcp) |
| بروتوكول النقل | MCP Streamable HTTP |
| عنوان Docker الداخلي | `http://tradingview-mcp:8000/mcp` |
| عميل Node.js | `server/mcpClient.ts` باستخدام `@modelcontextprotocol/sdk` |
| مهلة الطلب | 20 ثانية |
| سطح الشبكة | خدمة `amic-app` فقط؛ لا يوجد `ports` لخدمة `tradingview-mcp` |

## شكل الاستدعاء

تتحقق طبقة Node.js من اسم الأداة ضد قائمة مسموحة قبل الاتصال، ثم تنشئ عميل MCP قصير العمر لكل طلب:

```ts
await callTradingViewTool("coin_analysis", {
  symbol: "BTCUSDT",
  exchange: "BINANCE",
  timeframe: "1h",
});
```

تعيد الدالة JSON متى كانت استجابة الأداة نص JSON، وإلا تعيد النص كما هو. يمكن استكشاف مخطط كل أداة وتشغيلها من طبقة الخادم عبر `listTradingViewTools()` دون كشف الخدمة الداخلية للمتصفح.

## التغطية

تحتفظ `TRADINGVIEW_TOOL_NAMES` بالقائمة المسموح بها والتي تعكس الإصدار المضمّن. يتطلب AMIC ما لا يقل عن **37 أداة**؛ الإصدار المراجع حاليًا يعرّف **38 أداة مسموحة**، بما فيها أدوات `top_gainers` و`top_losers` و`coin_analysis` و`multi_timeframe_analysis` و`stock_screener` وأدوات الاختبار والسوق والأسهم والعقود الآجلة. يتحقق اختبار `server/mcpClient.test.ts` من عدم تكرار الأدوات ومن وجود المكونات الأساسية.

## الضوابط

- يسمح المتصفح فقط باستدعاء إجراءات tRPC؛ لا يحصل على عنوان MCP أو بيانات الدخول.
- تُخزَّن لقطات السوق العامة مؤقتًا لمدة قصيرة في `marketSnapshots` لتقليل الضغط على المصدر.
- تُعزل بيانات المستخدمين في `paperTrades` و`savedSignals` و`watchlists` عبر `userId` ومفاتيح مرجعية إلى `users`، وتضيف كل استعلامات التداول والإشارات شرط المالك.
- كل مخرجات التحليل معلوماتية؛ لا تُعامل كتنفيذ أو توصية استثمارية شخصية.
