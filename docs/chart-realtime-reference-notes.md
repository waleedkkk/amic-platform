# مراجع تصميم طبقات الشارت والبث اللحظي

## Lightweight Charts

- توضح وثائق `Series Markers` أن العلامات الزمنية يمكن ربطها مباشرةً بشموع السلسلة لإبراز أحداث محددة؛ وهي مناسبة لإشارات الاختراق والانعكاس والتقاطعات.
  المصدر: https://tradingview.github.io/lightweight-charts/tutorials/how_to/series-markers

- توضح وثائق `Panes` أن المخطط يدعم ألواحًا منفصلة للسلاسل المختلفة، مثل السعر والحجم، مع إدارة ارتفاع الألواح وإعادة ترتيب السلاسل. يُستخدم ذلك لإضافة Confluence Score أو زخم/حجم دون تكديس الرسم السعري.
  المصدر: https://tradingview.github.io/lightweight-charts/docs/panes

## تدفق السوق اللحظي

- توصي وثائق TradingView لتغذية البيانات بفصل الاشتراك عن إلغاء الاشتراك، وتخزين آخر شمعة، وبناء/تحديث OHLC من صفقات البث، وإعادة ضبط الكاش عند تغيير الإطار الزمني. هذا يدعم تصميم وسيط بث واحد على الخادم يشغّل عدة مشتركين في الواجهة بدل فتح اتصال مزود لكل مستخدم.
  المصدر: https://www.tradingview.com/charting-library-docs/latest/tutorials/implement_datafeed_tutorial/Streaming-Implementation/
