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
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-primary-50 ring-1 ring-black/5 ${sizes[size]} ${className}`}>
      <img
        src={productIconSrc({ name, brand, imageUrl })}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </span>
  );
}
