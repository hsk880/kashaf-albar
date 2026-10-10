export type Species = {
  id: string; nameAr: string; nameEn: string; scientificName: string;
  category: 'plant' | 'mammal' | 'bird' | 'reptile'; region: string; description: string;
  caution?: string;
};

// Curated starter examples for browsing only. This catalogue is NOT the ML model
// and must not be presented as exhaustive or used as proof of photo identification.
export const species: Species[] = [
  { id:'plant-sidr', nameAr:'السدر', nameEn:'Christ’s thorn jujube', scientificName:'Ziziphus spina-christi', category:'plant', region:'ينتشر في مناطق من الجزيرة العربية', description:'شجرة شوكية تتحمل الظروف الجافة نسبيًا، وتُعرف بأوراقها البيضاوية وثمارها.', caution:'لا تعتمد على التطبيق وحده لتحديد صلاحية أي نبات للأكل أو العلاج.' },
  { id:'plant-ghada', nameAr:'الغضا', nameEn:'Haloxylon persicum', scientificName:'Haloxylon persicum', category:'plant', region:'بيئات رملية صحراوية', description:'شجيرة صحراوية متكيفة مع الرمال والظروف الجافة.' },
  { id:'plant-arar', nameAr:'العرعر', nameEn:'Juniper', scientificName:'Juniperus spp.', category:'plant', region:'مرتفعات في جنوب غرب الجزيرة العربية', description:'أشجار أو شجيرات دائمة الخضرة؛ قد يتطلب تحديد النوع فحصًا متخصصًا.' },
  { id:'mammal-ibex', nameAr:'الوعل النوبي', nameEn:'Nubian ibex', scientificName:'Capra nubiana', category:'mammal', region:'مناطق جبلية في أجزاء من الشرق الأوسط', description:'ماعز بري جبلي يتميز بقرون طويلة مقوسة؛ يجب تجنب الاقتراب منه أو إزعاجه.' },
  { id:'mammal-gazelle', nameAr:'الغزال', nameEn:'Gazelle', scientificName:'Gazella spp.', category:'mammal', region:'تختلف حسب النوع', description:'اسم عام لعدة أنواع متقاربة؛ لا يمكن تحديد النوع من الاسم العام وحده.' },
  { id:'bird-falcon', nameAr:'الصقور', nameEn:'Falcons', scientificName:'Falco spp.', category:'bird', region:'أنواع متعددة في السعودية', description:'مجموعة من الطيور الجارحة؛ يلزم تحديد النوع اعتمادًا على سمات واضحة.' },
  { id:'bird-oubara', nameAr:'الحبارى', nameEn:'Houbara bustard', scientificName:'Chlamydotis macqueenii', category:'bird', region:'مناطق صحراوية وشبه صحراوية', description:'طائر يعيش في البيئات المفتوحة؛ تختلف حالة وجوده باختلاف المنطقة والموسم.' },
  { id:'reptile-spiny', nameAr:'السحالي الصحراوية', nameEn:'Desert lizards', scientificName:'عدة أجناس وأنواع', category:'reptile', region:'بيئات صحراوية متعددة', description:'مجموعة واسعة من الأنواع؛ لا تلمس الزواحف البرية ولا تقترب من الأنواع غير المعروفة.', caution:'لا تلمس أو تمسك أي زاحف غير معروف.' }
];
