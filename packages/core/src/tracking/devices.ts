import { asc, devices, eq, services, type DbExecutor, type Device, type Service } from '@marutime/db';

export async function getActiveDevices(db: DbExecutor): Promise<Device[]> {
  return db.select().from(devices).where(eq(devices.isActive, true)).orderBy(asc(devices.sortOrder), asc(devices.name));
}

export async function getActiveServices(db: DbExecutor): Promise<Service[]> {
  return db.select().from(services).where(eq(services.isActive, true)).orderBy(asc(services.sortOrder), asc(services.name));
}

export async function getAllDevices(db: DbExecutor): Promise<Device[]> {
  return db.select().from(devices).orderBy(asc(devices.sortOrder), asc(devices.name));
}

export async function getAllServices(db: DbExecutor): Promise<Service[]> {
  return db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));
}
