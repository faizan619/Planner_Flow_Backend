import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { BASE_URL, startServer, stopServer } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

describe("download page", () => {
  test("renders with the current release's link, version, size and checksum", async () => {
    const res = await fetch(`${BASE_URL}/download`);
    assert.equal(res.status, 200);
    const html = await res.text();
    const { release } = await import("../src/config/release.js");
    assert.match(html, /Download for Android/);
    assert.ok(html.includes(release.downloadUrl.replaceAll("&", "&amp;")), "links to the APK");
    assert.ok(html.includes(`Version ${release.version}`) || html.includes(`Version <!-- -->${release.version}`));
    assert.ok(html.includes(release.sha256), "shows the file checksum");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
  });

  test("the home page points to it", async () => {
    const html = await (await fetch(BASE_URL)).text();
    assert.match(html, /href="\/download"/);
  });
});

describe("latest app version", () => {
  test("tells the app the newest version and where to get it, without sign-in", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/app/latest`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const { release } = await import("../src/config/release.js");
    assert.equal(body.version, release.version);
    assert.equal(body.versionCode, release.versionCode);
    assert.equal(body.minimumVersionCode, release.minimumVersionCode);
    assert.deepEqual(body.whatsNew, release.whatsNew);
    assert.match(body.downloadPage, /\/download$/);
  });
});
