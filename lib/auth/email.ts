import "server-only";
import type { OtpPurpose } from "./otp";

export function ownerEmail() {
  return process.env.APP_OWNER_EMAIL?.trim().toLowerCase() || "janidudev@gmail.com";
}

export async function sendOtpEmail(to: string, code: string, purpose: OtpPurpose, requestedEmail: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email delivery is not configured");
  const registration = purpose === "registration";
  const text = registration
    ? `A new account was requested for ${requestedEmail} at journal.janidudev.com.\n\nApproval code: ${code}\n\nThis code expires in 5 minutes and can only be used once for this account. Share it with the applicant only if you approve their registration. If you do not approve, ignore this email.`
    : `Your My Journal password reset code is: ${code}\n\nEnter it at https://journal.janidudev.com/forgot-password. It expires in 5 minutes and can only be used once. If you did not request this, ignore this email.`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "My Journal <noreply@journal.janidudev.com>", to: [to], subject: registration ? "Approve a new My Journal account" : "Your My Journal password reset code", text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    console.error("OTP email delivery failed", response.status);
    throw new Error("Unable to send email");
  }
}
