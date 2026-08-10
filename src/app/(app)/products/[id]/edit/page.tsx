import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canSeeProfit } from '@/lib/perms';
import { getProductFull, listCategoriesAll } from '@/server/queries/products';
import { PageHeader } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { ProductForm } from '../../product-form';

export const metadata = { title: 'تعديل صنف' };
export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile(['owner', 'manager', 'warehouse']);
  const { id } = await params;

  const [product, categories] = await Promise.all([getProductFull(id), listCategoriesAll()]);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`تعديل: ${product.name}`}
        description="تعديل البيانات الأساسية والأسعار — المخزون يُعدَّل من صفحة الصنف"
        actions={
          <Link href={`/products/${product.id}`}>
            <Button variant="ghost" size="sm">
              <ArrowRight className="size-4" />
              صفحة الصنف
            </Button>
          </Link>
        }
      />
      <ProductForm categories={categories} product={product} canSeeProfit={canSeeProfit(profile.role)} />
    </div>
  );
}
