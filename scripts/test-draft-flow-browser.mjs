import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let draftId;
let tradeId;
let profile;
let chrome;
let socket;

try {
  const beforeTrades = await (await fetch(`${base}/api/trades?month=2026-10`)).json();
  assert.equal(beforeTrades.success, true);
  const initialCount = beforeTrades.data.length;
  profile = await mkdtemp(path.join(os.tmpdir(), "tradezilla-draft-test-"));
  const port = 20000 + Math.floor(Math.random() * 10000);
  chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let target;
  for (let i = 0; i < 50; i++) {
    try { target = (await (await fetch(`http://localhost:${port}/json/list`)).json()).find(tab => tab.type === "page"); if (target) break; }
    catch { /* Chrome is starting. */ }
    await sleep(100);
  }
  assert.ok(target, "Chrome did not start");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 1;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await sleep(100); }
    throw new Error(`Timed out: ${expression}; state=${JSON.stringify(await evaluate('({url:location.href,alert:document.querySelector("[role=alert]")?.textContent,status:document.querySelector("[role=status]")?.textContent,buttons:[...document.querySelectorAll("button[type=submit]")].map(x=>({text:x.textContent,disabled:x.disabled}))})'))}`);
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: `${base}/journal` });
  await until('Boolean(document.querySelector("button[value=draft]") && document.querySelector("button[value=complete]"))');
  await until('Object.keys(document.querySelector("form")).some(key => key.startsWith("__reactProps$"))');
  await evaluate(`(() => {
    const input = document.querySelector('input[name=entry]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '4123.45');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('textarea[name=entryReason]').value = 'Temporary draft browser test';
    document.querySelector('button[value=draft]').click();
  })()`);
  await until('location.pathname === "/trades"');
  const drafts = await (await fetch(`${base}/api/drafts?month=2026-10`)).json();
  const draft = drafts.data.find(item => item.data.entryReason === "Temporary draft browser test");
  assert.ok(draft, "Draft was not persisted");
  draftId = draft.id;
  assert.equal(draft.data.entry, "4123.45");
  assert.equal(draft.data.stopLoss, "");
  const afterDraftTrades = await (await fetch(`${base}/api/trades?month=2026-10`)).json();
  assert.equal(afterDraftTrades.data.length, initialCount, "Draft changed trade stats");
  await until(`Boolean(document.querySelector('a[href="/journal?draft=${draftId}"]'))`);
  assert.ok(await evaluate(`Boolean(document.querySelector('a[href="/journal?draft=${draftId}"]')?.textContent.includes('Edit'))`));
  assert.ok(await evaluate('Boolean(document.querySelector("button") && [...document.querySelectorAll("button")].some(x => x.textContent === "Delete"))'));
  await send("Page.navigate", { url: `${base}/journal?draft=${draftId}` });
  await until('Boolean(document.querySelector("button[value=complete]"))');
  await until('Object.keys(document.querySelector("form")).some(key => key.startsWith("__reactProps$"))');
  await until('document.querySelector("input[name=entry]")?.value === "4123.45"');
  await until('document.querySelectorAll("input[type=checkbox]").length > 0');
  await evaluate(`(() => {
    const set = (name, value) => {
      const input = document.querySelector('input[name=' + name + ']');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('stopLoss', '4113.45'); set('takeProfit', '4143.45'); set('profitLoss', '50');
    document.querySelectorAll('input[type=checkbox]').forEach(input => { if (!input.checked) input.click(); });
  })()`);
  await evaluate('document.querySelector("button[aria-label^=\\"Am I ready to lose\\"]").click()');
  await until('Boolean(document.querySelector("[role=listbox]"))');
  await evaluate('[...document.querySelectorAll("[role=listbox] [role=option]")].find(x => x.textContent.includes("Yes")).click()');
  await until('Boolean(document.body.textContent.includes("100% complete"))');
  await evaluate('document.querySelector("button[value=complete]").click()');
  await until(`location.pathname === "/trades/${draftId}"`);
  tradeId = draftId;
  const completed = await (await fetch(`${base}/api/trades/${tradeId}`)).json();
  assert.equal(completed.success, true);
  assert.equal(completed.data.entryReason, "Temporary draft browser test");
  assert.equal(completed.data.entry, 4123.45);
  const afterCompleteDraft = await (await fetch(`${base}/api/drafts/${draftId}`)).json();
  assert.equal(afterCompleteDraft.success, false);
  const afterCompleteTrades = await (await fetch(`${base}/api/trades?month=2026-10`)).json();
  assert.equal(afterCompleteTrades.data.length, initialCount + 1);
  await send("Page.navigate", { url: `${base}/trades?month=2026-10` });
  await until(`Boolean(document.querySelector('a[href="/trades/${tradeId}/edit"]'))`);
  await until(`Object.keys(document.querySelector('a[href="/trades/${tradeId}/edit"]')).some(key => key.startsWith('__reactProps$'))`);
  await evaluate(`document.querySelector('a[href="/trades/${tradeId}/edit"]').closest('tr').querySelector('button').click()`);
  await until('Boolean(document.querySelector("[role=dialog]"))');
  await evaluate('[...document.querySelectorAll("[role=dialog] button")].find(x => x.textContent.includes("Delete Trade")).click()');
  await until(`!document.querySelector('a[href="/trades/${tradeId}/edit"]')`);
  const afterDelete = await (await fetch(`${base}/api/trades/${tradeId}`)).json();
  assert.equal(afterDelete.success, false);
  tradeId = undefined;
  console.log("Browser draft flow: incomplete save, persisted fields, Trade Log edit/delete actions, excluded stats, completed trade, draft removed");
} finally {
  socket?.close();
  chrome?.kill();
  if (tradeId) await fetch(`${base}/api/trades/${tradeId}`, { method: "DELETE" }).catch(() => undefined);
  else if (draftId) await fetch(`${base}/api/drafts/${draftId}`, { method: "DELETE" }).catch(() => undefined);
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
}
