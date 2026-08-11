// أيقونات الأقسام — مسار ملف SVG لكل قسم حسب اسمه
export const CATEGORY_ICONS: Record<string, string> = {
  'شيبس ومقرمشات': '/icons/products/chips.svg',
  'عصائر ومشروبات': '/icons/products/juice-box.svg',
  'مياه': '/icons/products/water-bottle.svg',
  'بسكويت وويفر': '/icons/products/biscuit.svg',
  'شوكولاتة وحلويات': '/icons/products/chocolate.svg',
  'مواد تموينية': '/icons/products/grocery.svg',
  'مشروبات غازية': '/icons/products/soda-can.svg',
  'منظفات وورقيات': '/icons/products/cleaner.svg',
};

// خريطة أيقونات حقيقية ومحددة بالدقة لجميع منتجات النظام
export const EXACT_PRODUCT_ICONS: Record<string, string> = {
  'شيبس كتشب 30غم': '/icons/products/chips-ketchup.svg',
  'شيبس ملح 30غم': '/icons/products/chips-salt.svg',
  'بوشار جاهز 80غم': '/icons/products/popcorn-senyora.svg',
  'عصير برتقال 250مل': '/icons/products/juice-suntop-orange.svg',
  'عصير مانجا 250مل': '/icons/products/juice-suntop-mango.svg',
  'مياه 1.5 لتر': '/icons/products/water-jana-15l.svg',
  'مياه 0.5 لتر': '/icons/products/water-jana-05l.svg',
  'بسكويت شاي 60غم': '/icons/products/biscuit-wataniya.svg',
  'ويفر شوكولاتة 40غم': '/icons/products/wafer-alibaba.svg',
  'شوكولاتة حليب 22غم': '/icons/products/choco-galaxy.svg',
  'حلاوة طحينية 700غم': '/icons/products/halva-aseel.svg',
  'رز مصري 5كغ': '/icons/products/rice-shallal.svg',
  'سكر ناعم 1كغ': '/icons/products/sugar-ittihad.svg',
  'زيت دوار الشمس 1.8لتر': '/icons/products/oil-afia.svg',
  'معكرونة اسباغيتي 400غم': '/icons/products/spaghetti-durra.svg',
  'كولا 330مل': '/icons/products/pepsi-can.svg',
  'مشروب غازي ليمون 330مل': '/icons/products/7up-can.svg',
  'مناديل ورقية 550 منديل': '/icons/products/fine-tissues.svg',
};

// ألوان الأقسام — خلفية ناعمة لكل قسم
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  'شيبس ومقرمشات': { bg: '#FEF3C7', text: '#92400E', ring: '#FDE68A' },
  'عصائر ومشروبات': { bg: '#FFEDD5', text: '#9A3412', ring: '#FDBA74' },
  'مياه': { bg: '#DBEAFE', text: '#1E40AF', ring: '#93C5FD' },
  'بسكويت وويفر': { bg: '#FEF9C3', text: '#854D0E', ring: '#FDE68A' },
  'شوكولاتة وحلويات': { bg: '#F3E8FF', text: '#6B21A8', ring: '#D8B4FE' },
  'مواد تموينية': { bg: '#EDE9FE', text: '#5B21B6', ring: '#C4B5FD' },
  'مشروبات غازية': { bg: '#FEE2E2', text: '#991B1B', ring: '#FCA5A5' },
  'منظفات وورقيات': { bg: '#D1FAE5', text: '#065F46', ring: '#6EE7B7' },
};

/**
 * قواعد المطابقة الذكية — تربط كلمات مفتاحية في اسم المنتج بملف SVG المناسب.
 */
