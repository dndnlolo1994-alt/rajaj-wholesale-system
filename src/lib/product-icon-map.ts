// أيقونات الأقسام — مسار ملف SVG لكل قسم حسب اسمه
export const CATEGORY_ICONS: Record<string, string> = {
  'شيبس ومقرمشات': '/icons/products/chips.svg',
  'عصائر ومشروبات': '/icons/products/juice-box.svg',
  'مياه': '/icons/products/water-jana-05l.svg',
  'بسكويت وويفر': '/icons/products/biscuit-wataniya.svg',
  'شوكولاتة وحلويات': '/icons/products/choco-galaxy.svg',
  'مواد تموينية': '/icons/products/grocery.svg',
  'معلبات ومواد غذائية': '/icons/products/grocery.svg',
  'مشروبات غازية': '/icons/products/soda-can.svg',
  'منظفات وورقيات': '/icons/products/cleaner.svg',
};

// خريطة أيقونات حقيقية ومحددة بالدقة لجميع منتجات النظام
export const EXACT_PRODUCT_ICONS: Record<string, string> = {
  'شيبس كتشب 30غم': '/icons/products/chips-ketchup.svg',
  'شيبس ملح 30غم': '/icons/products/chips-salt.svg',
  'شيبس حار نار 30غم': '/icons/products/chips-spicy.svg',
  'شيبس جبنة 30غم': '/icons/products/chips-cheese.svg',
  'بوشار جاهز 80غم': '/icons/products/popcorn-senyora.svg',
  'بوشار بالجبنة 80غم': '/icons/products/popcorn-cheese.svg',
  'عصير برتقال 250مل': '/icons/products/juice-suntop-orange.svg',
  'عصير مانجا 250مل': '/icons/products/juice-suntop-mango.svg',
  'عصير توت مشكل 250مل': '/icons/products/juice-suntop-berry.svg',
  'عصير تفاح 250مل': '/icons/products/juice-suntop-apple.svg',
  'عصير عنب 250مل': '/icons/products/juice-rabie-grape.svg',
  'مياه 1.5 لتر': '/icons/products/water-jana-15l.svg',
  'مياه 0.5 لتر': '/icons/products/water-jana-05l.svg',
  'مياه 0.33 لتر': '/icons/products/water-jana-05l.svg',
  'مياه 1.5 لتر أكوافينا': '/icons/products/water-aquafina-15l.svg',
  'مياه 0.5 لتر أكوافينا': '/icons/products/water-aquafina-05l.svg',
  'بسكويت شاي 60غم': '/icons/products/biscuit-wataniya.svg',
  'بسكويت دايجستف 80غم': '/icons/products/biscuit-digestive.svg',
  'ويفر شوكولاتة 40غم': '/icons/products/wafer-alibaba.svg',
  'ويفر فانيلا 40غم': '/icons/products/wafer-vanilla.svg',
  'بسكويت مالح 50غم': '/icons/products/biscuit.svg',
  'شوكولاتة حليب 22غم': '/icons/products/choco-galaxy.svg',
  'شوكولاتة كيت كات 4 أصابع': '/icons/products/choco-kitkat.svg',
  'شوكولاتة سنيكرز 50غم': '/icons/products/choco-snickers.svg',
  'شوكولاتة تويكس 50غم': '/icons/products/choco-twix.svg',
  'حلاوة طحينية 700غم': '/icons/products/halva-aseel.svg',
  'حلاوة بالفستق 350غم': '/icons/products/halva-aseel.svg',
  'علكة مستكة': '/icons/products/chocolate.svg',
  'رز مصري 5كغ': '/icons/products/rice-shallal.svg',
  'رز تايلندي 5كغ': '/icons/products/rice-shallal.svg',
  'سكر ناعم 1كغ': '/icons/products/sugar-ittihad.svg',
  'زيت دوار الشمس 1.8لتر': '/icons/products/oil-afia.svg',
  'زيت زيتون بلدي 1لتر': '/icons/products/oil-olive.svg',
  'معكرونة اسباغيتي 400غم': '/icons/products/spaghetti-durra.svg',
  'معجون طماطم 135غم': '/icons/products/tomato-paste.svg',
  'طحينية سمسم 500غم': '/icons/products/halva-aseel.svg',
  'ملح طعام 700غم': '/icons/products/salt-safi.svg',
  'شاي أحمر 100 ميدالية': '/icons/products/tea-rabie.svg',
  'كولا 330مل': '/icons/products/pepsi-can.svg',
  'كولا دايت 330مل': '/icons/products/pepsi-can.svg',
  'مشروب غازي ليمون 330مل': '/icons/products/7up-can.svg',
  'مشروب غازي برتقال 330مل': '/icons/products/mirinda-orange.svg',
  'مشروب طاقة 250مل': '/icons/products/redbull-energy.svg',
  'مناديل ورقية 550 منديل': '/icons/products/fine-tissues.svg',
  'مناديل رول مطبخ 2 رول': '/icons/products/fine-tissues.svg',
  'سائل غسيل صحون 1لتر': '/icons/products/hygien-dishwash.svg',
  'مسحوق غسيل 1كغ': '/icons/products/ariel-powder.svg',
  'مطهر عام 1لتر': '/icons/products/dettol-cleaner.svg',
};

