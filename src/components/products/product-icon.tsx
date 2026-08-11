/* eslint-disable @next/next/no-img-element */
import { productIconSrc } from '@/lib/product-visuals';

const sizes = {
  sm: 'size-9 rounded-xl',
  md: 'size-11 rounded-2xl',
  lg: 'size-14 rounded-2xl',
} as const;

export function ProductIcon({
  name,
  brand,
  imageUrl,
  size = 'md',
  className = '',
}: {
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const src = productIconSrc({ name, brand, imageUrl });
  const isSvgFile = src.startsWith('/icons/');

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-black/5 bg-white p-1 ${sizes[size]} ${className}`}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.currentTarget.src = '/icons/products/grocery.svg';
        }}
        className={isSvgFile ? 'h-full w-full object-contain' : 'h-full w-full object-cover'}
      />
    </span>
  );
}
