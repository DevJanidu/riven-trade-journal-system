import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { setupTypes, trades } from "@/lib/db/schema";

export async function listSetupTypes() { return getDb().select().from(setupTypes).orderBy(asc(setupTypes.name)); }
export async function getSetupType(id: string) { const [row] = await getDb().select().from(setupTypes).where(eq(setupTypes.id, id)).limit(1); return row ?? null; }
export async function createSetupType(name: string, rules: string[], avoidRules: string[]) { const [row] = await getDb().insert(setupTypes).values({ name, rules, avoidRules }).returning(); return row; }
export async function updateSetupType(id: string, name: string, rules: string[], avoidRules: string[]) { const [row] = await getDb().update(setupTypes).set({ name, rules, avoidRules, updatedAt: new Date() }).where(eq(setupTypes.id, id)).returning(); return row ?? null; }
export async function deleteSetupType(id: string) {
  const setup = await getSetupType(id);
  if (!setup) return { deleted: false, inUse: false };
  const [usage] = await getDb().select({ value: count() }).from(trades).where(eq(trades.setup, setup.name));
  if (Number(usage.value) > 0) return { deleted: false, inUse: true };
  await getDb().delete(setupTypes).where(eq(setupTypes.id, id));
  return { deleted: true, inUse: false };
}
