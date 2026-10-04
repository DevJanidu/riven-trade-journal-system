import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const app = process.env.TEST_BASE_URL || 'http://localhost:3138';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function upload() {
  const form = new FormData();
  form.set('file', new File([png], 'test.png', { type: 'image/png' }));
  const response = await fetch(`${app}/api/uploads`, { method: 'POST', body: form });
  const json = await response.json();
  assert.equal(response.status, 201, json.error);
  return json.data.key;
}

async function run() {
  let id;
  const createdIds = [];
  const keys = [];
  let chrome;
  let socket;
  let profile;
  try {
    const setups = await (await fetch(`${app}/api/setup-types`)).json();
    const setup = setups.data.find(item => item.rules.length);
    assert.ok(setup, 'A setup with checklist rules is required');
    keys.push(await upload(), await upload());
    const trade = {
      instrument: 'XAUUSD', date: '2026-10-04', session: 'London', direction: 'Long',
      entry: 4000, stopLoss: 3990, takeProfit: 4020, riskAmount: 25, profitLoss: 50,
      profitBooked: 0, breakEvenAfterProfit: false, setup: setup.name, setupGrade: 'A+',
      setupChecklist: setup.rules, setupAvoidChecklist: [], psychologyReady: true,
      psychologyAnswer: 'Temporary browser test', entryReason: 'Temporary browser test',
      wentWell: '', wentWrong: '', improvement: '', followedRules: true, emotion: 'Calm',
      beforeScreenshot: keys[0], afterScreenshot: keys[1],
    };
    const created = await (await fetch(`${app}/api/trades`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trade),
    })).json();
    assert.equal(created.success, true, created.error);
    id = created.data.id;

    profile = await mkdtemp(path.join(os.tmpdir(), 'tradezilla-browser-'));
    const port = 20000 + Math.floor(Math.random() * 10000);
    chrome = spawn(chromePath, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
    ], { windowsHide: true, stdio: 'ignore' });
    let target;
    for (let i = 0; i < 50; i++) {
      try {
        const tabs = await (await fetch(`http://localhost:${port}/json/list`)).json();
        target = tabs.find(tab => tab.type === 'page');
        if (target) break;
      } catch { /* Chrome is starting. */ }
      await sleep(100);
    }
    assert.ok(target, 'Chrome debugging target did not start');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let nextId = 1;
    const pending = new Map();
    const requests = [];
    const tracked = new Map();
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const task = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) task.reject(new Error(message.error.message));
        else task.resolve(message.result);
      } else if (message.method === 'Network.requestWillBeSent') {
        const request = message.params.request;
        if (request.method === 'PATCH' || request.url.includes('/api/uploads') || (request.method === 'POST' && request.url.endsWith('/api/trades'))) {
          const item = { method: request.method, url: request.url, body: request.postData, at: message.params.timestamp };
          requests.push(item);
          tracked.set(message.params.requestId, item);
        }
      } else if (message.method === 'Network.responseReceived') {
        const item = tracked.get(message.params.requestId);
        if (item) item.responseMs = Math.round((message.params.timestamp - item.at) * 1000);
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const commandId = nextId++;
      pending.set(commandId, { resolve, reject });
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    const until = async (expression, expected = true) => {
      for (let i = 0; i < 200; i++) {
        if ((await evaluate(expression)) === expected) return;
        await sleep(100);
      }
      throw new Error(`Timed out waiting for ${expression}`);
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    const edit = async () => {
      await send('Page.navigate', { url: `${app}/trades/${id}/edit` });
      await until('Boolean(document.querySelector("form button[type=submit]"))');
      await until(`document.querySelector("input[name=setup]")?.value === ${JSON.stringify(setup.name)}`);
      await until(`document.querySelectorAll('input[type=checkbox]').length === ${setup.rules.length}`);
    };
    await edit();
    const initialRequests = requests.length;
    await evaluate('document.querySelector("form button[type=submit]").click()');
    try {
      await until('Boolean(document.querySelector("[role=status]")?.textContent.includes("No changes to save"))');
    } catch (error) {
      console.error('Form feedback:', await evaluate('({alert:document.querySelector("[role=alert]")?.textContent, status:document.querySelector("[role=status]")?.textContent, button:document.querySelector("form button[type=submit]")?.textContent})'));
      throw error;
    }
    assert.equal(requests.length, initialRequests, 'No-change save made a network mutation');

    await evaluate('document.querySelector("button[aria-label^=\\"Emotion:\\"]").click()');
    await until('Boolean(document.querySelector("[role=listbox][aria-label=Emotion]"))');
    await evaluate('[...document.querySelectorAll("[role=listbox][aria-label=Emotion] [role=option]")].find(x => x.textContent.includes("Confident")).click()');
    const beforeSave = requests.length;
    const textSaveStarted = performance.now();
    await evaluate('document.querySelector("form button[type=submit]").click()');
    await until('location.pathname === "/trades/' + id + '"');
    const textSaveMs = Math.round(performance.now() - textSaveStarted);
    const mutations = requests.slice(beforeSave);
    assert.equal(mutations.filter(request => request.method === 'PATCH').length, 1);
    assert.equal(mutations.filter(request => request.method === 'POST' && request.url.includes('/api/uploads')).length, 0);
    assert.deepEqual(JSON.parse(mutations.find(request => request.method === 'PATCH').body), { emotion: 'Confident' });
    const saved = await (await fetch(`${app}/api/trades/${id}`)).json();
    assert.equal(saved.data.emotion, 'Confident');
    assert.equal(saved.data.beforeScreenshot, keys[0]);
    assert.equal(saved.data.afterScreenshot, keys[1]);
    console.log(`Browser edit: one PATCH with {emotion:"Confident"}, zero uploads; existing images unchanged; API=${mutations.find(request => request.method === 'PATCH').responseMs} ms, click-to-navigation=${textSaveMs} ms`);
    console.log('Browser no-change save: zero mutation requests');

    await edit();
    await evaluate('document.querySelector("button[aria-label^=\\"Emotion:\\"]").click()');
    await until('Boolean(document.querySelector("[role=listbox][aria-label=Emotion]"))');
    await evaluate('[...document.querySelectorAll("[role=listbox][aria-label=Emotion] [role=option]")].find(x => x.textContent.includes("Calm")).click()');
    const beforeDoubleClick = requests.length;
    await evaluate('const button = document.querySelector("form button[type=submit]"); button.click(); button.click()');
    await until('location.pathname === "/trades/' + id + '"');
    assert.equal(requests.slice(beforeDoubleClick).filter(request => request.method === 'PATCH').length, 1);
    console.log('Browser double-click: one PATCH');

    await edit();
    const beforeImageSave = requests.length;
    await evaluate(`(() => {
      const bytes = Uint8Array.from(atob('${png.toString('base64')}'), char => char.charCodeAt(0));
      const file = new File([bytes], 'replacement.png', { type: 'image/png' });
      const transfer = new DataTransfer(); transfer.items.add(file);
      const input = document.querySelector('input[name=beforeScreenshot]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await until('Boolean(document.querySelector("img[src^=blob]") || document.querySelector("img[src*=blob]") )');
    const imageSaveStarted = performance.now();
    await evaluate('document.querySelector("form button[type=submit]").click()');
    try {
      await until('location.pathname === "/trades/' + id + '"');
    } catch (error) {
      console.error('Image save feedback:', await evaluate('({alert:document.querySelector("[role=alert]")?.textContent, status:document.querySelector("[role=status]")?.textContent, button:document.querySelector("form button[type=submit]")?.textContent})'));
      console.error('Image save requests:', requests.slice(beforeImageSave).map(request => ({ method: request.method, url: request.url, responseMs: request.responseMs })));
      throw error;
    }
    const imageSaveMs = Math.round(performance.now() - imageSaveStarted);
    const imageMutations = requests.slice(beforeImageSave);
    assert.equal(imageMutations.filter(request => request.method === 'POST' && request.url.endsWith('/api/uploads')).length, 1);
    assert.equal(imageMutations.filter(request => request.method === 'PATCH').length, 1);
    const imagePatch = JSON.parse(imageMutations.find(request => request.method === 'PATCH').body);
    assert.deepEqual(Object.keys(imagePatch), ['beforeScreenshot']);
    const imageSaved = await (await fetch(`${app}/api/trades/${id}`)).json();
    assert.equal(imageSaved.data.beforeScreenshot, imagePatch.beforeScreenshot);
    assert.equal(imageSaved.data.afterScreenshot, keys[1]);
    console.log(`Browser before-image replacement: one upload, one PATCH, existing after-image unchanged; upload=${imageMutations.find(request => request.method === 'POST' && request.url.endsWith('/api/uploads')).responseMs} ms, API=${imageMutations.find(request => request.method === 'PATCH').responseMs} ms, click-to-navigation=${imageSaveMs} ms`);

    await edit();
    await evaluate(`(() => {
      const bytes = Uint8Array.from(atob('${png.toString('base64')}'), char => char.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], 'replacement.png', { type: 'image/png' }));
      const input = document.querySelector('input[name=afterScreenshot]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      window.__nativeFetch = window.fetch;
      window.fetch = (url, options) => String(url) === '/api/uploads'
        ? Promise.resolve(new Response(JSON.stringify({ success: false, error: 'Simulated upload failure' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
        : window.__nativeFetch(url, options);
    })()`);
    const beforeUploadFailure = requests.length;
    await evaluate('document.querySelector("form button[type=submit]").click()');
    await until('Boolean(document.querySelector("[role=alert]")?.textContent.includes("Simulated upload failure"))');
    assert.equal(requests.slice(beforeUploadFailure).filter(request => request.method === 'PATCH').length, 0);
    await evaluate('window.fetch = window.__nativeFetch');
    console.log('Browser upload failure: error shown, zero PATCH requests');

    await evaluate(`(() => {
      window.__nativeFetch = window.fetch;
      window.fetch = (url, options) => String(url).includes('/api/trades/${id}') && options?.method === 'PATCH'
        ? Promise.resolve(new Response(JSON.stringify({ success: false, error: 'Simulated database failure' }), { status: 500, headers: { 'Content-Type': 'application/json' } }))
        : window.__nativeFetch(url, options);
    })()`);
    const beforeDatabaseFailure = requests.length;
    await evaluate('document.querySelector("form button[type=submit]").click()');
    await until('Boolean(document.querySelector("[role=alert]")?.textContent.includes("Simulated database failure"))');
    await until('document.querySelector("form button[type=submit]")?.textContent.includes("Update Trade")');
    const failedSaveRequests = requests.slice(beforeDatabaseFailure);
    assert.equal(failedSaveRequests.filter(request => request.method === 'POST' && request.url.endsWith('/api/uploads')).length, 1);
    assert.equal(failedSaveRequests.filter(request => request.method === 'DELETE' && request.url.includes('/api/uploads/')).length, 1);
    await evaluate('window.fetch = window.__nativeFetch');
    const persisted = await (await fetch(`${app}/api/trades/${id}`)).json();
    assert.equal(persisted.data.afterScreenshot, keys[1]);
    console.log('Browser database failure: uploaded replacement cleaned up, persisted image unchanged');

    const prepareCreate = async (withImages) => {
      await send('Page.navigate', { url: `${app}/journal` });
      await until('Boolean(document.querySelector("form button[type=submit]"))');
      await until(`document.querySelector("input[name=setup]")?.value === ${JSON.stringify(setup.name)}`);
      await until('document.querySelectorAll("input[type=checkbox]").length > 0');
      await evaluate(`(() => {
        const set = (name, value) => {
          const input = document.querySelector('input[name=' + name + ']');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        set('entry', '4000'); set('stopLoss', '3990'); set('takeProfit', '4020'); set('profitLoss', '50');
        document.querySelectorAll('input[type=checkbox]').forEach(input => input.click());
      })()`);
      await evaluate('document.querySelector("button[aria-label^=\\"Am I ready to lose\\"]").click()');
      await until('Boolean(document.querySelector("[role=listbox]"))');
      await evaluate('[...document.querySelectorAll("[role=listbox] [role=option]")].find(x => x.textContent.includes("Yes")).click()');
      await until('Boolean(document.body.textContent.includes("100% complete"))');
      if (withImages) {
        await evaluate(`(() => {
          const bytes = Uint8Array.from(atob('${png.toString('base64')}'), char => char.charCodeAt(0));
          for (const name of ['beforeScreenshot', 'afterScreenshot']) {
            const transfer = new DataTransfer();
            transfer.items.add(new File([bytes], name + '.png', { type: 'image/png' }));
            const input = document.querySelector('input[name=' + name + ']');
            input.files = transfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        })()`);
        await until('document.querySelectorAll("img[src^=blob], img[src*=blob]").length === 2');
      }
    };
    for (const withImages of [false, true]) {
      await prepareCreate(withImages);
      const beforeCreate = requests.length;
      const createStarted = performance.now();
      await evaluate('document.querySelector("form button[value=complete]").click()');
      await until('location.pathname.startsWith("/trades/") && !location.pathname.endsWith("/edit")');
      const createMs = Math.round(performance.now() - createStarted);
      const newId = await evaluate('location.pathname.split("/")[2]');
      createdIds.push(newId);
      const mutations = requests.slice(beforeCreate);
      const uploads = mutations.filter(request => request.method === 'POST' && request.url.endsWith('/api/uploads'));
      assert.equal(uploads.length, withImages ? 2 : 0);
      assert.equal(mutations.filter(request => request.method === 'POST' && request.url.endsWith('/api/trades')).length, 1);
      if (withImages) assert.ok(Math.abs(uploads[0].at - uploads[1].at) < 0.5, 'Screenshot uploads were not started together');
      const createRequest = mutations.find(request => request.method === 'POST' && request.url.endsWith('/api/trades'));
      console.log(`Browser create ${withImages ? 'with two images' : 'without images'}: ${uploads.length} uploads, one POST; uploads=${uploads.map(request => request.responseMs).join(',') || 'none'} ms, API=${createRequest.responseMs} ms, click-to-navigation=${createMs} ms`);
    }
  } finally {
    if (socket) socket.close();
    if (chrome) chrome.kill();
    if (id) await fetch(`${app}/api/trades/${id}`, { method: 'DELETE' }).catch(() => undefined);
    for (const createdId of createdIds) await fetch(`${app}/api/trades/${createdId}`, { method: 'DELETE' }).catch(() => undefined);
    for (const key of keys) await fetch(`${app}/api/uploads/${key}`, { method: 'DELETE' }).catch(() => undefined);
    if (profile && path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
    }
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
