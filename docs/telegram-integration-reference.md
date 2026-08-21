# مرجع تكامل تيليغرام للتنبيهات

المصدر الرسمي: [Telegram Bot API](https://core.telegram.org/bots/api).

توثق واجهة Telegram Bot API أن الاستدعاءات تتم عبر HTTPS بالصيغة `https://api.telegram.org/bot<token>/METHOD_NAME`، وأنها تدعم JSON في طلبات POST وتعيد حقل `ok` لتأكيد نجاح العملية. سيستخدم التكامل استدعاء الرسائل النصية من الخادم فقط، مع حفظ رمز البوت في متغير بيئي سري وعدم إرساله إلى المتصفح.
