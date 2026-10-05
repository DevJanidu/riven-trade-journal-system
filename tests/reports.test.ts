import assert from "node:assert/strict";
import test from "node:test";
import { getReportRange, reportQuerySchema } from "../lib/reports";

test("weekly reports run from Monday through Sunday across month boundaries", () => {
  assert.deepEqual(getReportRange("weekly", "2026-10-01"), {
    start: "2026-09-28",
    endExclusive: "2026-10-05",
    endInclusive: "2026-10-04",
    label: "Sep 28, 2026 – Oct 4, 2026",
  });
});

test("monthly reports use the full calendar month", () => {
  const range = getReportRange("monthly", "2024-02-15");
  assert.equal(range.start, "2024-02-01");
  assert.equal(range.endInclusive, "2024-02-29");
  assert.equal(range.endExclusive, "2024-03-01");
});

test("yearly reports use the full calendar year", () => {
  const range = getReportRange("yearly", "2026-10-05");
  assert.equal(range.start, "2026-01-01");
  assert.equal(range.endInclusive, "2026-12-31");
  assert.equal(range.endExclusive, "2027-01-01");
});

test("report query rejects impossible dates", () => {
  assert.equal(reportQuerySchema.safeParse({ period: "monthly", date: "2026-02-30" }).success, false);
});
