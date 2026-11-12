import { expect, test } from "@playwright/test";
import {
  ADMIN,
  APPROVER,
  LAPTOP,
  LAPTOP_SKU,
  MOUSE,
  MOUSE_SKU,
  REQUESTER,
  VENDOR,
  readStock,
  selectByText,
  signIn,
} from "./helpers";

/**
 * End-to-end check of the full procure-to-pay flow.
 *
 * Prerequisites:
 *   1. The dedicated Postgres container is running.
 *   2. The database has been migrated and seeded (`npm run db:migrate && npm run db:seed`).
 *
 * Playwright starts the production build automatically. The test creates its own
 * request with a unique reference, so it can run repeatedly, but it does add
 * demo records to the database. Re-run `npm run db:seed` to restore the clean
 * demo state.
 */

test("request, approval, vendor, order, payment, and delivery update stock", async ({
  browser,
}) => {
  const run = Date.now().toString().slice(-6);
  const purpose = `E2E procurement flow ${run}`;
  const paymentNote = `E2E invoice ${run}`;
  const firstDeliveryNote = `DN-E2E-${run}-1`;
  const secondDeliveryNote = `DN-E2E-${run}-2`;

  let requestUrl = "";
  let orderUrl = "";
  let paymentUrl = "";
  let laptopBefore = 0;
  let mouseBefore = 0;

  const staff = await signIn(browser, REQUESTER);
  const manager = await signIn(browser, APPROVER);
  const admin = await signIn(browser, ADMIN);

  await test.step("requester submits a two-line purchase request", async () => {
    await staff.goto("/purchase-requests/new");
    await staff.selectOption("#department", "IT");
    await staff.fill("#purpose", purpose);

    await selectByText(staff, "#product-1", LAPTOP);
    await staff.fill("#qty-1", "2");

    await staff.getByRole("button", { name: "Add item" }).click();
    await selectByText(staff, "#product-2", MOUSE);
    await staff.fill("#qty-2", "3");

    await staff.getByRole("button", { name: "Submit request" }).click();
    await staff.waitForURL("**/purchase-requests/*?notice=*");
    requestUrl = staff.url().split("?")[0];

    await expect(staff.getByText("Request submitted for approval")).toBeVisible();
    await expect(staff.getByText(purpose)).toBeVisible();
    // 2 × $1,150.00 + 3 × $24.50
    await expect(staff.getByText("$2,373.50").first()).toBeVisible();
  });

  await test.step("approver approves the request", async () => {
    await manager.goto("/approvals");
    await expect(manager.getByText(purpose)).toBeVisible();

    await manager.goto(requestUrl);
    await manager.getByRole("button", { name: "Approve request" }).click();
    await manager.waitForURL("**/purchase-requests/*?notice=*");

    await expect(manager.getByText("Purchase request approved")).toBeVisible();
    await expect(manager.getByText("Request approved", { exact: true })).toBeVisible();
    await expect(manager.getByText(/Daniel Tan ·/)).toBeVisible();
  });

  await test.step("admin assigns a vendor and creates the purchase order", async () => {
    await admin.goto(requestUrl);
    await selectByText(admin, 'select[name="vendorId"]', VENDOR);
    await admin.fill('textarea[name="vendorNote"]', "E2E: fastest lead time");
    await admin.getByRole("button", { name: "Assign vendor" }).click();
    await admin.waitForURL("**/purchase-requests/*?notice=*");

    await expect(admin.getByText(`${VENDOR} assigned`)).toBeVisible();
    await expect(admin.getByText("Assigned vendor", { exact: true })).toBeVisible();
    await expect(admin.getByText("E2E: fastest lead time")).toBeVisible();

    await admin.getByRole("link", { name: "Create purchase order" }).click();
    await admin.waitForURL("**/purchase-orders/new?requestId=*");

    await admin.fill(
      `input[aria-label='Unit price for ${LAPTOP}']`,
      "1140",
    );
    await admin.fill(`input[aria-label="Unit price for ${MOUSE}"]`, "25");
    await admin.getByRole("button", { name: "Create purchase order" }).click();
    await admin.waitForURL("**/purchase-orders/*?notice=*");
    orderUrl = admin.url().split("?")[0];

    await expect(admin.getByText("Purchase order created and sent for approval")).toBeVisible();
    await expect(admin.getByText("Pending approval").first()).toBeVisible();
    // 2 × $1,140.00 + 3 × $25.00
    await expect(admin.getByText("$2,355.00").first()).toBeVisible();
  });

  await test.step("approver approves the purchase order", async () => {
    await manager.goto(orderUrl);
    await manager.getByRole("button", { name: "Approve order" }).click();
    await manager.waitForURL("**/purchase-orders/*?notice=*");

    await expect(manager.getByText("Purchase order approved")).toBeVisible();
    await expect(manager.getByText("Approved by Daniel Tan")).toBeVisible();

    // Payment and goods receipt are admin-only.
    await admin.goto(orderUrl);
    await expect(admin.getByText("Payment for")).toBeVisible();
    await expect(admin.getByText("Receive goods for")).toBeVisible();
  });

  await test.step("admin raises a payment request", async () => {
    await admin.fill("#payment-notes", paymentNote);
    await admin.getByRole("button", { name: "Submit payment request" }).click();
    await admin.waitForURL("**/payments/*?notice=*");
    paymentUrl = admin.url().split("?")[0];

    await expect(admin.getByText("Payment request submitted for approval")).toBeVisible();
    await expect(admin.getByText("$2,355.00").first()).toBeVisible();
    // Regression: payment notes must not leak into the delivery form.
    await expect(admin.getByText(paymentNote)).toBeVisible();
  });

  await test.step("approver approves the payment and admin marks it paid", async () => {
    await manager.goto(paymentUrl);
    await manager.getByRole("button", { name: "Approve payment" }).click();
    await manager.waitForURL("**/payments/*?notice=*");
    await expect(manager.getByText("Payment approved").first()).toBeVisible();

    await admin.goto(paymentUrl);
    await admin.getByRole("button", { name: "Mark as paid" }).click();
    await admin.waitForURL("**/payments/*?notice=*");
    await expect(admin.getByText("Payment recorded as paid")).toBeVisible();
    await expect(admin.getByText("Paid on")).toBeVisible();
  });

  await test.step("delivery guards reject empty and excessive receipts", async () => {
    laptopBefore = await readStock(admin, LAPTOP_SKU);
    mouseBefore = await readStock(admin, MOUSE_SKU);
    await admin.goto(orderUrl);

    await admin.getByRole("button", { name: "Record delivery" }).click();
    await expect(
      admin.getByText("Enter a received quantity for at least one line"),
    ).toBeVisible();

    const laptopInput = admin.locator(`input[aria-label='Quantity received for ${LAPTOP}']`);
    await laptopInput.fill("5");
    // The browser blocks values above the remaining quantity; remove the limit
    // to prove the server rejects an over-receipt as well.
    await laptopInput.evaluate((element) => element.removeAttribute("max"));
    await admin.getByRole("button", { name: "Record delivery" }).click();
    await expect(admin.getByText("only 2 remain")).toBeVisible();
  });

  await test.step("partial delivery updates status and stock", async () => {
    await admin.fill(`input[aria-label='Quantity received for ${LAPTOP}']`, "1");
    await admin.fill(`input[aria-label="Quantity received for ${MOUSE}"]`, "1");
    await admin.fill("#delivery-noteNo", firstDeliveryNote);
    await admin.fill("#delivery-notes", "E2E partial delivery");
    await admin.getByRole("button", { name: "Record delivery" }).click();
    await admin.waitForURL("**/purchase-orders/*?notice=*");

    await expect(
      admin.getByText(`Delivery ${firstDeliveryNote} recorded. Stock updated.`),
    ).toBeVisible();
    await expect(admin.getByText("Partially received").first()).toBeVisible();
    await expect(admin.getByText("E2E partial delivery")).toBeVisible();

    expect(await readStock(admin, LAPTOP_SKU)).toBe(laptopBefore + 1);
    expect(await readStock(admin, MOUSE_SKU)).toBe(mouseBefore + 1);
  });

  await test.step("final delivery completes the order and stock", async () => {
    await admin.goto(orderUrl);
    await admin.fill(`input[aria-label='Quantity received for ${LAPTOP}']`, "1");
    await admin.fill(`input[aria-label="Quantity received for ${MOUSE}"]`, "2");
    await admin.fill("#delivery-noteNo", secondDeliveryNote);
    await admin.getByRole("button", { name: "Record delivery" }).click();
    await admin.waitForURL("**/purchase-orders/*?notice=*");

    await expect(
      admin.getByText(`Delivery ${secondDeliveryNote} recorded. Stock updated.`),
    ).toBeVisible();
    await expect(admin.getByText("Completed").first()).toBeVisible();
    await expect(admin.getByText("All goods received")).toBeVisible();
    await expect(admin.getByText("2 delivery records").first()).toBeVisible();

    expect(await readStock(admin, LAPTOP_SKU)).toBe(laptopBefore + 2);
    expect(await readStock(admin, MOUSE_SKU)).toBe(mouseBefore + 3);
  });

  await test.step("the request shows its completed purchase order", async () => {
    await admin.goto(requestUrl);
    await expect(admin.getByText("Ordered", { exact: true }).first()).toBeVisible();
    await expect(admin.getByText(/View PO-\d{4}-\d{4}/)).toBeVisible();
  });
});
