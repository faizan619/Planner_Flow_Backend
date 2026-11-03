import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { api, startServer, stopServer, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const sync = (token, cursor, changes = {}) => api("POST", "/api/v1/sync", { token, body: { cursor, changes } });

const expense = (overrides = {}) => ({
  id: randomUUID(),
  kind: "expense",
  amountMinor: 45_000,
  currency: "INR",
  category: "food",
  method: "upi",
  date: "2026-11-02",
  note: "Dinner",
  owedId: null,
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

const owed = (overrides = {}) => ({
  id: randomUUID(),
  kind: "money",
  text: "Your share of dinner",
  remindAt: null,
  done: false,
  person: "Rahul",
  amountMinor: 60_000,
  currency: "INR",
  direction: "owed_to_me",
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

const budget = (category, amountMinor, overrides = {}) => ({
  id: `INR:${category}`,
  category,
  currency: "INR",
  amountMinor,
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

describe("spending: expenses, income and budgets", () => {
  test("expenses and income sync and come back as sent", async () => {
    const { accessToken } = await verifiedUser("spend-basic");
    const spent = expense();
    const salary = expense({ kind: "income", category: "salary", amountMinor: 5_000_000, method: "bank", note: "", date: "2026-11-01" });
    const first = await sync(accessToken, 0, { transactions: [spent, salary] });
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.rejected, []);

    const pulled = (await sync(accessToken, 0)).body.changes.transactions;
    assert.equal(pulled.length, 2);
    const back = pulled.find((t) => t.id === spent.id);
    assert.deepEqual(back, spent);
    assert.equal(typeof back.amountMinor, "number");
    assert.equal(pulled.find((t) => t.id === salary.id).kind, "income");
  });

  test("an expense split with someone links to their money entry, sent in the same sync", async () => {
    const { accessToken } = await verifiedUser("spend-split");
    const share = owed();
    const res = await sync(accessToken, 0, { reminders: [share], transactions: [expense({ amountMinor: 60_000, owedId: share.id })] });
    assert.deepEqual(res.body.rejected, []);
    assert.equal(res.body.changes.transactions[0].owedId, share.id);
  });

  test("a link to a money entry the user doesn't own is rejected", async () => {
    const alice = await verifiedUser("spend-owner-a");
    const bob = await verifiedUser("spend-owner-b");
    const share = owed();
    await sync(alice.accessToken, 0, { reminders: [share] });
    const res = await sync(bob.accessToken, 0, { transactions: [expense({ owedId: share.id }), expense({ owedId: randomUUID() })] });
    assert.equal(res.body.rejected.length, 2);
    assert.equal(res.body.rejected[0].reason, "Unknown money entry");
    assert.equal(res.body.changes.transactions.length, 0);
  });

  test("invalid transactions are rejected one by one", async () => {
    const { accessToken } = await verifiedUser("spend-invalid");
    const bad = [
      expense({ amountMinor: 0 }),
      expense({ amountMinor: 12.5 }),
      expense({ kind: "transfer" }),
      expense({ category: "Food & drink" }),
      expense({ currency: "rupees" }),
      expense({ method: "cheque" }),
      expense({ date: "2026-02-30" }),
      expense({ note: "x".repeat(301) }),
    ];
    const res = await sync(accessToken, 0, { transactions: [...bad, expense()] });
    assert.equal(res.body.rejected.length, bad.length);
    assert.equal(res.body.changes.transactions.length, 1);
  });

  test("budgets: overall and per category, keyed by currency and category", async () => {
    const { accessToken } = await verifiedUser("spend-budgets");
    const res = await sync(accessToken, 0, {
      budgets: [budget("all", 3_000_000), budget("food", 500_000), budget("food", 1, { id: "INR:rent" })],
    });
    assert.equal(res.body.rejected.length, 1, "the id must match currency and category");
    const pulled = res.body.changes.budgets.sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(
      pulled.map((b) => [b.id, b.amountMinor]),
      [
        ["INR:all", 3_000_000],
        ["INR:food", 500_000],
      ]
    );
  });

  test("users never see each other's spending", async () => {
    const alice = await verifiedUser("spend-idor-a");
    const bob = await verifiedUser("spend-idor-b");
    const mine = expense();
    await sync(alice.accessToken, 0, { transactions: [mine], budgets: [budget("all", 100_000)] });
    // Bob sends the same ids: they become his own rows, Alice's stay as they were.
    await sync(bob.accessToken, 0, { transactions: [{ ...mine, amountMinor: 1, updatedAt: Date.now() + 1000 }] });
    const alicePull = (await sync(alice.accessToken, 0)).body.changes;
    assert.equal(alicePull.transactions[0].amountMinor, 45_000);
    const bobPull = (await sync(bob.accessToken, 0)).body.changes;
    assert.equal(bobPull.budgets.length, 0);
    assert.equal(bobPull.transactions[0].amountMinor, 1);
  });

  test("spending is in the data export", async () => {
    const { accessToken } = await verifiedUser("spend-export");
    await sync(accessToken, 0, { transactions: [expense()], budgets: [budget("food", 500_000)] });
    const link = await api("POST", "/api/v1/export/link", { token: accessToken, body: { format: "json" } });
    assert.equal(link.status, 201, JSON.stringify(link.body));
    const download = await fetch(link.body.url);
    const data = await download.json();
    assert.equal(data.transactions.length, 1);
    assert.equal(data.transactions[0].amountMinor, 45_000);
    assert.equal(data.transactions[0].date, "2026-11-02");
    assert.deepEqual(data.budgets, [{ category: "food", currency: "INR", amountMinor: 500_000 }]);
  });
});
