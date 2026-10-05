import assert from "node:assert/strict";
import { test } from "node:test";
import { generateOtp, hashOtp, isOtp, otpLifetimeMs } from "../lib/auth/otp";
import { createSessionToken, passwordVersion, verifySessionToken } from "../lib/auth/token";

test("codes are six decimal digits, including leading zeroes", () => {
  for (let i = 0; i < 100; i++) assert.match(generateOtp(), /^\d{6}$/);
  assert.equal(isOtp("000001"), true);
  for (const code of ["12345", "1234567", "12345x", " 123456", "123456\n"]) assert.equal(isOtp(code), false);
});
test("OTP digests bind the code to its request, purpose and signing secret", () => {
  const digest = hashOtp("request-a", "registration", "000001", "secret-a");
  assert.equal(digest, hashOtp("request-a", "registration", "000001", "secret-a"));
  assert.notEqual(digest, hashOtp("request-b", "registration", "000001", "secret-a"));
  assert.notEqual(digest, hashOtp("request-a", "password-reset", "000001", "secret-a"));
  assert.notEqual(digest, hashOtp("request-a", "registration", "000002", "secret-a"));
  assert.notEqual(digest, hashOtp("request-a", "registration", "000001", "secret-b"));
  assert.throws(() => hashOtp("request-a", "registration", "000001", ""));
  assert.equal(otpLifetimeMs, 300_000);
});

test("sessions bind to the current password without comparing database and app clocks", async () => {
  const oldSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "otp-test-session-secret";
  try {
    const token = await createSessionToken("test-user", "old-password-hash");
    const session = await verifySessionToken(token);
    assert.equal(session?.userId, "test-user");
    assert.equal(session?.passwordVersion, await passwordVersion("old-password-hash"));
    assert.notEqual(session?.passwordVersion, await passwordVersion("new-password-hash"));
    assert.equal(await verifySessionToken(token + "tampered"), null);
  } finally {
    if (oldSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldSecret;
  }
});
