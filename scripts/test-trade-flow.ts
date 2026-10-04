import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3138";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
const ids = new Set<string>();
const imageKeys = new Set<string>();

const trade = {
  instrument: "XAUUSD", date: "2026-10-04", session: "London", direction: "Long",
  entry: 4000, stopLoss: 3990, takeProfit: 4020, riskAmount: 25,
  profitLoss: 50, profitBooked: 0, breakEvenAfterProfit: false,
  setup: "Liquidity Sweep", setupGrade: "A", setupChecklist: [], setupAvoidChecklist: [],
  psychologyReady: true, psychologyAnswer: "Temporary performance test",
  entryReason: "Temporary performance test", wentWell: "", wentWrong: "", improvement: "",
  followedRules: true, emotion: "Calm",
};

async function jsonRequest(method: string, path: string, body?: unknown) {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, {
    method, headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, json, ms: Math.round(performance.now() - started) };
}

async function upload() {
  const form = new FormData();
  form.set("file", new File([png], "temporary.png", { type: "image/png" }));
  const started = performance.now();
  const response = await fetch(`${base}/api/uploads`, { method: "POST", body: form });
  const json = await response.json();
  assert.equal(response.status, 201, json.error);
  imageKeys.add(json.data.key);
  console.log(`image upload: ${Math.round(performance.now() - started)} ms`);
  return json.data.key as string;
}

async function create(overrides: Record<string, unknown> = {}) {
  const result = await jsonRequest("POST", "/api/trades", { ...trade, ...overrides });
  assert.equal(result.status, 201, result.json.error);
  ids.add(result.json.data.id);
  return result;
}

async function patch(id: string, changes: Record<string, unknown>) {
  const result = await jsonRequest("PATCH", `/api/trades/${id}`, changes);
  assert.equal(result.status, 200, result.json.error);
  return result;
}

async function run() {
  try {
    const noImages = await create();
    const id = noImages.json.data.id as string;
    console.log(`create without images: ${noImages.ms} ms; 1 request, 0 uploads`);
    for (const [label, changes] of [
      ["setup", { setup: "Reversal" }],
      ["emotion", { emotion: "Confident" }],
      ["journal text", { wentWell: "Measured text update" }],
      ["entry/SL/TP", { entry: 4001, stopLoss: 3990, takeProfit: 4021 }],
      ["P&L", { profitLoss: 0 }],
    ] as const) {
      const result = await patch(id, changes);
      console.log(`${label} edit: ${result.ms} ms; 1 PATCH, 0 uploads`);
    }
    const details = await jsonRequest("GET", `/api/trades/${id}`);
    assert.equal(details.json.data.setup, "Reversal");
    assert.equal(details.json.data.emotion, "Confident");
    assert.equal(details.json.data.wentWell, "Measured text update");
    assert.equal(details.json.data.actualR, 0);
    assert.equal(details.json.data.result, "Break Even");

    const beforeOnly = await upload();
    const withBefore = await create({ beforeScreenshot: beforeOnly });
    assert.equal(withBefore.json.data.beforeScreenshot, beforeOnly);
    const afterOnly = await upload();
    const withAfter = await create({ afterScreenshot: afterOnly });
    assert.equal(withAfter.json.data.afterScreenshot, afterOnly);
    const [bothBefore, bothAfter] = await Promise.all([upload(), upload()]);
    const withBoth = await create({ beforeScreenshot: bothBefore, afterScreenshot: bothAfter });
    const imageTradeId = withBoth.json.data.id as string;
    console.log(`create with both images: ${withBoth.ms} ms for POST; uploads ran concurrently`);

    const textOnly = await patch(imageTradeId, { setup: "Continuation" });
    assert.equal(textOnly.json.data.beforeScreenshot, bothBefore);
    assert.equal(textOnly.json.data.afterScreenshot, bothAfter);
    console.log(`text edit with existing images: ${textOnly.ms} ms; 1 PATCH, 0 uploads`);
    const newBefore = await upload();
    const beforeEdit = await patch(imageTradeId, { beforeScreenshot: newBefore });
    assert.equal(beforeEdit.json.data.beforeScreenshot, newBefore);
    assert.equal(beforeEdit.json.data.afterScreenshot, bothAfter);
    const newAfter = await upload();
    const afterEdit = await patch(imageTradeId, { afterScreenshot: newAfter });
    assert.equal(afterEdit.json.data.beforeScreenshot, newBefore);
    assert.equal(afterEdit.json.data.afterScreenshot, newAfter);
    const [replacementBefore, replacementAfter] = await Promise.all([upload(), upload()]);
    const bothEdit = await patch(imageTradeId, { beforeScreenshot: replacementBefore, afterScreenshot: replacementAfter });
    assert.equal(bothEdit.json.data.beforeScreenshot, replacementBefore);
    assert.equal(bothEdit.json.data.afterScreenshot, replacementAfter);
    console.log(`replace both images: ${bothEdit.ms} ms for PATCH; uploads ran concurrently`);
    const removeBefore = await patch(imageTradeId, { beforeScreenshot: null });
    assert.equal(removeBefore.json.data.beforeScreenshot, undefined);
    assert.equal(removeBefore.json.data.afterScreenshot, replacementAfter);
    const removeAfter = await patch(imageTradeId, { afterScreenshot: null });
    assert.equal(removeAfter.json.data.afterScreenshot, undefined);
    console.log(`remove images: before=${removeBefore.ms} ms, after=${removeAfter.ms} ms; 0 uploads`);

    const badForm = new FormData();
    badForm.set("file", new File([Buffer.from("invalid")], "bad.png", { type: "image/png" }));
    const badUpload = await fetch(`${base}/api/uploads`, { method: "POST", body: badForm });
    assert.equal(badUpload.status, 400);
    console.log("invalid image upload rejected before database update");

    const dashboard = await jsonRequest("GET", "/api/dashboard?month=2026-10");
    assert.equal(dashboard.status, 200);
    assert.ok(dashboard.json.data.summary.totalTrades >= 4);
    console.log("dashboard reflects saved test trades");
  } finally {
    for (const id of ids) await jsonRequest("DELETE", `/api/trades/${id}`).catch(() => undefined);
    for (const key of imageKeys) await fetch(`${base}/api/uploads/${key}`, { method: "DELETE" }).catch(() => undefined);
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