const PRODUCT_ICON_RULES: Array<{ keywords: string[]; icon: string }> = [
  // شيبس ومقرمشات
  { keywords: ['كتشب', 'كشب'], icon: '/icons/products/chips-ketchup.svg' },
  { keywords: ['ملح', 'سادة'], icon: '/icons/products/chips-salt.svg' },
  { keywords: ['بوشار', 'فشار', 'popcorn'], icon: '/icons/products/popcorn-senyora.svg' },
  { keywords: ['شيبس', 'شيبسي', 'مقرمش', 'chips', 'crisp'], icon: '/icons/products/chips.svg' },
  // عصائر
  { keywords: ['برتقال'], icon: '/icons/products/juice-suntop-orange.svg' },
  { keywords: ['مانجا', 'مانجو'], icon: '/icons/products/juice-suntop-mango.svg' },
  { keywords: ['عصير', 'juice', 'نكتار', 'سن توب'], icon: '/icons/products/juice-box.svg' },
  // مياه
  { keywords: ['1.5', 'كبير'], icon: '/icons/products/water-jana-15l.svg' },
  { keywords: ['0.5', 'صغير'], icon: '/icons/products/water-jana-05l.svg' },
  { keywords: ['مياه', 'ماء', 'water', 'جنى'], icon: '/icons/products/water-jana-15l.svg' },
  // بسكويت
  { keywords: ['ويفر', 'wafer', 'gaufrette'], icon: '/icons/products/wafer-alibaba.svg' },
  { keywords: ['بسكويت', 'بسكوت', 'biscuit', 'cookie'], icon: '/icons/products/biscuit-wataniya.svg' },
  // شوكولاتة
  { keywords: ['حلاوة', 'طحينية', 'halva'], icon: '/icons/products/halva-aseel.svg' },
  { keywords: ['شوكولاتة', 'شوكولا', 'chocolate', 'جالكسي', 'كادبوري', 'كيت كات', 'سنيكرز'], icon: '/icons/products/choco-galaxy.svg' },
  // مواد تموينية
  { keywords: ['رز', 'أرز', 'rice'], icon: '/icons/products/rice-shallal.svg' },
  { keywords: ['سكر', 'sugar'], icon: '/icons/products/sugar-ittihad.svg' },
  { keywords: ['زيت', 'oil', 'عافية'], icon: '/icons/products/oil-afia.svg' },
  { keywords: ['معكرونة', 'سباغيتي', 'اسباغيتي', 'مكرونة', 'pasta', 'spaghetti'], icon: '/icons/products/spaghetti-durra.svg' },
  // مشروبات غازية
  { keywords: ['سفن', '7up', 'ليمون'], icon: '/icons/products/7up-can.svg' },
  { keywords: ['كولا', 'بيبسي', 'غازي', 'pepsi', 'cola'], icon: '/icons/products/pepsi-can.svg' },
  // منظفات
  { keywords: ['مناديل', 'منديل', 'tissue', 'فاين'], icon: '/icons/products/fine-tissues.svg' },
  { keywords: ['منظف', 'صابون', 'شامبو', 'معقم', 'كلوركس', 'clean', 'soap'], icon: '/icons/products/cleaner.svg' },
];

/**
 * يحاول إيجاد أيقونة SVG مطابقة لاسم المنتج بصلابة ودقة فائقة.
 */
export function matchProductIcon(name: string, brand?: string | null): string | null {
  const trimmed = name.trim();
  // 1) مطابقة تامة بالاسم المباشر
  if (EXACT_PRODUCT_ICONS[trimmed]) {
    return EXACT_PRODUCT_ICONS[trimmed];
  }

  // 2) مطابقة جزئية بالاسم المباشر
  for (const [exactName, icon] of Object.entries(EXACT_PRODUCT_ICONS)) {
    if (trimmed.includes(exactName) || exactName.includes(trimmed)) {
      return icon;
    }
  }

  // 3) مطابقة القواعد والكلمات المفتاحية
  const haystack = `${name} ${brand ?? ''}`.toLowerCase();
  for (const rule of PRODUCT_ICON_RULES) {
    for (const kw of rule.keywords) {
      if (haystack.includes(kw.toLowerCase())) {
        return rule.icon;
      }
    }
  }
  return null;
}

export function matchCategoryIcon(categoryName: string): string | null {
  return CATEGORY_ICONS[categoryName] ?? null;
}

export function matchCategoryColor(categoryName: string): { bg: string; text: string; ring: string } | null {
  return CATEGORY_COLORS[categoryName] ?? null;
}
