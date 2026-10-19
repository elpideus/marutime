import { asc, devices, eq, services, type DbExecutor, type Device, type Service } from '@marutime/db';
import { cached, invalidateCache } from '../cache';

// The catalog changes only when an admin edits it; every page needs it.
const CATALOG_TTL = { ttl: 5 * 60, staleTtl: 60 * 60 };

export async function getActiveDevices(db: DbExecutor): Promise<Device[]> {
  return cached('catalog:devices', CATALOG_TTL, () => db.select().from(devices).where(eq(devices.isActive, true)).orderBy(asc(devices.sortOrder), asc(devices.name)));
}

export async function getActiveServices(db: DbExecutor): Promise<Service[]> {
  return cached('catalog:services', CATALOG_TTL, () => db.select().from(services).where(eq(services.isActive, true)).orderBy(asc(services.sortOrder), asc(services.name)));
}

export async function invalidateCatalogCache(): Promise<void> {
  await invalidateCache('catalog:*');
}

export async function getAllDevices(db: DbExecutor): Promise<Device[]> {
  return db.select().from(devices).orderBy(asc(devices.sortOrder), asc(devices.name));
}

export async function getAllServices(db: DbExecutor): Promise<Service[]> {
  return db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));
}
