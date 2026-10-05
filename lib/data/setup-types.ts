import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { setupTypes, trades } from "@/lib/db/schema";

export async function listSetupTypes() { const userId = await requireUserId(); return getDb().select().from(setupTypes).where(eq(setupTypes.userId, userId)).orderBy(asc(setupTypes.name)); }
export async function getSetupType(id: string) { const userId = await requireUserId(); const [row] = await getDb().select().from(setupTypes).where(and(eq(setupTypes.id, id), eq(setupTypes.userId, userId))).limit(1); return row ?? null; }
export async function createSetupType(name: string, rules: string[], avoidRules: string[]) { const userId = await requireUserId(); const [row] = await getDb().insert(setupTypes).values({ name, rules, avoidRules, userId }).returning(); return row; }
export async function updateSetupType(id: string, name: string, rules: string[], avoidRules: string[]) { const userId = await requireUserId(); const [row] = await getDb().update(setupTypes).set({ name, rules, avoidRules, updatedAt: new Date() }).where(and(eq(setupTypes.id, id), eq(setupTypes.userId, userId))).returning(); return row ?? null; }
export async function deleteSetupType(id: string) {
  const userId = await requireUserId();
  const setup = await getSetupType(id);
  if (!setup) return { deleted: false, inUse: false };
  const [usage] = await getDb().select({ value: count() }).from(trades).where(and(eq(trades.userId, userId), eq(trades.setup, setup.name)));
  if (Number(usage.value) > 0) return { deleted: false, inUse: true };
  await getDb().delete(setupTypes).where(and(eq(setupTypes.id, id), eq(setupTypes.userId, userId)));
  return { deleted: true, inUse: false };
}
