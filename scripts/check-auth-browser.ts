import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { authChallenges, users } from "../lib/db/schema";
import { hashOtp } from "../lib/auth/otp";
import { hashPassword, verifyPassword } from "../lib/auth/password";

config({ path: ".env.development.local", quiet: true });
const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const email = `otp-browser-${randomUUID()}@example.invalid`;
  const profile = await mkdtemp(path.join(tmpdir(), "tradezilla-auth-"));
  const port = 24000 + Math.floor(Math.random() * 1000);
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket: WebSocket | undefined;
  try {
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 100 && !target; i++) {
      try { target = (await (await fetch(`http://localhost:${port}/json/list`)).json()).find((tab: { type: string }) => tab.type === "page"); } catch { /* Starting Chrome. */ }
      if (!target) await pause(100);
    }
    assert.ok(target);
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => { socket!.onopen = () => resolve(); socket!.onerror = reject; });
    let counter = 0;
    const pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: unknown) => void }>();
    socket.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (message.id) { const callback = pending.get(message.id); pending.delete(message.id); if (message.error) callback?.reject(message.error); else callback?.resolve(message.result); }
    };
    function rpc<T = unknown>(method: string, params: object = {}): Promise<T> {
      const id = ++counter;
      return new Promise((resolve, reject) => { pending.set(id, { resolve: result => resolve(result as T), reject }); socket!.send(JSON.stringify({ id, method, params })); });
    }
    async function evaluate<T>(expression: string): Promise<T> {
      const result = await rpc<{ result: { value: T }; exceptionDetails?: unknown }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    async function waitFor(expression: string) {
      for (let i = 0; i < 150; i++) { if (await evaluate<boolean>(`Boolean(document.body && (${expression}))`)) return; await pause(200); }
      throw new Error(`Browser timed out: ${expression}; ${await evaluate<string>("document.body.innerText")}`);
    }
    await rpc("Page.enable");
    await rpc("Emulation.setDeviceMetricsOverride", { width: 1000, height: 900, deviceScaleFactor: 1, mobile: false });
    await rpc("Page.navigate", { url: `${baseUrl}/forgot-password` });
    await waitFor("document.querySelector('input[name=email]')");
    await pause(1000);
    await evaluate("document.querySelector('input[name=email]').focus()");
    await rpc("Input.insertText", { text: email });
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor("document.querySelector('input[name=challengeId]')");
    const challengeId = await evaluate<string>("document.querySelector('input[name=challengeId]').value");
    // The unknown-email form requires no email delivery. Attach an isolated
    // fixture to its opaque request ID to test the real browser/server actions.
    const [user] = await getDb().insert(users).values({ email, name: "OTP browser test", passwordHash: await hashPassword("old-test-password") }).returning();
    await getDb().insert(authChallenges).values({ id: challengeId, email, purpose: "password-reset", codeHash: hashOtp(challengeId, "password-reset", "012345", process.env.AUTH_SECRET || process.env.RESEND_API_KEY || ""), payload: { userId: user.id }, delivered: true, expiresAt: new Date(Date.now() + 300_000) });
    assert.equal(await evaluate<number>("document.querySelector('section').getBoundingClientRect().width"), 540);
    assert.equal(await evaluate<number>("document.querySelectorAll('input[type=password]').length"), 0);
    await evaluate("document.querySelector('[aria-label=\"Verification code digit 1\"]').focus()");
    for (let i = 0; i < 6; i++) {
      await rpc("Input.insertText", { text: String(i) });
      assert.equal(await evaluate<string>("document.activeElement.getAttribute('aria-label')"), `Verification code digit ${Math.min(i + 2, 6)}`);
    }
    assert.equal(await evaluate<string>("new FormData(document.querySelector('form')).get('code')"), "012345");
    await evaluate("document.querySelector('[aria-label=\"Verification code digit 1\"]').focus()");
    await rpc("Input.insertText", { text: "012345" });
    assert.equal(await evaluate<string>("document.querySelector('input[name=code]').value"), "012345");
    await evaluate("(() => { const data=new DataTransfer(); data.setData('text','012345'); document.querySelector('[aria-label=\"Verification code digit 3\"]').dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true})); })()");
    assert.equal(await evaluate<string>("document.querySelector('input[name=code]').value"), "012345");
    await evaluate("document.querySelector('form').requestSubmit()");
    await waitFor("document.querySelector('[role=dialog]')");
    assert.equal(await evaluate<number>("document.querySelector('[role=dialog] section').getBoundingClientRect().width"), 540);
    assert.equal(await evaluate<boolean>("document.querySelector('[role=dialog]').innerText.includes('Request a new code')"), false);
    for (const name of ["password", "confirmPassword"]) {
      await evaluate(`document.querySelector('input[name=${name}]').focus()`);
      await rpc("Input.insertText", { text: "new-browser-test-password" });
    }
    await evaluate("document.querySelector('[role=dialog] form').requestSubmit()");
    await waitFor("location.pathname === '/login' && location.search.includes('reset=success')");
    const [updated] = await getDb().select().from(users).where(eq(users.id, user.id));
    assert.equal(await verifyPassword("new-browser-test-password", updated.passwordHash), true);
    console.log("Browser checks passed: six-digit typing and focus, leading zero, paste, autofill, 540px recovery card, OTP-only step, verification modal and successful password change.");
  } finally {
    socket?.close();
    chrome.kill();
    await getDb().delete(users).where(eq(users.email, email));
    await getDb().delete(authChallenges).where(eq(authChallenges.email, email));
    assert.ok(path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
