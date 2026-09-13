import { test, expect } from "@playwright/test";
test("customer, fractional invoice, settlement, ledger and print workflow", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer picture." }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-overview.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // Mobile navigates from the bottom bar; Settings lives in the topbar there.
  const nav = async (name: string) => {
    if (testInfo.project.name === "mobile") {
      if (name === "Settings") {
        await page.getByRole("button", { name: "Settings" }).click();
        return;
      }
      await page
        .locator(".bottom-nav")
        .getByRole("button", { name: new RegExp(`^${name}`) })
        .click();
      return;
    }
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .click();
  };
  await nav("Settings");
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Sample Sole Trader");
  await page
    .getByLabel("Proprietor / registered person's name (optional)")
    .fill("Example Owner");
  await page
    .getByLabel("Business registration number (BRN)")
    .fill("TEST-INDIVIDUAL");
  await page.getByLabel("Telephone", { exact: true }).fill("0000 0000");
  await page.getByLabel("Bank name", { exact: true }).fill("Example Bank");
  await page
    .getByLabel("Account holder name", { exact: true })
    .fill("Example Owner");
  await page
    .getByLabel("Bank account number", { exact: true })
    .fill("000012340000");
  await page.getByRole("button", { name: "Save details" }).click();
  await nav("Customers");
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Customer name").fill("Test Restaurant");
  await dialog.getByLabel("Address", { exact: true }).fill("Port Louis");
  await dialog.getByRole("button", { name: "Save customer" }).click();
  await expect(dialog).not.toBeVisible();
  await nav("Invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await dialog
    .getByRole("combobox", { name: "Customer", exact: true })
    .selectOption({ label: "Test Restaurant" });
  await dialog.getByLabel("Item 1 description").fill("Fresh herbs");
  await dialog.getByLabel("Item 1 quantity").fill("0.125");
  await dialog.getByLabel("Item 1 price").fill("60.04");
  await dialog.getByLabel("Item 1 unit").selectOption("kg");
  await dialog.getByLabel("Tax rate (%)").fill("15");
  await dialog.getByLabel("Deposit received").fill("2");
  await dialog
    .getByRole("button", { name: "Create invoice", exact: true })
    .click();
  await expect(dialog.locator(".paper-grand")).toContainText("8.64");
  await expect(dialog.locator(".paper-header")).toContainText(
    "Sample Sole Trader",
  );
  await expect(dialog.locator(".paper-header")).toContainText(
    "TEST-INDIVIDUAL",
  );
  await expect(dialog.locator(".paper-bank")).toContainText("000012340000");
  await expect(dialog.locator(".paper-totals")).toContainText("6.64");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await dialog.getByLabel("Amount (MUR)").fill("6.64");
  await dialog.getByRole("button", { name: "Save payment" }).click();
  await expect(dialog.locator(".print-toolbar .badge")).toHaveText("Paid");
  await expect(dialog.locator(".paper-totals")).toContainText("0.00");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".app-main")).not.toBeVisible();
  await expect(dialog.locator(".invoice-paper")).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-invoice-print.png`,
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen" });
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await nav("Ledger");
  await page
    .getByRole("combobox", { name: "View customer" })
    .selectOption({ label: "Test Restaurant" });
  await expect(page.locator(".ledger-summary h2")).toContainText("0.00");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe("opervia-ledger.csv");
  await nav("Invoices");
  await page.getByRole("button", { name: "Blank invoice" }).click();
  await expect(dialog.locator(".paper-table tbody tr")).toHaveCount(14);
  await expect(dialog.locator(".paper-bank")).toContainText("000012340000");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await nav("Expenses");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await dialog.getByLabel("Description", { exact: true }).fill("Test delivery");
  await dialog.getByLabel("Amount (MUR)").fill("150");
  await dialog.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByText("Test delivery", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("search, blank invoice, void and demo reset", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page
    .locator(testInfo.project.name === "mobile" ? ".bottom-nav" : ".sidebar nav")
    .getByRole("button", { name: /Invoices/ })
    .click();
  await page.getByLabel("Search invoices").fill("nothing-matches");
  await expect(
    page.getByRole("heading", { name: "No invoices here yet" }),
  ).toBeVisible();
  await page.getByLabel("Search invoices").fill("OP-1003");
  await page.getByRole("button", { name: "View OP-1003" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Void", exact: true })
    .click();
  // Voiding now confirms in an Opervia dialog rather than a native confirm().
  const confirmVoid = page.getByRole("dialog", { name: /^Void OP-1003\?$/ });
  await expect(confirmVoid).toBeVisible();
  await confirmVoid.getByRole("button", { name: "Void invoice" }).click();
  await expect(page.locator(".print-toolbar .badge")).toHaveText("Void");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .locator(".demo-banner")
    .getByRole("button", { name: "Exit demo", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Explore the demo" }),
  ).toBeVisible();
});

test("a customer with no invoices can be deleted; one with invoices cannot", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  const nav = async (name: string) =>
    page
      .locator(
        testInfo.project.name === "mobile" ? ".bottom-nav" : ".sidebar nav",
      )
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .click();

  await nav("Customers");

  // A demo customer that already has invoices is protected.
  await page.getByRole("button", { name: /Sample Restaurant/ }).click();
  const existing = page.getByRole("dialog", { name: "Customer details" });
  await expect(existing.getByText(/stay on record/)).toBeVisible();
  await expect(
    existing.getByRole("button", { name: "Delete customer" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();

  // A newly added customer has no invoices, so it can be deleted.
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Customer name").fill("Temporary Trader");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByText("Temporary Trader")).toBeVisible();

  await page.getByRole("button", { name: /Temporary Trader/ }).click();
  await page.getByRole("button", { name: "Delete customer" }).click();

  const confirm = page.getByRole("dialog", { name: "Delete this customer?" });
  const remove = confirm.getByRole("button", { name: "Delete customer" });
  // The action stays locked until the name is typed exactly.
  await expect(remove).toBeDisabled();
  await confirm.getByRole("textbox").fill("Temporary");
  await expect(remove).toBeDisabled();
  await confirm.getByRole("textbox").fill("Temporary Trader");
  await expect(remove).toBeEnabled();
  await remove.click();

  await expect(page.getByText("Temporary Trader")).toHaveCount(0);
});
