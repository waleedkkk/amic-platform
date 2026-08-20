# إصلاح NDJSON في decodeResult

المشكلة: خوارزمية depth الحالية لا تُشغّل داخل strings وescaped quotes، فتكسر الكائن عند أول "}" (نهاية indicators) بدل نهايته الفعلية.

الحل: إضافة متغير inString و escaped عند المرور على الأحرف.