// ألوان الأقسام — خلفية ناعمة لكل قسم
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  'شيبس ومقرمشات': { bg: '#FEF3C7', text: '#92400E', ring: '#FDE68A' },
  'عصائر ومشروبات': { bg: '#FFEDD5', text: '#9A3412', ring: '#FDBA74' },
  'مياه': { bg: '#DBEAFE', text: '#1E40AF', ring: '#93C5FD' },
  'بسكويت وويفر': { bg: '#FEF9C3', text: '#854D0E', ring: '#FDE68A' },
  'شوكولاتة وحلويات': { bg: '#F3E8FF', text: '#6B21A8', ring: '#D8B4FE' },
  'مواد تموينية': { bg: '#EDE9FE', text: '#5B21B6', ring: '#C4B5FD' },
  'معلبات ومواد غذائية': { bg: '#ECFDF5', text: '#065F46', ring: '#A7F3D0' },
  'مشروبات غازية': { bg: '#FEE2E2', text: '#991B1B', ring: '#FCA5A5' },
  'منظفات وورقيات': { bg: '#D1FAE5', text: '#065F46', ring: '#6EE7B7' },
};

/**
 * قواعد المطابقة الذكية الشاملة — تربط كلمات مفتاحية في اسم المنتج أو الماركة بأيقونة SVG المناسبة
 */
const PRODUCT_ICON_RULES: Array<{ keywords: string[]; icon: string }> = [
  // 1) عصائر ومشروبات
  { keywords: ['تفاح'], icon: '/icons/products/juice-suntop-apple.svg' },
  { keywords: ['برتقال'], icon: '/icons/products/juice-suntop-orange.svg' },
  { keywords: ['مانجا', 'مانجو'], icon: '/icons/products/juice-suntop-mango.svg' },
  { keywords: ['توت', 'فراولة'], icon: '/icons/products/juice-suntop-berry.svg' },
  { keywords: ['عنب'], icon: '/icons/products/juice-rabie-grape.svg' },
  { keywords: ['كوكتيل', 'مشكل', 'فواكه', 'جوافة', 'موز', 'أناناس', 'رمان', 'عصير', 'juice', 'نكتار', 'شراب', 'سن توب'], icon: '/icons/products/juice-box.svg' },

  // 2) مياه
  { keywords: ['أكوافينا', 'aquafina'], icon: '/icons/products/water-aquafina-15l.svg' },
  { keywords: ['330', '0.33', '250', '200', 'صغير'], icon: '/icons/products/water-jana-05l.svg' },
  { keywords: ['1.5', 'كبير', 'لتر'], icon: '/icons/products/water-jana-15l.svg' },
  { keywords: ['مياه', 'ماء', 'ميه', 'water', 'جنى'], icon: '/icons/products/water-jana-05l.svg' },

  // 3) شيبس ومقرمشات
  { keywords: ['حار', 'فلفل', 'شطة', 'نار'], icon: '/icons/products/chips-spicy.svg' },
  { keywords: ['كتشب', 'كشب', 'طماطم'], icon: '/icons/products/chips-ketchup.svg' },
  { keywords: ['ملح', 'سادة', 'خل'], icon: '/icons/products/chips-salt.svg' },
  { keywords: ['بوشار', 'فشار', 'popcorn'], icon: '/icons/products/popcorn-senyora.svg' },
  { keywords: ['شيبس', 'شيبسي', 'مقرمش', 'كرات', 'ذرة', 'chips', 'crisp'], icon: '/icons/products/chips.svg' },

  // 4) بسكويت وويفر
  { keywords: ['فانيلا', 'فانيليا'], icon: '/icons/products/wafer-vanilla.svg' },
  { keywords: ['ويفر', 'wafer', 'gaufrette'], icon: '/icons/products/wafer-alibaba.svg' },
  { keywords: ['دايجستف', 'digestive'], icon: '/icons/products/biscuit-digestive.svg' },
  { keywords: ['بسكويت', 'بسكوت', 'شاي', 'مالح', 'biscuit', 'cookie', 'كعك'], icon: '/icons/products/biscuit-wataniya.svg' },

  // 5) شوكولاتة وحلويات
  { keywords: ['كيت كات', 'kitkat', 'kit kat'], icon: '/icons/products/choco-kitkat.svg' },
  { keywords: ['سنيكرز', 'snickers'], icon: '/icons/products/choco-snickers.svg' },
  { keywords: ['تويكس', 'twix'], icon: '/icons/products/choco-twix.svg' },
  { keywords: ['جالكسي', 'galaxy'], icon: '/icons/products/choco-galaxy.svg' },
  { keywords: ['شوكولاتة', 'شوكولا', 'شوكولاته', 'chocolate', 'كادبوري', 'نستله', 'مارس'], icon: '/icons/products/choco-galaxy.svg' },
  { keywords: ['حلاوة', 'طحينية', 'فستق', 'halva'], icon: '/icons/products/halva-aseel.svg' },
  { keywords: ['علكة', 'مستكة', 'شعراوي', 'gum'], icon: '/icons/products/chocolate.svg' },

  // 6) مواد تموينية ومواد غذائية
  { keywords: ['تونة', 'tuna', 'سردين'], icon: '/icons/products/tuna-alali.svg' },
  { keywords: ['فول', 'foul'], icon: '/icons/products/foul-durra.svg' },
  { keywords: ['حمص', 'hummus'], icon: '/icons/products/hummus-durra.svg' },
  { keywords: ['حليب', 'لبن', 'قشطة', 'زبدة', 'milk'], icon: '/icons/products/milk-baladna.svg' },
  { keywords: ['مربى', 'فراولة', 'jam'], icon: '/icons/products/jam-strawberry.svg' },
  { keywords: ['عسل', 'honey'], icon: '/icons/products/honey-jar.svg' },
  { keywords: ['قهوة', 'بن', 'نسكافيه', 'هيل', 'coffee'], icon: '/icons/products/coffee-cardamom.svg' },
  { keywords: ['تمر', 'رطب', 'dates'], icon: '/icons/products/dates-box.svg' },
  { keywords: ['جبنة', 'جبن', 'cheese'], icon: '/icons/products/cheese-white.svg' },
  { keywords: ['رز', 'أرز', 'rice'], icon: '/icons/products/rice-shallal.svg' },
  { keywords: ['سكر', 'sugar'], icon: '/icons/products/sugar-ittihad.svg' },
  { keywords: ['زيت زيتون', 'زيتون'], icon: '/icons/products/oil-olive.svg' },
  { keywords: ['زيت', 'oil', 'عافية', 'دوار الشمس'], icon: '/icons/products/oil-afia.svg' },
  { keywords: ['معكرونة', 'سباغيتي', 'اسباغيتي', 'مكرونة', 'pasta', 'spaghetti', 'شعرية'], icon: '/icons/products/spaghetti-durra.svg' },
  { keywords: ['طماطم', 'بندورة', 'صلصة', 'معجون'], icon: '/icons/products/tomato-paste.svg' },
  { keywords: ['ملح', 'salt'], icon: '/icons/products/salt-safi.svg' },
  { keywords: ['شاي', 'tea'], icon: '/icons/products/tea-rabie.svg' },

  // 7) مشروبات غازية وطاقة
  { keywords: ['سفن', '7up', 'ليمون'], icon: '/icons/products/7up-can.svg' },
  { keywords: ['ميرندا', 'mirinda'], icon: '/icons/products/mirinda-orange.svg' },
  { keywords: ['كولا', 'بيبسي', 'غازي', 'pepsi', 'cola'], icon: '/icons/products/pepsi-can.svg' },
  { keywords: ['ريد بول', 'طاقة', 'redbull', 'red bull', 'energy'], icon: '/icons/products/redbull-energy.svg' },

  // 8) منظفات وورقيات
  { keywords: ['مناديل', 'منديل', 'tissue', 'فاين'], icon: '/icons/products/fine-tissues.svg' },
  { keywords: ['منظف', 'صابون', 'شامبو', 'معقم', 'كلوركس', 'clean', 'soap', 'ديتول', 'هاي جين', 'أريال'], icon: '/icons/products/cleaner.svg' },
];

