# مصادر كتالوج النماذج

تُستدعى قوائم النماذج من الخادم فقط؛ لا يمر مفتاح المزود إلى المتصفح أو إلى السجل. تُعاد للواجهة حقول اختيار آمنة ومحدودة: المعرّف، الاسم الظاهر، والناشر عند توافره.

| المزود | المسار | صيغة الحقول الأساسية | المصدر الرسمي |
|---|---|---|---|
| OpenAI | `GET https://api.openai.com/v1/models` | `data[].id`, `data[].owned_by` | https://developers.openai.com/api/reference/resources/models/methods/list/ |
| Anthropic | `GET https://api.anthropic.com/v1/models?limit=100` | `data[].id`, `data[].display_name` | https://platform.claude.com/docs/en/api/models/list |
| Google Gemini | `GET https://generativelanguage.googleapis.com/v1beta/models?key=…` | `models[].name`, `models[].displayName`, `models[].supportedGenerationMethods` | https://ai.google.dev/api/models |
| OpenRouter | `GET https://openrouter.ai/api/v1/models` | `data[].id`, `data[].name`, `data[].context_length` | https://openrouter.ai/docs/guides/overview/models |
| ZenMux | `GET https://zenmux.ai/api/v1/models` | `data[].id`, `data[].display_name`, `data[].owned_by` | https://zenmux.ai/docs/api/openai/openai-list-models.html |

تُرشَّح نماذج Gemini التي تدعم `generateContent` كي لا يظهر في قائمة مساعد AMIC نموذج لا يصلح للمحادثة النصية. أما ZenMux وOpenRouter فتُحمَّل قائمتهما من واجهة النماذج المعلنة، مع تمرير المفتاح إلى الخادم فقط عند إدخاله للاختبار أو استخدام القيمة المشفرة الموجودة مسبقًا.
