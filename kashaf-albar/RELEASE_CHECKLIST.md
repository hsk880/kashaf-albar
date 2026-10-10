# قائمة فحص إصدار كشّاف البر

## ما تم دمجه في هذه النسخة
- وحدة iOS أصلية تستخدم Apple Vision `VNClassifyImageRequest` لتصنيف الصور محليًا دون رفعها إلى الإنترنت.
- واجهة تعرض أعلى التصنيفات ودرجات الثقة، مع تنبيه أن النتائج عامة وليست تحديدًا علميًا للنوع.
- لا يتطلب التصنيف المحلي مفتاح API ولا يرسل الصور إلى خادم.

## ما لا يزال مطلوبًا قبل النشر العام
- [ ] ربط المشروع بحساب EAS واستبدال `REPLACE_WITH_YOUR_EAS_PROJECT_ID` بمعرّف مشروع فعلي.
- [ ] تثبيت الاعتماديات وتشغيل `npm run typecheck` و`npx expo-doctor`.
- [ ] إنشاء iOS Development Build عبر EAS لاختبار الوحدة الأصلية؛ لن تعمل داخل Expo Go العادي.
- [ ] اختبار صور حقيقية على أجهزة iPhone متعددة، مع وبدون إنترنت.
- [ ] إضافة محرك Android محلي إذا كان دعم Android مطلوبًا؛ المحرك الحالي iOS فقط.
- [ ] اختيار ودمج نموذج متخصص مرخص للنباتات والحيوانات البرية، مع بيانات labels موثوقة ومجموعة اختبار مستقلة. Apple Vision الحالي يصنف الصور تصنيفًا عامًا ولا يضمن النوع العلمي.
- [ ] بناء نظام تنزيل حزم حقيقي للنماذج والبيانات مع التحقق من checksum/signature، الاستئناف والتراجع والتحديث الآمن.
- [ ] فحص الاعتماديات والثغرات المعروفة واختبار حالات فشل الأذونات والملفات التالفة والمساحة غير الكافية.
- [ ] استكمال سياسة الخصوصية، وبيانات المتجر، والأيقونات ولقطات الشاشة.

## ملاحظة سلامة
لا تعتمد على تصنيف الصورة لاتخاذ قرار بشأن أكل نبات أو استخدامه طبيًا أو الاقتراب من حيوان خطير. أظهر التطبيق تحذيرًا واضحًا عند كل نتيجة عامة.


## ML model validation (required before release)
- [ ] Install the app with an iOS native build (not Expo Go).
- [ ] Download Iris 9 plant model and verify checksum; test airplane mode after download.
- [ ] Validate image preprocessing against the model card (two-stage resize / EXIF orientation still needs production parity testing).
- [ ] Evaluate Saudi wild-plant test set; do not claim species-level accuracy without local benchmark.
- [ ] Animal specialist models are NOT yet integrated; do not market animal species identification as specialist-grade.
- [ ] Review model CC BY 4.0 attribution and app-store disclosures.
