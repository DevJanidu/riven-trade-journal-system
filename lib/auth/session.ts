import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSessionToken, sessionCookieName, sessionMaxAge, verifySessionToken } from "./token";

export async function setSession(userId: string) {
  const store = await cookies();
  store.set(sessionCookieName, await createSessionToken(userId), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionMaxAge });
}

export async function clearSession() {
  const store = await cookies();
  store.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function getSessionUser() {
  const store = await cookies();
  const payload = await verifySessionToken(store.get(sessionCookieName)?.value);
  if (!payload) return null;
  const [user] = await getDb().select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, payload.userId)).limit(1);
  return user ?? null;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireUserId() { return (await requireUser()).id; }
