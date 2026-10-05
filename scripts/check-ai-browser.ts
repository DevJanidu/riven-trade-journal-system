import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sessionCookieName } from "../lib/auth/token";

export async function checkAiBrowser(base: string, token: string, analysisId: string, expectCalendar = false, paginationChecks = false) {
  const profile = await mkdtemp(path.join(tmpdir(), "tradezilla-ai-"));
  const port = 24000 + Math.floor(Math.random() * 1000);
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket: WebSocket | undefined;
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 60 && !target; i++) {
      try { target = (await (await fetch(`http://localhost:${port}/json/list`)).json()).find((tab: { type: string }) => tab.type === "page"); } catch { /* Starting Chrome. */ }
      if (!target) await pause(100);
    }
    assert.ok(target, "Chrome must start");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => { socket!.onopen = () => resolve(); socket!.onerror = reject; });
    let counter = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (value: unknown) => void }>();
    const writes: string[] = [];
    const jsErrors: unknown[] = [];
    socket.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (message.method === "Network.requestWillBeSent" && message.params.request.method === "POST" && message.params.request.url.includes("/api/ai-analysis")) writes.push(message.params.request.url);
      if (message.method === "Runtime.exceptionThrown") jsErrors.push(message.params.exceptionDetails);
      if (message.id) { const callback = pending.get(message.id); pending.delete(message.id); if (message.error) callback?.reject(message.error); else callback?.resolve(message.result); }
    };
    function rpc<T = unknown>(method: string, params: object = {}): Promise<T> {
      const id = ++counter;
      return new Promise((resolve, reject) => { pending.set(id, { resolve: value => resolve(value as T), reject }); socket!.send(JSON.stringify({ id, method, params })); });
    }
    async function evaluate<T>(expression: string): Promise<T> {
      const result = await rpc<{ result: { value: T }; exceptionDetails?: unknown }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      assert.ok(!result.exceptionDetails); return result.result.value;
    }
    async function ready(expression: string) {
      for (let i = 0; i < 100; i++) { if (await evaluate<boolean>(`document.body && (${expression})`)) return; await pause(200); }
      throw new Error("AI browser page did not become ready");
    }
    await rpc("Network.enable"); await rpc("Runtime.enable"); await rpc("Page.enable");
    await rpc("Network.setCookie", { name: sessionCookieName, value: token, url: base, httpOnly: true });
    const artifacts = path.resolve(".ai-artifacts"); await mkdir(artifacts, { recursive: true });
    for (const [width, height] of [[1440, 1000], [390, 844], [320, 740]]) {
      await rpc("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
      await rpc("Page.navigate", { url: `${base}/ai-analysis?id=${analysisId}` });
      await ready("document.body.textContent.includes('What would change the bias?') && document.querySelector('button') !== null");
      await pause(400);
      assert.ok(await evaluate<boolean>("[...document.querySelectorAll('button')].some(button => button.getAttribute('aria-label')?.startsWith('Delete analysis for '))"), "Each saved history report exposes a delete option");
      assert.ok(await evaluate<boolean>("![...document.querySelectorAll('summary,h2')].some(node => /my technical context|technical bias|alignment/i.test(node.textContent))"), "No personal technical-context form or alignment section");
      assert.ok(await evaluate<boolean>("document.documentElement.scrollWidth <= window.innerWidth"), `No document overflow at ${width}`);
      if (expectCalendar) {
        assert.ok(await evaluate<boolean>("document.body.textContent.includes('Weekly event risk:') && document.body.textContent.includes('Consensus:')"), "Saved economic calendar is visible");
        assert.ok(await evaluate<boolean>("[...document.querySelectorAll('a')].some(link => link.href === 'https://www.financecalendar.com/' && link.innerText === 'FinanceCalendar')"), "FinanceCalendar attribution is visible and linked");
        assert.ok(await evaluate<boolean>("document.body.innerText.includes('Live news feed') && document.body.innerText.includes('Market-implied Fed probabilities')"));
      }
      const screenshot = await rpc<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(path.join(artifacts, `ai-analysis-${width}.png`), Buffer.from(screenshot.data, "base64"));
    }
    await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent.includes('Refresh Analysis')).click()");
    await ready("document.querySelector('[role=dialog]') !== null");
    assert.ok(await evaluate<boolean>("document.querySelector('[role=dialog]').innerText.includes('OpenAI credit')"));
    await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(button => button.textContent==='Cancel').click()");
    assert.equal(writes.length, 0, "Open, reload, history and cancelled refresh never generate");
    if (paginationChecks) {
      await evaluate("document.querySelector('nav[aria-label=\"analyses pagination\"] button[aria-label=\"Next page\"]').click()");
      await ready("new URL(location.href).searchParams.get('historyPage') === '1' && document.querySelector('nav[aria-label=\"analyses pagination\"] button[aria-current=\"page\"]')?.textContent === '2'");
      assert.equal(await evaluate<number>("[...document.querySelectorAll('button')].filter(button => button.getAttribute('aria-label')?.startsWith('Delete analysis for ')).length"), 2);
      assert.equal(await evaluate<string>("new URL(location.href).searchParams.get('id')"), analysisId, "History pagination preserves selected report");
      await evaluate("document.querySelector('nav[aria-label=\"macro factors pagination\"] button[aria-label=\"Next page\"]').click()");
      await ready("document.querySelector('nav[aria-label=\"macro factors pagination\"] button[aria-current=\"page\"]')?.textContent === '2'");
      assert.ok(await evaluate<boolean>("document.documentElement.scrollWidth <= innerWidth"));
      await rpc("Page.navigate", { url: `${base}/trades?month=2026-10&result=Win&page=2` });
      await ready("document.querySelector('nav[aria-label=\"trades pagination\"] button[aria-current=\"page\"]')?.textContent === '2'");
      assert.equal(await evaluate<number>("document.querySelector('table tbody').children.length"), 10);
      await evaluate("document.querySelector('nav[aria-label=\"trades pagination\"] button[aria-label=\"Next page\"]').click()");
      await ready("document.querySelector('nav[aria-label=\"trades pagination\"] button[aria-current=\"page\"]')?.textContent === '3'");
      assert.equal(await evaluate<number>("document.querySelector('table tbody').children.length"), 3);
      assert.equal(await evaluate<string>("new URL(location.href).searchParams.get('result')"), "Win");
      const tradeUrl = await evaluate<string>("location.href");
      await rpc("Page.navigate", { url: tradeUrl });
      await ready("document.querySelector('nav[aria-label=\"trades pagination\"] button[aria-current=\"page\"]')?.textContent === '3'");
      await rpc("Page.navigate", { url: `${base}/reports?period=yearly&date=2026-10-05&tradePage=2&setupPage=2` });
      await ready("document.querySelector('nav[aria-label=\"report trades pagination\"] button[aria-current=\"page\"]')?.textContent === '2' && document.querySelector('nav[aria-label=\"setups pagination\"] button[aria-current=\"page\"]')?.textContent === '2'");
      assert.deepEqual(await evaluate<number[]>("[...document.querySelectorAll('table tbody')].map(body => body.children.length)"), [10, 2]);
      await evaluate("document.querySelector('nav[aria-label=\"report trades pagination\"] button[aria-label=\"Next page\"]').click()");
      await ready("document.querySelector('nav[aria-label=\"report trades pagination\"] button[aria-current=\"page\"]')?.textContent === '3'");
      assert.deepEqual(await evaluate<number[]>("[...document.querySelectorAll('table tbody')].map(body => body.children.length)"), [3, 2]);
      assert.ok(await evaluate<boolean>("document.querySelector('[aria-label=\"Report summary\"]').textContent.includes('23')"), "Summary retains all 23 trades");
      assert.ok(await evaluate<boolean>("new URL(location.href).searchParams.get('period') === 'yearly' && new URL(location.href).searchParams.get('setupPage') === '2' && document.documentElement.scrollWidth <= innerWidth"));
      assert.equal(writes.length, 0, "Table paging never generates an AI analysis");
      console.info("Pagination browser passed: AI history, macro scorecard, filtered trade pages/reload, independent report tables, full totals and mobile layout.");
    }
    assert.equal(jsErrors.length, 0, "No browser JS errors");
    console.info("AI browser passed at 1440/390/320px: no document overflow, no JS errors, readable report, refresh confirmation, zero generation requests from reading/cancelling. Screenshots in .ai-artifacts/.");
  } finally {
    socket?.close(); chrome.kill();
    // Profile is in the OS temp directory; retained for normal OS cleanup.
  }
}
