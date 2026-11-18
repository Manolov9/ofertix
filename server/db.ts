import { eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { catalogBrochures, catalogOffers, catalogStores, catalogSync, InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import type { Brochure, Offer, Store, SyncState } from './catalog';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

const parsePageUrls = (value: string) => { try { return JSON.parse(value) as string[]; } catch { return []; } };

export async function loadCatalogSnapshot() {
  const db = await getDb();
  if (!db) return null;
  const [syncRows, storeRows, brochureRows] = await Promise.all([
    db.select().from(catalogSync).where(eq(catalogSync.id, 1)).limit(1),
    db.select().from(catalogStores),
    db.select().from(catalogBrochures),
  ]);
  const sync = syncRows[0];
  if (!sync?.activeRunId) return { stores: storeRows.map(toStore), brochures: brochureRows.map(toBrochure), offers: [], sync: sync ? toSync(sync) : undefined };
  const offerRows = await db.select().from(catalogOffers).where(eq(catalogOffers.runId, sync.activeRunId));
  return { stores: storeRows.map(toStore), brochures: brochureRows.map(toBrochure), offers: offerRows.map(toOffer), sync: toSync(sync) };
}

const toStore = (row: typeof catalogStores.$inferSelect): Store => ({ order: row.displayOrder, id: row.id, name: row.name, url: row.url, logo: row.logo, active: Boolean(row.active) });
const toBrochure = (row: typeof catalogBrochures.$inferSelect): Brochure => ({ id: row.id, storeId: row.storeId, title: row.title, url: row.url, period: row.period, rawDate: row.rawDate, thumbnailUrl: row.thumbnailUrl || undefined, pageUrls: parsePageUrls(row.pageUrls) });
const toOffer = (row: typeof catalogOffers.$inferSelect): Offer => ({ id: row.id, product: row.product, searchText: row.searchText, storeId: row.storeId, storeName: row.storeName, price: row.price ?? Number.POSITIVE_INFINITY, currency: row.currency === "BGN" || row.currency === "EUR" ? row.currency : undefined, priceLabel: row.priceLabel, unit: row.unit, period: row.period, validLabel: row.validLabel, brochureUrl: row.brochureUrl, pageUrl: row.pageUrl, source: row.source, imageUrl: row.imageUrl || undefined });
const toSync = (row: typeof catalogSync.$inferSelect): SyncState => ({ status: row.status, stage: row.stage, startedAt: row.startedAt?.toISOString(), finishedAt: row.finishedAt?.toISOString(), storesProcessed: row.storesProcessed, brochuresProcessed: row.brochuresProcessed, offersProcessed: row.offersProcessed, message: row.message });

export async function persistCatalogMetadata(stores: Store[], brochures: Brochure[]) {
  const db = await getDb();
  if (!db) return;
  for (const store of stores) await db.insert(catalogStores).values({ id: store.id, displayOrder: store.order, name: store.name, url: store.url, logo: store.logo, active: store.active ? 1 : 0 }).onDuplicateKeyUpdate({ set: { displayOrder: store.order, name: store.name, url: store.url, logo: store.logo, active: store.active ? 1 : 0 } });
  for (const brochure of brochures) await db.insert(catalogBrochures).values({ id: brochure.id, storeId: brochure.storeId, title: brochure.title, url: brochure.url, period: brochure.period, rawDate: brochure.rawDate, thumbnailUrl: brochure.thumbnailUrl ?? null, pageUrls: JSON.stringify(brochure.pageUrls) }).onDuplicateKeyUpdate({ set: { storeId: brochure.storeId, title: brochure.title, url: brochure.url, period: brochure.period, rawDate: brochure.rawDate, thumbnailUrl: brochure.thumbnailUrl ?? null, pageUrls: JSON.stringify(brochure.pageUrls) } });
}

export async function persistSyncState(state: SyncState, activeRunId?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(catalogSync).values({ id: 1, activeRunId: activeRunId ?? null, status: state.status, stage: state.stage, startedAt: state.startedAt ? new Date(state.startedAt) : null, finishedAt: state.finishedAt ? new Date(state.finishedAt) : null, storesProcessed: state.storesProcessed, brochuresProcessed: state.brochuresProcessed, offersProcessed: state.offersProcessed, message: state.message }).onDuplicateKeyUpdate({ set: { ...(activeRunId === undefined ? {} : { activeRunId }), status: state.status, stage: state.stage, startedAt: state.startedAt ? new Date(state.startedAt) : null, finishedAt: state.finishedAt ? new Date(state.finishedAt) : null, storesProcessed: state.storesProcessed, brochuresProcessed: state.brochuresProcessed, offersProcessed: state.offersProcessed, message: state.message } });
}

export async function appendCatalogOffers(runId: string, offers: Offer[]) {
  const db = await getDb();
  if (!db || !offers.length) return;
  const values = offers.map(offer => ({ id: `${runId}:${offer.id}`.slice(0, 180), runId, product: offer.product, searchText: offer.searchText, storeId: offer.storeId, storeName: offer.storeName, price: Number.isFinite(offer.price) ? offer.price : null, currency: offer.currency ?? null, priceLabel: offer.priceLabel, unit: offer.unit, period: offer.period, validLabel: offer.validLabel, brochureUrl: offer.brochureUrl, pageUrl: offer.pageUrl, source: offer.source, imageUrl: offer.imageUrl ?? null }));
  await db.insert(catalogOffers).values(values);
}

export async function activateCatalogRun(runId: string, state: SyncState) {
  await persistSyncState(state, runId);
  const db = await getDb();
  if (db) await db.delete(catalogOffers).where(ne(catalogOffers.runId, runId));
}
