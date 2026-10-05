import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { authChallenges } from "@/lib/db/schema";
import { generateOtp, hashOtp, otpLifetimeMs, otpMaxAttempts, otpResendDelayMs, type OtpPurpose } from "./otp";
import { sendOtpEmail } from "./email";

function digest(id: string, purpose: OtpPurpose, code: string) {
  return hashOtp(id, purpose, code, process.env.AUTH_SECRET || process.env.RESEND_API_KEY || "");
}
export async function requestChallenge(email: string, purpose: OtpPurpose, recipient: string, payload: typeof authChallenges.$inferInsert.payload) {
  const id = randomUUID();
  const code = generateOtp();
  const now = new Date();
  const record = { id, email, purpose, payload, codeHash: digest(id, purpose, code), attempts: 0, delivered: false, usedAt: null, verifiedAt: null, createdAt: sql`now()`, expiresAt: sql`now() + interval '5 minutes'` };
  const [challenge] = await getDb().insert(authChallenges).values(record).onConflictDoUpdate({
    target: [authChallenges.email, authChallenges.purpose], set: record,
    setWhere: sql`${authChallenges.createdAt} <= now() - ${otpResendDelayMs} * interval '1 millisecond'`,
  }).returning({ id: authChallenges.id });
  if (!challenge) throw new Error("Please wait 60 seconds before requesting another code.");
  try {
    await sendOtpEmail(recipient, code, purpose, email);
    await getDb().update(authChallenges).set({ delivered: true }).where(eq(authChallenges.id, id));
  } catch {
    await getDb().delete(authChallenges).where(eq(authChallenges.id, id));
    throw new Error("Unable to send the code. Please try again later or contact the app owner.");
  }
  return { challengeId: id, expiresAt: now.getTime() + otpLifetimeMs, email };
}

// Row locks recheck the conditions for concurrent attempts. Code consumption and
// the account mutation execute together, preventing reuse and partial changes.
function consume(id: string, purpose: OtpPurpose, code: string) {
  const codeHash = digest(id, purpose, code);
  return sql`UPDATE auth_challenges SET attempts = attempts + 1,
    used_at = CASE WHEN code_hash = ${codeHash} THEN now() ELSE NULL END
    WHERE id = ${id}::uuid AND purpose = ${purpose} AND delivered = true
      AND used_at IS NULL AND expires_at > now() AND attempts < ${otpMaxAttempts}
    RETURNING email, payload, used_at`;
}
export async function completeRegistration(id: string, code: string) {
  const result = await getDb().execute(sql`WITH verified AS (${consume(id, "registration", code)})
    INSERT INTO users (name, email, password_hash)
    SELECT payload->>'name', email, payload->>'passwordHash' FROM verified WHERE used_at IS NOT NULL
    RETURNING id`);
  return result.rows[0]?.id as string | undefined;
}
export async function completePasswordReset(id: string, code: string, passwordHash: string) {
  const result = await getDb().execute(sql`WITH verified AS (${consume(id, "password-reset", code)}),
    changed AS (UPDATE users SET password_hash = ${passwordHash}, updated_at = now()
      FROM verified WHERE users.id = (verified.payload->>'userId')::uuid AND verified.used_at IS NOT NULL
      RETURNING users.id),
    invalidated AS (UPDATE password_reset_tokens SET used_at = now() FROM changed
      WHERE password_reset_tokens.user_id = changed.id AND password_reset_tokens.used_at IS NULL)
    SELECT id FROM changed`);
  return result.rows[0]?.id as string | undefined;
}
export async function verifyPasswordResetCode(id: string, code: string) {
  const codeHash = digest(id, "password-reset", code);
  const result = await getDb().execute(sql`UPDATE auth_challenges SET attempts = attempts + 1,
    verified_at = CASE WHEN code_hash = ${codeHash} THEN now() ELSE verified_at END
    WHERE id = ${id}::uuid AND purpose = 'password-reset' AND delivered = true
      AND used_at IS NULL AND verified_at IS NULL AND expires_at > now() AND attempts < ${otpMaxAttempts}
    RETURNING verified_at`);
  return Boolean(result.rows[0]?.verified_at);
}
export async function completeVerifiedPasswordReset(id: string, passwordHash: string) {
  const result = await getDb().execute(sql`WITH verified AS (
    UPDATE auth_challenges SET used_at = now()
      WHERE id = ${id}::uuid AND purpose = 'password-reset' AND delivered = true
        AND verified_at IS NOT NULL AND used_at IS NULL AND expires_at > now()
      RETURNING payload
    ), changed AS (
    UPDATE users SET password_hash = ${passwordHash}, updated_at = now()
      FROM verified WHERE users.id = (verified.payload->>'userId')::uuid
      RETURNING users.id
    ), invalidated AS (UPDATE password_reset_tokens SET used_at = now() FROM changed
      WHERE password_reset_tokens.user_id = changed.id AND password_reset_tokens.used_at IS NULL)
    SELECT id FROM changed`);
  return result.rows[0]?.id as string | undefined;
}
