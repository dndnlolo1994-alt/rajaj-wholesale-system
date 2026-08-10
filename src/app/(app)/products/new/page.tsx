import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canSeeProfit } from '@/lib/perms';
import { listCategoriesAll } from '@/server/queries/products';
import { PageHeader } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { ProductForm } from '../product-form';

export const metadata = { title: 'صنف جديد' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string }>;
}) {
  const profile = await requireProfile(['owner', 'manager', 'warehouse']);
  const sp = await searchParams;
  const categories = await listCategoriesAll();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="صنف جديد"
        description={sp.barcode ? `باركود ممسوح: ${sp.barcode}` : 'أدخل بيانات الصنف وأسعاره'}
        actions={
          <Link href="/products">
            <Button variant="ghost" size="sm">
              <ArrowRight className="size-4" />
              الأصناف
            </Button>
          </Link>
        }
      />
      <ProductForm
        categories={categories}
        initialBarcode={sp.barcode}
        canSeeProfit={canSeeProfit(profile.role)}
      />
    </div>
  );
}
