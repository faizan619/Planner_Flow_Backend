import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { api, startServer, stopServer, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const sync = (token, cursor, changes = {}) => api("POST", "/api/v1/sync", { token, body: { cursor, changes } });

const subscription = (overrides = {}) => ({
  id: randomUUID(),
  name: "Netflix",
  amountMinor: 64_900,
  currency: "INR",
  category: "entertainment",
  method: "card",
  cycle: "month",
  cycleCount: 1,
  startDate: "2026-11-20",
  nextDue: "2026-11-20",
  trialEndsOn: "2026-11-20",
  status: "active",
  cancelledOn: null,
  note: "",
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

const payment = (subscriptionId, overrides = {}) => ({
  id: randomUUID(),
  kind: "expense",
  amountMinor: 64_900,
  currency: "INR",
  category: "entertainment",
  method: "card",
  date: "2026-11-20",
  note: "Netflix",
  owedId: null,
  subscriptionId,
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

describe("subscriptions", () => {
  test("a subscription syncs and comes back as sent", async () => {
    const { accessToken } = await verifiedUser("subs-basic");
    const sub = subscription();
    const res = await sync(accessToken, 0, { subscriptions: [sub] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.rejected, []);
    const back = (await sync(accessToken, 0)).body.changes.subscriptions;
    assert.deepEqual(back, [sub]);
    assert.equal(typeof back[0].amountMinor, "number");
    assert.equal(typeof back[0].cycleCount, "number");
  });

  test("a payment links to its subscription, sent in the same sync", async () => {
    const { accessToken } = await verifiedUser("subs-pay");
    const sub = subscription({ nextDue: "2026-12-20" });
    const paid = payment(sub.id);
    const res = await sync(accessToken, 0, { subscriptions: [sub], transactions: [paid] });
    assert.deepEqual(res.body.rejected, []);
    assert.equal(res.body.changes.transactions[0].subscriptionId, sub.id);
    assert.equal(res.body.changes.subscriptions[0].nextDue, "2026-12-20");
  });

  test("a payment of a subscription the user doesn't own is rejected", async () => {
    const alice = await verifiedUser("subs-owner-a");
    const bob = await verifiedUser("subs-owner-b");
    const sub = subscription();
    await sync(alice.accessToken, 0, { subscriptions: [sub] });
    const res = await sync(bob.accessToken, 0, { transactions: [payment(sub.id), payment(randomUUID())] });
    assert.equal(res.body.rejected.length, 2);
    assert.equal(res.body.rejected[0].reason, "Unknown subscription");
    assert.equal(res.body.changes.transactions.length, 0);
    assert.equal(res.body.changes.subscriptions.length, 0, "Bob never sees Alice's subscription");
  });

  test("older apps can still sync expenses without subscriptionId", async () => {
    const { accessToken } = await verifiedUser("subs-old-app");
    const old = payment(null);
    delete old.subscriptionId;
    const res = await sync(accessToken, 0, { transactions: [old] });
    assert.deepEqual(res.body.rejected, []);
    assert.equal(res.body.changes.transactions[0].subscriptionId, null);
  });

  test("invalid subscriptions are rejected one by one", async () => {
    const { accessToken } = await verifiedUser("subs-invalid");
    const bad = [
      subscription({ name: "  " }),
      subscription({ amountMinor: 0 }),
      subscription({ cycle: "day" }),
      subscription({ cycleCount: 0 }),
      subscription({ cycleCount: 37 }),
      subscription({ status: "paused" }),
      subscription({ nextDue: "2026-02-30" }),
      subscription({ nextDue: "2026-11-01" }), // before the first payment
      subscription({ category: "Streaming!" }),
      subscription({ method: "cheque" }),
    ];
    const res = await sync(accessToken, 0, { subscriptions: [...bad, subscription({ trialEndsOn: null, status: "cancelled", cancelledOn: "2026-11-11" })] });
    assert.equal(res.body.rejected.length, bad.length);
    assert.equal(res.body.changes.subscriptions.length, 1);
  });

  test("the export includes subscriptions", async () => {
    const { accessToken } = await verifiedUser("subs-export");
    const sub = subscription({ name: "Gym", category: "health", trialEndsOn: null });
    await sync(accessToken, 0, { subscriptions: [sub], transactions: [payment(sub.id)] });
    const link = await api("POST", "/api/v1/export/link", { token: accessToken, body: { format: "json" } });
    assert.equal(link.status, 201, JSON.stringify(link.body));
    const data = await (await fetch(link.body.url)).json();
    assert.equal(data.subscriptions.length, 1);
    assert.equal(data.subscriptions[0].name, "Gym");
    assert.equal(data.subscriptions[0].cycleCount, 1);
    assert.equal(data.transactions[0].subscriptionId, sub.id);
  });
});
