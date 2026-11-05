import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { api, sql, startServer, stopServer } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const crash = (name, extra = {}) => ({
  source: "native",
  name,
  message: "Something failed",
  stack: "at one\nat two",
  appVersion: "1.0.10",
  versionCode: 13,
  androidVersion: "15",
  device: "motorola edge",
  ...extra,
});
const send = (body) => api("POST", "/api/v1/crashes", { body });

describe("crash reports", () => {
  test("the same crash is one row with a count; a new version is a new row", async () => {
    const name = `Repeat${Date.now()}`;
    assert.equal((await send(crash(name))).status, 204);
    assert.equal((await send(crash(name))).status, 204);
    assert.equal((await send(crash(name, { versionCode: 14 }))).status, 204);
    const rows = await sql("SELECT version_code, occurrences FROM crash_reports WHERE error_name = ? ORDER BY version_code", [name]);
    assert.deepEqual(
      rows.map((row) => [row.version_code, row.occurrences]),
      [
        [13, 2],
        [14, 1],
      ]
    );
  });

  test("emails and long numbers are removed before saving", async () => {
    const name = `Scrub${Date.now()}`;
    await send(crash(name, { message: "No user a.person@example.com, phone 9876543210", stack: "at b@c.io" }));
    const [row] = await sql("SELECT message, stack FROM crash_reports WHERE error_name = ?", [name]);
    assert.equal(row.message, "No user [email], phone [number]");
    assert.equal(row.stack, "at [email]");
  });

  test("a report without the required fields is refused", async () => {
    const { status } = await send({ source: "native", name: "Nope" });
    assert.equal(status, 400);
  });
});
