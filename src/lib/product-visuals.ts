import { matchProductIcon } from './product-icon-map';

const PALETTE = [
  ['#064e3b', '#34d399'],
  ['#7c2d12', '#fdba74'],
  ['#1e3a8a', '#93c5fd'],
  ['#701a75', '#f0abfc'],
  ['#713f12', '#fde68a'],
  ['#7f1d1d', '#fca5a5'],
  ['#0f766e', '#99f6e4'],
  ['#4338ca', '#c4b5fd'],
] as const;

function hash(input: string): number {
  let value = 0;
  for (const char of input) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

function initials(input: string): string {
  const words = input
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const chars = words.length >= 2
    ? [Array.from(words[0])[0], Array.from(words[1])[0]]
    : Array.from(words[0] ?? input).slice(0, 2);
  return chars.join('').trim() || 'ص';
}

export function productIconSrc({
  name,
  brand,
  imageUrl,
}: {
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
}): string {
  // 1) صورة مخصصة يدوية
  if (imageUrl?.trim()) return imageUrl.trim();

  // 2) مطابقة ذكية — أيقونة SVG حسب اسم المنتج
  const matched = matchProductIcon(name, brand);
  if (matched) return matched;

  // 3) fallback: الحروف الأولى مع تدرج لوني
  const label = initials(brand || name);
  const seed = brand || name;
  const [bg, fg] = PALETTE[hash(seed) % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${seed}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="${fg}"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g)"/><circle cx="49" cy="15" r="10" fill="rgba(255,255,255,.24)"/><path d="M14 45c8-13 25-15 36-4" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="5" stroke-linecap="round"/><text x="32" y="37" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="20" font-weight="800" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
