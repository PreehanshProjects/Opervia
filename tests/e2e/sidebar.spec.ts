import { test, expect } from "@playwright/test";

/**
 * Sign-out lives at the foot of the sidebar, and PRODUCT.md is explicit that
 * signing out matters on a shared device. A laptop open at 620px tall has less
 * height than the sidebar's column wants, and the footer used to be cropped off
 * the bottom of the viewport with no way to scroll to it.
 */
const SIZES = [
  ["short laptop", 1280, 620],
  ["narrow and short", 1100, 620],
  ["roomy", 1440, 900],
  ["very short", 1280, 460],
] as const;

test("sign-out stays reachable however short the window", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "The sidebar is desktop-only.",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page.waitForSelector(".sidebar");

  for (const [label, width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await expect(
      page.locator(".sidebar-bottom .icon-button"),
      `${label}: sign-out visible`,
    ).toBeVisible();
    const m = await page.evaluate(() => {
      const box = (s: string) =>
        document.querySelector(s)!.getBoundingClientRect();
      const scroll = document.querySelector(".sidebar-scroll") as HTMLElement;
      const signOut = box(".sidebar-bottom .icon-button");
      return {
        signOutInView:
          signOut.top >= 0 && signOut.bottom <= window.innerHeight + 0.5,
        brandInView: box(".sidebar .brand").top >= 0,
        scrollsInsteadOfClipping:
          scroll.scrollHeight <= scroll.clientHeight ||
          getComputedStyle(scroll).overflowY === "auto",
      };
    });
    expect(m.signOutInView, `${label}: sign-out within the viewport`).toBe(
      true,
    );
    expect(m.brandInView, `${label}: brand stays pinned in view`).toBe(true);
    expect(m.scrollsInsteadOfClipping, `${label}: overflow scrolls`).toBe(true);
  }

  // The overflowing part actually scrolls, and keeps its scrolling to itself.
  await page.setViewportSize({ width: 1280, height: 620 });
  const scrolled = await page.evaluate(() => {
    const scroll = document.querySelector(".sidebar-scroll") as HTMLElement;
    scroll.scrollTop = 9999;
    return {
      moved: scroll.scrollTop,
      contained:
        getComputedStyle(scroll).overscrollBehavior.includes("contain"),
      signOutStillInView:
        document
          .querySelector(".sidebar-bottom .icon-button")!
          .getBoundingClientRect().bottom <=
        window.innerHeight + 0.5,
    };
  });
  expect(scrolled.moved).toBeGreaterThan(0);
  expect(scrolled.contained).toBe(true);
  expect(scrolled.signOutStillInView).toBe(true);
});
