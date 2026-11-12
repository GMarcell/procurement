import { expect, type Browser, type Page } from "@playwright/test";

export const PASSWORD = "password123";
export const LAPTOP = 'Laptop 14" Business';
export const LAPTOP_SKU = "IT-1001";
export const MOUSE = "Wireless Mouse";
export const MOUSE_SKU = "IT-1002";
export const VENDOR = "TechSource Distribution";

export const REQUESTER = "staff@procura.app";
export const SECOND_REQUESTER = "staff2@procura.app";
export const APPROVER = "manager@procura.app";
export const ADMIN = "admin@procura.app";

export async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("Welcome back")).toBeVisible();

  return page;
}

export async function selectByText(page: Page, selector: string, text: string) {
  const option = page.locator(`${selector} option`, { hasText: text }).first();
  const value = await option.getAttribute("value");
  if (!value) throw new Error(`No option containing "${text}" in ${selector}`);
  await page.selectOption(selector, value);
}

/** Read the on-hand quantity for a product from the inventory page. */
export async function readStock(page: Page, sku: string) {
  await page.goto(`/inventory?q=${sku}`);
  const row = page.locator("tbody tr", { hasText: sku }).first();
  await expect(row).toBeVisible();
  const onHand = await row.locator("td").nth(2).innerText();
  return Number(onHand.replace(/[^0-9]/g, ""));
}

/** The document number shown as the page title, e.g. PR-2026-0001. */
export async function documentNumber(page: Page) {
  return (await page.locator("h1").innerText()).trim();
}

/** Create a one-line request and return its detail URL. */
export async function createRequest(page: Page, purpose: string) {
  await page.goto("/purchase-requests/new");
  await page.selectOption("#department", "Operations");
  await page.fill("#purpose", purpose);
  await selectByText(page, "#product-1", LAPTOP);
  await page.fill("#qty-1", "1");
  await page.getByRole("button", { name: "Submit request" }).click();
  await page.waitForURL("**/purchase-requests/*?notice=*");
  return page.url().split("?")[0];
}

export async function approveRequest(page: Page, requestUrl: string) {
  await page.goto(requestUrl);
  await page.getByRole("button", { name: "Approve request" }).click();
  await page.waitForURL("**/purchase-requests/*?notice=*");
  await expect(page.getByText("Purchase request approved")).toBeVisible();
}

export async function rejectRequest(
  page: Page,
  requestUrl: string,
  reason: string,
) {
  await page.goto(requestUrl);
  await page.locator("summary", { hasText: "Reject request" }).click();
  await page.fill('textarea[name="reason"]', reason);
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await page.waitForURL("**/purchase-requests/*?notice=*");
  await expect(page.getByText("Purchase request rejected")).toBeVisible();
  await expect(page.getByText(reason)).toBeVisible();
}

/**
 * Assign the default vendor to an approved request and create a PO with the
 * suggested prices. Returns the purchase order detail URL.
 */
export async function assignVendorAndCreateOrder(
  admin: Page,
  requestUrl: string,
) {
  await admin.goto(requestUrl);
  await selectByText(admin, 'select[name="vendorId"]', VENDOR);
  await admin.getByRole("button", { name: "Assign vendor" }).click();
  await admin.waitForURL("**/purchase-requests/*?notice=*");
  await expect(admin.getByText(`${VENDOR} assigned`)).toBeVisible();

  await admin.getByRole("link", { name: "Create purchase order" }).click();
  await admin.waitForURL("**/purchase-orders/new?requestId=*");
  await admin.getByRole("button", { name: "Create purchase order" }).click();
  await admin.waitForURL("**/purchase-orders/*?notice=*");
  return admin.url().split("?")[0];
}

export async function approveOrder(page: Page, orderUrl: string) {
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "Approve order" }).click();
  await page.waitForURL("**/purchase-orders/*?notice=*");
  await expect(page.getByText("Purchase order approved")).toBeVisible();
}

export async function rejectOrder(
  page: Page,
  orderUrl: string,
  reason: string,
) {
  await page.goto(orderUrl);
  await page.locator("summary", { hasText: "Reject order" }).click();
  await page.fill('textarea[name="reason"]', reason);
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await page.waitForURL("**/purchase-orders/*?notice=*");
  await expect(page.getByText("Purchase order rejected")).toBeVisible();
  await expect(page.getByText(reason)).toBeVisible();
}

/** Raise a payment request on an approved PO. Returns its detail URL. */
export async function createPayment(admin: Page, orderUrl: string) {
  await admin.goto(orderUrl);
  await admin.getByRole("button", { name: "Submit payment request" }).click();
  await admin.waitForURL("**/payments/*?notice=*");
  return admin.url().split("?")[0];
}

export async function rejectPayment(
  page: Page,
  paymentUrl: string,
  reason: string,
) {
  await page.goto(paymentUrl);
  await page.locator("summary", { hasText: "Reject payment" }).click();
  await page.fill('textarea[name="reason"]', reason);
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await page.waitForURL("**/payments/*?notice=*");
  await expect(page.getByText("Payment request rejected")).toBeVisible();
  await expect(page.getByText(reason)).toBeVisible();
}
