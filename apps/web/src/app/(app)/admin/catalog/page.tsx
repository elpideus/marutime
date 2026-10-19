import { getAllDevices, getAllServices } from '@marutime/core';
import { getDb } from '@marutime/db';
import { CatalogEditor } from '@/components/admin/catalog-editor';

export default async function AdminCatalogPage() {
  const db = getDb();
  const [devices, services] = await Promise.all([getAllDevices(db), getAllServices(db)]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CatalogEditor kind="device" items={devices} />
      <CatalogEditor kind="service" items={services} />
    </div>
  );
}
