import { test, expect } from "@playwright/test";

test("a customer statement prints their whole account", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await (
    testInfo.project.name === "mobile"
      ? page.locator(".bottom-nav")
      : page.locator(".sidebar nav")
  )
    .getByRole("button", { name: /^Ledger/ })
    .click();
  // There is no such document as a statement for "all customers", so the
  // action is not offered until an account is picked.
  await expect(
    page.getByRole("button", { name: "Print statement" }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "View customer" })
    .selectOption({ index: 1 });
  const ledgerEntries = await page
    .locator(".ledger-figures dd")
    .nth(2)
    .innerText();
  await page.getByRole("button", { name: "Print statement" }).click();

  const paper = page.locator(".invoice-paper");
  await expect(paper).toBeVisible();
  await expect(paper.locator(".paper-title h2")).toHaveText("STATEMENT");
  await expect(paper).toContainText("STATEMENT FOR");
  // The sheet carries the whole account, so its entry count must agree with
  // the ledger's total rather than with whatever page was on screen.
  await expect(paper.locator(".paper-customer")).toContainText(ledgerEntries);
  await expect(paper.locator(".paper-table tbody tr")).toHaveCount(
    Number(ledgerEntries),
  );
  // It settles an account, so it says how to pay and what is owed — and it is
  // not a receipt, which the sheet states rather than leaving to be assumed.
  await expect(paper).toContainText("Amount due");
  await expect(paper).toContainText("not a receipt");
  // The cash book has no statement: those figures belong to no customer.
  await expect(paper).not.toContainText("NET CASH");

  await page.screenshot({
    path: `test-results/${testInfo.project.name}-statement.png`,
    fullPage: true,
  });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".app-main")).not.toBeVisible();
  await expect(paper).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-statement-print.png`,
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen" });
  expect(errors).toEqual([]);
});