/**
 * دالة المطابقة الذكية — تطابق أي اسم منتج أو شركة مع أيقونة SVG حقيقية
 */
export function matchProductIcon(name: string, brand?: string | null): string {
  const normalizedName = name.trim().replace(/[أإآ]/g, 'ا');
  const normalizedBrand = (brand ?? '').trim().replace(/[أإآ]/g, 'ا');

  // 1) مطابقة تامة بالاسم المباشر
  if (EXACT_PRODUCT_ICONS[name.trim()]) {
    return EXACT_PRODUCT_ICONS[name.trim()];
  }

  // 2) مطابقة جزئية في جدول الأصناف التامة
  for (const [exactName, icon] of Object.entries(EXACT_PRODUCT_ICONS)) {
    const cleanExact = exactName.replace(/[أإآ]/g, 'ا');
    if (normalizedName.includes(cleanExact) || cleanExact.includes(normalizedName)) {
      return icon;
    }
  }

  // 3) مطابقة الكلمات المفتاحية الذكية
  const haystack = `${normalizedName} ${normalizedBrand}`.toLowerCase();
  for (const rule of PRODUCT_ICON_RULES) {
    for (const kw of rule.keywords) {
      const cleanKw = kw.replace(/[أإآ]/g, 'ا').toLowerCase();
      if (haystack.includes(cleanKw)) {
        return rule.icon;
      }
    }
  }

  // 4) أيقونة افتراضية عالية الجودة كـ SVG دائماً بدل الدائرة
  return '/icons/products/grocery.svg';
}

export function matchCategoryIcon(categoryName: string): string | null {
  return CATEGORY_ICONS[categoryName] ?? null;
}

export function matchCategoryColor(categoryName: string): { bg: string; text: string; ring: string } | null {
  return CATEGORY_COLORS[categoryName] ?? null;
}
