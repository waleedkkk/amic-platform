# ملاحظات توافق مزودي الذكاء الاصطناعي

## OpenRouter

- العنوان الأساسي لواجهة المحادثة المتوافقة مع OpenAI هو `https://openrouter.ai/api/v1`.
- تستخدم الطلبات ترويسة `Authorization: Bearer <API_KEY>`، وتدعم `POST /chat/completions`.
- يتطلب النموذج عادة اسمًا مؤهلًا ببادئة الناشر مثل `openai/gpt-5.2`.
- تستخدم المنصة `GET /key` للتحقق من المفتاح دون تنفيذ توليد أو تكلفة، بينما يحتفظ المدير باسم النموذج المؤهل لاستخدامه عند التحليل.
- المصدر: https://openrouter.ai/docs/api_reference/overview

## ZenMux.ai

- العنوان الأساسي لبروتوكول OpenAI المتوافق هو `https://zenmux.ai/api/v1`.
- يدعم Chat Completions عبر عميل OpenAI بعد تغيير `base_url` و`api_key`.
- يستخدم النموذج عادة صيغة `provider/model-name` مثل `google/gemini-3.1-pro-preview`.
- ستستخدم المنصة ترويسة Bearer، ومسار النماذج المتوافق لاختبار المفتاح دون إرسال طلب توليد مدفوع عند توفره.
- المصدر: https://zenmux.ai/docs/guide/quickstart.html

## قرار التصميم

تُعامل OpenRouter وZenMux كموفري بوابة متوافقين مع OpenAI. ستستعمل طبقة مشتركة عنوانًا أساسيًا خاصًا بكل بوابة، وتطبق التشفير و`keyHint` واختبار الاتصال ورسائل الخطأ الآمنة نفسها، من دون إدراج المفتاح في عنوان URL أو في السجلات أو في استجابة الواجهة.
