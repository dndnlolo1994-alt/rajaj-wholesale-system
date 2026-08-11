import { matchProductIcon } from './product-icon-map';

export function productIconSrc({
  name,
  brand,
  imageUrl,
}: {
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
}): string {
  // 1) صورة مخصصة يدوية مرفوعة
  if (imageUrl?.trim()) return imageUrl.trim();

  // 2) مطابقة ذكية لمكتبة SVG الحقيقية لكل منتج
  const matched = matchProductIcon(name, brand);
  if (matched) return matched;

  // 3) الصورة الافتراضية دائماً SVG تموينية حقيقية (بدون أي دوائر نصية إطلاقاً)
  return '/icons/products/grocery.svg';
}
