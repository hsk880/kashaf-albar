export type Pack = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  size: string;
  countLabel: string;
  speciesIds: string[];
  available: boolean;
};

/** Catalogue packs. Plant, animal, and bird packs download real Core ML model packages on iOS. */
export const initialPacks: Pack[] = [
  { id: 'sa-plants', title: 'نباتات السعودية', subtitle: 'أشجار ونباتات وأزهار برية مختارة', icon: '🌿', size: 'نموذج Core ML ينزّل عند الطلب', countLabel: '1081 فئة نباتية', speciesIds: ['plant-sidr','plant-ghada','plant-arar'], available: true },
  { id: 'sa-mammals', title: 'الحيوانات — تصنيف عام', subtitle: 'تصنيف عام للحيوانات وليس تحديدًا للنوع العلمي', icon: '🐾', size: 'نموذج تصنيف عام ينزّل عند الطلب', countLabel: '8 فئات حيوانية عامة', speciesIds: ['mammal-ibex','mammal-gazelle'], available: true },
  { id: 'sa-birds', title: 'الطيور', subtitle: 'نموذج تصنيف عام للطيور', icon: '🦅', size: 'نموذج Core ML ينزّل عند الطلب', countLabel: '965 فئة طيور', speciesIds: ['bird-falcon','bird-oubara'], available: true },
  { id: 'sa-reptiles', title: 'الزواحف', subtitle: 'معلومات عامة عن الزواحف', icon: '🦎', size: 'بيانات نصية صغيرة', countLabel: 'سجل تجريبي واحد', speciesIds: ['reptile-spiny'], available: true },
  { id: 'sa-insects', title: 'الحشرات', subtitle: 'حزمة قيد الإعداد', icon: '🦋', size: 'غير متاحة بعد', countLabel: 'قيد التجهيز', speciesIds: [], available: false },
  { id: 'world', title: 'موسوعة العالم', subtitle: 'حزم عالمية مستقبلية', icon: '🌍', size: 'غير متاحة بعد', countLabel: 'قيد التجهيز', speciesIds: [], available: false }
];
