import { test, expect } from "@playwright/test";

/**
 * An invoice is one sheet of paper. The blank sheet is the tight one — fourteen
 * ruled lines plus a fully filled-in business profile — and it used to spill its
 * footer onto a second, otherwise empty page, so the page count is asserted.
 */
const pageCount = (pdf: Buffer) =>
  (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

test("A4 blank and completed invoices produce printable PDFs", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "PDF export uses desktop Chromium.",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Sample Sole Trader");
  await page
    .getByLabel("Proprietor / registered person's name (optional)")
    .fill("Example Owner");
  await page
    .getByLabel("Business registration number (BRN)")
    .fill("TEST-INDIVIDUAL");
  await page.getByLabel("Business address").fill("Example Road, Vacoas");
  await page.getByLabel("Telephone", { exact: true }).fill("0000 0000");
  await page.getByLabel("Bank name", { exact: true }).fill("Example Bank");
  await page
    .getByLabel("Account holder name", { exact: true })
    .fill("Example Owner");
  await page
    .getByLabel("Bank account number", { exact: true })
    .fill("000012340000");
  await page.getByRole("button", { name: "Save details" }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Blank invoice", exact: true })
    .click();
  const blank = await page.pdf({
    path: "tmp/pdfs/blank-invoice.pdf",
    format: "A4",
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(pageCount(blank)).toBe(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "View OP-1001" }).click();
  await expect(page.locator(".paper-grand")).toContainText("1,365.00");
  const completed = await page.pdf({
    path: "tmp/pdfs/completed-invoice.pdf",
    format: "A4",
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(pageCount(completed)).toBe(1);
});
