// أيقونات الأقسام — مسار ملف SVG لكل قسم حسب اسمه
// يُستخدم في شريط الأقسام في POS وصفحة المنتجات
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
 * الترتيب مهم: أول مطابقة تُستخدم.
 */
const PRODUCT_ICON_RULES: Array<{ keywords: string[]; icon: string }> = [
  // شيبس ومقرمشات
  { keywords: ['بوشار', 'فشار', 'popcorn'], icon: '/icons/products/popcorn.svg' },
  { keywords: ['شيبس', 'شيبسي', 'مقرمش', 'chips', 'crisp'], icon: '/icons/products/chips.svg' },
  // عصائر
  { keywords: ['عصير', 'juice', 'نكتار', 'سن توب'], icon: '/icons/products/juice-box.svg' },
  // مياه
  { keywords: ['مياه', 'ماء', 'water', 'مويه'], icon: '/icons/products/water-bottle.svg' },
  // بسكويت
  { keywords: ['ويفر', 'wafer', 'gaufrette'], icon: '/icons/products/wafer.svg' },
  { keywords: ['بسكويت', 'بسكوت', 'biscuit', 'cookie'], icon: '/icons/products/biscuit.svg' },
  // شوكولاتة
  { keywords: ['حلاوة', 'طحينية', 'halva'], icon: '/icons/products/halva.svg' },
  { keywords: ['شوكولاتة', 'شوكولا', 'chocolate', 'جالكسي', 'كادبوري', 'كيت كات', 'سنيكرز'], icon: '/icons/products/chocolate.svg' },
  // مواد تموينية
  { keywords: ['رز', 'أرز', 'rice'], icon: '/icons/products/rice-bag.svg' },
  { keywords: ['سكر', 'sugar'], icon: '/icons/products/sugar.svg' },
  { keywords: ['زيت', 'oil', 'عافية'], icon: '/icons/products/oil-bottle.svg' },
  { keywords: ['معكرونة', 'سباغيتي', 'اسباغيتي', 'مكرونة', 'pasta', 'spaghetti'], icon: '/icons/products/pasta.svg' },
  // مشروبات غازية
  { keywords: ['كولا', 'بيبسي', 'سفن أب', 'سفن اب', 'ميرندا', 'غازي', 'pepsi', 'cola', 'sprite', '7up', 'fanta'], icon: '/icons/products/soda-can.svg' },
  // منظفات
  { keywords: ['مناديل', 'منديل', 'tissue', 'فاين'], icon: '/icons/products/tissue.svg' },
  { keywords: ['منظف', 'صابون', 'شامبو', 'معقم', 'كلوركس', 'clean', 'soap'], icon: '/icons/products/cleaner.svg' },
];

/**
 * يحاول إيجاد أيقونة SVG مطابقة لاسم المنتج.
 * يبحث في الاسم والبراند عن كلمات مفتاحية.
 */
export function matchProductIcon(name: string, brand?: string | null): string | null {
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

/**
 * يحاول إيجاد أيقونة قسم SVG حسب اسم القسم.
 */
export function matchCategoryIcon(categoryName: string): string | null {
  return CATEGORY_ICONS[categoryName] ?? null;
}

/**
 * يحاول إيجاد ألوان القسم حسب اسمه.
 */
export function matchCategoryColor(categoryName: string): { bg: string; text: string; ring: string } | null {
  return CATEGORY_COLORS[categoryName] ?? null;
}
