import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { createSessionToken, sessionCookieName } from "../lib/auth/token";

config({ path: ".env.development.local", quiet: true });
config({ path: ".env", quiet: true });
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const sql = neon(process.env.DATABASE_URL!);
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const [user] = await sql`INSERT INTO users (name, email, password_hash) VALUES ('Calendar browser test', ${`calendar-browser-${crypto.randomUUID()}@example.invalid`}, 'test-account-no-login') RETURNING id`;
  const cookie = `${sessionCookieName}=${await createSessionToken(user.id)}`;
  const profile = await mkdtemp(path.join(tmpdir(), "tradezilla-calendar-"));
  const port = 23000 + Math.floor(Math.random() * 2000);
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let socket: WebSocket | undefined;
  try {
    await sql`INSERT INTO setup_types (user_id, name, rules, avoid_rules) VALUES (${user.id}, 'Liquidity Sweep', '["Wait for confirmation"]'::jsonb, '[]'::jsonb)`;
    const ids: string[] = [];
    for (const [date, r] of [["2026-10-05", 2], ["2026-10-05", -1], ["2026-10-05", 0], ["2026-10-06", 2], ["2026-03-01", 2], ["2026-03-31", -1], ["2026-03-31", 2], ["2026-03-31", 0]] as const) {
      const response = await fetch(`${baseUrl}/api/trades`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({
        instrument: "XAUUSD", date, session: "London", direction: "Long", entry: 4000, stopLoss: 3990, takeProfit: 4020, riskAmount: 25, profitLoss: r * 25,
        setup: "Liquidity Sweep", setupGrade: "A+", setupChecklist: ["Wait for confirmation"], psychologyReady: true, followedRules: true, emotion: "Calm", beforeScreenshot: "/charts/before-trade.svg", afterScreenshot: "/charts/after-trade.svg",
      }) });
      const json = await response.json();
      assert.ok(json.success, JSON.stringify(json));
      ids.push(json.data.id);
    }
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 100 && !target; i++) {
      try { target = (await (await fetch(`http://localhost:${port}/json/list`)).json()).find((tab: { type: string }) => tab.type === "page"); } catch { /* Browser starting. */ }
      if (!target) await pause(100);
    }
    assert.ok(target, "Chrome must start");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => { socket!.onopen = () => resolve(); socket!.onerror = reject; });
    let counter = 0;
    const pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: unknown) => void }>();
    const requests: Array<{ url: string; method: string }> = [];
    const requestUrls = new Map<string, string>();
    const finishedRequests = new Set<string>();
    socket.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (message.method === "Network.requestWillBeSent") { requests.push(message.params.request); requestUrls.set(message.params.requestId, message.params.request.url); }
      if (message.method === "Network.loadingFinished") { const url = requestUrls.get(message.params.requestId); if (url) finishedRequests.add(url); }
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
      for (let i = 0; i < 150; i++) { if (await evaluate<boolean>(`document.body !== null && (${expression})`)) return; await pause(200); }
      throw new Error(`Browser timed out: ${expression}; ${await evaluate<string>("document.body.innerText")}`);
    }
    async function navigate(url: string, ready: string) { await rpc("Page.navigate", { url: `${baseUrl}${url}` }); await waitFor(ready); }
    await rpc("Network.enable");
    await rpc("Page.enable");
    await rpc("Network.setCookie", { name: sessionCookieName, value: cookie.split("=")[1], url: baseUrl, httpOnly: true });
    await rpc("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await navigate("/calendar?month=2026-10", "document.querySelector('a[href=\"/trades?date=2026-10-05\"]') !== null");
    await pause(800);
    const artifacts = path.resolve(".calendar-artifacts");
    await mkdir(artifacts, { recursive: true });
    async function screenshot(name: string) {
      const result = await rpc<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(path.join(artifacts, name), Buffer.from(result.data, "base64"));
    }
    await navigate("/dashboard?month=2026-10", "document.querySelector('[aria-label=\"Personal greeting\"]') !== null");
    assert.equal(await evaluate<string>("[...document.querySelectorAll('article')].find(a=>a.textContent.includes('Average R:R')).querySelectorAll('p')[1].textContent"), "1:2");
    if (process.env.TEST_RR_ONLY === "1") {
      const ratios = process.env.TEST_RR_VALUES ? process.env.TEST_RR_VALUES.split(",").map(Number) : [2, 2.5, 5, 20, 50];
      for (const ratio of ratios) {
        if (ratio !== 2) {
          for (const id of ids.slice(0, 4)) {
            const response = await fetch(`${baseUrl}/api/trades/${id}`, { method: "PATCH", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ takeProfit: 4000 + 10 * ratio }) });
            const json = await response.json();
            assert.ok(json.success, JSON.stringify(json));
            assert.equal(json.data.plannedRR, ratio);
          }
        }
        const response = await fetch(`${baseUrl}/api/dashboard?month=2026-10`, { headers: { Cookie: cookie } });
        const json = await response.json();
        assert.ok(json.success, JSON.stringify(json));
        assert.equal(json.data.summary.averagePlannedRR, ratio);
        assert.equal(typeof json.data.summary.averagePlannedRR, "number");
        assert.equal(json.data.summary.netR, 3);
        await navigate("/dashboard?month=2026-10", "document.querySelector('article') !== null");
        const average = await evaluate<string>("[...document.querySelectorAll('article')].find(a=>a.textContent.includes('Average R:R')).querySelectorAll('p')[1].textContent");
        assert.equal(average, `1:${ratio}`);
        assert.equal(await evaluate<string>("[...document.querySelectorAll('article')].find(a=>a.textContent.includes('Net R')).querySelectorAll('p')[1].textContent"), "+3R");
        await screenshot(`rr-${ratio}-dashboard.png`);
        await navigate(`/trades/${ids[0]}`, "document.body.innerText.includes('Trade Information')");
        assert.equal(await evaluate<string>("[...document.querySelectorAll('p')].find(p=>p.textContent==='Planned R:R').nextElementSibling.textContent"), `1:${ratio}`);
        await navigate(`/trades/${ids[0]}/edit`, "document.querySelector('textarea[name=entryReason]') !== null");
        assert.equal(await evaluate<string>("[...document.querySelectorAll('p')].find(p=>p.textContent==='Planned R:R').nextElementSibling.textContent"), `1:${ratio}`);
      }
      assert.equal(requests.filter(request => request.method === "POST" && request.url.includes("/api/uploads")).length, 0);
      console.info(`R:R browser/API regression passed: ${ratios.map(ratio => `${ratio}→1:${ratio}`).join(", ")} across Dashboard, single trade and edit form. API ratios remain numeric, Net R stays +3R and no images are uploaded. Temporary fixtures removed afterward.`);
      return;
    }
    for (const [hour, title] of [[8, "Good morning"], [14, "Good afternoon"], [19, "Good evening"], [23, "Good night"], [2, "Good night"]] as const) {
      await evaluate(`(() => { window.__realDate ??= Date; window.Date = class extends window.__realDate { getHours() { return ${hour}; } }; window.dispatchEvent(new Event('focus')); })()`);
      await waitFor(`document.querySelector('[aria-label="Personal greeting"]').textContent.includes('${title}, Calendar.')`);
      assert.ok(!await evaluate<boolean>("document.querySelector('[aria-label=\"Personal greeting\"]').textContent.includes('browser test')"));
    }
    await evaluate("window.Date=window.__realDate; window.dispatchEvent(new Event('focus'))");
    await screenshot("dashboard-greeting.png");
    await evaluate("document.querySelector('main a[href=\"/calendar?month=2026-10\"]').click()");
    await waitFor("location.pathname==='/calendar' && location.search.includes('month=2026-10') && document.querySelector('time[datetime=\"2026-10-05\"]') !== null");
    for (const [width, height] of [[1440, 900], [1366, 768], [1280, 600], [900, 700], [768, 600]]) {
      await rpc("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      for (const month of ["2026-03", "2026-08"]) {
        await navigate(`/calendar?month=${month}`, `document.querySelector('section[aria-label="${month === "2026-03" ? "March" : "August"} 2026"]') !== null && [...document.querySelectorAll('time[datetime]')].filter(t=>t.getClientRects().length).length===31`);
        await pause(200);
        assert.ok(await evaluate<boolean>("document.documentElement.scrollHeight <= window.innerHeight + 1"), `${width}×${height}, ${month}: entire calendar must fit the viewport`);
        assert.ok(await evaluate<boolean>("[...document.querySelectorAll('a[href^=\"/trades?date=\"]')].filter(a=>a.getClientRects().length).every(a=>[...a.querySelectorAll('p,time')].every(p=>p.getBoundingClientRect().bottom<=a.getBoundingClientRect().bottom+1 && p.getBoundingClientRect().right<=a.getBoundingClientRect().right+1))"), `${width}×${height}, ${month}: day details must fit their cells`);
      }
    }
    await rpc("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await navigate("/calendar?month=2026-10", "document.querySelector('time[datetime=\"2026-10-05\"]') !== null");
    await screenshot("desktop.png");
    assert.equal(await evaluate<number>("[...document.querySelectorAll('time[datetime]')].filter(t=>t.getClientRects().length).length"), 31);
    await evaluate("document.querySelector('[aria-label=\"Next month\"]').click()");
    await waitFor("location.search.includes('month=2026-11') && document.body.innerText.includes('No trades this month')");
    await evaluate("document.querySelector('[aria-label=\"Previous month\"]').click()");
    await waitFor("location.search.includes('month=2026-10') && document.body.innerText.includes('3 Trades')");
    await evaluate("document.querySelector('a[href=\"/trades?date=2026-10-05\"]').focus()");
    await rpc("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await rpc("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await waitFor("location.pathname === '/trades' && document.querySelectorAll('tbody tr').length === 3");
    assert.ok(await evaluate<boolean>("location.search.includes('date=2026-10-05') && document.body.innerText.includes('October 5, 2026')"));
    await evaluate("document.querySelector('[aria-label=\"Result: All\"]').click()");
    await evaluate("[...document.querySelectorAll('[role=option]')].find(e=>e.textContent==='Loss').click()");
    await waitFor("document.querySelectorAll('tbody tr').length===1 && document.body.innerText.includes('-1R')");
    assert.ok(await evaluate<boolean>("location.search.includes('date=2026-10-05') && location.search.includes('result=Loss')"));
    for (let i = 0; i < 100 && (!finishedRequests.has(`${baseUrl}/api/trades?month=2026-10`) || !finishedRequests.has(`${baseUrl}/api/drafts?month=2026-10`)); i++) await pause(100);
    assert.ok(finishedRequests.has(`${baseUrl}/api/trades?month=2026-10`), "Monthly data is prepared while the daily view is open");
    await pause(100);
    const requestCount = requests.length;
    const cleared = await evaluate<{ elapsed: number; title: string; dateRemoved: boolean }>("(async()=>{const start=performance.now(); document.querySelector('[aria-label=\"Remove date filter\"]').click(); await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); return {elapsed:performance.now()-start,title:document.querySelector('h1').textContent,dateRemoved:!document.querySelector('[aria-label=\"Remove date filter\"]')};})()");
    assert.ok(cleared.dateRemoved && cleared.title === "October 2026", "Clearing the date immediately shows the monthly view");
    assert.ok(cleared.elapsed < 300, `Clearing took ${cleared.elapsed}ms`);
    assert.ok(await evaluate<boolean>("!location.search.includes('date=') && location.search.includes('result=Loss')"));
    assert.equal(requests.slice(requestCount).filter(request => request.url.includes("/api/trades") || request.url.includes("/api/drafts") || request.url.includes("/trades?") && request.url.includes("_rsc=")).length, 0);
    console.info(`Date filter cleared in ${Math.round(cleared.elapsed)}ms with zero trade/draft or server-navigation requests.`);
    await evaluate("document.querySelector('[aria-label=\"Result: Loss\"]').click()");
    await evaluate("[...document.querySelectorAll('[role=option]')].find(e=>e.textContent==='All').click()");
    await waitFor("document.querySelectorAll('tbody tr').length===4");
    await navigate("/trades?date=2026-10-05", "document.querySelectorAll('tbody tr').length===3 && document.querySelector('[aria-label=\"Remove date filter\"]') !== null");
    await evaluate(`document.querySelector('a[href="/trades/${ids[0]}"]').click()`);
    await waitFor(`location.pathname==='/trades/${ids[0]}' && document.body.innerText.includes('Trade Information')`);
    await evaluate("[...document.querySelectorAll('a')].find(e=>e.textContent.includes('Back to Trades')).click()");
    await waitFor("location.search.includes('date=2026-10-05') && document.body.innerText.includes('Back to Calendar')");
    await evaluate("[...document.querySelectorAll('a')].find(e=>e.textContent.includes('Back to Calendar')).click()");
    await waitFor("location.pathname==='/calendar' && location.search.includes('month=2026-10') && document.querySelector('time[datetime=\"2026-10-05\"]') !== null");
    await rpc("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await waitFor("window.innerWidth===390 && [...document.querySelectorAll('time[datetime]')].filter(t=>t.getClientRects().length).length===2");
    await screenshot("mobile.png");
    assert.equal(await evaluate<number>("[...document.querySelectorAll('time[datetime]')].filter(t=>t.getClientRects().length).length"), 2);
    assert.ok(await evaluate<boolean>("document.documentElement.scrollWidth <= 390"));
    await rpc("Emulation.setDeviceMetricsOverride", { width: 900, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(200);
    assert.equal(await evaluate<number>("[...document.querySelectorAll('time[datetime]')].filter(t=>t.getClientRects().length).length"), 31);
    assert.ok(await evaluate<boolean>("document.documentElement.scrollWidth <= 900"));
    await navigate(`/trades/${ids[0]}/edit`, "document.querySelector('textarea[name=entryReason]') !== null");
    await waitFor("document.body.innerText.includes('100% complete')");
    requests.length = 0;
    await evaluate("(() => { const field=document.querySelector('textarea[name=entryReason]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Calendar browser regression check'); field.dispatchEvent(new Event('input',{bubbles:true})); field.dispatchEvent(new Event('change',{bubbles:true})); })()");
    await evaluate("document.querySelector('form.space-y-5').requestSubmit()");
    await waitFor(`location.pathname==='/trades/${ids[0]}'`);
    assert.equal(requests.filter(request => request.method === "POST" && request.url.includes("/api/uploads")).length, 0);
    assert.equal(requests.filter(request => request.method === "PATCH" && request.url.endsWith(`/api/trades/${ids[0]}`)).length, 1);
    console.info("Calendar browser passed: desktop/tablet/mobile layout, keyboard day navigation, exact-date filters, individual trade navigation, calendar return, empty month, and ZERO uploads when editing existing screenshots. Screenshots: .calendar-artifacts/");
  } finally {
    socket?.close();
    chrome.kill();
    await sql`DELETE FROM users WHERE id = ${user.id}`;
    await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
