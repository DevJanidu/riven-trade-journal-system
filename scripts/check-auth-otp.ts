import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { authChallenges, passwordResetTokens, users } from "../lib/db/schema";
import { completeVerifiedPasswordReset, completeRegistration, requestChallenge, verifyPasswordResetCode } from "../lib/auth/challenges";
import { hashOtp } from "../lib/auth/otp";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { ownerEmail } from "../lib/auth/email";

config({ path: ".env.development.local", quiet: true });
const prefix = `otp-check-${randomUUID()}`;
const emails: string[] = [];
const originalFetch = globalThis.fetch;
let sentCode = "";
let failDelivery = false;
let recipient = "";
globalThis.fetch = async (input, init) => {
  if (String(input) !== "https://api.resend.com/emails") return originalFetch(input, init);
  const body = JSON.parse(String(init?.body)) as { to: string[]; text: string; from: string };
  recipient = body.to[0];
  sentCode = body.text.match(/\b\d{6}\b/)?.[0] || "";
  assert.match(body.from, /journal\.janidudev\.com/);
  return new Response(JSON.stringify({ id: randomUUID() }), { status: failDelivery ? 503 : 200 });
};

async function request(label: string) {
  const email = `${prefix}-${label}@example.com`;
  emails.push(email);
  const passwordHash = await hashPassword("temporary-test-password");
  const challenge = await requestChallenge(email, "registration", ownerEmail(), { name: "OTP temporary test", passwordHash });
  return { ...challenge, code: sentCode };
}

async function main() {
  try {
    const first = await request("single-use");
    assert.equal(recipient, "janidudev@gmail.com");
    assert.equal((await getDb().select().from(users).where(eq(users.email, first.email))).length, 0);
    await assert.rejects(() => requestChallenge(first.email, "registration", ownerEmail(), {}), /60 seconds/);
    assert.equal(await completeRegistration(first.challengeId, first.code === "000000" ? "111111" : "000000"), undefined);
    const results = await Promise.all([completeRegistration(first.challengeId, first.code), completeRegistration(first.challengeId, first.code)]);
    const created = results.filter((id): id is string => Boolean(id));
    assert.equal(created.length, 1, "only one concurrent verification can create an account");
    assert.equal(await completeRegistration(first.challengeId, first.code), undefined);

    const expired = await request("expired");
    await getDb().update(authChallenges).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(authChallenges.id, expired.challengeId));
    assert.equal(await completeRegistration(expired.challengeId, expired.code), undefined);
    const locked = await request("attempt-limit");
    const wrong = locked.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) assert.equal(await completeRegistration(locked.challengeId, wrong), undefined);
    assert.equal(await completeRegistration(locked.challengeId, locked.code), undefined);
    const undelivered = await request("undelivered");
    await getDb().update(authChallenges).set({ delivered: false }).where(eq(authChallenges.id, undelivered.challengeId));
    assert.equal(await completeRegistration(undelivered.challengeId, undelivered.code), undefined);

    const replaced = await request("resend");
    await getDb().update(authChallenges).set({ createdAt: sql`now() - interval '61 seconds'` }).where(eq(authChallenges.id, replaced.challengeId));
    const replacement = await requestChallenge(replaced.email, "registration", ownerEmail(), { name: "OTP temporary test", passwordHash: await hashPassword("temporary-test-password") });
    assert.notEqual(replacement.challengeId, replaced.challengeId);
    assert.equal(await completeRegistration(replaced.challengeId, replaced.code), undefined);

    failDelivery = true;
    await assert.rejects(() => request("failed-delivery"), /Unable to send/);
    failDelivery = false;
    assert.equal((await getDb().select().from(authChallenges).where(eq(authChallenges.email, emails.at(-1)!))).length, 0);

    const userId = created[0];
    const reset = await requestChallenge(first.email, "password-reset", first.email, { userId });
    assert.equal(recipient, first.email);
    const resetCode = sentCode;
    assert.equal(await verifyPasswordResetCode(reset.challengeId, resetCode), true, "correct reset OTP must verify");
    assert.equal(await verifyPasswordResetCode(reset.challengeId, resetCode), false, "reset OTP cannot verify twice");
    assert.equal(await completeRegistration(reset.challengeId, resetCode), undefined);
    // Resending after a successful OTP verification must clear its stale flag.
    await getDb().update(authChallenges).set({ createdAt: sql`now() - interval '61 seconds'`, attempts: 5 }).where(eq(authChallenges.id, reset.challengeId));
    const replacementReset = await requestChallenge(first.email, "password-reset", first.email, { userId });
    const replacementCode = sentCode;
    const [fresh] = await getDb().select().from(authChallenges).where(eq(authChallenges.id, replacementReset.challengeId));
    assert.equal(fresh.verifiedAt, null);
    assert.equal(fresh.usedAt, null);
    assert.equal(fresh.attempts, 0);
    assert.equal(await verifyPasswordResetCode(reset.challengeId, resetCode), false);
    assert.equal(await completeVerifiedPasswordReset(replacementReset.challengeId, "unverified-password"), undefined);
    assert.equal(await verifyPasswordResetCode(replacementReset.challengeId, replacementCode), true, "replacement OTP must verify after the previous request was verified");
    await getDb().insert(passwordResetTokens).values({ userId, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60_000) });
    const [before] = await getDb().select().from(users).where(eq(users.id, userId));
    const newHash = await hashPassword("updated-test-password");
    const resets = await Promise.all([completeVerifiedPasswordReset(replacementReset.challengeId, newHash), completeVerifiedPasswordReset(replacementReset.challengeId, newHash)]);
    assert.deepEqual(resets.filter(Boolean), [userId], "only one concurrent password change may consume verification");
    assert.equal(await completeVerifiedPasswordReset(replacementReset.challengeId, newHash), undefined);
    const [after] = await getDb().select().from(users).where(eq(users.id, userId));
    assert.equal(await verifyPassword("updated-test-password", after.passwordHash), true);
    assert.equal(await verifyPassword("temporary-test-password", after.passwordHash), false);
    assert.ok(after.updatedAt > before.updatedAt);
    const [oldReset] = await getDb().select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    assert.ok(oldReset.usedAt);

    // A correct digest still cannot authorize the wrong purpose or an expired request.
    const [stored] = await getDb().select().from(authChallenges).where(eq(authChallenges.id, replacementReset.challengeId));
    assert.equal(stored.codeHash, hashOtp(replacementReset.challengeId, "password-reset", replacementCode, process.env.AUTH_SECRET || process.env.RESEND_API_KEY || ""));
    console.log("OTP database checks passed: owner routing, delayed creation, cooldown, concurrent verification, expiry, five-attempt limit, delivery failure, resend invalidation, purpose isolation, password reset and replay prevention.");
  } finally {
    globalThis.fetch = originalFetch;
    if (emails.length) await getDb().delete(users).where(inArray(users.email, emails));
    if (emails.length) await getDb().delete(authChallenges).where(inArray(authChallenges.email, emails));
    console.log("Temporary OTP test accounts and challenges removed.");
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
