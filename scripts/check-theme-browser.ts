import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { createSessionToken, sessionCookieName } from "../lib/auth/token";

config({ path: ".env.development.local", quiet: true });
const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
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
    const account = await getDb().execute(sql`SELECT users.id, users.password_hash, max(trades.date)::text AS month FROM users LEFT JOIN trades ON trades.user_id=users.id GROUP BY users.id ORDER BY count(trades.id) DESC LIMIT 1`);
    assert.ok(account.rows[0], "An existing account is required for read-only visual checks");
    const user = account.rows[0];
    const month = String(user.month || "2026-10").slice(0,7);
    await rpc("Network.enable");
    await rpc("Page.enable");
    await rpc("Network.setCookie", { name: sessionCookieName, value: await createSessionToken(String(user.id), String(user.password_hash)), url: baseUrl, httpOnly: true });
    await rpc("Page.addScriptToEvaluateOnNewDocument", { source: "if(!localStorage.getItem('theme'))localStorage.setItem('theme','dark')" });
    await rpc("Emulation.setDeviceMetricsOverride", { width:1440, height:1100, deviceScaleFactor:1, mobile:false });
    const artifacts = await mkdtemp(path.join(tmpdir(), "tradezilla-theme-preview-"));
    async function capture(name: string) {
      const screenshot = await rpc<{data:string}>("Page.captureScreenshot", { format:"png", captureBeyondViewport:true });
      await writeFile(path.join(artifacts, name + ".png"), Buffer.from(screenshot.data,"base64"));
    }
    await rpc("Page.navigate", { url: baseUrl + "/dashboard?month=" + month });
    await waitFor("document.querySelector('.dashboard')");
    await pause(1200);
    assert.equal(await evaluate<string>("getComputedStyle(document.body).backgroundColor"), "rgb(7, 11, 22)");
    const kpis = await evaluate<number>("document.querySelectorAll('.kpi-card').length");
    if (kpis) {
      assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('.kpi-card')).backgroundColor"), "rgb(13, 20, 38)");
      assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('.kpi-decoration')).display"), "none");
    }
    await capture("dashboard-dark");
    const width = await evaluate<number>("document.querySelector('.dashboard').getBoundingClientRect().width");
    await evaluate("document.querySelector('[aria-label=\\\"Switch to light theme\\\"]').click()");
    await waitFor("document.documentElement.dataset.theme==='light'");
    await pause(400);
    assert.equal(await evaluate<string>("getComputedStyle(document.body).backgroundColor"), "rgb(248, 250, 253)");
    if (kpis) {
      assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('.kpi-card')).backgroundColor"), "rgb(255, 255, 255)");
      assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('.kpi-decoration')).display"), "none");
    }
    assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('aside')).backgroundColor"), "rgb(255, 255, 255)");
    assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('a.bg-primary')).backgroundColor"), "rgb(17, 43, 128)");
    assert.ok(Math.abs(await evaluate<number>("document.querySelector('.dashboard').getBoundingClientRect().width") - width) <= 8, "Dashboard layout stays consistent within the scrollbar width");
    await capture("dashboard-light");
    const tradeRow = await getDb().execute(sql`SELECT id FROM trades WHERE user_id=${String(user.id)} ORDER BY date DESC LIMIT 1`);
    const tradeId = tradeRow.rows[0]?.id;
    const pages = [
      { route: "dashboard?month=" + month, ready: "document.querySelector('.dashboard')", name: "dashboard" },
      { route: "calendar?month=" + month, ready: "document.body.innerText.includes('Trading days')", name: "calendar" },
      { route: "trades?month=" + month, ready: "document.querySelector('[aria-label=\"Choose trading month\"]')", name: "trades" },
      { route: "journal", ready: "document.querySelector('[aria-label=\"Choose date\"]')", name: "journal" },
      { route: "settings/setups", ready: "document.querySelector('input[placeholder=\"Setup name\"]')", name: "setups" },
      ...(tradeId ? [
        { route: "trades/" + tradeId, ready: "document.body.innerText.includes('Why did I enter this trade?')", name: "trade-details" },
        { route: "trades/" + tradeId + "/edit", ready: "document.querySelector('[aria-label=\"Choose date\"]')", name: "edit-trade" },
      ] : []),
    ];
    async function checkLightSurfaces() {
      const darkSurfaces = await evaluate<string[]>(`Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().width && el.getBoundingClientRect().height && ['rgb(7, 11, 22)','rgb(10, 16, 32)','rgb(13, 20, 38)','rgb(17, 26, 48)','rgb(22, 32, 58)'].includes(getComputedStyle(el).backgroundColor)).map(el=>el.tagName+'.'+el.className)`);
      assert.deepEqual(darkSurfaces, [], "Light mode must not retain dark theme surfaces");
      assert.equal(await evaluate<string>("getComputedStyle(document.body).color"), "rgb(11, 26, 74)");
    }
    for (const theme of ["light", "dark"] as const) {
      await evaluate(`localStorage.setItem('theme',${JSON.stringify(theme)});document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
      for (const page of pages) {
        await rpc("Page.navigate", { url: baseUrl + "/" + page.route });
        await waitFor("document.querySelector('main') && (" + page.ready + ")");
        if (page.name === "setups") await waitFor("!document.body.innerText.includes('Loading setup types')");
        if (page.name === "trade-details") await waitFor("Array.from(document.querySelectorAll('img')).every(image=>image.complete)");
        await pause(700);
        assert.equal(await evaluate<string>("getComputedStyle(document.body).backgroundColor"), theme === "light" ? "rgb(248, 250, 253)" : "rgb(7, 11, 22)");
        if (theme === "light") await checkLightSurfaces();
        await capture(page.name+"-"+theme);
        if (page.name === "dashboard" && kpis) {
          const chart = await evaluate<{x:number;y:number}>("(()=>{const rect=document.querySelector('.recharts-wrapper').getBoundingClientRect();return {x:rect.right-30,y:rect.top+100}})()");
          await rpc("Input.dispatchMouseEvent", { type:"mouseMoved", ...chart });
          await waitFor("document.querySelector('.recharts-tooltip-wrapper .theme-popover')");
          assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('.recharts-tooltip-wrapper .theme-popover')).backgroundColor"), theme === "light" ? "rgb(255, 255, 255)" : "rgb(22, 32, 58)");
          await capture("chart-tooltip-"+theme);
          await rpc("Input.dispatchMouseEvent", { type:"mouseMoved", x:10, y:10 });
        }
        if (page.name === "journal" || page.name === "trades") {
          await evaluate("document.querySelector('button[role=combobox]').click()");
          await waitFor("document.querySelector('[role=listbox]')");
          assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('[role=listbox]')).backgroundColor"), theme === "light" ? "rgb(255, 255, 255)" : "rgb(22, 32, 58)");
          await capture(page.name+"-select-"+theme);
          await evaluate("document.querySelector('button[role=combobox]').click()");
          await evaluate(`document.querySelector('[aria-label=${JSON.stringify(page.name === "journal" ? "Choose date" : "Choose trading month")} ]').click()`);
          await waitFor("document.querySelector('[role=dialog]')");
          assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('[role=dialog]')).backgroundColor"), theme === "light" ? "rgb(255, 255, 255)" : "rgb(22, 32, 58)");
          await capture(page.name+"-picker-"+theme);
        }
        if (page.name === "trade-details") {
          await evaluate("Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('Delete Trade')).click()");
          await waitFor("document.querySelector('[aria-labelledby=delete-title]')");
          assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('[aria-labelledby=delete-title] > div')).backgroundColor"), theme === "light" ? "rgb(255, 255, 255)" : "rgb(17, 26, 48)");
          await capture("delete-modal-"+theme);
          await evaluate("document.querySelector('[aria-label=Close]').click()");
          const screenshot = await evaluate<boolean>("Boolean(document.querySelector('button > img'))");
          if (screenshot) {
            await evaluate("document.querySelector('button > img').parentElement.click()");
            await waitFor("document.querySelector('[aria-label=\"Close screenshot\"]')");
            assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('[aria-label=\"Close screenshot\"]')).color"), "rgb(255, 255, 255)");
            await capture("screenshot-viewer-"+theme);
            await evaluate("document.querySelector('[aria-label=\"Close screenshot\"]').click()");
          }
        }
      }
      await rpc("Emulation.setDeviceMetricsOverride", { width:390, height:844, deviceScaleFactor:1, mobile:true });
      for (const route of ["dashboard?month="+month, "calendar?month="+month, "journal"]) {
        await rpc("Page.navigate", { url:baseUrl+"/"+route });
        await waitFor("document.querySelector('main') && document.querySelector('h1')");
        await pause(700);
        await capture(route.split('?')[0]+"-mobile-"+theme);
      }
      await rpc("Emulation.setDeviceMetricsOverride", { width:1440, height:1100, deviceScaleFactor:1, mobile:false });
    }
    await rpc("Network.deleteCookies", { name:sessionCookieName, url:baseUrl });
    for (const theme of ["light", "dark"] as const) {
      await evaluate(`localStorage.setItem('theme',${JSON.stringify(theme)})`);
      for (const route of ["login", "register", "forgot-password"]) {
        await rpc("Page.navigate", { url:baseUrl+"/"+route });
        await waitFor("document.querySelector('.auth-panel') && document.querySelector('input')");
        await pause(400);
        assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('.auth-panel')).backgroundColor"), "rgb(248, 250, 253)");
        assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('.auth-panel .form-input')).backgroundColor"), "rgb(255, 255, 255)");
        assert.equal(await evaluate<string>("getComputedStyle(document.querySelector('.auth-panel form > button')).backgroundColor"), "rgb(17, 43, 128)");
        assert.ok(await evaluate<boolean>("Boolean(document.querySelector('.auth-wallpaper img'))"));
        await capture(route+"-"+theme);
      }
    }
    console.log("Read-only visual checks passed for light/dark dashboard, calendar, trades, journal, setups, trade details, edit forms, selects, date/month pickers, delete dialog, mobile layouts and authentication pages. No form submissions or database writes.");
    console.log("Screenshots: "+artifacts);

  } finally {
    socket?.close();
    chrome.kill();
    assert.ok(path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
