"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { setupTypes, users } from "@/lib/db/schema";
import { setups } from "@/types/trade";
import { clearSession, setSession } from "./session";
import { hashPassword, verifyPassword } from "./password";
import { completeVerifiedPasswordReset, completeRegistration, requestChallenge, verifyPasswordResetCode } from "./challenges";
import { ownerEmail } from "./email";
import { otpLifetimeMs } from "./otp";

export type AuthState = { error?: string; success?: string; challengeId?: string; expiresAt?: number; email?: string; verified?: boolean };
const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128);
const challengeSchema = z.object({ challengeId: z.uuid("Request a new code"), code: z.string().regex(/^\d{6}$/, "Enter the six-digit code") });
function value(formData: FormData, key: string) { return String(formData.get(key) ?? ""); }
function challengeError(state: AuthState, error: string): AuthState {
  return { challengeId: state.challengeId, expiresAt: state.expiresAt, email: state.email, verified: state.verified, error };
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password") }).safeParse({ email: value(formData, "email"), password: value(formData, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [user] = await getDb().select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user || !await verifyPassword(parsed.data.password, user.passwordHash)) return { error: "Email or password is incorrect" };
  await setSession(user.id);
  redirect("/dashboard");
}
export async function requestRegistrationAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ name: z.string().trim().min(2, "Enter your name").max(80), email: emailSchema, password: passwordSchema, confirmPassword: z.string() }).safeParse({ name: value(formData, "name"), email: value(formData, "email"), password: value(formData, "password"), confirmPassword: value(formData, "confirmPassword") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.password !== parsed.data.confirmPassword) return { error: "Passwords do not match" };
  const [existing] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing) return { error: "An account with this email already exists" };
  try {
    const challenge = await requestChallenge(parsed.data.email, "registration", ownerEmail(), { name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) });
    return { ...challenge, success: "An approval code was sent to the app owner. Ask the owner for the code and enter it within five minutes." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to request a code. Try again later." }; }
}
export async function registerAction(state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = challengeSchema.safeParse({ challengeId: value(formData, "challengeId"), code: value(formData, "code") });
  if (!parsed.success) return challengeError(state, parsed.error.issues[0]?.message || "Request a new code");
  let userId: string | undefined;
  try { userId = await completeRegistration(parsed.data.challengeId, parsed.data.code); }
  catch (error) {
    if (String(error).toLowerCase().includes("unique")) return challengeError(state, "An account with this email already exists");
    return challengeError(state, "Unable to create the account. Please try again later.");
  }
  if (!userId) return challengeError(state, "Code is incorrect, expired, already used, or has reached five attempts. Request a new code if needed.");
  await getDb().insert(setupTypes).values(setups.map(name => ({ name, userId: userId!, rules: [], avoidRules: [] }))).onConflictDoNothing();
  await setSession(userId);
  redirect("/dashboard");
}
export async function forgotPasswordAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse(value(formData, "email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [user] = await getDb().select({ id: users.id, email: users.email }).from(users).where(eq(users.email, parsed.data)).limit(1);
  const success = "If an account exists for this email, a reset code has been sent. Enter it within five minutes.";
  if (!user) return { success, challengeId: randomUUID(), expiresAt: Date.now() + otpLifetimeMs, email: parsed.data };
  try { return { ...await requestChallenge(user.email, "password-reset", user.email, { userId: user.id }), success }; }
  catch { return { error: "Unable to request a code. Wait 60 seconds and try again. If this continues, contact the app owner." }; }
}
export async function resetPasswordAction(state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ challengeId: z.uuid("Your reset session is invalid"), password: passwordSchema, confirmPassword: z.string() }).safeParse({ challengeId: value(formData, "challengeId"), password: value(formData, "password"), confirmPassword: value(formData, "confirmPassword") });
  if (!parsed.success) return challengeError(state, parsed.error.issues[0]?.message || "Request a new code");
  if (parsed.data.password !== parsed.data.confirmPassword) return challengeError(state, "Passwords do not match");
  let userId: string | undefined;
  try { userId = await completeVerifiedPasswordReset(parsed.data.challengeId, await hashPassword(parsed.data.password)); }
  catch { return challengeError(state, "Unable to reset the password. Please try again later."); }
  if (!userId) return challengeError(state, "Code is incorrect, expired, already used, or has reached five attempts. Request a new code if needed.");
  await clearSession();
  redirect("/login?reset=success");
}
export async function verifyResetCodeAction(state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = challengeSchema.safeParse({ challengeId: value(formData, "challengeId"), code: value(formData, "code") });
  if (!parsed.success) return challengeError(state, parsed.error.issues[0]?.message || "Request a new code");
  try {
    if (await verifyPasswordResetCode(parsed.data.challengeId, parsed.data.code)) return { ...state, verified: true, error: undefined, success: "Code verified. Choose a new password." };
  } catch { return challengeError(state, "Unable to verify the code. Please try again later."); }
  return challengeError(state, "Code is incorrect, expired, already used, or has reached five attempts. Request a new code if needed.");
}
export async function logoutAction() { await clearSession(); redirect("/login"); }
