# تشغيل AMIC على خادم دائم

## المتطلبات

- خادم Linux دائم مع Docker Engine وDocker Compose Plugin.
- قاعدة بيانات MySQL أو TiDB متاحة للخادم عبر TLS عند الحاجة.
- اسم نطاق وطبقة عكسية (Nginx أو Caddy) إذا كان الوصول العام مطلوبًا.

## التشغيل الأولي

```bash
git clone <YOUR_REPOSITORY_URL> amic-platform
cd amic-platform
# أنشئ ملف .env محليًا على الخادم بالقيم الفعلية، ولا ترفعه إلى Git.
docker compose config --quiet
docker compose build
docker compose run --rm amic-app pnpm drizzle-kit migrate
docker compose up -d
docker compose ps
docker compose logs -f amic-app
```

يحتاج ملف `.env` إلى `APP_PORT` و`DATABASE_URL` و`JWT_SECRET` وبيانات OAuth والمتغيرات المعرّفة في إعدادات المشروع (`VITE_APP_ID` و`VITE_OAUTH_PORTAL_URL` ومفاتيح Forge الأمامية والخلفية وبيانات المالك). تبني Compose واجهة Vite باستعمال المتغيرات التي تبدأ بـ`VITE_`، ولذلك يجب تعريفها قبل أمر البناء الأول وكل إعادة بناء. استخدم مدير أسرار الخادم لإدارة هذه القيم، ولا تحفظها في المستودع.

يوفر Compose خدمتين على شبكة داخلية: `amic-app` لتطبيق Node.js، و`tradingview-mcp` لموفر تحليل Python. منفذ Python لا يُفتح للمضيف أو للإنترنت؛ التطبيق وحده يتصل به على `http://tradingview-mcp:8000/mcp`.

## التحديث

```bash
git pull
docker compose up -d --build
docker image prune -f
```

## الفحص الصحي واستكشاف الأخطاء

```bash
docker compose ps
docker compose logs --tail=150 tradingview-mcp
docker compose logs --tail=150 amic-app
```

يجب أن تكون خدمة `tradingview-mcp` بحالة `healthy` قبل بدء التطبيق. لا تنشر المنفذ `8000` في ملف Compose؛ استخدم طبقة عكسية لحماية التطبيق العام عبر HTTPS، وضع حدًا للطلبات عند الحافة.

## تحقق بعد الإطلاق

نفّذ أوامر التحقق التالية من الخادم. لا تسجّل قيم `.env` أو مخرجاتها في ملفات السجل أو في تذاكر الدعم.

```bash
# يجب أن يعرض خدمتي amic-app وtradingview-mcp وحالة healthy للأخيرة.
docker compose ps

# يؤكد أن خادم MCP يعلن أدواته من داخل شبكة Compose فقط.
docker compose exec amic-app node -e "fetch(process.env.MCP_SERVICE_URL).then(r => console.log(r.status)).catch(() => process.exit(1))"

# راقب سجلات الاتصال دون طباعة المتغيرات السرية.
docker compose logs --tail=100 tradingview-mcp amic-app
```
