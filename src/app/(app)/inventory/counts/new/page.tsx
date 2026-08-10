import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { listCategoriesAll } from '@/server/queries/products';
import { PageHeader } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { NewCountClient } from './new-count-client';

export const metadata = { title: 'جرد جديد' };
export const dynamic = 'force-dynamic';

export default async function NewCountPage() {
  await requireProfile(['owner', 'manager', 'warehouse']);
  const categories = await listCategoriesAll();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="جرد جديد"
        description="تُفتح جلسة بلقطة من المخزون الحالي، ثم تُدخل الكميات الفعلية بندًا بندًا"
        actions={
          <Link href="/inventory?tab=counts">
            <Button variant="ghost" size="sm">
              <ArrowRight className="size-4" />
              الجرد
            </Button>
          </Link>
        }
      />
      <NewCountClient categories={categories.filter((c) => c.is_active)} />
    </div>
  );
}
