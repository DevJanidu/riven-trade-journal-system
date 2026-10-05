"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { passwordResetTokens, setupTypes, tradeDrafts, trades, users } from "@/lib/db/schema";
import { setups } from "@/types/trade";
import { clearSession, setSession } from "./session";
import { hashPassword, verifyPassword } from "./password";

export type AuthState = { error?: string; success?: string; resetUrl?: string };

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128);

function value(formData: FormData, key: string) { return String(formData.get(key) ?? ""); }
function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password") }).safeParse({ email: value(formData, "email"), password: value(formData, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [user] = await getDb().select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user || !await verifyPassword(parsed.data.password, user.passwordHash)) return { error: "Email or password is incorrect" };
  await setSession(user.id);
  redirect("/dashboard");
}

export async function registerAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ name: z.string().trim().min(2, "Enter your name").max(80), email: emailSchema, password: passwordSchema, confirmPassword: z.string() }).safeParse({ name: value(formData, "name"), email: value(formData, "email"), password: value(formData, "password"), confirmPassword: value(formData, "confirmPassword") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.password !== parsed.data.confirmPassword) return { error: "Passwords do not match" };
  const [existing] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing) return { error: "An account with this email already exists" };
  try {
    const [user] = await getDb().insert(users).values({ name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password) }).returning({ id: users.id });
    await Promise.all([
      getDb().update(trades).set({ userId: user.id }).where(isNull(trades.userId)),
      getDb().update(tradeDrafts).set({ userId: user.id }).where(isNull(tradeDrafts.userId)),
      getDb().update(setupTypes).set({ userId: user.id }).where(isNull(setupTypes.userId)),
    ]);
    await Promise.all([
      getDb().execute(sql`ALTER TABLE "trades" ALTER COLUMN "user_id" SET NOT NULL`),
      getDb().execute(sql`ALTER TABLE "trade_drafts" ALTER COLUMN "user_id" SET NOT NULL`),
      getDb().execute(sql`ALTER TABLE "setup_types" ALTER COLUMN "user_id" SET NOT NULL`),
    ]);
    await getDb().insert(setupTypes).values(setups.map(name => ({ name, userId: user.id, rules: [], avoidRules: [] }))).onConflictDoNothing();
    await setSession(user.id);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) return { error: "An account with this email already exists" };
    throw error;
  }
  redirect("/dashboard");
}

async function sendResetEmail(email: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: email, subject: "Reset your My Journal password", html: `<p>Use the link below to reset your password. It expires in one hour.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>` }) });
  if (!response.ok) console.error("Unable to send password reset email", await response.text());
  return response.ok;
}

export async function forgotPasswordAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse(value(formData, "email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [user] = await getDb().select({ id: users.id, email: users.email }).from(users).where(eq(users.email, parsed.data)).limit(1);
  let resetUrl: string | undefined;
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await getDb().insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    const origin = process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
    resetUrl = `${origin}/reset-password?token=${token}`;
    if (await sendResetEmail(user.email, resetUrl)) resetUrl = undefined;
  }
  return { success: "If an account exists for that email, a reset link has been created.", ...(process.env.NODE_ENV !== "production" && resetUrl ? { resetUrl } : {}) };
}

export async function resetPasswordAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ token: z.string().min(20, "Reset link is invalid"), password: passwordSchema, confirmPassword: z.string() }).safeParse({ token: value(formData, "token"), password: value(formData, "password"), confirmPassword: value(formData, "confirmPassword") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.password !== parsed.data.confirmPassword) return { error: "Passwords do not match" };
  const [reset] = await getDb().select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, hashToken(parsed.data.token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date()))).limit(1);
  if (!reset) return { error: "This reset link is invalid or has expired" };
  await getDb().update(users).set({ passwordHash: await hashPassword(parsed.data.password), updatedAt: new Date() }).where(eq(users.id, reset.userId));
  await getDb().update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, reset.id));
  await setSession(reset.userId);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
