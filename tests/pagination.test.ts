import assert from "node:assert/strict";
import test from "node:test";
import { parsePage, paginate } from "../lib/pagination";

test("pagination rejects malformed and unsafe browser page values", () => {
  for (const value of [undefined, ["2"], "-1", "0", "1.5", "Infinity", "1e3", "oops", "9007199254740992"]) assert.equal(parsePage(value), 1);
  assert.equal(parsePage("2"), 2);
});
test("pagination clamps after deletion, handles empty lists and last partial pages", () => {
  assert.deepEqual(paginate(23, 3), { page: 3, totalPages: 3, offset: 20, end: 23 });
  assert.deepEqual(paginate(20, 3), { page: 2, totalPages: 2, offset: 10, end: 20 });
  assert.deepEqual(paginate(0, 99), { page: 1, totalPages: 1, offset: 0, end: 0 });
  assert.equal(paginate(100, Infinity).page, 1);
});
test("independent table pagination covers every row once without changing full-period totals", () => {
  const rows = Array.from({ length: 100 }, (_, index) => index + 1);
  const visible = Array.from({ length: 10 }, (_, index) => {
    const range = paginate(rows.length, index + 1); return rows.slice(range.offset, range.end);
  }).flat();
  assert.deepEqual(visible, rows);
  assert.equal(paginate(7, 2, 5).offset, 5);
  assert.equal(rows.reduce((sum, row) => sum + row, 0), 5050);
});
