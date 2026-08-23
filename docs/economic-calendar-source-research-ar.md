# اختيار مصدر التقويم الاقتصادي

تمت مقارنة وثائق عدة مصادر قبل تنفيذ التكامل. توضح وثائق Trading Economics وجود نقاط نهاية متعددة للتقويم، بما فيها اللقطة والتصفية حسب البلد والمؤشر، لكنها تتطلب اشتراكًا ومفتاحًا؛ كما تأكد أن حساب الضيف `guest:guest` متوقف وأعاد الخادم HTTP 410. وتوضح وثائق Financial Modeling Prep أن الوصول لنقطة التقويم يحتاج مفتاحًا مخوّلًا، وقد أعاد المفتاح المتاح HTTP 402. وتؤكد وثائق FXStreet أن جميع نقاط تقويمها محمية بـOAuth2. كما يتطلب HorizonFX مفتاح RapidAPI. وبناءً على شرط المستخدم بعدم استخدام بطاقة أو خدمة تجارية، سيتحول التنفيذ إلى تقويم رسمي مفتوح يغطي الأحداث الأميركية عالية الأثر من BLS وFOMC.

| المصدر | ما تأكد من الوثائق | قرار التنفيذ |
|---|---|---|
| Trading Economics | تقويم اقتصادي مخصص ونقاط نهاية للتقويم واللقطة والبلدان والمؤشرات. | بديل مناسب إذا توفرت بيانات اشتراك مناسبة لاحقًا. |
| Financial Modeling Prep | نقطة نهاية تقويم اقتصادي معلنة بوضوح وخطة مجانية موثقة، وتتطلب مفتاح API. | المصدر الأساسي المقترح للتكامل الأولي مع كاش ساعة؛ يحتاج مفتاح المستخدم الآمن. |
| FXStreet | تقويم اقتصادي محمي بالكامل بمصادقة OAuth2. | غير مناسب من دون تسجيل تطبيق ومفاتيح OAuth2. |
| HorizonFX عبر RapidAPI | تقويم اقتصادي عالمي معلن بتحديثات كل خمس دقائق ودعم UTC، مع تجربة مجانية عبر RapidAPI. | غير معتمد لأنه يتطلب إضافة بطاقة أو مفتاح RapidAPI. |
| BLS الرسمي | جدول إصدارات رسمي منشور شهريًا مع تاريخ ووقت وعنوان الإصدار، والأوقات بتوقيت Eastern Time. | مصدر مفتوح معتمد لأحداث العمل والتضخم والأسعار الأميركية. |
| FOMC الرسمي | صفحة الاحتياطي الفيدرالي تنشر اجتماعات FOMC الثمانية المنتظمة ومواعيد البيان والمحاضر. | مصدر مفتوح معتمد لقرارات السياسة النقدية الأميركية. |

لن يُستخدم مفتاح مضمن أو مصدر غير موثق. سيجلب الخادم الجداول الرسمية المتاحة ويعرض بوضوح نطاق التغطية: أحداث أميركية عالية الأثر مدعومة، لا تقويم تجاري شامل لكل الاقتصادات. سيعالج فشل المصدر بإظهار حالة غير متاحة بدل اختلاق بيانات.

## المراجع

[1] [Trading Economics — Economic Calendar API Documentation](https://docs.tradingeconomics.com/economic_calendar/)

[2] [Financial Modeling Prep — Economic Data Releases Calendar API](https://site.financialmodelingprep.com/developer/docs/stable/economics-calendar)

[3] [FXStreet — Economic Calendar API](https://docs.fxstreet.com/api/calendar/)

[4] [HorizonFX — Economic Calendar API](https://economic-calendar.horizonfx.id/)

[5] [U.S. Bureau of Labor Statistics — Release Calendar](https://www.bls.gov/schedule/)

[6] [Federal Reserve — FOMC Meeting Calendars](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)
