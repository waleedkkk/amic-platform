# خطة طبقات مؤشرات Pine Script على مخطط AMIC

## الهدف

يعرض AMIC شموع OHLCV تاريخية فعلية عبر `CandlestickChart`. لتحويل مؤشر Pine Script شخصي، سيُنقل **منطق الحساب فقط** إلى TypeScript كي يتعامل مع مصفوفة الشموع نفسها، ثم يحوَّل ناتجه إلى طبقات رسم فوق `lightweight-charts`. لا يُنفذ Pine Script داخل المتصفح ولا تُرسل شفرته إلى مزود خارجي.

## واجهة تحويل موحدة

```ts
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type PineLayer =
  | { kind: "line"; id: string; points: Array<{ time: number; value: number }>; color: string }
  | { kind: "level"; id: string; price: number; color: string; label: string }
  | { kind: "zone"; id: string; from: number; to?: number; high: number; low: number; color: string; label: string };

function calculateIndicator(candles: Candle[]): PineLayer[] {
  return [];
}
```

ينشأ لكل مؤشر ملف مستقل في `shared/indicators/` مع اختبارات قيم ثابتة. يستهلك `CandlestickChart` الطبقات عبر خاصية اختيارية، ويرسم الخطوط كـ `LineSeries` والمستويات كـ `createPriceLine`. أما مناطق FVG وOrder Blocks فتستخدم primitive/plugin متوافقًا مع إصدار `lightweight-charts` المثبت، مع تنظيف الطبقات عند تغيير الرمز أو الإطار الزمني.

## مسار التنفيذ المقترح

| المرحلة | الناتج | معيار القبول |
|---|---|---|
| 1 | استلام كود Pine Script واحد وتعريف مدخلاته | تحديد معادلاته وحالاته دون تخمين |
| 2 | دالة TypeScript صرفة واختبارات شموع ثابتة | تطابق نقاط الإشارة مع أمثلة Pine المرفقة |
| 3 | محول من المخرجات إلى `PineLayer` | عدم إضافة نقاط خارج نطاق الشموع |
| 4 | طبقة رسم قابلة للتبديل في المخطط | تحديثها عند كل إعادة جلب للشموع |
| 5 | مقارنة مرئية بين TradingView وAMIC | توثيق أي اختلاف في التوقيت أو التقريب |

## التحديث اللحظي

الوضع الحالي يعيد جلب التحليل والشموع كل دقيقة ويكشف عمر البيانات للمستخدم. لا يعني ذلك بثًا لحظيًا. عند الحاجة إلى تحديث حقيقي لكل شمعة، يُستبدل مزود الشموع بمصدر مرخص يدعم WebSocket، ثم تمر كل شمعة جديدة إلى الدالة نفسها لإعادة الحساب incremental؛ لا يتغير عقد `calculateIndicator`.
