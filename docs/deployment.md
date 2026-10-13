# تشغيل AMIC على خادم دائم

## المتطلبات

- خادم Linux دائم مع Docker Engine وDocker Compose Plugin.
- قاعدة PostgreSQL على Supabase متاحة للخادم عبر اتصال مشفّر.
- اسم نطاق وطبقة عكسية (Nginx أو Caddy) إذا كان الوصول العام مطلوبًا.

## التشغيل الأولي

```bash
git clone <YOUR_REPOSITORY_URL> amic-platform
cd amic-platform
# انسخ .env.example إلى .env على الخادم وأدخل القيم عبر مدير الأسرار؛ لا ترفع الملف إلى Git.
# أنشئ سر Redis عشوائيًا واحفظه في مدير أسرار الخادم أو في .env بصلاحية مقيدة.
printf 'REDIS_PASSWORD=%s\n' "$(openssl rand -hex 32)" >> .env
docker compose config --quiet
docker compose build
docker compose run --rm amic-app pnpm db:migrate
docker compose up -d
docker compose ps
docker compose logs -f amic-app
```

يحتاج ملف `.env` إلى `APP_PORT` و`DATABASE_URL` و`JWT_SECRET` و`REDIS_PASSWORD` وبيانات OAuth والمتغيرات المعرّفة في إعدادات المشروع (`VITE_APP_ID` و`VITE_OAUTH_PORTAL_URL` ومفاتيح Forge الأمامية والخلفية وبيانات المالك). أنشئ `JWT_SECRET` بقيمة عشوائية قوية ومستقلة عن `REDIS_PASSWORD`. تبني Compose واجهة Vite باستعمال المتغيرات التي تبدأ بـ`VITE_`، ولذلك يجب تعريفها قبل أمر البناء الأول وكل إعادة بناء. استخدم مدير أسرار الخادم لإدارة هذه القيم، ولا تحفظها في المستودع.

`DATABASE_URL` هو رابط PostgreSQL الذي تنسخه من زر **Connect** في لوحة مشروع Supabase، وليس رابط REST أو مفتاح API. استخدم direct connection للخادم الدائم إذا كانت شبكته تدعم IPv6؛ وإذا كانت IPv4 فقط فاختر Session pooler أو فعّل دعم IPv4 للمشروع. عيّن `DATABASE_POOL_MAX=5` ما لم تُظهر مراقبة الاتصالات حاجة إلى قيمة أخرى. يستخدم التطبيق TLS افتراضيًا (`DATABASE_SSL=require`) ويعطّل prepared statements لتوافق أوضاع Supabase pooler؛ لا تضبط `DATABASE_SSL=disable` إلا لقاعدة تطوير محلية.

تعريف PostgreSQL الحالي في `drizzle/schema.ts` وترحيلاته المعتمدة في `drizzle/postgres/`. تبقى ترحيلات MySQL القديمة في جذر `drizzle/` محفوظة ولا تُستخدم بواسطة إعداد PostgreSQL. لتعديل المخطط، شغّل `pnpm db:generate` وراجع SQL الناتج، ثم طبّق الترحيلات باستخدام `pnpm db:migrate` بعد ضبط `DATABASE_URL` الصحيح.

طُبّق baseline الأول مباشرةً على المشروع القائم وسُجّل أيضًا في `drizzle.__drizzle_migrations`؛ لذلك يتخطاه `pnpm db:migrate` هناك ويطبّق الترحيلات الأحدث فقط. في مشروع Supabase فارغ جديد، استخدم `pnpm db:migrate` كالمعتاد.

يُفعّل baseline سياسة RLS على جميع جداول التطبيق الجديدة بلا سياسات عامة؛ لا تضف سياسات إلا عند الحاجة إلى وصول مباشر من عميل Supabase. يحتفظ الخادم فقط ببيانات اتصال PostgreSQL، ولا تضع `DATABASE_URL` أو كلمة مرور قاعدة البيانات ضمن متغيرات `VITE_` أو شيفرة المتصفح.

يشغّل Compose Redis داخل الشبكة الداخلية مع كلمة مرور وملف بيانات دائم، ولا ينشر منفذ Redis على المضيف. يستخدمه التطبيق لتخزين عدادات تحديد المعدل المشتركة بين النسخ. يشترط التطبيق وجود `REDIS_URL` في الإنتاج ويتوقف عن البدء إذا تعذر الاتصال، بدلًا من التحول بصمت إلى عدادات محلية غير مشتركة. في التطوير المحلي يمكن تشغيله دون `REDIS_URL`، وعندها يستخدم مخزن الذاكرة المحلي.

يُضبط `TRUST_PROXY_HOPS` افتراضيًا على `0`. إذا كان التطبيق خلف وكيل عكسي واحد موثوق، اضبطه على `1` فقط بعد منع الوصول المباشر إلى منفذ التطبيق من الإنترنت، واجعل الوكيل يكتب/ينقّي `X-Forwarded-For` بدل قبول قيمة يرسلها العميل. لا تثق بعدد قفزات أكبر من بنية الشبكة الفعلية؛ خطأ الضبط قد يسمح بتزوير عنوان IP وتجاوز المحدد.

يوفر Compose كذلك `amic-app` لتطبيق Node.js و`tradingview-mcp` لموفر تحليل Python. منفذ Python لا يُفتح للمضيف أو للإنترنت؛ التطبيق وحده يتصل به على `http://tradingview-mcp:8000/mcp`.

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

يجب أن تكون خدمتا `tradingview-mcp` و`redis` بحالة `healthy` قبل بدء التطبيق. لا تنشر منفذي `8000` أو `6379` في ملف Compose؛ استخدم طبقة عكسية لحماية التطبيق العام عبر HTTPS، وضع حدًا للطلبات عند الحافة.

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
