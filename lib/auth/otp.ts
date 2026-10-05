import { createHmac, randomInt } from "node:crypto";

export const otpLifetimeMs = 5 * 60 * 1000;
export const otpMaxAttempts = 5;
export const otpResendDelayMs = 60 * 1000;
export type OtpPurpose = "registration" | "password-reset";

export function generateOtp() { return randomInt(0, 1_000_000).toString().padStart(6, "0"); }
export function hashOtp(id: string, purpose: OtpPurpose, code: string, secret: string) {
  if (!secret) throw new Error("OTP signing secret is not configured");
  return createHmac("sha256", secret).update(`${id}:${purpose}:${code}`).digest("hex");
}
export function isOtp(code: string) { return /^\d{6}$/.test(code); }
